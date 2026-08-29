# Brief P — Preflight: make the refactor's safety nets real

**Read first:** [README.md](README.md) — ground rules and the list of things that are already correct.
**Source:** [github-issues-codebase-audit.md](github-issues-codebase-audit.md) issues 3, 5, 6
**Runs before:** brief 0, which runs before everything else.
**Reserved migration:** `0016`, and only if step P2 needs one.
**Status file you own:** `context/plans/oss-adoption/execution/status/chat-p.md`

## Mission

Brief 0 reorganizes the API by product domain and leans on two guarantees to prove it changed no
behaviour: a passing `authorization-policy.test.ts`, and a clean `drizzle-kit check`. **Neither guarantee
currently holds the weight put on it.** One of the tests will break the moment files move, and the
migration metadata is incomplete enough that a future generation could propose destructive changes.

This brief makes both real. It is small, it is a prerequisite for everything else, and it should not grow.

---

## P1 — Convert the source-reading tests to behaviour tests · blocks brief 0

**Confirmed:** `api/src/server/authorization-policy.test.ts:2` imports `readFileSync`, and `:61` and `:67`
read `./orpc.ts` and `./routers/index.ts` as **text**, matching patterns against the source. It is the
test brief 0 was told to treat as its authorization net, and after the refactor `routers/index.ts` is
composition only — so the test breaks by construction, and whoever is mid-refactor will be tempted to
weaken it to get green. That is exactly the wrong failure mode for the one test standing between a
mechanical move and a silent authorization regression.

Same pattern, lower stakes, in `api/src/server/tier4-gaps.test.ts` and
`api/src/server/tier4-integration.test.ts` — two `readFileSync` calls each, asserting that source strings
exist. Both also carry tier names that brief 0 is retiring.

And in the agent: `agent/tests/test_prompt_config.py:161` — `test_run_limits_match_api` builds
`Path(__file__).parents[2] / "api" / "src" / "shared" / "index.ts"`, reads it, and regexes `maxToolCalls`,
`maxModelTurns` and `runDeadlineMs` out of the TypeScript. The architecture treats the agent as a
separately deployable component; a test that reaches into a sibling checkout contradicts that, and it
fails outright if the agent is ever cloned alone.

**Build:**

- **Rewrite `authorization-policy.test.ts` to assert on the composed router, not on source text.** The
  property worth keeping is the one that makes deny-by-default structural: every procedure in `appRouter`
  is reachable only through a builder that named a capability, and `os` / `authenticatedProcedure` are
  not exported from `server/orpc.ts`. Assert that against the imported router object and the module's
  exports. It must survive arbitrary file moves — that is the whole point.
- Replace the two `tier4-*` source assertions with tests of the behaviour they were standing in for, and
  rename them after that behaviour. If a given assertion turns out to be protecting nothing, delete it and
  say so rather than porting it.
- Give the agent's run limits an explicit owner. Either the agent declares them and the API asserts
  against the agent's published value, or they move into the proto / a small shared config the agent reads
  at runtime. Do not keep parsing TypeScript with a regular expression.

**Acceptance:** moving any file in `api/src/server/` breaks no test that is not actually about that file.

---

## P2 — Reconcile Drizzle declarations and migration metadata

**Confirmed:** the live database enforces constraints the Drizzle declarations do not describe. A
table-and-column diff comes back clean — that check was run and it passes — but it is structurally blind
to this, so the drift is real and was missed:

- `tickets.service_subcategory_id` + `service_id` composite foreign key, and the
  `tickets.merged_into_id` self-reference — neither declared in `db/schema/tickets.ts`.
- `services.sla_id`, `services.ola_id`, `service_subcategories.form_id` — enforced in the database,
  declared as loose `text` in `db/schema/catalogue.ts`.

The declarations were probably left loose to dodge circular TypeScript imports between schema modules.
That is a solvable problem — Drizzle supports deferred references via a callback, and a neutral module
can break a genuine cycle. Integrity that PostgreSQL already enforces should be visible to the code.

**Confirmed metadata gap:** 16 migrations are applied and `_journal.json` lists `0000`–`0015`, but the
snapshot files under `src/db/migrations/meta/` stop at `0006_snapshot.json`. `drizzle-kit generate`
diffs against the latest snapshot, so a generation today reasons from a nine-migration-old picture and
can propose recreating or dropping objects that already exist. Every brief after this one adds
migrations.

**Build:**

1. Declare the five missing constraints, breaking import cycles with deferred references rather than by
   omitting integrity.
2. Establish a current snapshot baseline through `0015`.
3. Apply `0000`–`0015` to a clean database and confirm it matches the declared schema.
4. Generate once, **review the diff, and confirm it contains no unexpected create or drop.** If it is
   empty, take no migration at all — `0016` is reserved in case it is not.
5. Add a drift check that runs against a clean migrated database, so this cannot silently recur.

**Do not** rename, reorder or edit any existing migration or journal entry, including the ones with tier
names in them. They are applied history and their hashes are recorded in the database. Future migrations
get domain names.

---

## P3 — Settle the `knowledge_search` limit mismatch

**Confirmed:** the agent declares `limit: int = Field(default=5, ge=1, le=10)`
(`agent/axel/tools.py:44`); the API declares `z.number().int().min(1).max(20).default(8)`
(`api/src/server/tools/knowledge.ts:9`). The model validates against one contract and the API enforces
another. A request for 15 results passes the API's schema and is rejected by the agent's before it is ever
sent.

Pick one default and one maximum deliberately — the API's is the enforcing side, so it is the natural
winner unless there is a reason the agent should be more conservative — align both, and add a test that
fails when they diverge again.

While you are there, note in your status file whether device action names match across
`agent/axel/tools.py`, `api/src/server/tools/device.ts`, `api/src/server/grpc.ts` and
`cli/internal/device/actions.go`. **Report only; do not fix.** A full parity harness is
[issue 5](github-issues-codebase-audit.md)'s scope and belongs after the milestone briefs.

---

## Out of scope

Everything else in the audit. You are not splitting files, not centralizing ticket creation, not touching
the portal contract, not deleting `t4-asset-import.ts`. If you find something, write it into your status
file under *Handed off*.

## Definition of done

- [ ] `authorization-policy.test.ts` asserts on the composed router and survives arbitrary file moves.
- [ ] No test in `api/` reads router or server source as text.
- [ ] No agent test reads a file from the `api/` checkout.
- [ ] The five missing constraints are declared, with no import cycle.
- [ ] Migration metadata represents the schema through `0015`; a reviewed generation shows no unexpected
      create or drop.
- [ ] A clean database applies `0000`–`0015` and matches the declared schema.
- [ ] `knowledge_search.limit` has one default and one maximum, with a test.
- [ ] Existing migration SQL, journal tags and applied hashes are unchanged.
- [ ] All five component gates pass, run and quoted.

## When you are done

Say in your status file whether P1 landed. Brief 0 is waiting on it and should not start without it.
