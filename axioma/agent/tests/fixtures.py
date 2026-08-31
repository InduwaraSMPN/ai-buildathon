from __future__ import annotations

from collections import deque
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any

from axel.loop import Decision, Message, RunContext, Step


@dataclass
class ScriptedModel:
    decisions: list[Decision]
    transcripts: list[list[Message]] = field(default_factory=list)
    deadlines: list[float | None] = field(default_factory=list)

    def __post_init__(self) -> None:
        self._decisions = deque(self.decisions)

    async def __call__(
        self, transcript: list[Message], *, deadline_seconds: float | None = None
    ) -> Decision:
        self.transcripts.append(deepcopy(transcript))
        self.deadlines.append(deadline_seconds)
        if not self._decisions:
            raise AssertionError("scripted model exhausted")
        return self._decisions.popleft()


@dataclass
class FakeToolBus:
    outputs: dict[str, Any]
    calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)
    source_step_ordinals: list[int] = field(default_factory=list)

    def __post_init__(self) -> None:
        outputs = {
            "cmdb_record_observation": {"ok": True, "object_id": "ci-test"},
            **self.outputs,
        }
        self._outputs = {
            name: deque(value if isinstance(value, list) else [value])
            for name, value in outputs.items()
        }

    async def __call__(
        self, name: str, payload: dict[str, Any], source_step_ordinal: int
    ) -> object:
        self.calls.append((name, deepcopy(payload)))
        self.source_step_ordinals.append(source_step_ordinal)
        if name not in self._outputs or not self._outputs[name]:
            raise AssertionError(f"unexpected tool call: {name} {payload}")
        output = self._outputs[name].popleft()
        if isinstance(output, BaseException):
            raise output
        return output


@dataclass
class Recorder:
    steps: list[Step] = field(default_factory=list)

    async def __call__(self, step: Step) -> int:
        self.steps.append(step)
        return len(self.steps)


def context(
    model: ScriptedModel,
    bus: FakeToolBus | None = None,
    recorder: Recorder | None = None,
    **overrides: Any,
) -> tuple[RunContext, FakeToolBus, Recorder]:
    bus = bus or FakeToolBus({})
    recorder = recorder or Recorder()
    values = {
        "run_id": "run-1",
        "ticket_id": "ticket-1",
        "title": "Test ticket",
        "body": "Deterministic test body",
        "device_id": None,
        "context_json": "",
        "think": model,
        "call_tool": bus,
        "report": recorder,
        "transcript": [{"role": "user", "content": "ticket"}],
    }
    values.update(overrides)
    return RunContext(**values), bus, recorder


def cmdb_call() -> Decision:
    return call(
        "cmdb_record_observation",
        {
            "class_key": "SoftwareInstance",
            "external_id": "test/ci",
            "name": "Test CI",
            "attributes": {},
        },
        "Record the resolved state with provenance.",
    )


def call(
    tool: str,
    tool_input: dict[str, Any],
    reasoning: str = "Gather decisive evidence.",
    **usage: Any,
) -> Decision:
    return Decision(
        kind="tool_call", reasoning=reasoning, tool=tool, tool_input=tool_input, **usage
    )
