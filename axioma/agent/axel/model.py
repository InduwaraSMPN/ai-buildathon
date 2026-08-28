"""LiteLLM adapter for the agent loop."""

from __future__ import annotations

import json
from typing import Any

import litellm

from axel import tools
from axel.config import config
from axel.loop import SYSTEM_PROMPT, Decision

_DECISION_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "resolve_ticket",
            "description": "Finish when evidence shows the ticket is resolved.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reasoning": {"type": "string"},
                    "resolution": {"type": "string"},
                },
                "required": ["reasoning", "resolution"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_ticket",
            "description": "Escalate when a safe fix needs human intent or is unavailable.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reasoning": {"type": "string"},
                    "reason": {"type": "string"},
                    "proposal": {"type": "object"},
                },
                "required": ["reasoning", "reason"],
            },
        },
    },
]


async def think(transcript: list[dict]) -> Decision:
    """Ask the configured model for exactly one typed next action."""
    if config.model == "demo":
        ticket = json.loads(transcript[0]["content"])
        if len(transcript) == 1:
            return Decision(
                kind="tool_call",
                reasoning="Read the device before deciding.",
                tool="device.read_state",
                tool_input={"device_id": ticket["device_id"], "facets": ["reachability"]},
            )
        return Decision(
            kind="resolved",
            reasoning="The device answered the reachability check.",
            resolution="Device reachability verified.",
        )

    response = await litellm.acompletion(
        model=config.model,
        temperature=config.temperature,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            *[
                {"role": "user" if item.get("role") == "tool" else item.get("role", "user"),
                 "content": item.get("content", "")}
                for item in transcript
            ],
        ],
        tools=[*tools.as_llm_tools(), *_DECISION_TOOLS],
        tool_choice="required",
    )
    message = response.choices[0].message
    calls = message.tool_calls or []
    if not calls:
        raise ValueError("model returned no tool call")
    return _decision(calls[0].function.name, calls[0].function.arguments)


def _decision(name: str, raw_arguments: str | dict[str, Any]) -> Decision:
    arguments = json.loads(raw_arguments) if isinstance(raw_arguments, str) else raw_arguments
    reasoning = str(arguments.pop("reasoning", ""))
    if name == "resolve_ticket":
        return Decision(kind="resolved", reasoning=reasoning, resolution=arguments["resolution"])
    if name == "escalate_ticket":
        return Decision(
            kind="escalate",
            reasoning=reasoning,
            reason=arguments["reason"],
            proposal=arguments.get("proposal"),
        )
    return Decision(kind="tool_call", reasoning=reasoning, tool=name, tool_input=arguments)
