# Axiōma `agent` — implementation plan

**Document role:** Implementation plan for `axioma/agent` — Axel
**Related:** [api.md](api.md) (read first), [architecture.md](../idea/architecture.md), [idea.md](../idea/idea.md)

Axel is one reasoning surface, not a cast of characters. It has no database credentials, no cluster
credentials and no path to a device: every side effect is a `ToolRequest` the API executes.

---

## 1. Current state

### Gates, run 2026-08-29

| Gate | Command | Result |
|---|---|---|
| Lint | `uv run ruff check .` | Clean |
| Tests | `uv run pytest -q` | 3 passed in 5.33s |

`proto/axioma.proto` is byte-identical to `api/proto/axioma.proto`. Generated bindings exist in
`axel/pb/` (`axioma_pb2.py`, `axioma_pb2_grpc.py`, `axioma_pb2.pyi`), so `scripts/generate-proto.sh`
has been run and works.

### What is built and real

**The bounded loop** — `axel/loop.py`. This is the best-realised part of the component and matches
the architecture almost exactly. It owns the sequence and the limits; the model owns only what to try
next. Concretely:

- `run(ctx)` iterates up to `MAX_MODEL_TURNS`, checks `RUN_DEADLINE_SECONDS` at the top of each turn,
  and counts tool calls against `MAX_TOOL_CALLS`.
- A `resolved` or `escalate` decision ends the run with a reported `DECISION` step.
- An **unknown tool** is reported as an `OBSERVATION` with an error and pushed back into the
  transcript, so the model corrects itself inside the same budget rather than crashing the run.
- **Invalid tool input** does the same, carrying the pydantic `ValidationError` text back to the
  model.
- A tool that raises is caught and also becomes an observation.
- Hitting any ceiling ends the run `exhausted` with a `DECISION` step naming the reason.

**The tool registry** — `axel/tools.py`. All seven tools from `architecture.md` are registered with
pydantic schemas and, for the three writes, a `verified_by` naming the read that confirms them.
`as_llm_tools()` renders the registry as OpenAI-style function definitions from
`model_json_schema()`. Nothing in this module executes anything, which is the point.

**The gRPC worker** — `axel/server.py`. Dials the API, sends `AgentHello` with version, model label
and capabilities, then holds one bidirectional stream. It really does:

- correlate `ToolResult` back to the awaiting call by `call_id`, resolving or rejecting a future;
- report every step as its own `RunUpdate` as it happens, not batched at the end;
- send a terminal `RunUpdate` with status and outcome, including on cancellation and on unexpected
  exceptions;
- reject duplicate `StartRun` for a run already in flight;
- handle `CancelRun` by cancelling the asyncio task;
- reconnect with exponential backoff plus jitter, capped by `reconnect_cap_seconds`;
- fail every pending tool future with `ConnectionError` when the connection drops, so a run cannot
  hang forever on a lost API;
- expose `GET /health` returning 200 while connected and 503 while reconnecting.

**Configuration** — `axel/config.py`. Pydantic-settings with the `AXIOMA_` prefix. No provider is
named; `model` is passed straight to litellm.

**Tests** — `tests/test_adapters.py`, three of them: the demo model's read-then-resolve path, tool-call
to `Decision` mapping, and `call_id` correlation.

### What is stubbed

**`axel/model.py` is the weak point of the component.** The real litellm path exists and is
unexercised; the `demo` branch hard-codes a device read followed by a resolve, which is what the
current tests actually exercise. Three defects in the real path, all of which prevent multi-step
reasoning from working:

| # | Location | Defect |
|---|---|---|
| A1 | `model.py:339-343` | The transcript is flattened into user messages: `"role": "user" if item.get("role") == "tool" else …`. Tool results arrive as *user* turns, and **the assistant's own tool-call message is never appended**. The model therefore has no record of what it asked for — only anonymous blobs of output. Multi-step tool use degrades to guessing on turn two. |
| A2 | `model.py:334-347` | `response.usage` is discarded. `agent_runs.prompt_tokens` and `completion_tokens` are consequently always null, which is why the dashboard's token row renders `0`. |
| A3 | `tools.py:544-556` | `as_llm_tools()` emits `model_json_schema()` as the function parameters, which does not declare `reasoning`. `_decision` then pops `reasoning` with a default of `""`. A model following the schema cannot supply reasoning for an ordinary tool call, so **every `tool_call` step in the transcript has empty reasoning** — the "why" the dashboard exists to show. |

### What is missing outright

| # | Gap |
|---|---|
| A4 | **`verified_by` is declared and never enforced.** `architecture.md` states every write is followed by a read, and the system prompt asks politely. The loop does not require it. A model that patches an image and immediately declares victory is accepted today. |
| A5 | **The ceilings contradict each other.** `MAX_MODEL_TURNS = 10` bounds the `for` loop, and every failed or invalid tool call consumes an iteration. `MAX_TOOL_CALLS = 20` can therefore never be reached — it is dead. |
| A6 | **`RUN_LIMITS` is duplicated.** `api/src/shared/index.ts` and `axel/loop.py` each declare 20 / 10 / 300s independently, with no mechanism keeping them equal. |
| A7 | **The deadline is checked only between turns.** A `device.computer_use` call with a 600s ceiling can run far past `RUN_DEADLINE_SECONDS` without the loop noticing. |
| A8 | **`StepKind.THINK` is never produced.** `server.py` maps it and the proto declares `KIND_THINK`; the loop emits only `TOOL_CALL`, `OBSERVATION` and `DECISION`. No transcript will ever contain a think step. |
| A9 | **The transcript grows unbounded.** Every tool output is `json.dumps`'d in full and appended. A pod list or an `ipconfig /all` dump is thousands of tokens, repeated on every subsequent turn. |
| A10 | **`StartRun.context_json` is parsed into the ticket dict and then never used** as anything but an opaque field. Once `api.md` milestone F makes it real CMDB context, nothing here reads it. |
| A11 | **No per-call timeout on the agent side.** If the API accepts a `ToolRequest` and never answers, `await future` blocks forever inside a live connection. Only a disconnect frees it. |
| A12 | **No retry on transient provider errors.** A single 429 or a socket reset from the model provider fails the whole run. |
| A13 | **No test of the loop itself** — the three existing tests cover adapters. The escalate-rather-than-act judgement, which `idea.md` calls the case that makes the other two mean something, has no test at all. |
| A14 | **Nothing knows about incidents versus service requests**, or impact and urgency. Once `api.md` milestone A lands, that classification exists and the prompt ignores it. |

---

## 2. Gaps

1. The conversation sent to the model is malformed for multi-step tool use (A1).
2. Reasoning is structurally unobtainable for tool calls (A3).
3. Token usage is never reported (A2).
4. Write-then-verify is a suggestion, not a rule (A4).
5. Run ceilings are inconsistent, duplicated across components, and not enforced during long calls
   (A5, A6, A7).
6. Transcripts have no think steps and no size discipline (A8, A9).
7. CMDB context and ITIL classification are received and ignored (A10, A14).
8. No per-call timeout and no provider retry (A11, A12).
9. The three scenarios — especially the refusal — are untested (A13).
10. No model provider is actually configured or exercised end to end.

---

## 3. Milestones

Dependency-ordered.

### A — Make the model conversation correct
**Files:** `axel/model.py`, `axel/loop.py`, `axel/tools.py`.

Rewrite the message construction so the transcript is a real OpenAI-shaped conversation:

- `RunContext.transcript` stops being a list of loose dicts and becomes a typed list of messages:
  `system`, `user` (the ticket), `assistant` with `tool_calls`, and `tool` with `tool_call_id`.
- After every decision that is a tool call, the loop appends the **assistant message including the
  tool call ID**, then appends the tool result as a `tool` message keyed to that ID (fixes **A1**).
- Failed calls — unknown tool, invalid input, tool raised — append a `tool` message with the error
  text keyed to the same ID, so a correction is attributable to the attempt that caused it.
- `as_llm_tools()` wraps each tool's `model_json_schema()` in an envelope that adds a required
  `reasoning: string` property alongside the tool's own parameters, and `_decision` unwraps it (fixes
  **A3**). Schemas get `additionalProperties: false` and every property listed in `required`, so
  strict function calling can be enabled.
- Capture `response.usage.prompt_tokens` and `completion_tokens`, accumulate across turns on the
  `RunContext`, and return them from `run()` on `RunResult` (fixes **A2**).
- The `demo` branch moves out of `model.py` into `tests/fixtures.py` as a scripted model. Production
  code should not carry a demo path, and the tests that need one should own it.

**Done when:** a run against a real provider makes three or more sequential tool calls in which the
model demonstrably uses the previous result — verified by reading the transcript, where each
`tool_call` step carries non-empty reasoning and each `agent_runs` row ends with non-zero token
counts.

### B — Reconcile and enforce the ceilings
**Files:** `axel/loop.py`, `axel/config.py`.

- Make `MAX_TOOL_CALLS` reachable: the `for` loop bounds *model turns*, and a turn that ends in an
  observation-and-retry should not cost the same as a productive turn. Track them separately —
  `model_turns` increments on every `think`, `tool_calls` on every dispatched tool — and cap
  independently, with a third small ceiling on consecutive failed turns (default 3) so a model stuck
  emitting invalid input escalates rather than burning the budget (fixes **A5**).
- Move the three constants into `Config` as `max_tool_calls`, `max_model_turns`,
  `run_deadline_seconds`, so they are configurable and visible next to the model settings. Document in
  the module docstring that these must equal `RUN_LIMITS` in `api/src/shared/index.ts`, and add a test
  asserting the documented values — the two components cannot import from each other, so the check is
  the only mechanism available (mitigates **A6**).
- Wrap every `call_tool` await in `asyncio.wait_for` bounded by the remaining run deadline, so a long
  device or computer-use call cannot outlive the run (fixes **A7** and **A11** together).

**Done when:** a run whose tool always returns invalid input ends `exhausted` after three consecutive
failures rather than ten turns; a tool that never answers ends the run at the deadline with a
reported error step; and the constants test fails if `RUN_LIMITS` is edited on either side.

### C — Enforce write-then-verify
**Files:** `axel/loop.py`, `axel/tools.py`.

`verified_by` becomes a rule the loop enforces rather than prose in the prompt:

- The loop tracks `pending_verification: dict[str, str]` — tool name to its verifying read — populated
  whenever a write tool **that declares a `verified_by`** succeeds. `cmdb.record_observation` is a
  write with `verified_by` null, and that is deliberate rather than an omission: a CMDB observation has
  no external state to re-read, the write is the record, and it is additive rather than corrective. The
  enforcement exempts null explicitly so nobody later "fixes" it by inventing a read.
- If the model proposes `resolved` while any verification is pending, the decision is **rejected as an
  observation**, not accepted: the loop reports an `OBSERVATION` step naming the write and the read
  that must follow it, appends the same text as a tool message, and continues inside the budget. This
  reuses the existing correction mechanism rather than adding a second one.
- A successful call to the named read clears the entry. The read must target the same resource — the
  parameters are compared on the fields the write named, so re-reading a different deployment does not
  discharge the obligation.
- Two rejections in a row on the same pending verification ends the run `escalated`, because a model
  that will not verify is a model whose resolution cannot be trusted.

This is the architecture's central claim — "a write returning success means the call was accepted, not
that the problem is fixed" — and it is the one that must be true in code rather than in a prompt.

**Done when:** a scripted model that patches an image and immediately resolves is forced to call
`cluster.read_deployment` first, and its resolution is rejected twice into an escalation if it refuses.

### D — Prompt construction
**Files:** `axel/loop.py` (`SYSTEM_PROMPT`), new `axel/prompt.py`.

Move prompt assembly out of the string constant into a module that builds the user turn from the whole
`StartRun`:

- ticket title and body, verbatim;
- **record type** — an incident asks "restore service fast", a service request asks "fulfil a
  pre-defined low-risk ask". Different objectives produce different tool choices, so the prompt says
  which one this is (closes **A14**);
- impact, urgency and derived priority, as context on how far to go, never as permission to skip
  verification;
- `device_id` when present, and its absence stated explicitly so the model does not invent one;
- **CMDB context** from `context_json`, rendered as a short list of prior observations with their
  observation time, under a heading that marks it as *what the platform already believes* rather than
  as fact (closes **A10**).

The system prompt keeps its current three rules — gather evidence before acting, prefer typed actions
over GUI, escalate rather than act on policy decisions — because they are well-written and match the
product. Add one: the transcript is read by IT staff and by the employee, so reasoning is written for
a person.

**Done when:** the assembled prompt for a seeded scenario-2 ticket contains the device ID, the record
type, and at least one CMDB observation; and a ticket with no device says so rather than omitting the
field.

### E — Transcript quality
**Files:** `axel/loop.py`, `axel/server.py`.

- **Emit `THINK` steps.** Report a `THINK` step carrying the model's reasoning before each tool call
  dispatch, so the transcript reads as think → act → observe rather than jumping straight to a call
  (fixes **A8**). This is what makes the dashboard's ordered transcript legible.
- **Bound the transcript.** Tool outputs over a threshold (default 4000 characters) are stored in full
  on the reported step — the dashboard and the CMDB want everything — but the copy appended to the
  model conversation is truncated with an explicit marker naming what was dropped and how much (fixes
  **A9**). Truncation is never silent, because a model that cannot see it was truncated will conclude
  the data is absent.
- **Extract evidence.** For each observation, carry a short `evidence` string — the decisive line, such
  as the `ImagePullBackOff` reason or the scheduler's message — alongside the full output. The
  dashboard's `AgentStep` type already declares an `evidence` field that nothing supplies; this is
  where it comes from. It requires a proto field and a contract field, both owned by `api.md`, so this
  step is written to degrade gracefully if that field is not yet available.

**Done when:** a scenario-1 transcript shows think, tool_call, observation and decision steps in order;
a 200-pod read does not blow the context window on turn three; and the escalation step for scenario 3
carries the scheduler's message as its evidence string.

### F — Model provider and resilience
**Files:** `axel/config.py`, `axel/model.py`, `pyproject.toml`, `README.md`.

Keep **LiteLLM** as the model client. It is already a dependency, it is what makes the provider
configuration rather than architecture, and `agent_runs.model` recording which model actually answered
depends on that indirection existing.

Set the default `AXIOMA_MODEL` to a current OpenAI frontier model with strict function calling —
`openai/gpt-5` at time of writing — rather than the present `gpt-4o-mini`, which is a cost-tier model
whose tool-call reliability is the single biggest determinant of whether this loop works at all.
Credentials continue to come from the provider's standard environment variables, which LiteLLM reads
without extra code.

> **Assumption, flagged so it is easy to overrule.** The instruction was "set up LiteLLM, don't use
> Claude, use the best and suitable SDK for this". Read here as: keep LiteLLM as the SDK and choose the
> strongest non-Claude model through it. The alternative reading — replace the hand-written loop with
> an agent framework such as Pydantic AI or the OpenAI Agents SDK — was not taken, because
> `architecture.md` is explicit that the loop owns the sequence and the limits while the model owns
> only what to try next, and every framework in this space wants to own the loop. Changing that is a
> re-architecture, not a dependency swap. Switching the default model is one environment variable.

Also in this milestone:

- Retry transient provider failures — rate limits, timeouts, 5xx — with bounded exponential backoff
  and jitter, capped so retries cannot outlive the run deadline. A retried call is reported as an
  observation so the transcript shows the delay rather than an unexplained gap (fixes **A12**).
- Enable strict function calling now that the schemas in milestone A support it, and fall back with a
  logged warning on providers that reject it.
- Record the model string returned by the provider, not the configured one, so a provider-side alias
  change is visible in the run record.

**Done when:** the run record's model matches what the provider reported; a forced 429 is retried and
visible in the transcript; and switching `AXIOMA_MODEL` to a different provider runs the same
scenarios with no code change.

### G — Scenario tests
**Files:** new `tests/fixtures.py`, `tests/test_loop.py`, `tests/test_scenarios.py`,
`tests/test_verification.py`.

A `ScriptedModel` fixture returns a fixed sequence of `Decision`s, and a `FakeToolBus` returns canned
tool outputs, so the loop can be tested with no network and no cluster. Then:

- **Scenario 1** — read pods, see `ImagePullBackOff`, patch, verify with `read_deployment`, resolve.
  Asserts the verification call happened before the resolution was accepted.
- **Scenario 2** — read device state, dispatch the typed action, re-read, resolve.
- **Scenario 3, the important one** — read pods, see `Unschedulable` with `Insufficient cpu`,
  **escalate without calling any write tool**. Asserts that the set of tools called contains no tool
  whose `effect` is `WRITE`, that the run status is `escalated`, and that the scheduler's message
  survives into the terminal step verbatim rather than paraphrased.
- Loop invariants: unknown tool recovers, invalid input recovers, consecutive-failure ceiling
  escalates, deadline mid-tool-call ends the run, cancellation reports a terminal step.

Scenario 3 is the case `idea.md` says makes the other two mean something. It gets a test that fails if
Axel ever acts on it, and `idea.md` asks for it to be demonstrated rather than merely tested — the test
is the regression guard, not the demo.

**Done when:** `uv run pytest -q` passes with these tests, and deliberately making the loop accept an
unverified resolution turns scenario 1 red.

### H — Worker robustness
**Files:** `axel/server.py`, `axel/config.py`.

- Replace the `if "heartbeat" in locals()` cleanup in `connect_forever` with a properly scoped task
  handle. It works today and is one refactor away from a leak.
- Report `worker_id` on `AgentHello` — a stable UUID persisted next to the config — so `api.md`
  milestone H can pool workers instead of keeping a single slot.
- Add `capabilities` reflecting reality rather than a fixed list: the tool names the registry actually
  holds, so the API can reject a tool request for something this worker does not know.
- Bound `Connection.pending` and log a warning when a `ToolResult` arrives for an unknown `call_id`,
  which today is silently dropped.

**Done when:** two agent workers can run against one API and both appear connected; killing one leaves
the other serving runs.

---

## 4. Cross-component impact

| Needed from `api` | Why | Owned by |
|---|---|---|
| Terminal `RunUpdate` gains `prompt_tokens` / `completion_tokens` | Milestone A produces the numbers and has nowhere to put them | `api.md` milestone H |
| `RunUpdate` gains an `evidence` field | Milestone E extracts the decisive line; the dashboard type already expects it | `api.md` milestone B/H |
| `StartRun` carries real CMDB context, record type, impact and urgency | Milestone D's prompt is built from them | `api.md` milestones A, C, F |
| `AgentHello` gains `worker_id` | Milestone H's worker pooling | `api.md` milestone H |
| `cluster.*` and `cmdb.*` tools actually execute | Every one returns `tool not implemented` today, so scenarios 1 and 3 cannot run | `api.md` milestones D, E, F |
| Structured tool errors naming registered tools | The loop's self-correction path is only as good as the error text | `api.md` milestone D |

| Forced on others | Detail |
|---|---|
| `api` | `RUN_LIMITS` in `src/shared/index.ts` must stay equal to the config defaults here. Neither component can import the other, so both sides carry an assertion. |
| `cli` | Milestone C's write-then-verify means every device write is followed by a `device.read_state` that must actually reflect the change. A facet that does not observe what an action changed makes verification impossible — `cli.md` owns pairing each action with a facet that proves it. |
| **`cli` → here** | `cli.md` milestone B replaces the action and facet sets, because two of the three current actions need administrator rights the non-admin install does not have. `DeviceRunAction.action` and `DeviceReadState.facets` in `axel/tools.py` are `Literal[...]` over the old names and must change with them, or Axel will validate a valid action into a rejection. Land both in the same session; the API's own schema is the backstop that fails loudly on a mismatch. |

Nothing in this plan edits files outside `axioma/agent/`. Proto changes are requested from `api.md`,
which owns `proto/axioma.proto`; this component regenerates bindings with
`./scripts/generate-proto.sh` after each publish.

---

## 5. Decisions taken

**Keep the hand-written loop; do not adopt an agent framework.** `architecture.md` is explicit that
the loop owns the sequence and the limits and the model owns only what to try next, and that no verdict
is taken from model confidence. Frameworks in this space want to own the loop, the retries and the
termination condition — exactly the three things that must be ours for run limits, `exhausted`
handling and enforced verification to mean anything. `loop.py` is 270 lines and already correct in
shape.

**Keep LiteLLM; change the default model.** Reasons in milestone F, including the flagged assumption
about the instruction.

**Enforce `verified_by` in the loop, not the prompt.** A prompt rule is a request; a loop rule is a
guarantee. The distinguishing claim of this product is that a write returning success is not evidence
the problem is fixed, and a claim that only lives in a prompt is not a claim the system makes.

**Reject an unverified resolution as an observation rather than failing the run.** It reuses the
correction path that already exists for unknown tools and invalid input, keeps the model inside its
budget, and produces a transcript that shows the model being told to verify — which is more useful to
a reader than a run that simply ends.

**Truncate the model's copy of tool output, never the stored copy.** The dashboard, the CMDB and the
audit trail want everything; the context window does not. Truncation is marked inline so the model
knows it is looking at a summary.

**Move the `demo` model into the test fixtures.** A production module that branches on
`config.model == "demo"` is a test seam in the wrong place. It also means a misconfigured deployment
silently runs a hardcoded script instead of failing loudly.

**Do not add computer-use awareness beyond the existing tool.** `device.computer_use` is registered and
the prompt already ranks it below typed actions. Whether a given device can serve it is the device's
answer, not Axel's — a refusal comes back as a tool error and becomes an observation like any other.
Axel has no cua dependency and must not acquire one.

**Report think steps.** The transcript is the product for the IT staff member reading it. A transcript
of tool calls without the reasoning between them is a log, not an explanation.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| The conversation-shape fix (A1) is the difference between a working agent and one that guesses on turn two, and it cannot be validated without a real provider and real tools. | Do milestone A against the `FakeToolBus` from milestone G first, asserting on the message array itself, then re-validate against a live provider once `api.md` milestone E lands. The assertion is on structure, not on model behaviour. |
| Enforced verification can deadlock a run when the verifying read legitimately cannot confirm the change yet — a rollout in progress reads as not-ready. | `cluster.read_deployment` returns rollout progress, and the loop treats a read that ran successfully as discharging the obligation regardless of what it found. Verification means "you looked", not "it worked" — the model then decides what the observation means. |
| Strict function calling is not uniformly supported across providers, and the schemas are generated from pydantic. | Feature-detect, fall back with a logged warning, and keep the schema envelope valid in both modes. The provider-agnostic path is already why LiteLLM is here. |
| Token spend during development: every loop iteration is a real model call. | The `ScriptedModel` fixture covers every loop test with no network. Live runs are needed only at the end of milestones A, D and F. |
| The run-limit duplication between this component and `api/src/shared/index.ts` cannot be enforced by the type system across a language boundary. | A test asserting the documented values, plus a comment on both sides naming the other file. Cheap, and it fails loudly the first time someone edits one side. |
| Scenario 3 depends on the model choosing not to act, which is a judgement, not a mechanism — a different model may behave differently. | The escalate-rather-than-act instruction is explicit in the system prompt, the test uses a scripted model so the regression guard is deterministic, and the run record stores which model answered so a behaviour change is attributable. This is a genuine limitation and is stated rather than engineered away. |

---

## 7. Definition of done

1. `uv run ruff check .` clean and `uv run pytest -q` green, including the new loop, verification and
   scenario tests.
2. The message array sent to the model contains assistant tool-call messages and `tool` messages keyed
   by `tool_call_id`; no tool result is delivered as a user turn.
3. Every `tool_call` step in a real transcript carries non-empty reasoning.
4. Every finished run reports non-zero prompt and completion token counts, and the model string on the
   run record is the one the provider returned.
5. A write tool is never followed by a resolution until its `verified_by` read has run; a model that
   refuses to verify escalates rather than resolving.
6. Model turns, tool calls and the run deadline are enforced independently, and a tool call that hangs
   ends the run at the deadline rather than never.
7. A transcript for each of the three scenarios reads think → tool_call → observation → decision in
   order, with the decisive evidence string present on the observation that carried it.
8. Scenario 3 escalates having called no write tool, with the scheduler's `Insufficient cpu` message
   verbatim in the terminal step, and the test fails if any write tool is called.
9. Switching `AXIOMA_MODEL` between two providers runs all three scenarios with no code change.
10. Two workers can serve one API concurrently and either can be killed without stalling the other.
