from __future__ import annotations

import asyncio

import pytest

from axel import server, tools
from axel.config import config
from axel.loop import RunResult, RunStatus
from axel.pb import axioma_pb2 as pb


async def test_hello_reports_worker_and_registry_capabilities() -> None:
    connection = server.Connection("worker-1")
    messages = connection.requests()
    hello = (await anext(messages)).hello
    await messages.aclose()

    assert hello.worker_id == "worker-1"
    assert list(hello.capabilities) == sorted(tools.REGISTRY)


async def test_terminal_reports_provider_model(monkeypatch: pytest.MonkeyPatch) -> None:
    async def finished(_ctx):
        return RunResult(RunStatus.RESOLVED, "fixed", 7, 3, "provider/model")

    monkeypatch.setattr(server, "run", finished)
    connection = server.Connection("worker-1")
    await connection.execute(pb.StartRun(run_id="run-1", ticket_id="ticket-1", title="T", body="B"))

    terminal = await connection.outbound.get()
    assert terminal is not None
    assert terminal.run_update.model == "provider/model"
    assert (terminal.run_update.prompt_tokens, terminal.run_update.completion_tokens) == (7, 3)


async def test_gateway_heartbeat_is_not_echoed() -> None:
    connection = server.Connection("worker-1")
    await connection.handle(pb.ApiMessage(heartbeat=pb.Heartbeat(unix_ms=1)))
    assert connection.outbound.empty()


async def test_unknown_tool_result_warns(caplog: pytest.LogCaptureFixture) -> None:
    connection = server.Connection("worker-1")
    with caplog.at_level("WARNING"):
        await connection.handle(
            pb.ApiMessage(tool_result=pb.ToolResult(call_id="missing", ok=True, output_json="{}"))
        )
    assert "unknown call_id missing" in caplog.text


async def test_disconnect_retains_terminal_for_next_connection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started = asyncio.Event()

    async def running(_ctx):
        started.set()
        await asyncio.Event().wait()

    monkeypatch.setattr(server, "run", running)
    server._RETAINED_TERMINALS.clear()
    connection = server.Connection("worker-1")
    start = pb.StartRun(run_id="run-1", ticket_id="ticket-1", title="T", body="B")
    task = asyncio.create_task(connection.execute(start))
    connection.runs[start.run_id] = task
    await started.wait()
    await connection.close()

    assert task.cancelled()
    assert server._RETAINED_TERMINALS["run-1"].run_update.status == "failed"

    next_connection = server.Connection("worker-1")
    messages = next_connection.requests()
    await anext(messages)  # hello
    replay = await anext(messages)
    await messages.aclose()
    assert replay.run_update.run_id == "run-1"
    assert "run-1" not in server._RETAINED_TERMINALS


def test_pending_limit_is_configured() -> None:
    assert config.max_pending_calls > 0
