"""LiteLLM adapter for the agent loop."""

from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from typing import Any

import litellm

from axel import tools
from axel.config import config
from axel.loop import Decision
from axel.prompt import SYSTEM_PROMPT

log = logging.getLogger(__name__)

_DECISION_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "resolve_ticket",
            "description": "Finish when evidence shows the ticket is resolved.",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "reasoning": {"type": "string", "minLength": 1},
                    "resolution": {"type": "string", "minLength": 1},
                },
                "required": ["reasoning", "resolution"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_ticket",
            "description": "Escalate when a safe fix needs human intent or is unavailable.",
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": {
                    "reasoning": {"type": "string", "minLength": 1},
                    "reason": {"type": "string", "minLength": 1},
                    "proposal": {
                        "anyOf": [
                            {"type": "object", "additionalProperties": True},
                            {"type": "array", "items": {"type": "object"}},
                            {"type": "string"},
                            {"type": "null"},
                        ],
                        "description": (
                            "A concrete proposed remediation for the operator. For configuration "
                            "changes, provide before/after fields or an RFC 6902 patch."
                        ),
                    },
                },
                "required": ["reasoning", "reason", "proposal"],
                "additionalProperties": False,
            },
        },
    },
]


async def think(
    transcript: list[dict[str, Any]], *, deadline_seconds: float | None = None
) -> Decision:
    """Ask the configured model for one typed action before an absolute deadline."""
    messages = list(transcript)
    if not any(message.get("role") == "system" for message in messages):
        messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})

    deadline = None if deadline_seconds is None else time.monotonic() + deadline_seconds
    response, retry_events = await _completion(messages, deadline)
    message = response.choices[0].message
    usage = getattr(response, "usage", None)
    metadata = {
        "prompt_tokens": int(getattr(usage, "prompt_tokens", 0) or 0),
        "completion_tokens": int(getattr(usage, "completion_tokens", 0) or 0),
        "model": getattr(response, "model", None) or "",
        "retry_events": retry_events,
    }
    calls = list(getattr(message, "tool_calls", None) or [])
    if len(calls) != 1:
        return Decision(
            kind="invalid",
            error=f"model returned {len(calls)} tool calls; expected exactly one",
            **metadata,
        )

    call = calls[0]
    try:
        decision = _decision(call.function.name, call.function.arguments)
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        return Decision(
            kind="invalid",
            tool=call.function.name,
            tool_input={"raw_arguments": call.function.arguments},
            call_id=call.id,
            error=f"invalid model tool call {call.function.name}: {exc}",
            **metadata,
        )
    return Decision(
        kind=decision.kind,
        reasoning=decision.reasoning,
        tool=decision.tool,
        tool_input=decision.tool_input,
        resolution=decision.resolution,
        reason=decision.reason,
        proposal=decision.proposal,
        call_id=call.id,
        **metadata,
    )


async def _completion(
    messages: list[dict[str, Any]], deadline: float | None
) -> tuple[Any, list[str]]:
    warnings: list[str] = []
    strict = config.strict_function_calling
    attempt = 0
    while True:
        remaining = None if deadline is None else deadline - time.monotonic()
        if remaining is not None and remaining <= 0:
            raise TimeoutError("model deadline exceeded")
        kwargs: dict[str, Any] = {
            "model": config.model,
            "messages": messages,
            "tools": _llm_tools(strict=strict),
            "tool_choice": "required",
            "parallel_tool_calls": False,
            "api_base": config.api_base,
        }
        if config.api_key is not None:
            kwargs["api_key"] = config.api_key.get_secret_value()
        if config.reasoning_effort is not None:
            kwargs["reasoning_effort"] = config.reasoning_effort
        if config.temperature is not None:
            kwargs["temperature"] = config.temperature
        try:
            call = litellm.acompletion(**kwargs)
            return (
                await call if remaining is None else await asyncio.wait_for(call, remaining),
                warnings,
            )
        except Exception as exc:
            if strict and _strict_rejected(exc):
                strict = False
                warning = "provider rejected strict function calling; retrying once without strict"
                warnings.append(warning)
                log.warning(warning)
                continue
            if not _transient(exc) or attempt >= config.retry_attempts:
                raise
            delay = min(
                config.retry_base_seconds * 2**attempt + random.uniform(0, 0.25),
                config.retry_cap_seconds,
            )
            attempt += 1
            remaining = None if deadline is None else deadline - time.monotonic()
            if remaining is not None and delay >= remaining:
                raise TimeoutError("model retry deadline exceeded") from exc
            warnings.append(f"transient provider error; retrying in {delay:.2f}s: {exc}")
            await asyncio.sleep(delay)


def _llm_tools(*, strict: bool) -> list[dict[str, object]]:
    definitions = [*tools.as_llm_tools(strict=strict), *_DECISION_TOOLS]
    if strict:
        return definitions
    fallback = []
    for definition in definitions:
        function = {**definition["function"], "strict": False}
        fallback.append({**definition, "function": function})
    return fallback


def _decision(name: str, raw_arguments: str | dict[str, Any]) -> Decision:
    arguments = json.loads(raw_arguments) if isinstance(raw_arguments, str) else dict(raw_arguments)
    reasoning = arguments.pop("reasoning", "")
    if not isinstance(reasoning, str) or not reasoning.strip():
        reasoning = "Model selected this action without separate reasoning."
    if name == "resolve_ticket":
        resolution = arguments.get("resolution")
        if not isinstance(resolution, str) or not resolution.strip():
            raise ValueError("resolution must be a non-empty string")
        return Decision(kind="resolved", reasoning=reasoning, resolution=resolution)
    if name == "escalate_ticket":
        reason = arguments.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            reason = reasoning
        return Decision(
            kind="escalate",
            reasoning=reasoning,
            reason=reason,
            proposal=(
                {"description": arguments["proposal"]}
                if isinstance(arguments.get("proposal"), str)
                else {"patch": arguments["proposal"]}
                if isinstance(arguments.get("proposal"), list)
                else arguments.get("proposal")
                if isinstance(arguments.get("proposal"), dict)
                else None
            ),
        )
    tool = tools.resolve(name)
    return Decision(
        kind="tool_call",
        reasoning=reasoning,
        tool=tool.name if tool else name,
        tool_input=arguments,
    )


def _transient(exc: Exception) -> bool:
    status = getattr(exc, "status_code", None)
    return (
        status == 429
        or (isinstance(status, int) and status >= 500)
        or type(exc).__name__
        in {
            "APIConnectionError",
            "InternalServerError",
            "RateLimitError",
            "ServiceUnavailableError",
            "Timeout",
            "TimeoutError",
        }
    )


def _strict_rejected(exc: Exception) -> bool:
    if getattr(exc, "status_code", None) not in {400, 404, 422}:
        return False
    message = str(exc).lower()
    return (
        "strict" in message
        or "invalid_function_parameters" in message
        or "invalid schema for function" in message
        or "function" in message
        and "unsupported" in message
    )
