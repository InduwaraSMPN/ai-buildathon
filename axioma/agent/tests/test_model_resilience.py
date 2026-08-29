from __future__ import annotations

from types import SimpleNamespace

import pytest

from axel import model
from axel.config import config


def response(
    *, name: str = "resolve_ticket", arguments: str = '{"reasoning":"done","resolution":"ok"}'
):
    return SimpleNamespace(
        model="provider/actual-model",
        usage=SimpleNamespace(prompt_tokens=4, completion_tokens=2),
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    tool_calls=[
                        SimpleNamespace(
                            id="call-1",
                            function=SimpleNamespace(name=name, arguments=arguments),
                        )
                    ]
                )
            )
        ],
    )


async def test_provider_options_usage_and_actual_model(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict = {}

    async def completion(**kwargs: object) -> object:
        captured.update(kwargs)
        return response()

    monkeypatch.setattr(model.litellm, "acompletion", completion)
    monkeypatch.setattr(config, "temperature", None)
    decision = await model.think([{"role": "user", "content": "ticket"}])

    assert captured["parallel_tool_calls"] is False
    assert "temperature" not in captured
    assert decision.model == "provider/actual-model"
    assert (decision.prompt_tokens, decision.completion_tokens) == (4, 2)


async def test_transient_error_retries_and_is_reported(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0

    class RateLimitError(Exception):
        status_code = 429

    async def completion(**_kwargs: object) -> object:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RateLimitError("busy")
        return response()

    async def no_sleep(_delay: float) -> None:
        return None

    monkeypatch.setattr(model.litellm, "acompletion", completion)
    monkeypatch.setattr(model.asyncio, "sleep", no_sleep)
    decision = await model.think([{"role": "user", "content": "ticket"}], deadline_seconds=10)

    assert calls == 2
    assert len(decision.retry_events) == 1
    assert "transient provider error" in decision.retry_events[0]


async def test_strict_rejection_falls_back_once(monkeypatch: pytest.MonkeyPatch) -> None:
    strict_values: list[bool] = []

    class SchemaError(Exception):
        status_code = 400

    async def completion(**kwargs: object) -> object:
        strict_values.append(kwargs["tools"][0]["function"]["strict"])
        if len(strict_values) == 1:
            raise SchemaError("strict function calling unsupported")
        return response()

    monkeypatch.setattr(model.litellm, "acompletion", completion)
    monkeypatch.setattr(model.config, "strict_function_calling", True)
    decision = await model.think([{"role": "user", "content": "ticket"}])
    next_decision = await model.think([{"role": "user", "content": "another ticket"}])

    assert decision.kind == next_decision.kind == "resolved"
    assert strict_values == [True, False, True]
    assert any("strict function calling" in event for event in decision.retry_events)
