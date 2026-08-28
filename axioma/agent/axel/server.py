"""Outbound gRPC worker and process health endpoint."""

from __future__ import annotations

import asyncio
import json
import logging
import random
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import ClassVar

import grpc

from axel import __version__, model
from axel.config import config
from axel.loop import RunContext, Step, StepKind, run
from axel.pb import axioma_pb2 as pb
from axel.pb import axioma_pb2_grpc as pb_grpc

LOG = logging.getLogger(__name__)
_KIND = {
    StepKind.THINK: pb.RunUpdate.KIND_THINK,
    StepKind.TOOL_CALL: pb.RunUpdate.KIND_TOOL_CALL,
    StepKind.OBSERVATION: pb.RunUpdate.KIND_OBSERVATION,
    StepKind.DECISION: pb.RunUpdate.KIND_DECISION,
}


class HealthHandler(BaseHTTPRequestHandler):
    connected: ClassVar[asyncio.Event]

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self.send_error(404)
            return
        healthy = self.connected.is_set()
        body = b'{"status":"ok"}\n' if healthy else b'{"status":"disconnected"}\n'
        self.send_response(200 if healthy else 503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        LOG.debug(format, *args)


class Connection:
    def __init__(self) -> None:
        self.outbound: asyncio.Queue[pb.AgentMessage | None] = asyncio.Queue()
        self.pending: dict[str, asyncio.Future[object]] = {}
        self.runs: dict[str, asyncio.Task[None]] = {}

    async def requests(self):
        yield pb.AgentMessage(
            hello=pb.AgentHello(
                agent_version=__version__,
                model_label=config.model,
                capabilities=["tools", "run_updates", "cancel"],
            )
        )
        while (message := await self.outbound.get()) is not None:
            yield message

    async def handle(self, message: pb.ApiMessage) -> None:
        payload = message.WhichOneof("payload")
        if payload == "start_run":
            start = message.start_run
            if start.run_id in self.runs:
                LOG.warning("ignoring duplicate run %s", start.run_id)
                return
            task = asyncio.create_task(self.execute(start), name=f"run-{start.run_id}")
            self.runs[start.run_id] = task
            task.add_done_callback(lambda _task, run_id=start.run_id: self.runs.pop(run_id, None))
        elif payload == "tool_result":
            result = message.tool_result
            future = self.pending.pop(result.call_id, None)
            if future and not future.done():
                if result.ok:
                    try:
                        future.set_result(json.loads(result.output_json or "null"))
                    except json.JSONDecodeError as exc:
                        future.set_exception(ValueError(f"invalid tool result JSON: {exc}"))
                else:
                    future.set_exception(RuntimeError(result.error or "tool failed"))
        elif payload == "cancel_run":
            task = self.runs.get(message.cancel_run.run_id)
            if task:
                task.cancel(message.cancel_run.reason)
        elif payload == "heartbeat":
            await self.send_heartbeat()

    async def execute(self, start: pb.StartRun) -> None:
        ordinal = 0

        async def report(step: Step) -> None:
            nonlocal ordinal
            ordinal += 1
            await self.outbound.put(
                pb.AgentMessage(
                    run_update=pb.RunUpdate(
                        run_id=start.run_id,
                        ordinal=ordinal,
                        kind=_KIND[step.kind],
                        reasoning=step.reasoning or "",
                        tool_name=step.tool_name or "",
                        tool_input_json=_json(step.tool_input),
                        tool_output_json=_json(step.tool_output),
                        error=step.error or "",
                    )
                )
            )

        async def call_tool(name: str, payload: dict) -> object:
            call_id = uuid.uuid4().hex
            future = asyncio.get_running_loop().create_future()
            self.pending[call_id] = future
            await self.outbound.put(
                pb.AgentMessage(
                    tool_request=pb.ToolRequest(
                        run_id=start.run_id,
                        call_id=call_id,
                        tool_name=name,
                        input_json=json.dumps(payload, separators=(",", ":")),
                    )
                )
            )
            try:
                return await future
            finally:
                self.pending.pop(call_id, None)

        ticket = {
            "run_id": start.run_id,
            "ticket_id": start.ticket_id,
            "title": start.title,
            "body": start.body,
            "reporter_id": start.reporter_id,
            "device_id": start.device_id or None,
            "context": _loads(start.context_json),
        }
        ctx = RunContext(
            run_id=start.run_id,
            ticket_id=start.ticket_id,
            title=start.title,
            body=start.body,
            device_id=start.device_id or None,
            context_json=start.context_json,
            think=model.think,
            call_tool=call_tool,
            report=report,
            transcript=[{"role": "user", "content": json.dumps(ticket)}],
        )
        try:
            result = await run(ctx)
            status, outcome, error = result.status.value, result.outcome, ""
        except asyncio.CancelledError as exc:
            status, outcome, error = "failed", "run cancelled", str(exc) or "cancelled"
        except Exception as exc:  # noqa: BLE001
            LOG.exception("run %s failed", start.run_id)
            status, outcome, error = "failed", "agent run failed", str(exc)
        ordinal += 1
        await self.outbound.put(
            pb.AgentMessage(
                run_update=pb.RunUpdate(
                    run_id=start.run_id,
                    ordinal=ordinal,
                    kind=pb.RunUpdate.KIND_TERMINAL,
                    status=status,
                    outcome=outcome,
                    error=error,
                )
            )
        )

    async def send_heartbeat(self) -> None:
        await self.outbound.put(
            pb.AgentMessage(heartbeat=pb.Heartbeat(unix_ms=int(time.time() * 1000)))
        )

    async def heartbeat(self) -> None:
        while True:
            await asyncio.sleep(30)
            await self.send_heartbeat()

    async def close(self) -> None:
        for task in self.runs.values():
            task.cancel("connection lost")
        for future in self.pending.values():
            if not future.done():
                future.set_exception(ConnectionError("API connection lost"))
        if self.runs:
            await asyncio.gather(*self.runs.values(), return_exceptions=True)
        await self.outbound.put(None)


async def connect_forever(connected: asyncio.Event) -> None:
    delay = config.reconnect_base_seconds
    while True:
        connection = Connection()
        try:
            async with grpc.aio.insecure_channel(config.api_grpc_host) as channel:
                await asyncio.wait_for(channel.channel_ready(), timeout=10)
                stream = pb_grpc.AgentChannelStub(channel).Connect(connection.requests())
                heartbeat = asyncio.create_task(connection.heartbeat())
                connected.set()
                delay = config.reconnect_base_seconds
                async for message in stream:
                    await connection.handle(message)
        except asyncio.CancelledError:
            raise
        except grpc.aio.AioRpcError as exc:
            LOG.warning("API stream disconnected: %s", exc.code().name)
        except Exception:  # noqa: BLE001
            LOG.exception("API stream failed")
        finally:
            connected.clear()
            if "heartbeat" in locals():
                heartbeat.cancel()
                await asyncio.gather(heartbeat, return_exceptions=True)
                del heartbeat
            await connection.close()
        wait = min(delay, config.reconnect_cap_seconds)
        await asyncio.sleep(random.uniform(wait / 2, wait))
        delay = min(delay * 2, config.reconnect_cap_seconds)


def _json(value: object | None) -> str:
    return "" if value is None else json.dumps(value, default=str, separators=(",", ":"))


def _loads(value: str) -> object:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    connected = asyncio.Event()
    HealthHandler.connected = connected
    health = ThreadingHTTPServer(("", config.health_port), HealthHandler)
    health_task = asyncio.create_task(asyncio.to_thread(health.serve_forever))
    try:
        await connect_forever(connected)
    finally:
        health.shutdown()
        await health_task
        health.server_close()


if __name__ == "__main__":
    asyncio.run(main())
