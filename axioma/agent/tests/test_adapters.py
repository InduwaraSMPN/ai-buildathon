from __future__ import annotations

from types import SimpleNamespace

import pytest

from axel import model


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
                                name="cluster.read_pods", arguments="{not-json"
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
