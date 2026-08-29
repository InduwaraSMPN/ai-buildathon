from __future__ import annotations

from axel.pb import axioma_pb2 as pb
from axel.server import _priority, _worker_id


def test_worker_id_is_stable(tmp_path) -> None:
    path = tmp_path / "worker-id"
    assert _worker_id(path) == _worker_id(path)


def test_additive_proto_fields_and_priority() -> None:
    assert pb.AgentHello(worker_id="worker").worker_id == "worker"
    assert pb.DeviceHello(enrolment_code="code").enrolment_code == "code"
    assert pb.ToolRequest(source_step_ordinal=2).source_step_ordinal == 2
    update = pb.RunUpdate(
        evidence="observed",
        prompt_tokens=3,
        completion_tokens=2,
        model="provider/model",
        resolution_code="fixed",
    )
    assert (
        update.evidence,
        update.prompt_tokens,
        update.completion_tokens,
        update.model,
        update.resolution_code,
    ) == ("observed", 3, 2, "provider/model", "fixed")
    start = pb.StartRun(
        record_type="service_request", impact="high", urgency="medium", origin="monitoring"
    )
    assert (start.record_type, start.impact, start.urgency, start.origin) == (
        "service_request",
        "high",
        "medium",
        "monitoring",
    )
    assert _priority("high", "medium") == "P2"
