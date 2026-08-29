# Brief C — Problems, changes, knowledge, forms

**Read first:** [README.md](README.md) — coordination map, blocker protocol, ground rules, and the list of
things that are already correct and must not be changed.
**Tier document:** [tier-2.md](../tiers/tier-2.md)
**Reserved migrations:** `0024` – `0027`
**Status file you own:** `context/plans/oss-adoption/execution/status/chat-c.md`

## Mission

Tier 2 is 1 of 7, and that number is misleading in a specific way: **the API and database are about 85%
done and the human surfaces are about 30% done.** All 22 tables exist with correct shapes and constraints,
every CAB vote and approval procedure is capability-gated with an additional membership check, approvals
genuinely block `startRun` and `resolve`, and the portal's knowledge boundary is enforced twice over.

What is missing is that **almost none of it is reachable by a person**, and the request catalogue has no
data and no way to create any. You own the largest UI surface of the five briefs.

## What you own

```
axioma/api/src/contracts/{catalogue,problems,changes,knowledge}.ts
axioma/api/src/server/routers/{catalogue,problems,changes,knowledge}.ts
axioma/api/src/server/{problems,changes,forms}.ts
axioma/api/src/server/knowledge/
axioma/api/src/server/tools/knowledge.ts
axioma/api/src/db/schema/{catalogue,problems,changes,knowledge,forms,approvals}.ts
axioma/dashboard/src/features/{problems,changes,knowledge,approvals}/
axioma/portal/src/features/{knowledge,request-catalogue}/
```

Brief 0 ran first and split the old `contracts/tier2.ts` and `routers/tier2.ts` into the domain files
above. **The `file:line` references below were captured before that move — locate by procedure or symbol
name, which the refactor preserved exactly.** Read `status/chat-0.md` for the final domain-to-file map.

Task **C7** is the one edit you make outside your own files: it touches `contracts/tickets.ts` and
`routers/tickets.ts`, which brief B owns. It is a much smaller surface than before the refactor, but still
coordinate — tell B through your status file, and run the full gate set afterwards.


## Use subagents for reading, never for writing

Your brief is a session's worth of work, so widen what you can see rather than multiplying what writes.
**Every edit stays in this session.** Two agents editing one working tree is a lost write, not a merge
conflict, and lost writes are silent.

Delegate read-only questions and act on the answers yourself. The two that pay off most here:

- **Finding what brief 0 moved.** Every `file:line` below predates the domain refactor. A subagent that
  answers "where does this procedure live now, and what calls it" costs you no context and is faster than
  sweeping for it.
- **Confirming a claim before you act on it.** "Check nothing else reads this table" is a good subagent
  question. "Fix this table" is not.

Do not delegate gate runs — a typecheck against a tree that is mid-edit means nothing.

---

## Tasks, in order

### C1 — Forms that can exist · highest priority

**Confirmed:** `createForm`, `updateForm` and `publishForm` appear **nowhere** in the repository. Live
database: `forms` = 0, `form_fields` = 0, and 0 of 4 `service_subcategories` carry a `form_id`. The
portal's `selected?.form ?` guard at `portal/src/features/tickets/components/request-form.tsx:519` can
therefore never be true, so the whole `forms` / `form_fields` stack and `DynamicRequestForm` are dead
paths. T2.G's headline case — a "new laptop" request rendering as a typed form — is unreachable, not
merely unproven.

The schema underneath is good and should not change: versioning by `key` + `version`, the GLPI field
families (`isMandatory`, `isHidden`, `isReadonly`, `predefinedValue`), and a `condition` jsonb that the
portal already evaluates at `features/request-catalogue/components/dynamic-request-form.tsx:30-41`.

**Build:** `listForms`, `createForm`, `updateForm`, `publishForm` gated on an appropriate capability; a
form builder in the dashboard; and a seeded catalogue form wired to a subcategory so the portal path is
demonstrable on a fresh database.

### C2 — Let a CAB member vote

**Confirmed:** `voteOnChange` is in the contract, gated on `change.approve` at
`server/routers/tier2.ts:262` with a CAB-membership check at `:264-276`, and `:224-239` blocks
`in_progress` until the CAB approves. It is called from **no component** — `dashboard/src/routes/_auth/changes.$changeId.tsx`
issues queries only. The enforcement is correct and there is no way to vote.

**Build:** a vote control on the change detail, shown when the viewer holds `change.approve` and is a CAB
member. `decideApproval` is already wired and is a good pattern to copy.

### C3 — Post-implementation review in the UI

**Confirmed:** all five `pir_*` fields exist (`db/schema/changes.ts:93-98`), autonomous changes auto-fill
them (`server/tools/index.ts:105-120`, `server/tools/change.ts:68-78`), and completion is gated on a PIR
(`routers/tier2.ts:240-247`). But `ChangeDetail` (`dashboard/src/features/changes/components/changes.tsx:31-44`)
omits every `pir*` field from its type and `ChangeDetailView` (`:137-190`) renders none. **A human can
neither read nor write a PIR**, though T2.E names `dashboard/src/features/changes/` as a file it owns.

### C4 — Problems and knowledge people can edit

**Confirmed:** `createProblem`, `updateProblem`, `linkProblemTickets`, `closeProblem`,
`createKnowledgeArticle` and `updateKnowledgeArticle` are all published, gated, and **called from
nowhere**. `KnowledgeArticleEditor` (`dashboard/src/features/knowledge/components/knowledge.tsx:128`) is
exported and never mounted — `routes/_auth/knowledge.tsx:12` passes no `action`. So T2.B's "three
incidents grouped under one problem" and §5's "a person writes the article" have no human path.

Wire the mutations into the routes. The components largely exist.

### C5 — Knowledge: vector search and the ACL

Two separate gaps.

**Vector search.** T2.F says to keep the `embedding` column *and the vector search*, because "adding it
later means backfilling embeddings for every article." **Confirmed:** nothing writes `embedding`,
`server/tools/knowledge.ts:71` hard-codes `mode: "lexical"`, and the live table has only `_pkey`,
`_publication_idx`, `_lexical_idx` — no vector index, though `pgvector` is installed. The §6 mitigation
"reports which mode answered" is vacuous when the mode is a constant. Either implement the embedding
write on publish plus an HNSW or IVFFlat index and a vector branch, **or** put the decision to the user
and record lexical-only in the tier document. Do not leave it as it is.

**The ACL.** `knowledge_acl`, `knowledge_folders`, `knowledge_tags` and `knowledge_article_tags` are
migrated and referenced by **zero application code**. `is_restricted` currently means "invisible to the
portal" with no grant mechanism, so T2.F's "enforced through Tier 0 capabilities" is only half true —
audience is enforced, per-principal ACL is inert. Consult `knowledge_acl` in `listKnowledgeArticles` and
`getKnowledgeArticle`, or defer the four tables explicitly in writing.

### C6 — Audit change transitions

**Confirmed:** `change_transitions` is declared (`db/schema/changes.ts:187-211`), migrated, and **written
by nothing**. Status changes at `routers/tier2.ts:224-261, 292-303` and in `server/tools/change.ts` mutate
`changes.status` directly with no transition row and no `actorType` attribution — though T2.D says the
state machine "reuses the table-driven transitions from T1.A". Insert a row on every status write, or drop
the table.

### C7 — Retire `category` and `subcategory` · coordinate with brief B

**Confirmed:** DoD 2 requires both **gone from the contract**. Both are still full contract citizens —
`contracts/index.ts:315-316` (ticket schema), `:446` (list filter), `:495-497` (facet), `:665-666`
(reclassify action) — and `category` is still written on create at `routers/index.ts:459` and reclassified
at `:1366-1369`. The schema comment calling them "compatibility-only until backfilled" is stale: migration
`0011` already backfilled every row, and `tickets.service_id` / `service_subcategory_id` are `NOT NULL`
with a composite foreign key that prevents a subcategory drifting from its service.

The catalogue is otherwise wired properly — three-level tree, seeded, and resolved into SLA at
`server/sla/runtime.ts:24-79` in service → contract → priority → default order.

**Build:** drop both from the ticket schema, the list filter, the facet and the reclassify action; replace
with `serviceId` and `serviceSubcategoryId`; drop the columns in your own migration. Swap the dashboard
queue facet (`features/tickets/components/ticket-queue.tsx:264-268`) and the two detail rows
(`ticket-detail.tsx:207-209`) to service and subcategory — the API already returns a `service` facet at
`routers/index.ts:793` and accepts a `serviceId` filter.

**These edits land in `contracts/tickets.ts` and `routers/tickets.ts`, which brief B owns.** Do it as a
single isolated change, record it in your status file so B sees it, and run the full gate set afterwards.

### C8 — Two catalogue gaps worth closing

- **No service carries an `sla_id`** (live: 0 of 4), so T2.A's "a service with its own SLA produces a
  different deadline" cannot be observed. Seed one and add a test.
- **No catalogue-authoring procedure exists** — `listCatalogue` is read-only, so the service tree can only
  be changed by migration. Add authoring if it fits your remaining budget; record it as handed off if not.

---

## The agent boundary — read before touching `server/tools/`

The audit confirmed this holds and it must keep holding. Axel has nine tools; **none authors knowledge,
none posts into the human case log, none holds credentials.** Exactly one new write path exists across all
five tiers — `patchImageWithChange` creating a change record. `createKnowledgeArticle` and
`updateKnowledgeArticle` live only on `capabilityProcedure("knowledge.manage")`, a human oRPC path the
agent cannot reach. Keep it that way.

Two agent-side items are yours, and both are reads:

- **T2.C is the one milestone in this tier that is genuinely complete.** `knowledge_search` returns known
  errors and published articles, `prompt.py:10-14` requires a citation, and `loop.py:137-181` records it as
  a real `TOOL_CALL` step. Do not rework it. One test gap: no test exercises a *matching* known error
  resolving a ticket with a citation — `test_loop.py:12-20` proves the call happens but with an empty
  result set. Add that test.
- **§4 says Axel should gain a case-log read tool** and the registry has none. Add `ticket_read_messages`
  as a read-only tool that returns public entries only. If adding it risks the boundary in any way, stop
  and put it to the user instead.

---

## Definition of done

- A form can be authored in the dashboard, published, attached to a subcategory, and rendered and
  submitted from the portal on a fresh database.
- A CAB member can vote; a normal change cannot proceed until required members have.
- A completed change's PIR can be read and written by a human.
- Three incidents can be grouped under one problem, and a person can write a knowledge article.
- The knowledge vector-search decision is either implemented or recorded, not left ambiguous.
- Change status writes leave an audit trail.
- `category` and `subcategory` are gone from the contract and the queue facets by service.
- All five component gates pass, run and quoted.
