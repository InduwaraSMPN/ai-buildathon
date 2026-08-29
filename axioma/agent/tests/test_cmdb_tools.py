from axel import tools


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
