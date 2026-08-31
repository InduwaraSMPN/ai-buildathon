from __future__ import annotations

import asyncio

import pytest

from axel.config import config
from axel.loop import Decision, RunStatus, StepKind, run
from tests.fixtures import FakeToolBus, ScriptedModel, call, cmdb_call, context


async def test_knowledge_search_is_always_the_first_tool_call() -> None:
    ctx, bus, recorder = context(
        ScriptedModel(
            [cmdb_call(), Decision(kind="resolved", reasoning="Known fix.", resolution="Done.")]
        ),
        FakeToolBus({"knowledge_search": {"mode": "lexical", "items": []}}),
    )
    result = await run(ctx)
    assert result.status is RunStatus.RESOLVED
    assert bus.calls[0][0] == "knowledge_search"
    assert recorder.steps[0].tool_name == "knowledge_search"


async def test_unknown_invalid_and_malformed_decisions_recover() -> None:
    model = ScriptedModel(
        [
            call("missing.tool", {}),
            call("cluster_read_pods", {"namespace": "default"}),
            call("cluster_read_pods", {"namespace": "default", "extra": True}),
            call("cluster_read_pods", {"namespace": "default"}),
            Decision(kind="invalid", tool="cluster_read_pods", error="malformed JSON arguments"),
            call("cluster_read_pods", {"namespace": "default"}),
            cmdb_call(),
            Decision(kind="resolved", reasoning="Healthy now.", resolution="Recovered."),
        ]
    )
    ctx, bus, recorder = context(
        model, FakeToolBus({"cluster_read_pods": [{"pods": []}, {"pods": []}, {"pods": []}]})
    )
    result = await run(ctx)
    assert result.status is RunStatus.RESOLVED
    assert result.resolution_code == "fixed"
    assert [name for name, _ in bus.calls] == [
        "knowledge_search",
        *(["cluster_read_pods"] * 3),
        "cmdb_record_observation",
    ]
    assert bus.source_step_ordinals[0] == 1
    assert bus.source_step_ordinals[1:4] == [6, 11, 15]
    errors = [step.error for step in recorder.steps if step.error]
    assert any("unknown tool" in error for error in errors)
    assert any("invalid input" in error and "extra" in error for error in errors)
    assert "malformed JSON arguments" in errors
    for assistant, tool_message in zip(ctx.transcript[1::2], ctx.transcript[2::2], strict=True):
        assert assistant["role"] == "assistant"
        assert tool_message["role"] == "tool"
        assert tool_message["tool_call_id"] == assistant["tool_calls"][0]["id"]


async def test_explicit_duplicate_resolution_is_coded() -> None:
    ctx, _, _ = context(
        ScriptedModel(
            [
                cmdb_call(),
                Decision(
                    kind="resolved",
                    reasoning="Same incident.",
                    resolution="Duplicate ticket.",
                ),
            ]
        )
    )
    result = await run(ctx)
    assert result.resolution_code == "duplicate"


async def test_consecutive_failure_ceiling(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "max_consecutive_failures", 3, raising=False)
    ctx, bus, recorder = context(ScriptedModel([call("missing.tool", {}) for _ in range(3)]))
    result = await run(ctx)
    assert result.status is RunStatus.EXHAUSTED
    assert result.outcome == "consecutive failure ceiling reached"
    assert [name for name, _ in bus.calls] == ["knowledge_search"]
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
    assert result.outcome == "run deadline exceeded"
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
            cmdb_call(),
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
    assert [message["role"] for message in model.transcripts[1]] == [
        "user",
        "assistant",
        "tool",
        "assistant",
        "tool",
    ]
    assistant, tool_message = model.transcripts[1][-2:]
    assert tool_message["tool_call_id"] == assistant["tool_calls"][0]["id"]
    assert "[truncated " in tool_message["content"]
    observation = next(
        step
        for step in recorder.steps
        if step.kind is StepKind.OBSERVATION and step.tool_name == "cluster_read_pods"
    )
    assert observation.tool_output == full_output
    assert "truncated" not in str(observation.tool_output)


async def test_knowledge_fetch_is_bounded_in_model_context() -> None:
    full_body = "prefix-" + "x" * 5000 + "-decisive-tail"
    model = ScriptedModel(
        [
            call("knowledge_fetch", {"source": "article", "id": "kb-1"}),
            Decision(kind="escalate", reasoning="Read full item.", reason="Done."),
        ]
    )
    ctx, _, _ = context(
        model,
        FakeToolBus(
            {
                "knowledge_search": {"items": []},
                "knowledge_fetch": {"source": "article", "id": "kb-1", "body": full_body},
            }
        ),
    )
    await run(ctx)
    fetched = [item for item in model.transcripts[1] if item.get("role") == "tool"][-1]
    assert "decisive-tail" not in fetched["content"]
    assert "[truncated " in fetched["content"]


async def test_matching_known_error_result_is_recorded_for_citation() -> None:
    model = ScriptedModel(
        [
            cmdb_call(),
            Decision(
                kind="resolved",
                reasoning="Use PRB-42 VPN DNS failure.",
                resolution="Applied workaround from PRB-42 VPN DNS failure.",
            )
        ]
    )
    ctx, bus, recorder = context(
        model,
        FakeToolBus(
            {
                "knowledge_search": {
                    "mode": "lexical",
                    "items": [
                        {
                            "source": "known_error",
                            "reference": "PRB-42",
                            "title": "VPN DNS failure",
                            "workaround": "Flush DNS",
                        }
                    ],
                }
            }
        ),
    )
    result = await run(ctx)
    assert result.status is RunStatus.RESOLVED
    assert bus.calls[0][0] == "knowledge_search"
    assert any(step.tool_output and "PRB-42" in str(step.tool_output) for step in recorder.steps)
    assert "PRB-42" in result.outcome
