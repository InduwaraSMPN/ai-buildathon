"""Outbound gRPC worker and process health endpoint."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import signal
import time
import uuid
from collections import OrderedDict
from collections.abc import AsyncIterator
from contextlib import suppress
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import ClassVar

import grpc

from axel import __version__, tools
from axel.config import config
from axel.loop import RunContext, Step, StepKind, classify, run
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
_RETAINED_TERMINALS: OrderedDict[str, tuple[float, pb.AgentMessage]] = OrderedDict()


def _worker_id(path: Path | None = None) -> str:
    """Resolve this replica's worker ID.

    An explicit AXIOMA_WORKER_ID wins over the file. The Dockerfile tells
    operators to mount a volume over the config directory, so replicas sharing
    that volume otherwise all read the same ID and collapse into one entry in
    the API's registry.
    """
    if config.worker_id.strip():
        return config.worker_id.strip()
    path = path or config.config_dir / "worker-id"
    try:
        return str(uuid.UUID(path.read_text(encoding="utf-8").strip()))
    except (OSError, ValueError):
        pass
    worker_id = str(uuid.uuid4())
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        # O_EXCL so two replicas cold-starting together converge on one value:
        # the loser of the race reads the winner's ID rather than overwriting it.
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        try:
            os.write(descriptor, f"{worker_id}\n".encode())
        finally:
            os.close(descriptor)
    except FileExistsError:
        try:
            return str(uuid.UUID(path.read_text(encoding="utf-8").strip()))
        except (OSError, ValueError):
            return worker_id
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
        self.outbound: asyncio.Queue[pb.AgentMessage | None] = asyncio.Queue(
            maxsize=config.outbound_queue_size
        )
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
        if config.agent_token is not None:
            _set_if_present(hello, credential=config.agent_token.get_secret_value())
        yield pb.AgentMessage(hello=hello)
        _prune_retained_terminals()
        for _, message in list(_RETAINED_TERMINALS.values()):
            yield message
        while (message := await self.outbound.get()) is not None:
            yield message

    async def dispatch(self, message: pb.ApiMessage) -> None:
        """Handle one inbound message without risking the connection.

        Every concurrent run rides on this stream, so only a dead connection may
        propagate out of the read loop; anything else is this message's problem.
        """
        try:
            await self.handle(message)
        except ConnectionError:
            raise
        except Exception:  # noqa: BLE001
            LOG.exception("failed to handle %s message", message.WhichOneof("payload"))

    async def handle(self, message: pb.ApiMessage) -> None:
        payload = message.WhichOneof("payload")
        if payload == "start_run":
            start = message.start_run
            if start.run_id in self.runs:
                LOG.warning("ignoring duplicate run %s", start.run_id)
                return
            if len(self.runs) >= config.max_concurrent_runs:
                LOG.warning("rejecting run %s: concurrent run limit reached", start.run_id)
                await self._send(_rejected(start.run_id, "concurrent run limit reached"))
                return
            if self.closing:
                raise ConnectionError("API connection is closing")
            try:
                # Never block the read loop on the acknowledgement: a slow send
                # here delays every unrelated tool result behind it.
                self.outbound.put_nowait(
                    pb.AgentMessage(run_accepted=pb.RunAccepted(run_id=start.run_id))
                )
            except asyncio.QueueFull:
                LOG.warning("rejecting run %s: outbound queue full", start.run_id)
                await self._send(_rejected(start.run_id, "outbound queue full"))
                return
            task = asyncio.create_task(self.execute(start), name=f"run-{start.run_id}")
            self.runs[start.run_id] = task
            task.add_done_callback(
                lambda done, run_id=start.run_id: self._run_done(run_id, done)
            )
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
        elif payload == "terminal_ack":
            ack = message.terminal_ack
            retained = _RETAINED_TERMINALS.get(ack.run_id)
            if retained is not None and retained[1].run_update.ordinal == ack.ordinal:
                _RETAINED_TERMINALS.pop(ack.run_id, None)
        elif payload == "heartbeat":
            return

    def _run_done(self, run_id: str, task: asyncio.Task[None]) -> None:
        self.runs.pop(run_id, None)
        if not task.cancelled() and (exc := task.exception()) is not None:
            LOG.error("run %s task crashed", run_id, exc_info=(type(exc), exc, exc.__traceback__))

    async def _send(self, message: pb.AgentMessage) -> None:
        if (
            message.WhichOneof("payload") == "run_update"
            and message.run_update.kind == pb.RunUpdate.KIND_TERMINAL
        ):
            _retain_terminal(message.run_update.run_id, message)
        if self.closing:
            raise ConnectionError("API connection is closing")
        try:
            await asyncio.wait_for(
                self.outbound.put(message), timeout=config.outbound_enqueue_timeout_seconds
            )
        except TimeoutError as exc:
            self.closing = True
            while not self.outbound.empty():
                queued = self.outbound.get_nowait()
                if (
                    queued is not None
                    and queued.WhichOneof("payload") == "run_update"
                    and queued.run_update.kind == pb.RunUpdate.KIND_TERMINAL
                ):
                    _retain_terminal(queued.run_update.run_id, queued)
            self.outbound.put_nowait(None)
            raise ConnectionError("outbound gRPC queue remained full") from exc

    async def execute(self, start: pb.StartRun) -> None:
        ordinal = 0
        terminal_evidence = ""
        terminal_evidence_tone: str | None = None

        async def report(step: Step) -> int:
            nonlocal ordinal, terminal_evidence, terminal_evidence_tone
            ordinal += 1
            if step.evidence:
                terminal_evidence = step.evidence
                terminal_evidence_tone = step.evidence_tone
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
            _set_if_present(
                update,
                notice=step.notice,
                evidence=step.evidence,
                evidence_tone=step.evidence_tone,
            )
            await self._send(pb.AgentMessage(run_update=update))
            return ordinal

        async def call_tool(name: str, payload: dict, source_step_ordinal: int) -> object:
            if len(self.pending) >= config.max_pending_calls:
                raise RuntimeError("pending tool call limit reached")
            call_id = uuid.uuid4().hex
            future = asyncio.get_running_loop().create_future()
            # Registered inside the guard: a send that fails after registering
            # leaks the entry forever, and enough leaks retire the connection at
            # max_pending_calls.
            self.pending[call_id] = future
            try:
                await self._send(
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
        origin = _proto_value(start, "origin") or _metadata(metadata, "origin", default="portal")
        # Server-resolved target environment, rendered as fact. Read forward-compatibly
        # so an older binding without the field still yields "". Never inferred from
        # ticket prose — the API resolves it and the agent only carries it.
        environment = _proto_value(start, "environment") or _metadata(metadata, "environment")
        ctx = RunContext(
            run_id=start.run_id,
            ticket_id=start.ticket_id,
            title=start.title,
            body=start.body,
            device_id=start.device_id or None,
            context_json=start.context_json,
            think=_think,
            call_tool=call_tool,
            report=report,
            record_type=record_type,
            impact=impact,
            urgency=urgency,
            priority=priority,
            origin=origin,
            environment=environment or None,
            transcript=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_user_prompt(
                        title=start.title,
                        body=start.body,
                        device_id=start.device_id or None,
                        context_json=start.context_json,
                        reporter_name=start.reporter_name,
                        reporter_job_title=start.reporter_job_title,
                        reporter_department=start.reporter_department,
                        reporter_manager=start.reporter_manager,
                        record_type=record_type,
                        impact=impact,
                        urgency=urgency,
                        priority=priority,
                        origin=origin,
                        environment=environment or None,
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
            # The full text stays in the log: RunUpdate.error is read by IT staff
            # and by the employee, and an internal exception names internals.
            LOG.exception("run %s failed", start.run_id)
            status, outcome, error = "failed", "agent run failed", classify(exc)
        try:
            ordinal += 1
            update = pb.RunUpdate(
                run_id=start.run_id,
                ordinal=ordinal,
                kind=pb.RunUpdate.KIND_TERMINAL,
                status=status,
                outcome=outcome,
                error=error,
                resolution_code=getattr(result, "resolution_code", ""),
            )
            _set_if_present(
                update,
                prompt_tokens=getattr(result, "prompt_tokens", ctx.prompt_tokens),
                completion_tokens=getattr(result, "completion_tokens", ctx.completion_tokens),
                model=getattr(result, "model", ctx.model),
                evidence=terminal_evidence,
                evidence_tone=terminal_evidence_tone,
            )
            message = pb.AgentMessage(run_update=update)
            with suppress(ConnectionError):
                await self._send(message)
        except Exception:  # noqa: BLE001
            LOG.exception("failed to construct or queue terminal for run %s", start.run_id)
            raise
        if cancelled is not None:
            raise cancelled

    async def send_heartbeat(self) -> None:
        await self._send(pb.AgentMessage(heartbeat=pb.Heartbeat(unix_ms=int(time.time() * 1000))))

    async def heartbeat(self) -> None:
        """Beat until a send fails, then end.

        A silently dead heartbeat is a dead worker to the API — it times the
        worker out and stops dispatching while the stream stays open — so the
        failure is logged and the task returns for connect_forever to notice.
        """
        while True:
            await asyncio.sleep(config.heartbeat_interval_seconds)
            try:
                await self.send_heartbeat()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                LOG.exception("heartbeat failed; dropping the API connection")
                return

    async def close(self) -> None:
        self.closing = True
        # Cancelled, not failed: setting an exception on a future whose awaiting
        # run task is about to be cancelled leaves it unretrieved, and asyncio
        # logs "Future exception was never retrieved" at ERROR on every
        # disconnect.
        for future in self.pending.values():
            if not future.done():
                future.cancel()
        self.pending.clear()
        for task in self.runs.values():
            task.cancel("connection lost")
        if self.runs:
            await asyncio.gather(*self.runs.values(), return_exceptions=True)
        while not self.outbound.empty():
            queued = self.outbound.get_nowait()
            if (
                queued is not None
                and queued.WhichOneof("payload") == "run_update"
                and queued.run_update.kind == pb.RunUpdate.KIND_TERMINAL
            ):
                _retain_terminal(queued.run_update.run_id, queued)
        self.outbound.put_nowait(None)


def _channel_options() -> list[tuple[str, object]]:
    """Keepalive and message bounds for the API channel.

    Without keepalive a silently half-open connection wedges the worker forever:
    the read loop never returns, health still answers ok, and no supervisor
    restarts it. The length bounds make an oversize message fail here, with a
    clear error, instead of aborting the shared bidi call and taking every
    concurrent run with it.
    """
    options: list[tuple[str, object]] = [
        ("grpc.keepalive_time_ms", 20000),
        ("grpc.keepalive_timeout_ms", 10000),
        ("grpc.keepalive_permit_without_calls", 1),
        ("grpc.http2.max_pings_without_data", 0),
        ("grpc.max_send_message_length", config.grpc_max_message_bytes),
        ("grpc.max_receive_message_length", config.grpc_max_message_bytes),
    ]
    if config.api_grpc_server_name:
        options.append(("grpc.ssl_target_name_override", config.api_grpc_server_name))
    return options


async def _read_stream(
    connection: Connection,
    stream: AsyncIterator[pb.ApiMessage],
    connected: asyncio.Event,
    inbound: list[float],
) -> None:
    """Pump inbound messages, recording when each arrived.

    Health goes green on the first message and not before: a stream the API
    rejected is established locally but never answers, and reporting that as ok
    is how a worker stays in the pool while doing nothing.
    """
    async for message in stream:
        inbound[0] = time.monotonic()
        connected.set()
        await connection.dispatch(message)


async def _stream_watchdog(stream: object, inbound: list[float]) -> None:
    """Cancel a stream that has gone quiet.

    Keepalive catches a dead transport; this catches a live one that has stopped
    delivering. The API beats far faster than this, so three heartbeat intervals
    of silence is a wedged connection, not a lull.
    """
    limit = config.heartbeat_interval_seconds * 3
    while True:
        await asyncio.sleep(config.heartbeat_interval_seconds)
        idle = time.monotonic() - inbound[0]
        if idle >= limit:
            LOG.warning("no inbound API message in %.0fs; cancelling the stream", idle)
            cancel = getattr(stream, "cancel", None)
            if callable(cancel):
                cancel()
            return


async def connect_forever(connected: asyncio.Event) -> None:
    delay = config.reconnect_base_seconds
    worker_id = _worker_id()
    while True:
        connection = Connection(worker_id)
        tasks: set[asyncio.Task[None]] = set()
        connected_at: float | None = None
        try:
            roots = config.api_grpc_ca_file.read_bytes() if config.api_grpc_ca_file else None
            async with grpc.aio.secure_channel(
                config.api_grpc_host,
                grpc.ssl_channel_credentials(root_certificates=roots),
                options=_channel_options(),
            ) as channel:
                await asyncio.wait_for(channel.channel_ready(), timeout=10)
                stream = pb_grpc.AgentChannelStub(channel).Connect(connection.requests())
                connected_at = time.monotonic()
                inbound = [connected_at]
                tasks = {
                    asyncio.create_task(
                        _read_stream(connection, stream, connected, inbound), name="api-read"
                    ),
                    asyncio.create_task(connection.heartbeat(), name="api-heartbeat"),
                    asyncio.create_task(
                        _stream_watchdog(stream, inbound), name="api-watchdog"
                    ),
                }
                # Raced, not awaited in turn: a dead heartbeat has to tear the
                # connection down, or the API times the worker out and stops
                # dispatching while the stream sits there looking healthy.
                done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    if not task.cancelled() and (exc := task.exception()) is not None:
                        raise exc
        except asyncio.CancelledError:
            raise
        except grpc.aio.AioRpcError as exc:
            LOG.warning("API stream disconnected: %s", exc.code().name)
        except Exception:  # noqa: BLE001
            LOG.exception("API stream failed")
        finally:
            connected.clear()
            for task in tasks:
                task.cancel()
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            await connection.close()
        if (
            connected_at is not None
            and time.monotonic() - connected_at >= config.reconnect_stable_seconds
        ):
            delay = config.reconnect_base_seconds
        wait = min(delay, config.reconnect_cap_seconds)
        await asyncio.sleep(random.uniform(wait / 2, wait))
        delay = min(delay * 2, config.reconnect_cap_seconds)


async def _think(*args: object, **kwargs: object) -> object:
    from axel.model import think

    return await think(*args, **kwargs)


def _retain_terminal(run_id: str, message: pb.AgentMessage) -> None:
    _prune_retained_terminals()
    retained = _RETAINED_TERMINALS.get(run_id)
    if retained is not None and retained[1].run_update.ordinal >= message.run_update.ordinal:
        return
    _RETAINED_TERMINALS[run_id] = (time.monotonic(), message)
    _RETAINED_TERMINALS.move_to_end(run_id)
    while len(_RETAINED_TERMINALS) > config.retained_terminal_limit:
        _RETAINED_TERMINALS.popitem(last=False)


def _prune_retained_terminals() -> None:
    cutoff = time.monotonic() - config.retained_terminal_max_age_seconds
    for run_id, (retained_at, _) in list(_RETAINED_TERMINALS.items()):
        if retained_at >= cutoff:
            break
        _RETAINED_TERMINALS.pop(run_id, None)


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


def _rejected(run_id: str, error: str) -> pb.AgentMessage:
    return pb.AgentMessage(
        run_update=pb.RunUpdate(
            run_id=run_id,
            ordinal=1,
            kind=pb.RunUpdate.KIND_TERMINAL,
            status="failed",
            outcome="agent busy",
            error=error,
        )
    )


def _json(value: object | None) -> str:
    """Render a payload for the wire, bounded.

    _truncate bounds only the model-context copy, so an unbounded tool result
    reached the stream at full size: one oversize RunUpdate exceeds the API's
    gRPC receive limit, aborts the bidi call, and cancels every concurrent run.
    """
    if value is None:
        return ""
    rendered = json.dumps(value, default=str, separators=(",", ":"))
    limit = config.wire_output_max_chars
    if len(rendered) <= limit:
        return rendered
    return json.dumps(
        {
            "truncated": True,
            "dropped_characters": len(rendered) - limit,
            "output": rendered[:limit],
        },
        separators=(",", ":"),
    )


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
    worker = asyncio.create_task(connect_forever(connected), name="api-connection")
    # A rolling restart sends SIGTERM. Unhandled it kills the process outright:
    # connect_forever's finally and Connection.close() never run, in-flight runs
    # emit no terminal, and every retained-but-unacked terminal goes with it.
    with suppress(NotImplementedError):
        asyncio.get_running_loop().add_signal_handler(signal.SIGTERM, worker.cancel)
    try:
        with suppress(asyncio.CancelledError):
            await worker
    finally:
        health.shutdown()
        await health_task
        health.server_close()


if __name__ == "__main__":
    asyncio.run(main())
