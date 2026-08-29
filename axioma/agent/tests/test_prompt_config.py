from __future__ import annotations

import re
from pathlib import Path

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
    )

    for expected in (
        "VPN cannot connect",
        "Started after lunch.\nExact body retained.",
        "service_request",
        "fulfil a pre-defined low-risk ask",
        "Impact: low; urgency: medium; derived priority: P4",
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
    for rule in (
        "gather evidence",
        "typed action",
        "policy decision",
        "IT staff and by the employee",
    ):
        assert rule in SYSTEM_PROMPT


def test_every_llm_tool_schema_is_strict_and_requires_reasoning() -> None:
    for definition in tools.as_llm_tools():
        parameters = definition["function"]["parameters"]
        assert parameters["additionalProperties"] is False
        assert "reasoning" in parameters["properties"]
        assert set(parameters["required"]) == set(parameters["properties"])


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


def test_run_limits_match_api() -> None:
    api_shared = Path(__file__).parents[2] / "api" / "src" / "shared" / "index.ts"
    source = api_shared.read_text(encoding="utf-8")
    limits = Config(_env_file=None)

    def integer(name: str) -> int:
        match = re.search(rf"{name}:\s*(\d+)", source)
        assert match, f"RUN_LIMITS.{name} missing"
        return int(match.group(1))

    assert limits.max_tool_calls == integer("maxToolCalls")
    assert limits.max_model_turns == integer("maxModelTurns")
    deadline = re.search(r"runDeadlineMs:\s*(\d+)\s*\*\s*(\d[\d_]*)", source)
    assert deadline, "RUN_LIMITS.runDeadlineMs missing"
    assert limits.run_deadline_seconds * 1000 == int(deadline.group(1)) * int(
        deadline.group(2).replace("_", "")
    )
