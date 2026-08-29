from axel import tools
from axel.loop import Decision, RunStatus, run
from tests.fixtures import FakeToolBus, ScriptedModel, call, context


def test_cmdb_tool_shapes_are_typed() -> None:
    record = tools.CmdbRecordObservation(
        class_key="SoftwareInstance",
        external_id="deployment/demo/checkout",
        name="checkout",
        attributes={"version": "1.2.3"},
    )
    assert record.class_key == "SoftwareInstance"

    impact = tools.CmdbImpact(object_id="ci-1")
    assert impact.max_depth == 5
    assert tools.REGISTRY["cmdb_impact"].effect is tools.Effect.READ


async def test_cmdb_typed_failure_is_reported_and_recovered() -> None:
    failed = {
        "ok": False,
        "error": {
            "code": "unknown_property",
            "message": 'Class "SoftwareInstance" does not declare property "version"',
            "propertyKey": "version",
        },
    }
    model = ScriptedModel(
        [
            call(
                "cmdb_record_observation",
                {
                    "class_key": "SoftwareInstance",
                    "external_id": "deployment/demo/checkout",
                    "name": "checkout",
                    "attributes": {"version": "1.2.3"},
                },
            ),
            Decision(
                kind="resolved", reasoning="Recovered.", resolution="Skipped invalid property."
            ),
        ]
    )
    ctx, _, recorder = context(
        model,
        FakeToolBus(
            {
                "knowledge_search": {"items": []},
                "cmdb_record_observation": failed,
            }
        ),
    )

    result = await run(ctx)

    assert result.status is RunStatus.RESOLVED
    errors = [step.error for step in recorder.steps if step.error]
    assert any(error and "unknown_property" in error for error in errors)
    assert model.transcripts[1][-1]["role"] == "tool"
    assert "unknown_property" in model.transcripts[1][-1]["content"]
