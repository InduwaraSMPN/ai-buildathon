from __future__ import annotations

import asyncio

import pytest

from axel.config import config
from axel.loop import Decision, RunStatus, StepKind, run
from tests.fixtures import FakeToolBus, ScriptedModel, call, context


async def test_unknown_invalid_and_malformed_decisions_recover() -> None:
    model = ScriptedModel(
        [
            call("missing.tool", {}),
            call("cluster_read_pods", {"namespace": "default"}),
            call("cluster_read_pods", {"namespace": "default", "extra": True}),
            call("cluster_read_pods", {"namespace": "default"}),
            Decision(kind="invalid", tool="cluster_read_pods", error="malformed JSON arguments"),
            call("cluster_read_pods", {"namespace": "default"}),
            Decision(kind="resolved", reasoning="Healthy now.", resolution="Recovered."),
        ]
    )
    ctx, bus, recorder = context(
        model, FakeToolBus({"cluster_read_pods": [{"pods": []}, {"pods": []}, {"pods": []}]})
    )

    result = await run(ctx)

    assert result.status is RunStatus.RESOLVED
    assert [name for name, _ in bus.calls] == ["cluster_read_pods"] * 3
    assert bus.source_step_ordinals == [4, 9, 13]
    errors = [step.error for step in recorder.steps if step.error]
    assert any("unknown tool" in error for error in errors)
    assert any("invalid input" in error and "extra" in error for error in errors)
    assert "malformed JSON arguments" in errors
    for assistant, tool_message in zip(ctx.transcript[1::2], ctx.transcript[2::2], strict=True):
        assert assistant["role"] == "assistant"
        assert tool_message["role"] == "tool"
        assert tool_message["tool_call_id"] == assistant["tool_calls"][0]["id"]


async def test_consecutive_failure_ceiling(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "max_consecutive_failures", 3, raising=False)
    model = ScriptedModel([call("missing.tool", {}) for _ in range(3)])
    ctx, bus, recorder = context(model)

    result = await run(ctx)

    assert result.status is RunStatus.EXHAUSTED
    assert result.outcome == "consecutive failure ceiling reached"
    assert bus.calls == []
    assert recorder.steps[-1].kind is StepKind.DECISION
    assert recorder.steps[-1].error == result.outcome


async def test_deadline_interrupts_hanging_tool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "run_deadline_seconds", 0.02)
    model = ScriptedModel([call("cluster_read_pods", {"namespace": "default"})])

    async def hangs(_name: str, _payload: dict, _source_step_ordinal: int = 0) -> object:
        await asyncio.Event().wait()
        raise AssertionError("unreachable")

    ctx, _, recorder = context(model)
    ctx.call_tool = hangs
    result = await run(ctx)

    assert result.status is RunStatus.EXHAUSTED
    assert result.outcome == "tool timed out at run deadline: cluster_read_pods"
    assert any(step.error == result.outcome for step in recorder.steps)


async def test_transcript_shape_truncation_and_usage(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "model_output_max_chars", 24, raising=False)
    model = ScriptedModel(
        [
            call(
                "cluster_read_pods",
                {"namespace": "default"},
                prompt_tokens=11,
                completion_tokens=3,
                model="provider/model-a",
            ),
            Decision(
                kind="resolved",
                reasoning="Evidence is sufficient.",
                resolution="Done.",
                prompt_tokens=17,
                completion_tokens=5,
                model="provider/model-b",
            ),
        ]
    )
    full_output = {"pods": [{"name": "pod-" + "x" * 100}]}
    ctx, _, recorder = context(model, FakeToolBus({"cluster_read_pods": full_output}))

    result = await run(ctx)

    assert (result.prompt_tokens, result.completion_tokens, result.model) == (
        28,
        8,
        "provider/model-b",
    )
    assert [message["role"] for message in model.transcripts[1]] == ["user", "assistant", "tool"]
    assistant, tool_message = model.transcripts[1][-2:]
    assert tool_message["tool_call_id"] == assistant["tool_calls"][0]["id"]
    assert "[truncated " in tool_message["content"]
    observation = next(step for step in recorder.steps if step.kind is StepKind.OBSERVATION)
    assert observation.tool_output == full_output
    assert "truncated" not in str(observation.tool_output)
