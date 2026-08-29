"""Axel's bounded read, think, act, and verify loop."""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Literal, TypedDict

from pydantic import ValidationError

from axel import tools
from axel.config import config


class SystemMessage(TypedDict):
    role: Literal["system"]
    content: str


class UserMessage(TypedDict):
    role: Literal["user"]
    content: str


class AssistantMessage(TypedDict):
    role: Literal["assistant"]
    content: str | None
    tool_calls: list[dict[str, Any]]


class ToolMessage(TypedDict):
    role: Literal["tool"]
    content: str
    tool_call_id: str


Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage


class RunStatus(StrEnum):
    RESOLVED = "resolved"
    ESCALATED = "escalated"
    FAILED = "failed"
    EXHAUSTED = "exhausted"


class StepKind(StrEnum):
    THINK = "think"
    TOOL_CALL = "tool_call"
    OBSERVATION = "observation"
    DECISION = "decision"


@dataclass(slots=True)
class Step:
    kind: StepKind
    reasoning: str | None = None
    tool_name: str | None = None
    tool_input: dict | None = None
    tool_output: object | None = None
    error: str | None = None
    evidence: str | None = None


@dataclass(slots=True)
class RunResult:
    status: RunStatus
    outcome: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""
    resolution_code: str = ""


@dataclass(slots=True)
class Decision:
    kind: str  # tool_call | resolved | escalate | invalid
    reasoning: str = ""
    tool: str | None = None
    tool_input: dict | None = None
    resolution: str = ""
    reason: str = ""
    proposal: dict | None = None
    call_id: str = ""
    error: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""
    retry_events: list[str] = field(default_factory=list)


@dataclass(slots=True)
class RunContext:
    run_id: str
    ticket_id: str
    title: str
    body: str
    device_id: str | None
    context_json: str
    think: Callable[..., Awaitable[Decision]]
    call_tool: Callable[[str, dict, int], Awaitable[object]]
    report: Callable[[Step], Awaitable[int]]
    record_type: str = "incident"
    impact: str = "medium"
    urgency: str = "medium"
    priority: str = "P3"
    origin: str = "portal"
    clock: Callable[[], float] = time.monotonic
    transcript: list[Message] = field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""


@dataclass(slots=True)
class PendingVerification:
    write: str
    verifier: str
    payload: dict[str, Any]


async def run(ctx: RunContext) -> RunResult:
    started = ctx.clock()
    model_turns = tool_calls = consecutive_failures = verification_rejections = 0
    pending: list[PendingVerification] = []
    last_evidence: str | None = None

    # Knowledge retrieval is deliberately a real first tool call so its query and
    # evidence remain replayable in the transcript rather than hidden in the prompt.
    knowledge_input = {"query": f"{ctx.title}\n{ctx.body}"[:500], "limit": 5}
    knowledge_call_id = uuid.uuid4().hex
    _append_call(
        ctx,
        knowledge_call_id,
        "knowledge_search",
        {"reasoning": "Check published knowledge before diagnosis.", **knowledge_input},
    )
    knowledge_ordinal = await ctx.report(
        Step(
            kind=StepKind.TOOL_CALL,
            reasoning="Check published knowledge before diagnosis.",
            tool_name="knowledge_search",
            tool_input=knowledge_input,
        )
    )
    try:
        remaining = config.run_deadline_seconds - (ctx.clock() - started)
        knowledge = await asyncio.wait_for(
            ctx.call_tool("knowledge_search", knowledge_input, knowledge_ordinal),
            timeout=max(0.001, remaining),
        )
        tool_calls += 1
        last_evidence = _evidence(knowledge) or last_evidence
        await ctx.report(
            Step(
                kind=StepKind.OBSERVATION,
                tool_name="knowledge_search",
                tool_output=knowledge,
                evidence=last_evidence,
            )
        )
        ctx.transcript.append(
            {
                "role": "tool",
                "tool_call_id": knowledge_call_id,
                "content": _truncate(json.dumps(knowledge, default=str, separators=(",", ":"))),
            }
        )
    except Exception as exc:  # noqa: BLE001
        await _failure(
            ctx, knowledge_call_id, "knowledge_search", f"tool failed: {exc}", knowledge_input
        )

    while model_turns < config.max_model_turns:
        remaining = config.run_deadline_seconds - (ctx.clock() - started)
        if remaining <= 0:
            return await _finish(ctx, RunStatus.EXHAUSTED, "run deadline exceeded")

        try:
            decision = await _think(ctx, remaining)
        except TimeoutError:
            return await _finish(
                ctx, RunStatus.EXHAUSTED, "run deadline exceeded during model call"
            )
        model_turns += 1
        ctx.prompt_tokens += decision.prompt_tokens
        ctx.completion_tokens += decision.completion_tokens
        ctx.model = decision.model or ctx.model
        for event in decision.retry_events:
            await ctx.report(Step(kind=StepKind.OBSERVATION, error=event))

        call_id = decision.call_id or uuid.uuid4().hex
        if decision.kind == "invalid":
            message = decision.error or "invalid model tool call"
            _append_call(
                ctx, call_id, decision.tool or "invalid_model_output", decision.tool_input or {}
            )
            await _failure(ctx, call_id, decision.tool, message)
            consecutive_failures += 1
            if consecutive_failures >= config.max_consecutive_failures:
                return await _finish(
                    ctx, RunStatus.EXHAUSTED, "consecutive failure ceiling reached"
                )
            continue

        if decision.kind == "resolved":
            if pending:
                names = ", ".join(f"{item.write} requires {item.verifier}" for item in pending)
                message = f"resolution rejected: verification pending ({names})"
                _append_call(
                    ctx,
                    call_id,
                    "resolve_ticket",
                    {"reasoning": decision.reasoning, "resolution": decision.resolution},
                )
                await _failure(ctx, call_id, "resolve_ticket", message)
                consecutive_failures += 1
                verification_rejections += 1
                if verification_rejections >= 2:
                    return await _finish(ctx, RunStatus.ESCALATED, message, evidence=last_evidence)
                continue
            await ctx.report(
                Step(kind=StepKind.DECISION, reasoning=decision.reasoning, evidence=last_evidence)
            )
            return _result(
                ctx,
                RunStatus.RESOLVED,
                decision.resolution,
                resolution_code=_resolution_code(decision.resolution),
            )

        if decision.kind == "escalate":
            await ctx.report(
                Step(
                    kind=StepKind.DECISION,
                    reasoning=decision.reasoning,
                    tool_output=decision.proposal,
                    evidence=last_evidence,
                )
            )
            return _result(ctx, RunStatus.ESCALATED, decision.reason)

        if decision.kind != "tool_call":
            _append_call(ctx, call_id, "invalid_model_output", {})
            await _failure(ctx, call_id, None, f"invalid decision kind: {decision.kind}")
            consecutive_failures += 1
            if consecutive_failures >= config.max_consecutive_failures:
                return await _finish(
                    ctx, RunStatus.EXHAUSTED, "consecutive failure ceiling reached"
                )
            continue

        if tool_calls >= config.max_tool_calls:
            return await _finish(ctx, RunStatus.EXHAUSTED, "tool call ceiling reached")
        _append_call(
            ctx,
            call_id,
            decision.tool or "",
            {"reasoning": decision.reasoning, **(decision.tool_input or {})},
        )
        await ctx.report(Step(kind=StepKind.THINK, reasoning=decision.reasoning))
        tool = tools.resolve(decision.tool or "")
        if tool is None:
            await _failure(ctx, call_id, decision.tool, f"unknown tool: {decision.tool}")
            consecutive_failures += 1
            if consecutive_failures >= config.max_consecutive_failures:
                return await _finish(
                    ctx, RunStatus.EXHAUSTED, "consecutive failure ceiling reached"
                )
            continue

        try:
            parsed = tool.schema_model.model_validate(decision.tool_input or {})
        except ValidationError as exc:
            await _failure(ctx, call_id, tool.name, f"invalid input: {exc}", decision.tool_input)
            consecutive_failures += 1
            if consecutive_failures >= config.max_consecutive_failures:
                return await _finish(
                    ctx, RunStatus.EXHAUSTED, "consecutive failure ceiling reached"
                )
            continue

        payload = parsed.model_dump(mode="json", exclude_none=True)
        source_step_ordinal = await ctx.report(
            Step(
                kind=StepKind.TOOL_CALL,
                reasoning=decision.reasoning,
                tool_name=tool.name,
                tool_input=payload,
            )
        )
        tool_calls += 1
        remaining = config.run_deadline_seconds - (ctx.clock() - started)
        if remaining <= 0:
            return await _finish(ctx, RunStatus.EXHAUSTED, "run deadline exceeded")
        try:
            output = await asyncio.wait_for(
                ctx.call_tool(tool.name, payload, source_step_ordinal), timeout=remaining
            )
        except TimeoutError:
            message = f"tool timed out at run deadline: {tool.name}"
            await _failure(ctx, call_id, tool.name, message, payload)
            return await _finish(ctx, RunStatus.EXHAUSTED, message)
        except Exception as exc:  # noqa: BLE001
            await _failure(ctx, call_id, tool.name, f"tool failed: {exc}", payload)
            consecutive_failures += 1
            if consecutive_failures >= config.max_consecutive_failures:
                return await _finish(
                    ctx, RunStatus.EXHAUSTED, "consecutive failure ceiling reached"
                )
            continue

        consecutive_failures = verification_rejections = 0
        evidence = _evidence(output)
        last_evidence = evidence or last_evidence
        await ctx.report(
            Step(
                kind=StepKind.OBSERVATION,
                tool_name=tool.name,
                tool_output=output,
                evidence=evidence,
            )
        )
        rendered = json.dumps(output, default=str, separators=(",", ":"))
        ctx.transcript.append(
            {"role": "tool", "tool_call_id": call_id, "content": _truncate(rendered)}
        )

        if tool.effect is tools.Effect.WRITE and tool.verified_by is not None:
            pending.append(PendingVerification(tool.name, tool.verified_by, payload))
        pending[:] = [
            obligation
            for obligation in pending
            if not (
                tool.name == obligation.verifier and _same_resource(obligation.payload, payload)
            )
        ]

    return await _finish(ctx, RunStatus.EXHAUSTED, "model turn ceiling reached")


async def _think(ctx: RunContext, remaining: float) -> Decision:
    try:
        return await asyncio.wait_for(
            ctx.think(ctx.transcript, deadline_seconds=remaining), timeout=remaining
        )
    except TypeError as exc:
        if "deadline_seconds" not in str(exc):
            raise
        return await asyncio.wait_for(ctx.think(ctx.transcript), timeout=remaining)


def _append_call(ctx: RunContext, call_id: str, name: str, arguments: dict[str, Any]) -> None:
    ctx.transcript.append(
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": call_id,
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": json.dumps(arguments, separators=(",", ":")),
                    },
                }
            ],
        }
    )


async def _failure(
    ctx: RunContext,
    call_id: str,
    tool_name: str | None,
    message: str,
    tool_input: dict | None = None,
) -> None:
    await ctx.report(
        Step(kind=StepKind.OBSERVATION, tool_name=tool_name, tool_input=tool_input, error=message)
    )
    ctx.transcript.append({"role": "tool", "tool_call_id": call_id, "content": message})


def _same_resource(write: dict[str, Any], read: dict[str, Any]) -> bool:
    shared = set(write) & set(read) - {
        "reasoning",
        "facets",
        "parameters",
        "timeout_seconds",
        "objective",
        "action",
        "image",
        "container_index",
    }
    return bool(shared) and all(write[key] == read[key] for key in shared)


def _truncate(text: str) -> str:
    limit = config.model_output_max_chars
    if len(text) <= limit:
        return text
    dropped = len(text) - limit
    marker = (
        f"[truncated {dropped} characters from model context; full output retained in transcript]"
    )
    return f"{text[:limit]}\n{marker}"


def _evidence(output: object) -> str | None:
    values: list[str] = []

    def collect(value: object) -> None:
        if isinstance(value, dict):
            for item in value.values():
                collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)
        elif value is not None:
            values.extend(line.strip() for line in str(value).splitlines() if line.strip())

    collect(output)
    needles = ("Insufficient cpu", "ImagePullBackOff", "Unschedulable", "error", "failed")
    matches = [
        value for value in values if any(needle.lower() in value.lower() for needle in needles)
    ]
    return max(matches, key=len)[:1000] if matches else (values[0][:1000] if values else None)


async def _finish(
    ctx: RunContext, status: RunStatus, outcome: str, *, evidence: str | None = None
) -> RunResult:
    await ctx.report(
        Step(
            kind=StepKind.DECISION,
            error=outcome if status is RunStatus.EXHAUSTED else None,
            reasoning=outcome if status is RunStatus.ESCALATED else None,
            evidence=evidence,
        )
    )
    return _result(ctx, status, outcome)


def _resolution_code(resolution: str) -> str:
    return "duplicate" if "duplicate" in resolution.casefold() else "fixed"


def _result(
    ctx: RunContext, status: RunStatus, outcome: str, *, resolution_code: str = ""
) -> RunResult:
    return RunResult(
        status,
        outcome,
        ctx.prompt_tokens,
        ctx.completion_tokens,
        ctx.model,
        resolution_code,
    )
