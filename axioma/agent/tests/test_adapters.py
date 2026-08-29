from __future__ import annotations

from types import SimpleNamespace

import pytest

from axel import model, tools
from axel.loop import RunContext, _append_call


async def test_malformed_model_arguments_become_recoverable_invalid_decision(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = SimpleNamespace(
        model="provider/model",
        usage=SimpleNamespace(prompt_tokens=7, completion_tokens=2),
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    tool_calls=[
                        SimpleNamespace(
                            id="call-bad",
                            function=SimpleNamespace(
                                name="cluster_read_pods", arguments="{not-json"
                            ),
                        )
                    ]
                )
            )
        ],
    )

    async def completion(**_kwargs: object) -> object:
        return response

    monkeypatch.setattr(model.litellm, "acompletion", completion)
    decision = await model.think([{"role": "user", "content": "ticket"}])

    assert decision.kind == "invalid"
    assert decision.call_id == "call-bad"
    assert "invalid model tool call" in decision.error
    assert (decision.prompt_tokens, decision.completion_tokens, decision.model) == (
        7,
        2,
        "provider/model",
    )


def test_model_tool_name_matches_registry_name() -> None:
    decision = model._decision(
        "cluster_read_pods",
        {"reasoning": "Inspect pods.", "namespace": "demo", "label_selector": None},
    )
    assert decision.tool == "cluster_read_pods"


def test_transcript_uses_registry_tool_name() -> None:
    context = RunContext(
        run_id="r",
        ticket_id="t",
        title="title",
        body="body",
        device_id=None,
        context_json="",
        think=None,  # type: ignore[arg-type]
        call_tool=None,  # type: ignore[arg-type]
        report=None,  # type: ignore[arg-type]
    )
    _append_call(context, "call", "cluster_read_pods", {"namespace": "demo"})
    assert context.transcript[0]["tool_calls"][0]["function"]["name"] == "cluster_read_pods"  # type: ignore[index]


def test_device_tool_cross_field_validation() -> None:
    with pytest.raises(ValueError, match="target is required"):
        tools.DeviceReadState(device_id="device", facets=["reachability"])
    with pytest.raises(ValueError, match="process_name is required"):
        tools.DeviceRunAction(device_id="device", action="restart_user_process")


def test_escalation_adapter_preserves_structured_proposal() -> None:
    decision = model._decision(
        "escalate_ticket",
        {
            "reasoning": "Capacity needs owner intent.",
            "reason": "Policy decision required.",
            "proposal": {"before": {"cpu": "64"}, "after": {"cpu": "2"}},
        },
    )
    assert decision.proposal == {"before": {"cpu": "64"}, "after": {"cpu": "2"}}
