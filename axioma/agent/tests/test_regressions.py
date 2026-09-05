from __future__ import annotations

import pytest

from axel import tools
from axel.config import config
from axel.loop import Decision, RunStatus, _evidence, _same_resource, run
from axel.prompt import build_user_prompt
from tests.fixtures import FakeToolBus, ScriptedModel, call, cmdb_call, context


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
    assert _evidence({"padding": "x" * 2000, "condition": {"message": message}}) == (
        message,
        "destructive",
    )


def test_evidence_scan_is_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    class WideList(list):
        def __getitem__(self, key):
            assert isinstance(key, slice) and key.stop == 2
            return super().__getitem__(key)

    monkeypatch.setattr(config, "evidence_scan_max_items", 3)
    assert _evidence(WideList(["first", "second", "failed beyond bound"])) == (
        "first",
        "success",
    )


def test_prompt_accepts_top_level_observation_list() -> None:
    prompt = build_user_prompt(
        title="T",
        body="B",
        device_id=None,
        context_json='[{"observed_at":"2026-08-29","summary":"Known dependency"}]',
    )
    assert "[2026-08-29] Known dependency" in prompt


async def test_forced_search_fetch_and_cmdb_writeback_fit_default_budget() -> None:
    assert config.max_tool_calls == 15
    assert config.max_model_turns == 14
    model = ScriptedModel(
        [
            call("knowledge_fetch", {"source": "article", "id": "kb-1"}),
            call(
                "cmdb_record_observation",
                {"class_key": "service", "external_id": "svc-1", "name": "Service"},
            ),
            Decision(kind="resolved", reasoning="Evidence recorded.", resolution="Done."),
        ]
    )
    ctx, bus, _ = context(
        model,
        FakeToolBus(
            {
                "knowledge_search": {"mode": "hybrid", "items": []},
                "knowledge_fetch": {"source": "article", "id": "kb-1", "body": "Full text"},
                "cmdb_record_observation": {"ok": True, "object_id": "ci-1"},
            }
        ),
    )
    result = await run(ctx)
    assert result.status is RunStatus.RESOLVED
    assert [name for name, _ in bus.calls] == [
        "knowledge_search",
        "knowledge_fetch",
        "cmdb_record_observation",
    ]
    assert len(bus.calls) < config.max_tool_calls


async def test_worst_case_infrastructure_fix_fits_the_tool_ceiling() -> None:
    """The longest path a successful run can take, pinned against the ceiling.

    ``max_tool_calls`` is ``max_model_turns + 1``: the forced knowledge search
    costs one call before the loop starts and the loop spends at most one per
    turn, so anything higher is dead configuration and anything lower cuts a real
    run short. This pins the mandatory sequence — forced knowledge search, a
    fetch, a read, a write, the read that discharges the write's verification
    obligation, and the CMDB observation the resolution gate requires — against
    that ceiling. A live infrastructure fix additionally re-reads pods after the
    patch, which is why the headroom asserted below is not zero: an eight-call run
    was observed exhausting a ceiling of 8 one call short of resolving. The
    endpoint path is longer again and is pinned separately below.
    """
    model = ScriptedModel(
        [
            call("knowledge_fetch", {"source": "known_error", "id": "kb-9"}),
            call("cluster_read_pods", {"namespace": "shop"}),
            call(
                "cluster_patch_image",
                {
                    "namespace": "shop",
                    "name": "checkout",
                    "container_index": 0,
                    "image": "checkout:v2",
                },
            ),
            call("cluster_read_deployment", {"namespace": "shop", "name": "checkout"}),
            cmdb_call(),
            Decision(
                kind="resolved",
                reasoning="Rollout is healthy and the observation is recorded.",
                resolution="Image tag corrected.",
            ),
        ]
    )
    ctx, bus, _ = context(
        model,
        FakeToolBus(
            {
                "knowledge_search": {"mode": "hybrid", "items": []},
                "knowledge_fetch": {"source": "known_error", "id": "kb-9"},
                "cluster_read_pods": {"items": [{"name": "checkout-1"}]},
                "cluster_patch_image": {"accepted": True},
                "cluster_read_deployment": {"name": "checkout", "readyReplicas": 1},
            }
        ),
    )
    result = await run(ctx)
    assert result.status is RunStatus.RESOLVED
    assert [name for name, _ in bus.calls] == [
        "knowledge_search",
        "knowledge_fetch",
        "cluster_read_pods",
        "cluster_patch_image",
        "cluster_read_deployment",
        "cmdb_record_observation",
    ]
    assert len(bus.calls) == 6
    # Headroom over the mandatory sequence. The observed live path spends two of
    # these on a knowledge fetch and a post-patch pods read.
    assert config.max_tool_calls - len(bus.calls) >= 4


async def test_worst_case_endpoint_fix_fits_the_tool_ceiling() -> None:
    """The endpoint path, which is what the ceiling is actually sized for.

    Unlike a cluster patch, a named device action can be the wrong one without
    anything having gone wrong: the agent picks the narrowest action that fits
    the symptom, verifies, and only then reaches for the broader one. Each
    attempt costs the action and the read that discharges its verification
    obligation, so two cycles plus the state reads and the mandatory CMDB
    observation come to nine calls. A live run of exactly this shape ended on
    the turn ceiling of 11 having already applied the fix, leaving the ticket
    open and nothing recorded, which is what this pins.
    """
    device = "device-1"
    model = ScriptedModel(
        [
            call("device_read_state", {"device_id": device, "facets": ["proxy"]}),
            call(
                "device_run_action",
                {
                    "device_id": device,
                    "action": "clear_proxy_override",
                    "parameters": {},
                },
            ),
            call("device_read_state", {"device_id": device, "facets": ["proxy"]}),
            call(
                "device_run_action",
                {"device_id": device, "action": "disable_proxy", "parameters": {}},
            ),
            call("device_read_state", {"device_id": device, "facets": ["proxy"]}),
            call(
                "device_read_state",
                {
                    "device_id": device,
                    "facets": ["reachability"],
                    "target": "intranet.example",
                },
            ),
            call("knowledge_fetch", {"source": "article", "id": "kb-2"}),
            cmdb_call(),
            Decision(
                kind="resolved",
                reasoning="The proxy is off and the intranet resolves.",
                resolution="Disabled the stale WinINET proxy.",
            ),
        ]
    )
    ctx, bus, _ = context(
        model,
        FakeToolBus(
            {
                "knowledge_search": {"mode": "hybrid", "items": []},
                "knowledge_fetch": {"source": "article", "id": "kb-2", "body": "Full text"},
                # One entry per call: the bus hands each out once.
                "device_read_state": [
                    {"proxy": {"ok": True, "data": {"enabled": True}}},
                    {"proxy": {"ok": True, "data": {"enabled": True}}},
                    {"proxy": {"ok": True, "data": {"enabled": False}}},
                    {"reachability": {"ok": True, "data": {"resolved": True}}},
                ],
                "device_run_action": [{"ok": True}, {"ok": True}],
                "cmdb_record_observation": {"ok": True, "object_id": "ci-1"},
            }
        ),
        device_id=device,
    )
    result = await run(ctx)
    assert result.status is RunStatus.RESOLVED
    assert len(bus.calls) == 9
    assert len(bus.calls) <= config.max_tool_calls


def test_same_resource_requires_matching_authoritative_environment() -> None:
    write = {
        "namespace": "shop",
        "name": "checkout",
        "container_index": 0,
        "image": "checkout:v2",
        "environment": "prod",
    }
    # A read of the same object in a different environment must not discharge the
    # write's verification obligation.
    assert not _same_resource(
        write,
        {"namespace": "shop", "name": "checkout", "environment": "staging"},
        "prod",
    )
    # A write+read pair agreeing on any environment OTHER than the run's must not
    # discharge either — the run's resolved environment is authoritative.
    assert not _same_resource(
        {"namespace": "shop", "name": "checkout", "environment": "xyz"},
        {"namespace": "shop", "name": "checkout", "environment": "xyz"},
        "prod",
    )
    assert _same_resource(
        write,
        {"namespace": "shop", "name": "checkout", "environment": "prod"},
        "prod",
    )
    # Without a resolved run environment, the plain resource match still pairs.
    assert _same_resource(
        write,
        {"namespace": "shop", "name": "checkout"},
    )


def test_cluster_tool_models_accept_optional_environment() -> None:
    read_pods = tools.ClusterReadPods(namespace="default")
    assert read_pods.environment is None
    assert tools.ClusterReadPods(namespace="default", environment="prod").environment == "prod"
    assert (
        tools.ClusterReadDeployment(namespace="shop", name="a", environment="staging").environment
        == "staging"
    )
    assert (
        tools.ClusterPatchImage(
            namespace="shop", name="a", container_index=0, image="a:v2", environment="prod"
        ).environment
        == "prod"
    )
    with pytest.raises(ValueError):
        tools.ClusterReadDeployment(namespace="shop", name="a", environment="")


async def test_server_resolved_environment_is_defaulted_into_cluster_calls() -> None:
    model = ScriptedModel(
        [
            # environment omitted -> defaulted to the run's resolved "prod"
            call("cluster_read_pods", {"namespace": "default"}),
            Decision(kind="escalate", reasoning="Done.", reason="Done."),
        ]
    )
    ctx, bus, _ = context(
        model,
        FakeToolBus({"knowledge_search": {"items": []}, "cluster_read_pods": {"pods": []}}),
        environment="prod",
    )

    result = await run(ctx)

    assert result.status is RunStatus.ESCALATED
    assert [p for n, p in bus.calls if n == "cluster_read_pods"][0]["environment"] == "prod"


async def test_model_chosen_environment_is_preserved_over_server_default() -> None:
    # The model names a different environment than the run's resolved one. It is
    # kept as-is (the API authorizes any mismatch), not overwritten server-side.
    model = ScriptedModel(
        [
            call("cluster_read_pods", {"namespace": "default", "environment": "staging"}),
            Decision(kind="escalate", reasoning="Done.", reason="Done."),
        ]
    )
    ctx, bus, _ = context(
        model,
        FakeToolBus({"knowledge_search": {"items": []}, "cluster_read_pods": {"pods": []}}),
        environment="prod",
    )

    result = await run(ctx)

    assert result.status is RunStatus.ESCALATED
    assert [p for n, p in bus.calls if n == "cluster_read_pods"][0]["environment"] == "staging"


async def test_omitted_write_environment_is_not_discharged_by_different_read() -> None:
    # Run env "prod". The write omits environment (defaulted to prod). The model
    # then reads the deployment explicitly naming "staging": that read must NOT
    # clear the write's verification obligation, so the run cannot resolve until a
    # same-environment read happens.
    model = ScriptedModel(
        [
            call(
                "cluster_patch_image",
                {
                    "namespace": "shop",
                    "name": "checkout",
                    "container_index": 0,
                    "image": "checkout:v2",
                },
            ),
            call(
                "cluster_read_deployment",
                {"namespace": "shop", "name": "checkout", "environment": "staging"},
            ),
            Decision(kind="resolved", reasoning="Checked staging.", resolution="Premature."),
            call("cluster_read_deployment", {"namespace": "shop", "name": "checkout"}),
            cmdb_call(),
            Decision(kind="resolved", reasoning="Checked prod.", resolution="Verified."),
        ]
    )
    bus = FakeToolBus(
        {
            "cluster_patch_image": {"accepted": True},
            "cluster_read_deployment": [
                {"name": "checkout", "environment": "staging", "image": "checkout:v1"},
                {"name": "checkout", "environment": "prod", "image": "checkout:v2"},
            ],
        }
    )
    ctx, bus, recorder = context(model, bus, environment="prod")

    result = await run(ctx)

    assert result.status is RunStatus.RESOLVED
    assert result.outcome == "Verified."
    assert any("verification pending" in (step.error or "") for step in recorder.steps)
    assert [p["environment"] for n, p in bus.calls if n == "cluster_read_deployment"] == [
        "staging",
        "prod",
    ]


async def test_write_and_read_on_same_foreign_environment_do_not_discharge() -> None:
    # Run env "prod", but both the write and the read name a foreign "staging"
    # environment. The run's resolved environment is authoritative in verification,
    # so write+read agreeing on a non-run environment never clears the obligation:
    # the write can only ever be verified against the run's own environment, and
    # this run cannot confirm it, so it escalates.
    model = ScriptedModel(
        [
            call(
                "cluster_patch_image",
                {
                    "namespace": "shop",
                    "name": "checkout",
                    "container_index": 0,
                    "image": "checkout:v2",
                    "environment": "staging",
                },
            ),
            call(
                "cluster_read_deployment",
                {"namespace": "shop", "name": "checkout", "environment": "staging"},
            ),
            Decision(kind="resolved", reasoning="Checked staging.", resolution="Premature."),
            Decision(kind="resolved", reasoning="Still unverified.", resolution="Too early."),
        ]
    )
    bus = FakeToolBus(
        {
            "cluster_patch_image": {"accepted": True},
            "cluster_read_deployment": [
                {"name": "checkout", "environment": "staging", "image": "checkout:v1"},
            ],
        }
    )
    ctx, bus, recorder = context(model, bus, environment="prod")

    result = await run(ctx)

    assert result.status is RunStatus.ESCALATED
    assert sum(
        "verification pending" in (step.error or "") for step in recorder.steps
    ) >= 2
    assert [p["environment"] for n, p in bus.calls if n == "cluster_read_deployment"] == ["staging"]
