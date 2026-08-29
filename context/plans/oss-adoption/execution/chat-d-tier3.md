# Brief D — Rules before the model, vocabulary, CMDB, workflows

**Read first:** [README.md](README.md) — coordination map, blocker protocol, ground rules, and the list of
things that are already correct and must not be changed.
**Tier document:** [tier-3.md](../tiers/tier-3.md)
**Reserved migrations:** `0028` – `0031`
**Status file you own:** `context/plans/oss-adoption/execution/status/chat-d.md`

## Mission

Tier 3 is 2 of 7, and the data model underneath it is the best-made layer in the programme: every table,
enum, check and index the plan names exists and matches the Drizzle schema; the CMDB migration carries
provenance across correctly with a passing integration test; search has a real weighted GIN index rather
than a table pretending to be one; webhooks have delivery records with bounded exponential retry on the
existing sweep; and the public API is genuinely authenticated on a single capability model shared with
sessions.

**Your tier's own thesis is nonetheless unproven, and the plan's "one vocabulary per concept" decision is
broken with a source comment conceding it.** Those two are the job.

## What you own

```
axioma/api/src/server/rules/
axioma/api/src/server/workflows/
axioma/api/src/server/cmdb/
axioma/api/src/server/search/
axioma/api/src/server/dynamic-fields/
axioma/api/src/server/api-keys/
axioma/api/src/contracts/{cmdb,automation}.ts
axioma/api/src/server/routers/{cmdb,automation}.ts
axioma/api/src/db/schema/{cmdb,cmdb-links,rules,workflows,views,search,dynamic-fields,api-keys,vocabulary}.ts
axioma/api/src/index.ts                       (the Hono error-mapping middleware — D2)
axioma/dashboard/src/features/{cmdb,automation}/
axioma/dashboard/src/components/layout/command-menu.tsx
axioma/agent/axel/loop.py                     (typed-error recovery — D7)
```

Brief 0 ran first and split the Tier 3 procedures out of `contracts/index.ts` and `routers/tier3.ts` into
the domain files above. **The `file:line` references below were captured before that move — locate by
procedure or symbol name, which the refactor preserved exactly.** Read `status/chat-0.md` for the final
domain-to-file map.

Task **D1** needs `startTicketRun` called from three intake paths. Brief 0 moved it into
`server/routers/shared.ts`, so it is now importable rather than a private function inside a mega-file —
this is why the refactor ran first. The three call sites live in files briefs B and E own; keep the edit to
the call sites themselves, say so in your status file, and re-run the gates.

`api/src/db/schema/vocabulary.ts` holds ticket statuses only and brief B reads it heavily. When you add the
shared action vocabulary in D3, put it in a new module rather than expanding that file.


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

### D1 — Rules must actually stop the model · BLOCKER

**Confirmed:** the ordering is right — `routers/index.ts:412-424` evaluates rules, `:427-459` persists the
settled ticket, `:466` records firings, `:483` attributes them in the audit as `rule:${firing.ruleId}`,
and `:506` starts the run. But **nothing gates dispatch.** `startTicketRun` (`:208-267`) checks approvals,
a running run and worker presence, and never looks at `route` or `settledActions`.

`settleTicketBeforeModel` (`server/rules/index.ts:170-186`) is the only code implementing "a settled ticket
skips the model", and grep shows **no production caller** — only `rules/index.test.ts:135` and `:147`.
`settledActions` is passed one line earlier at `:502` into a workflow event payload and nowhere else.

`ticket_rules` is **empty**, seeded by no migration.

**Build:**
- Call `settleTicketBeforeModel` around `startTicketRun` in all three intake paths — `routers/index.ts`,
  `routers/tier4.ts:403`, `server/mail/db.ts:196`. Record the skip so it is observable rather than silent.
- Seed an ordered starter rule set. The tier suggests growing it from `agent_steps` evidence; a small,
  obviously-correct set is better than a speculative large one.
- **`server/mail/db.ts:251` writes rule firings but no `ticketAudit` rows**, unlike the other two paths.
  §5 says every firing writes to the T1.J audit. Add them.

### D2 — Make the measurability claim checkable

**Confirmed:** the plan says the rules engine makes the agent's contribution measurable, "checkable rather
than asserted". It currently cannot be checked at all. `measureTokensPerTicket` (`rules/index.ts:203`) is
called only from its own test; **no procedure reads `ticket_rule_firings`**; and `ticketStats` computes
`autonomousClosed = closedTotal − humanTransitions` (`routers/index.ts:1754-1758`) with no rule dimension,
so rule-settled and model-settled tickets are indistinguishable through the API.

**Build:** `listTicketRuleFirings`; `tokensPerTicket` on `ticketStats`, joining `agent_runs` token counts
over the ticket cohort; and a split of the autonomous rate by settlement source. Report a before-and-after
figure once rules are seeded — the tier's DoD asks for it explicitly, and the point stands even if rules
settle less than hoped.

**Also fix, in the same file:** the Hono middleware at `api/src/index.ts:72-88` catches only
`TOO_MANY_REQUESTS` from `createContext` and rethrows everything else, so the `ORPCError("UNAUTHORIZED")`
raised at `server/context.ts:23` for an invalid, expired or revoked API key escapes as **HTTP 500**. This
is reproducible against the running server: no bearer returns 401, a bad bearer returns
`Internal Server Error`, on both `/rpc/*` and `/api-reference/*`. Per the oRPC documentation the context
factory runs outside the handler, so its errors are never formatted — the idiomatic fix is to move API-key
rejection into an oRPC middleware; mapping the code in the catch is acceptable. Use `context7` for the
current oRPC error-handling contract before you choose.

### D3 — One action vocabulary · MAJOR

**Confirmed:** §5 commits to a single action vocabulary shared by the rules engine and workflows. There
are two.

- `RuleAction` (`server/rules/index.ts:29-37`) — 8 members, includes `route_human`.
- `ACTION_TYPES` (`server/workflows/core.ts:4-18`) — 12 members, includes `set_service`, `set_sla`,
  `set_ola`, `send_webhook`, `send_notification`, excludes `route_human`.

The source concedes it at `core.ts:3`: *"Keep aligned with rules actions until their shared module is
integrated."* Note the hybrid already in place — `rules/index.ts:90` types `settledActions` as the
workflow `ActionType` while keeping its own `RuleAction` union.

**The test named `workflow actions share rules vocabulary` does not test that.** `workflows/core.test.ts:28`
only checks that `assertWorkflowActions` accepts two valid objects and rejects `run_workflow`; it never
compares the two sets. A green test asserting the opposite of the truth is worse than no test — fix the
test as well as the code.

**Build:** extract one `Action` union into a shared module, have both engines import it, make the union
exhaustive at both call sites, and replace that test with one that compares the sets.

### D4 — Implement or remove the ten no-op workflow actions

**Confirmed:** `server/workflows/runtime.ts:51-128` implements only `send_webhook` and `send_notification`.
The other ten declared types pass `assertWorkflowActions`, do nothing, and the execution is still recorded
`succeeded`. Implement the mutating actions against D3's shared vocabulary, or remove them from the enum
until they exist. Silently succeeding is the worst of the three options.

**Also:** `workflow_scheduled_emissions` is created with a unique idempotency key and a due index and is
**never written or read**. Implement scheduled emission in the runtime sweep, or drop the table.

**Also:** `webhook_message_formats` is migrated and read by nothing, while `webhook_deliveries.message_format_id`
is a foreign key into it that is never populated — `messageFormatId` appears only as a nullable contract
field at `contracts/index.ts:162`. Wire the formats or drop them.

### D5 — Give impact analysis something to traverse

**Confirmed:** the BFS at `server/cmdb/impact.ts:25-62` honours `impact_direction` and `spreads_impact`,
is cycle-safe with a `visited` set, and is tested. It has no typed edges to walk:

- `cmdb_relationship_types` has **zero rows**. Its only insert derives types from legacy `cmdb_items`
  (`0012_tier3_extensible_platform.sql:141-150`), which a fresh install has none of.
- Those derived types are hardcoded `impact_direction='none'`, and the derived relationships carry no
  `property_id` (`:152-160`), so `spreadsImpact` falls back to `false` at `impact.ts:86` for every
  migrated edge.
- **No procedure creates a relationship type or an object relationship** — `routers/tier3.ts` has neither.
- `cmdb_class_properties` has 4 rows, all `legacy_attributes` json, none with `spreads_impact = true`.

**Build:** `listCmdbRelationshipTypes`, `createCmdbRelationshipType` and `createCmdbObjectRelationship`,
wiring the existing `server/cmdb/relationships.ts:119` `insertRelationship`. Seed a starter taxonomy with
real verbs, inverse verbs and directions, and at least one class property with `spreads_impact = true`, so
DoD 4 — a deployment CI linked to a business process reporting that process impacted — is demonstrable.

### D6 — Saved views an analyst can actually save

**Confirmed:** `createSavedView`, `updateSavedView` and `deleteSavedView` require **`admin.settings`**
(`routers/tier3.ts:318-320, 343-345, 362-364`), which the `it-analyst` role does not hold — verified in
`role_capabilities`. An analyst cannot save their own view, which is the exact gap row 3.11 exists to
close. Regate on `ticket.read.all` or a new `view.manage` capability, keeping ownership enforcement in
`canAccessSavedView`.

### D7 — Custom fields, search and the agent's error recovery

- **Dashboard custom fields are read-only.** `dashboard/src/features/tickets/components/dynamic-fields.tsx`
  is a `<dl>` with no `onChange`, and the dashboard never writes `customFields`, so DoD 8's "renders in
  both frontends" is half met. Port the portal's editable component
  (`portal/src/features/tickets/components/dynamic-fields.tsx:18,169`).
- **Search misses two declared types.** `SEARCH_OBJECT_TYPES` (`server/search/index.ts:6-13`) declares
  `problem` and `change`, but `search/projections.ts:143-196` has no loader for either, so they are never
  indexed. Add the projections and index-on-write hooks.
- **⌘K renders fallback headings.** The label map in `dashboard/src/components/layout/command-menu.tsx:18-27`
  keys on `cmdb_item`, `device`, `service`, `form`, `approval`; the server returns `cmdb_object`, `asset`,
  `problem`, `change`. Align the map with `SEARCH_OBJECT_TYPES`.
- **Index writes are not best-effort.** §6 says a failed index write logs and does not fail the request;
  `routers/index.ts:495` and `server/tools/cmdb.ts:212` both `await indexTicket` unguarded, so a projection
  failure fails ticket creation. Wrap them.
- **Axel cannot recover from a typed CMDB error.** `server/tools/cmdb.ts:88-92` returns a correct
  `Class "X" does not declare property "Y"` message, but `server/grpc.ts:513-524` hands it back as
  `ok: true`; `agent/axel/loop.py` has no branch on `ok`, `error` or `code`, `_evidence()` only greps for
  the substrings "error" and "failed", and `consecutive_failures` is **reset** at `:322`. DoD 3's recovery
  half is unimplemented and untested. Branch on `payload.ok === false`, feed `error.message` back as a
  corrective observation, count it against the budget, and add a test to `agent/tests/test_cmdb_tools.py`.

### D8 — Two API-key gaps

- **Rate limits are in-process constants** (120 per key per minute, 2000 global) at
  `server/api-keys/resolver.ts:36-42`. The plan names `api_key_rate_limits` and `api_rate_limits`; neither
  table exists, so limits are not configurable and do not survive a restart or hold across replicas.
- **The generated OpenAPI spec declares no security.** 140 paths, no `securitySchemes`, no operation-level
  `security`, and no documented required capability, and the reference page at `/api-reference` is served
  unauthenticated. The procedures themselves are correctly gated — this is documentation, not a hole — but
  DoD 13's third clause fails. Declare a bearer scheme and attach each procedure's capability via oRPC
  route metadata. Confirm the current metadata API with `context7` first.

---

## Definition of done

- A seeded rule that fully settles a ticket demonstrably prevents the model from being called, and the
  skip is recorded.
- A procedure distinguishes rule-settled from model-settled tickets, and tokens-per-ticket is reported
  before and after.
- An invalid API key returns 401.
- One action union, imported by both engines, with a test that compares the sets.
- No workflow action silently succeeds.
- A deployment CI linked to a business process reports that process impacted, on a fresh database.
- An analyst holding no admin capability can save a view.
- Axel recovers from an undeclared-property error inside its budget, with a test.
- All five component gates pass, run and quoted.
