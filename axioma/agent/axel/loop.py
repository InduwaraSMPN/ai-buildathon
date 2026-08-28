"""Axel: the agent loop.

Read, think, act, verify — bounded. The loop owns the sequence and the limits;
the model owns only what to try next. No verdict is taken from the model's
confidence, and nothing here executes a side effect: every tool call goes back
to the API, which owns persistence and every write.
"""

from __future__ import annotations

import json
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from enum import StrEnum

from pydantic import ValidationError

from axel import tools

# Ceilings on one run. Without these a confused agent loops and the ticket
# neither resolves nor escalates.
MAX_TOOL_CALLS = 20
MAX_MODEL_TURNS = 10
RUN_DEADLINE_SECONDS = 300


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


@dataclass(slots=True)
class RunResult:
    status: RunStatus
    outcome: str


@dataclass(slots=True)
class RunContext:
    run_id: str
    ticket_id: str
    title: str
    body: str
    device_id: str | None
    context_json: str

    # Ask the model what to do next. Returns a decision.
    think: Callable[[list[dict]], Awaitable[Decision]]
    # Send a tool request to the API and await its result.
    call_tool: Callable[[str, dict], Awaitable[object]]
    # Report a step upstream as it happens, so a hung run still shows progress.
    report: Callable[[Step], Awaitable[None]]

    clock: Callable[[], float] = time.monotonic
    transcript: list[dict] = field(default_factory=list)


@dataclass(slots=True)
class Decision:
    kind: str  # tool_call | resolved | escalate
    reasoning: str = ""
    tool: str | None = None
    tool_input: dict | None = None
    resolution: str = ""
    reason: str = ""
    proposal: dict | None = None


SYSTEM_PROMPT = """You are Axel, an IT support agent.

Given a ticket, gather evidence with read tools before acting. Act only when the
evidence identifies a specific cause and a specific fix. After any write, verify
with the read tool named by that write — a write returning success means the call
was accepted, not that the problem is fixed.

Prefer a typed action over driving a GUI. Computer-use is slow, non-deterministic,
and leaves you less able to say what changed; reach for it only after establishing
there is no API, CLI, or configuration path.

Escalate rather than act when the fix is a policy decision rather than a
correction. Changing a resource request, adding capacity, or anything whose right
answer depends on intent you do not have is a policy decision. Escalating with a
clear diagnosis is a good outcome, not a failure.

Select tools by name and supply typed parameters. You cannot compose commands."""


async def run(ctx: RunContext) -> RunResult:
    started = ctx.clock()
    tool_calls = 0

    for _turn in range(MAX_MODEL_TURNS):
        if ctx.clock() - started > RUN_DEADLINE_SECONDS:
            return await _exhausted(ctx, "run deadline exceeded")

        decision = await ctx.think(ctx.transcript)

        if decision.kind == "resolved":
            await ctx.report(Step(kind=StepKind.DECISION, reasoning=decision.reasoning))
            return RunResult(RunStatus.RESOLVED, decision.resolution)

        if decision.kind == "escalate":
            await ctx.report(
                Step(
                    kind=StepKind.DECISION,
                    reasoning=decision.reasoning,
                    tool_output=decision.proposal,
                )
            )
            return RunResult(RunStatus.ESCALATED, decision.reason)

        if tool_calls >= MAX_TOOL_CALLS:
            return await _exhausted(ctx, "tool call ceiling reached")

        tool = tools.resolve(decision.tool or "")
        if tool is None:
            # A model error, not a crash. Tell it, and let it retry inside budget.
            message = f"unknown tool: {decision.tool}"
            await ctx.report(
                Step(kind=StepKind.OBSERVATION, tool_name=decision.tool, error=message)
            )
            ctx.transcript.append({"role": "tool", "content": message})
            continue

        try:
            parsed = tool.schema_model.model_validate(decision.tool_input or {})
        except ValidationError as exc:
            message = f"invalid input: {exc}"
            await ctx.report(
                Step(
                    kind=StepKind.OBSERVATION,
                    tool_name=tool.name,
                    tool_input=decision.tool_input,
                    error=message,
                )
            )
            ctx.transcript.append({"role": "tool", "content": message})
            continue

        payload = parsed.model_dump(mode="json")
        await ctx.report(
            Step(
                kind=StepKind.TOOL_CALL,
                reasoning=decision.reasoning,
                tool_name=tool.name,
                tool_input=payload,
            )
        )
        tool_calls += 1

        try:
            output = await ctx.call_tool(tool.name, payload)
        except Exception as exc:  # noqa: BLE001 — any adapter failure is an observation
            message = f"tool failed: {exc}"
            await ctx.report(Step(kind=StepKind.OBSERVATION, tool_name=tool.name, error=message))
            ctx.transcript.append({"role": "tool", "content": message})
            continue

        await ctx.report(Step(kind=StepKind.OBSERVATION, tool_name=tool.name, tool_output=output))
        ctx.transcript.append({"role": "tool", "content": json.dumps(output, default=str)})

    return await _exhausted(ctx, "model turn ceiling reached")


async def _exhausted(ctx: RunContext, reason: str) -> RunResult:
    await ctx.report(Step(kind=StepKind.DECISION, error=reason))
    return RunResult(RunStatus.EXHAUSTED, reason)
