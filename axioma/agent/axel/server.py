"""Outbound gRPC worker and process health endpoint."""

from __future__ import annotations

import asyncio
import json
import logging
import random
import time
import uuid
from collections.abc import AsyncIterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import ClassVar

import grpc

from axel import __version__, model, tools
from axel.config import config
from axel.loop import RunContext, Step, StepKind, run
from axel.pb import axioma_pb2 as pb
from axel.pb import axioma_pb2_grpc as pb_grpc
from axel.prompt import SYSTEM_PROMPT, build_user_prompt

LOG = logging.getLogger(__name__)
_KIND = {
    StepKind.THINK: pb.RunUpdate.KIND_THINK,
    StepKind.TOOL_CALL: pb.RunUpdate.KIND_TOOL_CALL,
    StepKind.OBSERVATION: pb.RunUpdate.KIND_OBSERVATION,
    StepKind.DECISION: pb.RunUpdate.KIND_DECISION,
}
_RETAINED_TERMINALS: dict[str, pb.AgentMessage] = {}


def _worker_id(path: Path | None = None) -> str:
    path = path or config.config_dir / "worker-id"
    try:
        return str(uuid.UUID(path.read_text(encoding="utf-8").strip()))
    except (OSError, ValueError):
        worker_id = str(uuid.uuid4())
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f"{worker_id}\n", encoding="utf-8")
        except OSError as exc:
            raise RuntimeError(f"cannot persist worker ID at {path}: {exc}") from exc
        return worker_id


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
    def __init__(self, worker_id: str = "") -> None:
        self.worker_id = worker_id
        self.outbound: asyncio.Queue[pb.AgentMessage | None] = asyncio.Queue()
        self.pending: dict[str, asyncio.Future[object]] = {}
        self.runs: dict[str, asyncio.Task[None]] = {}
        self.closing = False

    async def requests(self) -> AsyncIterator[pb.AgentMessage]:
        hello = pb.AgentHello(
            agent_version=__version__,
            model_label=config.model,
            capabilities=sorted(tools.REGISTRY),
        )
        _set_if_present(hello, worker_id=self.worker_id)
        yield pb.AgentMessage(hello=hello)
        for run_id, message in list(_RETAINED_TERMINALS.items()):
            _RETAINED_TERMINALS.pop(run_id, None)
            yield message
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
            if future is None:
                LOG.warning("ignoring tool result for unknown call_id %s", result.call_id)
            elif not future.done():
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
            return

    async def execute(self, start: pb.StartRun) -> None:
        ordinal = 0
        terminal_evidence = ""

        async def report(step: Step) -> int:
            nonlocal ordinal, terminal_evidence
            ordinal += 1
            terminal_evidence = step.evidence or terminal_evidence
            update = pb.RunUpdate(
                run_id=start.run_id,
                ordinal=ordinal,
                kind=_KIND[step.kind],
                reasoning=step.reasoning or "",
                tool_name=step.tool_name or "",
                tool_input_json=_json(step.tool_input),
                tool_output_json=_json(step.tool_output),
                error=step.error or "",
            )
            _set_if_present(update, evidence=getattr(step, "evidence", None))
            await self.outbound.put(pb.AgentMessage(run_update=update))
            return ordinal

        async def call_tool(name: str, payload: dict, source_step_ordinal: int) -> object:
            if len(self.pending) >= config.max_pending_calls:
                raise RuntimeError("pending tool call limit reached")
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
                        source_step_ordinal=source_step_ordinal,
                    )
                )
            )
            try:
                return await future
            finally:
                self.pending.pop(call_id, None)

        context = _loads(start.context_json)
        metadata = context if isinstance(context, dict) else {}
        record_type = _proto_value(start, "record_type") or _metadata(
            metadata, "record_type", "recordType", default="incident"
        )
        impact = _proto_value(start, "impact") or _metadata(metadata, "impact", default="medium")
        urgency = _proto_value(start, "urgency") or _metadata(metadata, "urgency", default="medium")
        priority = (
            _proto_value(start, "priority")
            or _metadata(metadata, "priority")
            or _priority(impact, urgency)
        )
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
            record_type=record_type,
            impact=impact,
            urgency=urgency,
            priority=priority,
            transcript=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_user_prompt(
                        title=start.title,
                        body=start.body,
                        device_id=start.device_id or None,
                        context_json=start.context_json,
                        record_type=record_type,
                        impact=impact,
                        urgency=urgency,
                        priority=priority,
                    ),
                }
            ],
        )
        cancelled: asyncio.CancelledError | None = None
        result = None
        try:
            result = await run(ctx)
            status, outcome, error = result.status.value, result.outcome, ""
        except asyncio.CancelledError as exc:
            cancelled = exc
            status, outcome, error = "failed", "run cancelled", str(exc) or "cancelled"
        except Exception as exc:  # noqa: BLE001
            LOG.exception("run %s failed", start.run_id)
            status, outcome, error = "failed", "agent run failed", str(exc)
        ordinal += 1
        update = pb.RunUpdate(
            run_id=start.run_id,
            ordinal=ordinal,
            kind=pb.RunUpdate.KIND_TERMINAL,
            status=status,
            outcome=outcome,
            error=error,
        )
        if result is not None:
            _set_if_present(
                update,
                prompt_tokens=getattr(result, "prompt_tokens", None),
                completion_tokens=getattr(result, "completion_tokens", None),
                model=getattr(result, "model", None),
                evidence=terminal_evidence,
            )
        message = pb.AgentMessage(run_update=update)
        if self.closing:
            _RETAINED_TERMINALS[start.run_id] = message
        else:
            self.outbound.put_nowait(message)
        if cancelled is not None:
            raise cancelled

    async def send_heartbeat(self) -> None:
        await self.outbound.put(
            pb.AgentMessage(heartbeat=pb.Heartbeat(unix_ms=int(time.time() * 1000)))
        )

    async def heartbeat(self) -> None:
        while True:
            await asyncio.sleep(30)
            await self.send_heartbeat()

    async def close(self) -> None:
        self.closing = True
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
    worker_id = _worker_id()
    while True:
        connection = Connection(worker_id)
        heartbeat: asyncio.Task[None] | None = None
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
            if heartbeat is not None:
                heartbeat.cancel()
                await asyncio.gather(heartbeat, return_exceptions=True)
            await connection.close()
        wait = min(delay, config.reconnect_cap_seconds)
        await asyncio.sleep(random.uniform(wait / 2, wait))
        delay = min(delay * 2, config.reconnect_cap_seconds)


def _proto_value(message: object, name: str) -> str:
    return str(getattr(message, name, "") or "")


def _metadata(data: dict, *names: str, default: str = "") -> str:
    for source in (data, data.get("classification", {}), data.get("ticket", {})):
        if isinstance(source, dict):
            for name in names:
                value = source.get(name)
                if value is not None and str(value):
                    return str(value)
    return default


def _priority(impact: str, urgency: str) -> str:
    return {
        "high": {"high": "P1", "medium": "P2", "low": "P3"},
        "medium": {"high": "P2", "medium": "P3", "low": "P4"},
        "low": {"high": "P3", "medium": "P4", "low": "P4"},
    }.get(impact, {}).get(urgency, "P3")


def _json(value: object | None) -> str:
    return "" if value is None else json.dumps(value, default=str, separators=(",", ":"))


def _loads(value: str) -> object:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def _set_if_present(message: object, **values: object) -> None:
    """Set additive proto fields when bindings have caught up with the contract."""
    fields = message.DESCRIPTOR.fields_by_name  # type: ignore[attr-defined]
    for name, value in values.items():
        if name in fields and value is not None:
            setattr(message, name, value)


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    connected = asyncio.Event()
    HealthHandler.connected = connected
    health = ThreadingHTTPServer((config.health_host, config.health_port), HealthHandler)
    health_task = asyncio.create_task(asyncio.to_thread(health.serve_forever))
    try:
        await connect_forever(connected)
    finally:
        health.shutdown()
        await health_task
        health.server_close()


if __name__ == "__main__":
    asyncio.run(main())
