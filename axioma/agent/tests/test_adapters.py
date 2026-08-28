import asyncio

from axel.config import config
from axel.loop import Decision
from axel.model import _decision, think
from axel.pb import axioma_pb2 as pb
from axel.server import Connection


async def test_demo_model_reads_then_resolves() -> None:
    previous = config.model
    config.model = "demo"
    try:
        ticket = '{"device_id":"device-1"}'
        first = await think([{"role": "user", "content": ticket}])
        second = await think(
            [{"role": "user", "content": ticket}, {"role": "tool", "content": "{}"}]
        )
        assert first.tool == "device.read_state"
        assert first.tool_input == {"device_id": "device-1", "facets": ["reachability"]}
        assert second.kind == "resolved"
    finally:
        config.model = previous


def test_model_tool_call_maps_to_decision() -> None:
    assert _decision(
        "cluster.read_pods", '{"namespace":"default","reasoning":"inspect"}'
    ) == Decision(
        kind="tool_call",
        reasoning="inspect",
        tool="cluster.read_pods",
        tool_input={"namespace": "default"},
    )


async def test_tool_result_correlates_by_call_id() -> None:
    connection = Connection()
    future = asyncio.get_running_loop().create_future()
    connection.pending["call-1"] = future

    await connection.handle(
        pb.ApiMessage(
            tool_result=pb.ToolResult(
                call_id="call-1", ok=True, output_json='{"pods":[]}'
            )
        )
    )

    assert await future == {"pods": []}
    assert "call-1" not in connection.pending
