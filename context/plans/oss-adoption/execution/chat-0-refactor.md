# Brief 0 — Reorganize contracts and routers by domain

**Read first:** [README.md](README.md) — ground rules and the list of things that are already correct and
must not be changed.
**Runs before:** briefs A–E. They are waiting on you.
**Shape:** you are an orchestrator. Analysis fans out to read-only subagents; **every write is yours.**
**Reserved migrations:** none. **This refactor introduces no migration and no schema change.**
**Status file you own:** `context/plans/oss-adoption/execution/status/chat-0.md`

## Mission

The API is organized by adoption tier, which was a planning concept, not a product boundary. `tier4.ts`
alone carries assets, email, scheduling, service status, SSO, documents and suppliers — seven unrelated
domains. Tier 0, Tier 1 and Tier 3 contracts never moved out of `contracts/index.ts` at all.

Reorganize both by product domain. **This is a mechanical refactor: no behaviour changes, no schema
changes, no migration, no procedure renamed.**

You are the prerequisite for five sessions that run after you. Today they would have to share
`contracts/index.ts` (25.8 KB) and `routers/index.ts` (58.1 KB) by *region*, which is a coordination
promise rather than a guarantee. Once you land, each session owns whole files. **Say so in your status
file the moment the split is done.**

## What the files actually look like

Both mega-files already have the seam you need. They are shared declarations followed by one large object
literal:

| File | Shared declarations | The object | Tail |
|---|---|---|---|
| `src/contracts/index.ts` | lines 1–404 — `ticketStatus`, `ticketRoute`, `resolutionCode`, `recordType`, `impact`, `urgency`, `priority`, `category`, `progressMarker`, and the capability list | `appContract` from line 405 | `AppContract` at 1010 |
| `src/server/routers/index.ts` | lines 1–357 — imports and five helpers: `findTicket`, `findTicketMessages`, `decodeCursor`, `getRun`, `startTicketRun` | `appRouter` from line 358 | `AppRouter`, `AppRouterClient` at 2049 |

The top of each file is already, in substance, the shared module. Extract it first and the rest is moving
object keys.

---

## Target layout

```text
src/contracts/
  shared.ts        the zod primitives and schemas more than one domain needs
  index.ts         composition only — assembles and exports appContract, AppContract
  identity.ts      roles, capabilities, teams, departments, grants, user kind
  tickets.ts       lifecycle, list, stats, messages, presence, links, merge, audit, time, CSAT
  devices.ts       enrolment, device list, device commands
  catalogue.ts     services, subcategories, forms, request catalogue, approvals
  problems.ts
  changes.ts       changes, CAB, PIR
  knowledge.ts
  cmdb.ts          classes, properties, objects, relationships, impact
  automation.ts    rules, workflows, webhooks, notifications, saved views, search, api keys
  assets.ts        assets, import, inventory, software licences
  scheduling.ts    scheduled work, recurrence, snooze, calendars
  status.ts        service status  ← already exists, keep its meaning
  mail.ts          mailboxes, inbound, outbound, templates, channels
  documents.ts     ← already exists
  suppliers.ts     suppliers, contracts, coverage
```

Mirror the same names under `src/server/routers/`, adding `agent-runs.ts`, plus a deliberately thin
`src/server/routers/shared.ts` — see the helper rule below.

**Also split `dashboard/src/features/tier4/components.tsx`** — 643 lines carrying assets, scheduling,
suppliers, mail, dashboard configuration and documents in one file — into the matching dashboard feature
folders. It is the same defect on the frontend, and brief E owns four of those domains afterwards.

### The router helpers get domain homes, not a bucket

**Do not sweep all five helpers into `routers/shared.ts`.** That replaces a tier bucket with a generic
bucket and loses the ownership this refactor exists to create. Assign by domain:

| Helper | Home | Why |
|---|---|---|
| `findTicket`, `findTicketMessages`, `decodeCursor` | `routers/tickets.ts` | Ticket queries and ticket cursor encoding. Export them; other domains import from tickets. |
| `getRun` | `routers/agent-runs.ts` | Agent runs are their own domain, not a ticket detail. |
| `startTicketRun` | `routers/shared.ts` | Genuinely cross-domain: brief D calls it from three intake paths, and brief F consolidates those paths into one creation service. |

`shared.ts` holds only genuinely cross-domain orchestration after that. If it ends up holding four of the
five, you have made a bucket. Apply the same test to anything Subagent 3 surfaces.

### Three naming decisions, already made

- **`identity.ts`, not `auth.ts`.** `src/auth/` already exists and is Better Auth setup. The Tier 0 content
  is roles, teams, grants and user kind — administration, not authentication. A `contracts/auth.ts` beside
  `src/auth/index.ts` would read as the same thing.
- **`status.ts` already exists and means service status.** Keep that meaning. Ticket-status vocabulary
  belongs in `tickets.ts` or `shared.ts`, never here.
- **Do not create `tier0.ts` or `tier1.ts`.** The adoption tiers are temporary planning concepts; product
  domains are the durable boundary. This is the point of the exercise.

---

## Phase 1 — Analysis, in parallel, read-only

The two decisions that carry real risk in this refactor are **where the shared-module boundary falls** and
**whether the proposed layout creates import cycles**. Both are cheap to answer before you move code and
expensive to discover in the middle of step 4. Front-load them.

Spawn these four subagents **in one message so they run concurrently**. Every one is read-only: they read,
they report, they change nothing. Give each the target layout above and the file map.

**Subagent 1 — Procedure-to-domain map.**
Enumerate every key of `appContract` in `src/contracts/index.ts`, `contracts/tier2.ts` and
`contracts/tier4.ts`, and every key of `appRouter` in `routers/index.ts`, `routers/tier2.ts`,
`routers/tier3.ts` and `routers/tier4.ts`. Assign each to exactly one domain from the target layout.
Return a table of `procedure → domain → current file → target file`, and a separate list of any procedure
whose domain is genuinely ambiguous, with the argument for each candidate. The expected total is 140
procedures; report the number found and flag any mismatch.

**Subagent 2 — Shared-module boundary.**
Read `contracts/index.ts` lines 1–404 and the declaration blocks of `contracts/tier2.ts`,
`contracts/tier4.ts`, `contracts/status.ts` and `contracts/documents.ts`. For each declared schema or
primitive, report which domains reference it. Propose the exact contents of `contracts/shared.ts`: every
declaration used by more than one domain, and nothing else. Name explicitly which declarations should
instead move down into a single domain file because only that domain uses them. Include the duplicated
capability list at `contracts/index.ts:200` in the proposal and say where it belongs.

**Subagent 3 — Router helper call graph.**
Trace `findTicket`, `findTicketMessages`, `decodeCursor`, `getRun` and `startTicketRun` in
`routers/index.ts`. For each, report every call site and which target domain that call site belongs to.
Then sweep `routers/index.ts`, `routers/tier2.ts`, `routers/tier3.ts` and `routers/tier4.ts` for **any
other** function, constant or local helper called from more than one prospective domain — these are the
ones that will bite during extraction and are not on the list of five. Return a table of
`helper → callers → home`.

**Subagent 4 — Cycle and import-discipline check.**
Contract files may import **only** `zod`, `@orpc/contract` and sibling contract files — verify that still
holds today across all five contract files and report any violation. Then, given the target layout and
Subagent 2's boundary, identify every case where one domain contract would need to import another domain
contract rather than `shared.ts`. Report each as a potential cycle with the schema that causes it. Do the
same for the router files against their own imports.

**When they return:** reconcile the four reports. Where Subagent 1 and Subagent 2 disagree about a
schema's home, Subagent 2's usage evidence wins. Write the reconciled domain-to-file map into your status
file **before** you write any code — briefs A–E read it to find what they own, and you will need it
yourself as the checklist for phase 2.

If a subagent returns something that contradicts this brief, trust the code over the brief and say so in
your status file.

---

## Phase 2 — The writes, serial, yours alone

Do not delegate any of this. One mind holding the whole map is exactly right for a mechanical move, and a
second writer on the same files is how a lost write happens.

1. **Capture the baseline.** With the API running on `localhost:3000`:
   ```bash
   curl -s http://localhost:3000/api-reference/spec.json -o spec-before.json
   ```
   It should contain **140 paths**. This is your regression gate — stronger than the test suite, because a
   byte-identical spec proves every procedure name, input schema, output schema and route survived.
   Also run the full gate set now so you know what green looks like before you touch anything.

2. **Extract `contracts/shared.ts`** to Subagent 2's boundary. Nothing else changes yet; the gates must
   still pass.

3. **Relocate the router helpers to the domain homes in the table above**, plus anything Subagent 3
   surfaced, judged by the same rule. Gates again.

   `startTicketRun` must end up exported wherever it lands: brief D calls it from three intake paths and
   brief F consolidates those paths into one creation service. Making it importable instead of a private
   function inside a 58 KB file is a large part of why this refactor runs first.

4. **Split `contracts/index.ts` by domain**, leaving it as composition only. This is the step the five
   sessions are blocked on.

5. **Split `server/routers/index.ts` by domain**, leaving it as composition only.

   → **Checkpoint.** Steps 2–5 capture the entire coordination benefit. If you are running long, stop
   here, tell the user, and the five sessions can start. Steps 6–7 have no deadline.

6. **Split `contracts/tier2.ts` and `contracts/tier4.ts`** into their domain files, and the matching
   routers. These are single-owner files today, so this is tidiness rather than unblocking.

7. **Publish and verify.** `pnpm contracts:publish` from `axioma/api`, then the full gate set and the spec
   diff.

Run the gates after each of steps 2–6, not only at the end. A mechanical refactor that breaks at step 5 is
trivial to bisect if you know step 4 was green.

---

## Scope — what you must not do

- Do not rename a procedure, change an input or output schema, or change a route.
- Do not change an authorization requirement. Every procedure keeps the exact builder it has today.
- Do not change `appContract` or `AppContract`'s public shape, or `appRouter`'s behaviour.
- Do not touch database schemas or migrations. **You introduce no migration.**
- Do not fix defects you find. Five other briefs own them. Write anything you or a subagent spots into
  your status file under *Handed off* and move on — a behaviour change smuggled into a mechanical refactor
  is the one thing that makes this diff unreviewable.

**`publish-contracts.mjs` needs no change.** It does a directory-level `rm -rf`, `mkdir`, recursive `cp` of
`src/contracts`, then `stampGenerated` recurses into subdirectories. New files are mirrored automatically.
Verify this rather than assuming it, but do not rewrite it.

---

## Two guarantees that already exist — keep them working

- **`server/authorization-policy.test.ts`** asserts that all 140 procedures are bound to an explicit
  builder, and it is your net for "authorization checks unchanged". **Brief P rewrote it to assert on the
  composed router rather than on source text** — before that it called `readFileSync` on
  `./routers/index.ts`, which your split would have broken by construction. Confirm it no longer reads
  source before you rely on it; if it still does, stop and tell the user, because brief P has not landed
  and you have no authorization net.

  It works because `os` and `authenticatedProcedure` are deliberately **not** exported from
  `server/orpc.ts` — a procedure cannot be written without naming a capability. **Do not export them to
  make the split easier**, and do not weaken this test to get green. If it fails, you moved something
  wrong.
- **Contract and proto mirrors are byte-identical** to `dashboard/src/sdk/contracts`,
  `portal/src/sdk/contracts`, `agent/proto` and `cli/proto` today, apart from the generated banner. They
  must still be after you publish.

---

## Acceptance

- [ ] `spec-after.json` is byte-identical to `spec-before.json` — 140 paths, same operations, same schemas.
- [ ] Contracts and routers are grouped by product domain; no `tier*.ts` remains anywhere, including
      `dashboard/src/features/tier4/components.tsx`.
- [ ] `routers/shared.ts` holds only genuinely cross-domain orchestration — not a rebranded bucket.
- [ ] `contracts/index.ts` composes and exports `appContract` and `AppContract`; `server/routers/index.ts`
      composes and exports `appRouter`, `AppRouter` and `AppRouterClient`.
- [ ] No contract file imports anything but `zod`, `@orpc/contract` and sibling contracts.
- [ ] No import cycle between domain files.
- [ ] `authorization-policy.test.ts` passes unmodified.
- [ ] `pnpm contracts:publish` run; dashboard and portal SDK copies synchronized.
- [ ] No new migration; `drizzle-kit check` still clean.
- [ ] All five component gates pass, run and quoted: api (`biome`, `tsc`, **133 tests**), agent (`ruff`,
      **41 pytest**), cli (`go vet`, `go build`, **41 tests**), dashboard and portal (`biome`, `tsc`).

## When you are done

Your status file must end with the final domain-to-file map. Briefs A–E read it to find what they own,
and their `file:line` references were captured before you ran — the symbol names are what stays true.
