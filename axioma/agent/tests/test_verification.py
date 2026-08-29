from __future__ import annotations

from axel.loop import Decision, RunStatus, run
from tests.fixtures import FakeToolBus, ScriptedModel, call, context


async def test_verifier_must_read_same_resource() -> None:
    model = ScriptedModel(
        [
            call(
                "cluster_patch_image",
                {
                    "namespace": "shop",
                    "name": "checkout",
                    "container_index": 0,
                    "image": "checkout:v2",
                },
            ),
            call("cluster_read_deployment", {"namespace": "shop", "name": "catalog"}),
            Decision(
                kind="resolved", reasoning="Wrong deployment checked.", resolution="Premature."
            ),
            call("cluster_read_deployment", {"namespace": "shop", "name": "checkout"}),
            Decision(
                kind="resolved", reasoning="Correct deployment checked.", resolution="Verified."
            ),
        ]
    )
    bus = FakeToolBus(
        {
            "cluster_patch_image": {"accepted": True},
            "cluster_read_deployment": [
                {"name": "catalog", "image": "catalog:v1"},
                {"name": "checkout", "image": "checkout:v2"},
            ],
        }
    )
    ctx, bus, recorder = context(model, bus)

    result = await run(ctx)

    assert result.status is RunStatus.RESOLVED
    assert result.outcome == "Verified."
    assert any("verification pending" in (step.error or "") for step in recorder.steps)
    assert [
        payload["name"] for name, payload in bus.calls if name == "cluster_read_deployment"
    ] == ["catalog", "checkout"]


async def test_two_refused_verifications_escalate() -> None:
    model = ScriptedModel(
        [
            call(
                "device_run_action",
                {"device_id": "laptop-7", "action": "flush_dns", "parameters": {}},
            ),
            Decision(kind="resolved", reasoning="Trust the acknowledgement.", resolution="Done."),
            Decision(kind="resolved", reasoning="Still refusing the read.", resolution="Done."),
        ]
    )
    ctx, bus, recorder = context(
        model, FakeToolBus({"device_run_action": {"accepted": True}}), device_id="laptop-7"
    )

    result = await run(ctx)

    assert result.status is RunStatus.ESCALATED
    assert "device_run_action requires device_read_state" in result.outcome
    assert [name for name, _ in bus.calls] == ["device_run_action"]
    assert sum("verification pending" in (step.error or "") for step in recorder.steps) == 2
