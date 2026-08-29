from __future__ import annotations

import pytest

from axel import model, tools
from axel.config import Config
from axel.prompt import SYSTEM_PROMPT, build_user_prompt


def test_prompt_contains_ticket_classification_device_and_prior_observation() -> None:
    prompt = build_user_prompt(
        title="VPN cannot connect",
        body="Started after lunch.\nExact body retained.",
        device_id="laptop-7",
        context_json=(
            '{"observations":[{"observed_at":"2026-08-28T12:00:00Z",'
            '"observation":"Resolver health was degraded"}]}'
        ),
        record_type="service_request",
        impact="low",
        urgency="medium",
        priority="P4",
        origin="monitoring",
    )

    for expected in (
        "VPN cannot connect",
        "Started after lunch.\nExact body retained.",
        "service_request",
        "fulfil a pre-defined low-risk ask",
        "Impact: low; urgency: medium; derived priority: P4",
        "Origin: monitoring",
        "system-sourced, not an employee claim",
        "Device ID: laptop-7",
        "2026-08-28T12:00:00Z",
        "Resolver health was degraded",
        "prior observations, not established fact",
    ):
        assert expected in prompt


def test_prompt_renders_actual_cmdb_row_attributes() -> None:
    prompt = build_user_prompt(
        title="Repeat failure",
        body="The same deployment failed again.",
        device_id=None,
        context_json=(
            '[{"kind":"deployment","externalId":"deployment/demo/checkout",'
            '"name":"checkout","attributes":{"image":"nginx:broken"},'
            '"observedAt":"2026-08-28T12:00:00Z"}]'
        ),
    )
    assert "deployment/demo/checkout" in prompt
    assert "nginx:broken" in prompt


def test_prompt_states_missing_device_and_system_rules() -> None:
    prompt = build_user_prompt(title="Capacity", body="Pods pending", device_id=None)
    assert "Device ID: none provided; do not invent one." in prompt
    assert "Origin: portal — this ticket was submitted by an employee." in prompt
    for rule in (
        "gather evidence",
        "typed action",
        "policy decision",
        "IT staff and by the employee",
    ):
        assert rule in SYSTEM_PROMPT


def test_every_llm_tool_schema_is_strict_and_requires_reasoning() -> None:
    for definition in tools.as_llm_tools():
        assert "." not in definition["function"]["name"]
        parameters = definition["function"]["parameters"]
        assert parameters["additionalProperties"] is False
        assert "reasoning" in parameters["properties"]
        assert set(parameters["required"]) == set(parameters["properties"])


def test_knowledge_search_is_a_read_tool_and_prompt_requires_explicit_citation() -> None:
    tool = tools.resolve("knowledge_search")
    assert tool is not None
    assert tool.effect is tools.Effect.READ
    assert tool.schema_model.model_validate({"query": "VPN DNS failure"}).limit == 8
    assert tool.schema_model.model_validate({"query": "VPN DNS failure", "limit": 20})
    with pytest.raises(ValueError):
        tool.schema_model.model_validate({"query": "VPN DNS failure", "limit": 21})
    assert "call knowledge_search before exploratory" in SYSTEM_PROMPT
    assert "explicit tool call in the transcript" in SYSTEM_PROMPT
    assert "cite its identifier and title" in SYSTEM_PROMPT


def test_marketrix_defaults_and_completion_options(monkeypatch) -> None:
    settings = Config(_env_file=None, AXIOMA_LLM_KEY="secret")
    assert settings.model == "openai/gpt-5.6-terra"
    assert settings.api_base == "https://llm.marketrix.io/v1"
    assert settings.reasoning_effort == "max"

    monkeypatch.setattr(model, "config", settings)
    captured = {}

    async def completion(**kwargs):
        captured.update(kwargs)
        return type(
            "Response",
            (),
            {
                "choices": [
                    type(
                        "Choice",
                        (),
                        {
                            "message": type(
                                "Message",
                                (),
                                {
                                    "tool_calls": [
                                        type(
                                            "Call",
                                            (),
                                            {
                                                "id": "1",
                                                "function": type(
                                                    "Function",
                                                    (),
                                                    {
                                                        "name": "resolve_ticket",
                                                        "arguments": (
                                                            '{"reasoning":"done",'
                                                            '"resolution":"fixed"}'
                                                        ),
                                                    },
                                                )(),
                                            },
                                        )()
                                    ]
                                },
                            )()
                        },
                    )()
                ],
                "usage": None,
                "model": "gpt-5.6-terra",
            },
        )()

    monkeypatch.setattr(model.litellm, "acompletion", completion)
    import asyncio

    asyncio.run(model.think([{"role": "user", "content": "ticket"}]))
    assert captured["api_base"] == settings.api_base
    assert captured["api_key"] == "secret"
    assert captured["reasoning_effort"] == "max"
    assert "temperature" not in captured


def test_non_strict_fallback_does_not_require_optional_tool_fields() -> None:
    definitions = {item["function"]["name"]: item for item in tools.as_llm_tools(strict=False)}
    parameters = definitions["device_run_action"]["function"]["parameters"]
    assert "parameters" not in parameters["required"]
    assert set(parameters["required"]) == {"reasoning", "device_id", "action"}
