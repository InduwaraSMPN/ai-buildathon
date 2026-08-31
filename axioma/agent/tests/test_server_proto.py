from __future__ import annotations

from axel.pb import axioma_pb2 as pb
from axel.server import _priority, _proto_value, _worker_id


def test_worker_id_is_stable(tmp_path) -> None:
    path = tmp_path / "worker-id"
    assert _worker_id(path) == _worker_id(path)


def test_proto_value_reads_missing_field_forward_compatibly() -> None:
    # The bindings may lag the .proto (e.g. a field added on the API side first).
    # _proto_value must degrade to "" rather than raise, so the agent keeps working
    # against an older binding built before `environment` existed.
    class StaleBinding:
        ticket_id = "T-1"

    assert _proto_value(StaleBinding(), "environment") == ""
    assert _proto_value(StaleBinding(), "ticket_id") == "T-1"
    assert _proto_value(pb.StartRun(ticket_id="T-2", environment="prod"), "environment") == "prod"


def test_additive_proto_fields_and_priority() -> None:
    assert pb.AgentHello(worker_id="worker").worker_id == "worker"
    assert pb.DeviceHello(enrolment_token="token").enrolment_token == "token"
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
        record_type="service_request",
        impact="high",
        urgency="medium",
        origin="monitoring",
        environment="staging",
    )
    assert (start.record_type, start.impact, start.urgency, start.origin, start.environment) == (
        "service_request",
        "high",
        "medium",
        "monitoring",
        "staging",
    )
    assert _priority("high", "medium") == "P2"
