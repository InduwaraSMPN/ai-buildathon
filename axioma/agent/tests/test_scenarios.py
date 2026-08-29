from __future__ import annotations

from axel import tools
from axel.loop import Decision, RunStatus, StepKind, run
from tests.fixtures import FakeToolBus, ScriptedModel, call, context


async def test_scenario_1_repairs_image_then_verifies() -> None:
    model = ScriptedModel(
        [
            call("cluster.read_pods", {"namespace": "shop"}),
            call(
                "cluster.patch_image",
                {
                    "namespace": "shop",
                    "name": "checkout",
                    "container_index": 0,
                    "image": "checkout:v2",
                },
                "ImagePullBackOff identifies the bad image.",
            ),
            call("cluster.read_deployment", {"namespace": "shop", "name": "checkout"}),
            Decision(
                kind="resolved", reasoning="The rollout now uses v2.", resolution="Image corrected."
            ),
        ]
    )
    bus = FakeToolBus(
        {
            "cluster.read_pods": {"pods": [{"name": "checkout-1", "reason": "ImagePullBackOff"}]},
            "cluster.patch_image": {"accepted": True},
            "cluster.read_deployment": {"name": "checkout", "image": "checkout:v2", "available": 1},
        }
    )
    ctx, bus, recorder = context(model, bus)

    result = await run(ctx)

    assert result.status is RunStatus.RESOLVED
    assert [name for name, _ in bus.calls] == [
        "cluster.read_pods",
        "cluster.patch_image",
        "cluster.read_deployment",
    ]
    assert [step.kind for step in recorder.steps] == [
        StepKind.THINK,
        StepKind.TOOL_CALL,
        StepKind.OBSERVATION,
        StepKind.THINK,
        StepKind.TOOL_CALL,
        StepKind.OBSERVATION,
        StepKind.THINK,
        StepKind.TOOL_CALL,
        StepKind.OBSERVATION,
        StepKind.DECISION,
    ]


async def test_scenario_2_uses_typed_device_action_and_verifies() -> None:
    model = ScriptedModel(
        [
            call("device.read_state", {"device_id": "laptop-7", "facets": ["resolver"]}),
            call(
                "device.run_action",
                {"device_id": "laptop-7", "action": "flush_dns", "parameters": {}},
                "The resolver cache is stale, so use the typed action.",
            ),
            call("device.read_state", {"device_id": "laptop-7", "facets": ["resolver"]}),
            Decision(
                kind="resolved", reasoning="Resolver state is healthy.", resolution="DNS restored."
            ),
        ]
    )
    bus = FakeToolBus(
        {
            "device.read_state": [
                {"resolver": {"healthy": False, "message": "stale cache"}},
                {"resolver": {"healthy": True}},
            ],
            "device.run_action": {"accepted": True},
        }
    )
    ctx, bus, _ = context(model, bus, device_id="laptop-7")

    result = await run(ctx)

    assert result.status is RunStatus.RESOLVED
    assert [name for name, _ in bus.calls] == [
        "device.read_state",
        "device.run_action",
        "device.read_state",
    ]
    assert all(name != "device.computer_use" for name, _ in bus.calls)


async def test_scenario_3_escalates_capacity_policy_without_writes() -> None:
    scheduler_message = "0/3 nodes are available: 3 Insufficient cpu"
    model = ScriptedModel(
        [
            call("cluster.read_pods", {"namespace": "analytics"}),
            Decision(
                kind="escalate",
                reasoning="Unschedulable capacity requires owner intent.",
                reason="Capacity policy decision required.",
                proposal={
                    "scheduler_message": scheduler_message,
                    "description": '{"before":"cpu: 64","after":"cpu: 2"}',
                },
            ),
        ]
    )
    ctx, bus, recorder = context(
        model,
        FakeToolBus(
            {
                "cluster.read_pods": {
                    "pods": [
                        {
                            "phase": "Pending",
                            "reason": "Unschedulable",
                            "message": scheduler_message,
                        }
                    ]
                }
            }
        ),
    )

    result = await run(ctx)

    assert result.status is RunStatus.ESCALATED
    assert not {name for name, _ in bus.calls if tools.REGISTRY[name].effect is tools.Effect.WRITE}
    terminal = recorder.steps[-1]
    assert terminal.kind is StepKind.DECISION
    assert scheduler_message in (terminal.evidence or "")
    assert terminal.tool_output == {
        "scheduler_message": scheduler_message,
        "description": '{"before":"cpu: 64","after":"cpu: 2"}',
    }
