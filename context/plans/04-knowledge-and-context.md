# Phase 4 — Knowledge and Context

**Document role:** Implementation plan, executed in its own chat session.
**Read first:** [00-overview.md](00-overview.md) for the program and cross-phase contracts · the CMDB and Axel sections of [architecture.md](../idea/architecture.md) · this document's Progress Log at the end.
**Depends on:** Phase 1, softly — environment belongs in the assembled context. Can start before Phase 1 finishes; expect one merge point at `build_user_prompt`.

## Problem

The product claim is that when a ticket arrives, the system assembles the ticket, the reporter's context, everything the platform believes about the affected system, and all relevant domain knowledge — and that the agent decides how far it needs to go.

Three gaps between that and the tree.

**The corpus is narrow.** `api/src/server/tools/knowledge.ts` searches exactly two tables: `problems` filtered to known errors with a workaround, and `knowledge_articles` filtered to published and unrestricted. The `documents` module, resolved ticket history, and prior run transcripts are not reachable.

**Retrieval is lexical only.** It builds a `websearch_to_tsquery` and ranks with `ts_rank_cd`, returning `mode: "lexical"`. The database image is already `pgvector/pgvector:pg18` and no vector is used anywhere in the tree. Employees describe symptoms in their own words; lexical matching misses paraphrase, which is most of what they write.

**The agent cannot control depth.** `knowledge_search` returns excerpts truncated to 500 characters with no way to read the full document. "The agent decides how far it needs to go" is not currently expressible.

Two adjacent gaps belong in the same phase because they are the same work — what reaches the model.

**Reporter context is wired and unused.** `reporter_id` is defined in `StartRun` in the proto, populated in `api/src/server/grpc.ts`, and never read by the agent. `build_user_prompt` has no reporter parameter. Directory sync already imports job title, department, and manager chain through `api/src/server/directory/`. None of it reaches the model.

**CMDB write-back is discretionary.** `cmdb_record_observation` is a tool the model may choose. Nothing requires it before a run resolves — the pending-verification gate in `agent/axel/loop.py` covers writes that name a verifying read, and CMDB's `verified_by` is deliberately empty. "Once resolved, the system updates the CMDB" is currently a hope.

## Scope

**In.**

- Broaden the knowledge corpus.
- Hybrid retrieval: lexical plus vector.
- A fetch tool so the agent can read past an excerpt.
- Access rules for the broadened corpus, settled before it ships.
- Reporter context in the prompt.
- A decision on CMDB write-back enforcement, implemented.

**Out.**

- Changing what tools can *do* to external systems. Read surface only.
- Ingesting source repositories. Note it as a later corpus source if it comes up; do not build it here.
- Replacing the CMDB observation model. Insert-only with read-time dedupe stays.

## The access question, first

**Settle this before writing retrieval code.** It is listed as an open question in `idea.md` — "How much does Axel see of prior tickets? Context improves routing and risks leaking one employee's information into another's ticket" — and broadening the corpus is exactly what forces the answer.

The specific hazard: the run transcript is read by IT staff **and by the reporting employee**. `architecture.md` records that the portal's boundary is enforced by data shape rather than client discipline — `getMyTicket` filters in SQL *and* omits the field from its contract type, because a page that renders nothing sensitive while fetching it is still a leak. Retrieval that pulls another employee's ticket into this employee's transcript defeats that, at the retrieval layer, where no contract type protects it.

Options, to be chosen and recorded:

| Option | Trade |
|---|---|
| Exclude ticket history entirely | Safe, and gives up the most useful corpus in the system |
| Include, but return only de-identified diagnosis and resolution — never body, reporter, or messages | Keeps most of the value. Requires the projection to be built deliberately, not filtered ad hoc |
| Include fully, restrict the transcript's employee-facing view instead | Moves the boundary to where it has already failed once. Not recommended |

The middle option is the one to argue against before accepting. Whichever is chosen, enforce it in the query and in the returned shape, not in a prompt instruction. `knowledge_articles.isRestricted` already exists as precedent for a data-shape filter — follow that pattern.

## Build order

### 1. Access decision

Write it down in this document before step 2. One paragraph, in the Progress Log, naming what is in the corpus and what shape it comes back in.

### 2. Corpus projections

Rather than teaching one query about five tables, build a projection: one searchable representation per source, with a source discriminator, an access class, and the identifiers needed to fetch the full item later. `api/src/server/search/projections.ts` already exists and `indexCmdbObject` is called from `recordObservation` — read it and extend that pattern rather than inventing a second one.

Sources to add: the documents module, resolved tickets under the chosen access rule, and prior agent run outcomes. Keep known errors and published articles exactly as they are.

### 3. Embeddings and hybrid retrieval

Enable pgvector and add an embedding column to the projection. Decide where embeddings come from — the same owned gateway in `agent/axel/config.py` serves an embeddings endpoint, or a local model in the API. Record the choice; it has the same data-egress consequence as the Phase 2 gateway decision and should be answered consistently with it.

Combine lexical and vector rather than replacing one with the other. Reciprocal rank fusion is the usual answer and needs no tuning to be better than either alone. Keep returning a `mode` discriminator so a transcript records which retrieval path produced the evidence — the existing `mode: "lexical"` field is the precedent.

Backfill embeddings for existing rows in the migration or a one-shot script. Handle the case where the embedding provider is unreachable: retrieval degrades to lexical, it does not fail the run.

### 4. Depth control

Add `knowledge_fetch` — a read tool taking a source and identifier from a search result and returning the full item under the same access rule.

Both schema sides, per the parity contract: `agent/axel/tools.py` and `api/src/server/tools/knowledge.ts`, plus registration in `api/src/server/tools/index.ts`. Extend `parity.test.ts`.

Update `SYSTEM_PROMPT` in `agent/axel/prompt.py` so the citation discipline covers the new sources. It currently instructs the model to cite a known error or article by identifier and title; that instruction needs to hold for every corpus source, and it must stay clear that a prior ticket is evidence of what someone *did*, not evidence of what is *true*.

Watch the loop: `knowledge_search` is issued as a forced first tool call before the model's first turn, and it consumes one of `max_tool_calls`. Adding a fetch tool means runs will use more calls; check `config.max_tool_calls` (20) and `max_model_turns` (10) are still adequate, and raise them deliberately if not.

### 5. Reporter context

Add reporter fields to `StartRun` in `api/proto/axioma.proto` — name, job title, department, manager. Mirror with the publish command. Populate in `api/src/server/grpc.ts`, which already has `reporterId` in hand. Render in `build_user_prompt` in a clearly labelled block.

Two things to be careful about. Reporter attributes are **facts about who is asking**, not instructions — label them as such in the prompt, the same way prior observations are already labelled "not established fact". And decide what happens when directory sync has not run: the prompt must degrade cleanly, as it already does for observations with "No prior observations."

### 6. CMDB write-back

Decide between:

| Option | Consequence |
|---|---|
| Leave discretionary | Honest, matches "Axel reads more than it writes". The claim about keeping the CMDB current stays aspirational |
| Require an observation before `resolve_ticket` succeeds | Makes the claim true. Adds a rejection path in `loop.py` alongside the existing pending-verification rejection, which already has a two-strike escalation. Risks a model that records noise to satisfy a gate |
| API-side write-back on terminal state, from what the run already observed | Guarantees the record without asking the model to remember. Loses the model's judgement about what was worth recording |

The third deserves serious consideration and is not the obvious choice. Argue it before picking.

Whichever is chosen, note the existing behaviour: `recordObservation` always inserts a new row with a fresh UUID, and `readContextForTicket` dedupes by newest per `(classKey, externalId)`. Accuracy is a read-time property. That is deliberate — provenance columns record which ticket, run, and step produced each fact — but it means the table grows per observation. If the enforcement option chosen multiplies observations, say so in the Progress Log.

## Testing

| Test | Asserts |
|---|---|
| Access rule | A resolved ticket from employee A cannot surface identifying content in employee B's run, at the query layer |
| Restricted articles | `isRestricted` articles stay excluded through every new path |
| Hybrid beats lexical | A paraphrased query that lexical search misses returns the right document |
| Degradation | Embedding provider unreachable, retrieval still returns lexical results and the run completes |
| Fetch | Returns the full item; refuses an identifier the access rule excludes |
| Parity | `parity.test.ts` covers `knowledge_fetch` names and parameters |
| Reporter rendering | Prompt renders reporter context; degrades cleanly when directory sync has not run |
| Budget | A run using search plus fetch still completes within `max_tool_calls` |
| Regression | `agent/tests/test_regressions.py` green — it has uncommitted changes; read before assuming shape |

## Acceptance checklist

- [ ] The access decision is written in the Progress Log and enforced in queries, not prompts.
- [ ] Corpus covers documents, ticket history under the access rule, and prior runs.
- [ ] Retrieval is hybrid; a paraphrased symptom finds the right article.
- [ ] Retrieval degrades to lexical rather than failing when embeddings are unavailable.
- [ ] `knowledge_fetch` exists on both schema sides with parity coverage.
- [ ] Reporter context reaches the prompt, labelled as fact about the asker rather than instruction.
- [ ] CMDB write-back decision is implemented and the claim in `idea.md` matches what the code does.
- [ ] Full suite green across `api`, `agent`, `cli`.

## Known traps

- **The transcript is employee-visible.** Every widening of the corpus widens what an employee can read about colleagues. This is the trap that makes the phase risky.
- **Prompt-level access control is not access control.** Filter in SQL and in the returned shape.
- **`knowledge_search` is a forced first call.** It runs before the model's first turn. Changing its output shape changes the first thing the model ever sees.
- **`recordObservation` returns a typed error rather than throwing.** `_tool_failure` in `loop.py` inspects `ok` and `error.code` — specifically `unknown_property`. Changing tool return shapes can silently change what the loop treats as failure.
- **Prior tickets are evidence of what someone did.** A wrong past fix is in the corpus too. The citation instruction must not turn precedent into authority.

## Progress Log

Append-only. Date, what was done, what remains, any blocker.

---

**2026-08-30 — Access and implementation decisions.** The corpus includes published unrestricted articles, known errors with workarounds, current-ticket documents under their live ticket/public-case-note link, de-identified resolved-ticket diagnosis and resolution, and de-identified terminal agent outcomes. Resolved-ticket projection and fetch deliberately omit employee-authored title/body, reporter identity, messages, ticket number, and transcript steps; access is enforced in SQL before ranking and again on fetch, not by prompt instruction. Documents expose safe metadata and link text only because the module has no owned content extractor; arbitrary file reads and URL fetching remain excluded.

Embeddings are generated by the API through the same owned OpenAI-compatible gateway used for model traffic (`AXIOMA_LLM_API_BASE`/`AXIOMA_LLM_KEY`), so their data-egress posture is the same. Projection reconciliation backfills nullable vectors; provider failure leaves rows and queries lexically searchable. Lexical and vector candidate ranks are combined with reciprocal-rank fusion.

CMDB write-back uses the resolution gate: `resolve_ticket` is rejected until a successful `cmdb_record_observation` has occurred, sharing the existing two-strike escalation path with pending verification. This preserves model judgement and full ticket/run/step provenance rather than synthesizing observations API-side. It also guarantees at least one fresh insert per resolved run, increasing table growth; newest-per-identity read-time deduplication remains deliberate.

**2026-08-30 — Corpus usefulness/depth follow-up.** Resolved-ticket resolution and terminal-run outcome text now pass through one bounded structured-PII de-identification function before projection or fetch; employee-authored title/body, reporter, messages, ticket number, transcript steps, URLs, email addresses, phone numbers, IPs, and UUIDs remain excluded or redacted. Full-item document fetch reads only the existing hash-addressed blob store for strict UTF-8 `text/plain`, `text/csv`, and `application/json` files after the existing current-ticket/public-note SQL check; links are never fetched and binary formats are never parsed. No schema change or migration journal edit was needed.
