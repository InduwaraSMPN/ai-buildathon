# Execution — five parallel chats

**Document role:** Coordination map for finishing the adoption programme across five concurrent sessions
**Parent:** [oss-adoption.md](../oss-adoption.md)
**Written:** 2026-08-29, from a verification audit of the working tree, the live database and the running API

The programme is **30 of 40 milestones complete**: Tier 0 5/5, Tier 1 10/12, Tier 2 4/7, Tier 3 2/7,
and Tier 4 9/9. The close-out repaired and strengthened the migration ledger, seeded the reference data
needed by shipped features, removed legacy ticket categories, completed the SLA and settlement read
surfaces, hardened API keys, and closed the deferred architecture and parity issues. Remaining partial
milestones are explicitly tracked in the tier definitions rather than hidden behind schema-only work.

Five briefs divide that remaining work so five sessions can run at once without fighting over the same
files. Each brief is self-contained: it carries the confirmed evidence, so no session needs to re-audit.

**Two briefs run first, in order, alone.** [chat-p-preflight.md](chat-p-preflight.md) makes the refactor's
safety nets real — one of the tests brief 0 relies on currently reads router *source text* and would break
the moment files move. Then [chat-0-refactor.md](chat-0-refactor.md) reorganizes the API by product
domain; until it lands, briefs A, B and D would have to share `contracts/index.ts` and `routers/index.ts`
by *region*, which is a coordination promise rather than a guarantee. Afterwards each session owns whole
files. Run P, then 0, then the five together, then F.

A second audit — [github-issues-codebase-audit.md](github-issues-codebase-audit.md), a read-only
cross-codebase pass on the same date — found architecture and correctness issues the milestone audit
missed. Briefs P and F come from it, and its remaining issues are listed under *After the milestones*
below.

| Brief | Scope | Owns | Migrations |
|---|---|---|---|
| [chat-p-preflight.md](chat-p-preflight.md) · **first** | Behaviour tests for the source-reading tests; Drizzle constraint and snapshot reconciliation; the tool-limit mismatch | `authorization-policy.test.ts`, `db/schema/{tickets,catalogue}.ts`, migration metadata | 0016 if needed |
| [chat-0-refactor.md](chat-0-refactor.md) · **second, orchestrator** | Reorganize contracts, routers and the dashboard Tier 4 bucket by product domain. Mechanical only. | `contracts/`, `server/routers/`, `dashboard/features/tier4/` | none |
| [chat-a-identity.md](chat-a-identity.md) | Identity, authorization, admin surfaces, database hygiene | `auth/`, `authorization.ts`, `contracts/identity.ts`, `routers/identity.ts`, `features/admin/` | 0017–0019 |
| [chat-b-tier1.md](chat-b-tier1.md) | Status as data, SLA, breach, pending, resolution codes | `tickets.ts`, `grpc.ts`, `pending.ts`, `sla/`, `contracts/tickets.ts`, `routers/tickets.ts`, queue components, portal copy | 0020–0023 |
| [chat-c-tier2.md](chat-c-tier2.md) | Problems, changes, knowledge, forms, catalogue | `contracts` and `routers` for `catalogue`, `problems`, `changes`, `knowledge`; `features/{problems,changes,knowledge}/`, `request-catalogue/` | 0024–0027 |
| [chat-d-tier3.md](chat-d-tier3.md) | Rules before the model, action vocabulary, CMDB relationships, workflows, views | `rules/`, `workflows/`, `cmdb/`, `contracts` and `routers` for `cmdb` and `automation` | 0028–0031 |
| [chat-e-tier4.md](chat-e-tier4.md) | Mail, inventory, origins, dead-table cleanup | `mail/`, `inventory.ts`, `cli/`, `features/tier4/`, `contracts` and `routers` for `assets`, `scheduling`, `status`, `mail`, `documents`, `suppliers` | 0032–0035 |
| [chat-f-ticket-creation.md](chat-f-ticket-creation.md) · **last** | One creation service across five intake paths. **Correctness, not organization.** | `server/tickets/create.ts`, the five intake adapters | 0036–0037 if needed |

---

## Execution order

```text
P   preflight ─────────►  0   domain refactor ─────►  A ─┐
    safety nets real         orchestrator + 4              B ─┤
    for 0's gates            read-only subagents           C ─┼──►  F   one ticket-creation
                                                           D ─┤        service, five paths
                                                           E ─┘
```

1. **P — preflight.** Serial, small. Nothing else starts until it lands, because brief 0's authorization
   net does not currently survive a file move.
2. **0 — domain refactor.** Serial, orchestrator. Ends with the domain-to-file map in its status file.
3. **A – E — the milestone briefs.** Parallel, one session each, own branch each. Start A first if you
   can: until it lands no account can be `staff`, so the dashboard redirects everyone and the other four
   cannot hand-verify anything in it.
4. **F — ticket creation.** After the five, because it consolidates call sites B, C, D and E are all
   editing. It is a correctness fix, not cleanup — do not drop it if the others run long.

### After the milestones

The remaining issues from [github-issues-codebase-audit.md](github-issues-codebase-audit.md), none
urgent, roughly in dependency order:

| Issue | What |
|---|---|
| 10 | Correct dependency direction — `db/schema/rules.ts` importing from `server/rules`, routers importing document policy from an HTTP adapter — and split `index.ts` into a side-effect-free `app.ts` factory plus a minimal entry point. Unlocks real router tests. |
| 9 | `t4-asset-import.ts` is test-only; production uses `assets/import.ts`. Move the planning logic across, test the production path, delete the pair. |
| 2 | CI freshness checks so a stale contract or proto copy fails the build instead of drifting quietly. |
| 5 | A full tool-contract parity harness across API, agent, proto and CLI. Brief P settles the one confirmed mismatch and reports on device-action names; this is the durable fix. |
| 7 | Narrow the portal to a reporter-facing contract subset and centralize the multipart document upload. |
| 4 | Retire `cmdb_items` after a rollback window. The `category` / `subcategory` half is brief C's task C7. |

---

## Running them at the same time

**One branch or worktree per session.** Ask the user which branch you are on before you write anything.
Do not create, switch, commit, push or merge without the user asking you to — that rule holds in every
session.

**Reserved migration numbers.** Each brief owns a block of four. Never take a number outside your block,
even if lower ones look free — another session has claimed them.

**`src/db/migrations/meta/_journal.json` will conflict.** Every session that adds a migration appends to
it. This is expected. Resolve by keeping every entry from both sides, ordered by `idx`, and renumbering
`idx` so it stays contiguous. Nothing else in the file matters.

**Ownership is by file, once brief 0 has landed.** Before the refactor, `api/src/server/routers/index.ts`
(58 KB) and `api/src/contracts/index.ts` carried five briefs' worth of procedures and had to be shared by
region. After it, `index.ts` on both sides is composition only, and each session owns whole domain files.
Two shared modules exist and are read by everyone: `contracts/shared.ts` (zod primitives, the capability
list) and `server/routers/shared.ts` (`findTicket`, `findTicketMessages`, `decodeCursor`, `getRun`,
`startTicketRun`). Treat both as append-only — add what you need, change what is there only if you must,
and say so in your status file.

**Line numbers in these briefs predate the refactor.** They were captured against the working tree before
brief 0 ran, so after it lands the paths change and the lines shift. **Locate by symbol name** — procedure
names, function names and schema names all survive the refactor unchanged, by design. The evidence in each
brief stays true; only its coordinates move.

**Do not fix another brief's items.** If you find a defect that belongs to someone else, write it in your
status file under *Handed off* and move on. Duplicated fixes cost more to merge than they save.

---

## Subagents — read-only, never writing

Every brief here is a full session's work, so use subagents to widen what you can see, not to multiply
what writes. **Delegate reading; keep every edit in the main session.** Two agents editing one working
tree is a lost write, not a merge conflict, and lost writes are silent.

Where they earn their keep:

- **Locating symbols after the refactor moved them.** Every `file:line` in these briefs predates brief 0.
  A subagent that answers "where does `updateRoleCapabilities` live now, and what calls it" is faster than
  grepping it yourself and costs you no context.
- **Front-loading a risky decision.** Brief 0 does this deliberately — four parallel read-only agents settle
  the shared-module boundary and the cycle check before any code moves.
- **Verifying a claim you are about to act on.** "Confirm nothing else reads `sla_notification_rules`" is a
  good subagent question. "Fix `sla_notification_rules`" is not.

Where they do not: running gates (a `tsc` run against a tree someone else is mid-edit in means nothing),
anything that writes, and anything whose result you would not check.

## The blocker protocol

You will hit things you cannot finish — work that depends on another session, a decision only the user can
make, missing infrastructure. **Do not stall, and do not wait.**

1. Record the item in your status file at `context/plans/oss-adoption/execution/status/chat-<x>.md`.
2. Say what is blocked, what it is blocked on, and what you already did toward it.
3. Move to the next item and keep going.
4. Report the full blocker list at the end of your turn so the user can decide what to unblock.

Your status file is yours alone — no other session writes to it, so it never conflicts. Update it as you
go, not only at the end; the user reads these to decide what to run next.

Two blockers are known in advance and will affect everyone:

- **No account can be staff, and nobody holds `admin.roles`.** Until brief A lands, the dashboard
  redirects every user to the portal and the roles screen is unreachable. If a task needs a signed-in
  staff account to verify by hand, build it, ship it, and record the verification as blocked on A.
- **Most reference tables are empty.** If your feature needs seed rows that another brief owns, note it
  and continue; do not seed another brief's tables.

---

## Ground rules, every session

- **PowerShell.** Prefer `rg` for search. No `grep`, `sed`, `awk`, `rm -rf`, `export VAR=`.
- **Gates before you report done.** From `axioma/`:
  - `api` — `npx biome check .`, `npx tsc --noEmit`, `npm test` (currently **133 pass**)
  - `agent` — `uv run ruff check .`, `uv run pytest -q` (currently **41 pass**)
  - `cli` — `go vet ./...`, `go build ./...`, `go test ./...` (currently **41 pass, 5 packages**)
  - `dashboard`, `portal` — `npx biome check .`, `npx tsc --noEmit`
  - Never report a gate as passing without running it. If one fails, quote the failing line.
- **The database is live** on `postgresql://postgres:password@localhost:5432/axioma` (container
  `axioma-postgres`). Query it through the `dbhub` / postgresql MCP tool. Verify against the database,
  not only against the schema files.
- **The API may already be running** on `localhost:3000`. Check `/health` before starting another.
- **Use `context7`** for any library question — oRPC, Drizzle, Better Auth, TanStack, Hono, Zod. Do not
  answer from memory; this repo pins Better Auth 1.7.1 and oRPC 1.15, both of which have moved recently.
- **Publish contracts after changing them.** `pnpm contracts:publish` from `axioma/api` mirrors
  `src/contracts` into `dashboard/src/sdk/contracts` and `portal/src/sdk/contracts`, and the proto into
  `agent/proto` and `cli/proto`. They are byte-identical today; keep them that way.
- **Match the surrounding code.** This codebase has a consistent voice — table-driven logic, pure
  functions with injected clocks and databases, comments that explain a decision rather than restate the
  line. Read a neighbouring file before writing a new one.

---

## What is already correct — do not "fix" these

The audit confirmed these hold. Changing them would be a regression.

- **No stored deadlines anywhere.** Stopwatches carry `accumulated_ms` and `pending_ms`. Never add a
  deadline column.
- **`merged_into_id` is a column, never a status. `snoozed_until` is a timestamp compared at query time.**
  The live `ticket_statuses` table has seven rows and contains neither `merged` nor `snoozed`. Keep it so.
- **The portal boundary is enforced by data shape.** `getMyTicket` filters visibility in SQL *and* the
  contract type omits the field. Knowledge does the same for audience. Never add a client-side filter.
- **Axel reads more than it writes.** Nine tools; none authors knowledge, none posts into the human case
  log, none holds credentials. Exactly one new write path across five tiers — the change record on patch.
  Only brief C may add an agent read tool, and only a read tool.
- **Deny-by-default is structural.** `os` and `authenticatedProcedure` are deliberately unexported from
  `server/orpc.ts` so a procedure cannot be written without naming a capability, and
  `authorization-policy.test.ts` asserts it. Never export them.
- **Email threads by reference, never by subject.** Word-boundary matching against retained ticket
  numbers, with a test that proves `"Re: printer issue"` does not match.
- **Multi-tenancy stays deferred.** No `tenant_id` on any table.
