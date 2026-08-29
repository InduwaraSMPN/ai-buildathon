from __future__ import annotations

import pytest

from axel.config import config
from axel.loop import Decision, RunStatus, _evidence, run
from axel.prompt import build_user_prompt
from tests.fixtures import FakeToolBus, ScriptedModel, call, context


async def test_multiple_writes_each_require_matching_verification() -> None:
    model = ScriptedModel(
        [
            call(
                "cluster_patch_image",
                {"namespace": "shop", "name": "a", "container_index": 0, "image": "a:v2"},
            ),
            call(
                "cluster_patch_image",
                {"namespace": "shop", "name": "b", "container_index": 0, "image": "b:v2"},
            ),
            call("cluster_read_deployment", {"namespace": "shop", "name": "b"}),
            Decision(kind="resolved", reasoning="Only B checked.", resolution="Too early."),
            Decision(kind="resolved", reasoning="Still refusing.", resolution="Too early."),
        ]
    )
    ctx, _, _ = context(
        model,
        FakeToolBus(
            {
                "cluster_patch_image": [{"accepted": True}, {"accepted": True}],
                "cluster_read_deployment": {"name": "b"},
            }
        ),
    )
    result = await run(ctx)
    assert result.status is RunStatus.ESCALATED


async def test_tool_ceiling_does_not_leave_dangling_assistant_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(config, "max_tool_calls", 1)
    model = ScriptedModel(
        [
            call("cluster_read_pods", {"namespace": "default"}),
            call("cluster_read_pods", {"namespace": "default"}),
        ]
    )
    ctx, _, _ = context(model, FakeToolBus({"cluster_read_pods": {"pods": []}}))
    result = await run(ctx)
    assert result.outcome == "tool call ceiling reached"
    assert ctx.transcript[-1]["role"] == "tool"


def test_evidence_finds_decisive_nested_value_after_large_padding() -> None:
    message = "0/3 nodes are available: 3 Insufficient cpu"
    assert _evidence({"padding": "x" * 2000, "condition": {"message": message}}) == message


def test_prompt_accepts_top_level_observation_list() -> None:
    prompt = build_user_prompt(
        title="T",
        body="B",
        device_id=None,
        context_json='[{"observed_at":"2026-08-29","summary":"Known dependency"}]',
    )
    assert "[2026-08-29] Known dependency" in prompt
