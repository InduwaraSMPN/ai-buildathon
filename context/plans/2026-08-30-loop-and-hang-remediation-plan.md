# Loop and Hang Remediation Plan

Date: 2026-08-30
Scope: `dashboard/`, `portal/`, `api/`, `agent/`, and `cli/`

This application has no real users. There is no backward compatibility, legacy support, or
rollback requirement. Contracts, protobuf definitions, database schema, and helper signatures
may all change freely.

The calendar render-driven request loop is already resolved in
`dashboard/src/routes/_auth/calendar.tsx:15-16`. Render-scoped `new Date()` values flowed into
`orpc.listCalendar.queryOptions({ input: { from, to } })`; oRPC places `input` in the query key
and TanStack Query hashes it structurally, so a millisecond-precision `Date` produced a new key
on every render. Lazy `useState` initializers freeze both values for the component's lifetime.
That change is staged but not committed.

---

## Prerequisites

Every one of these gates at least one item below. None exists today. Land them first.

### P1 — Database migration

Confirmed against the live database. Add in a single migration, then run `pnpm db:check`
(`drizzle-kit check` plus `scripts/check-migration-drift.mjs`).

| Table | Addition | Consumed by |
|---|---|---|
| `agent_runs` | `worker_id text`, `accepted_at timestamp`, `lease_expires_at timestamp` | A2 |
| `agent_runs` | `CREATE INDEX ... ON agent_runs (lease_expires_at) WHERE status = 'running'` | A2 |
| `webhook_deliveries` | `claimed_at timestamp` | A5 |
| `webhook_deliveries` | partial index `WHERE status = 'delivering'` | A5 |
| `workflow_executions` | `claimed_at timestamp`, `lease_expires_at timestamp` | A12 |
| `inbound_emails` | `attempt_count integer NOT NULL DEFAULT 0`, `last_error text` | A7 |
| new table | `ticket_creation_claims` | A1 |
| new table | `agent_tool_calls` | A9 |
| new column | `changes.verification_deadline_at timestamp` | A13 |

`agent_runs` currently carries only `agent_runs_ticket_idx (ticket_id, started_at)`. A lease
sweep without the partial index above sequentially scans the table.

`webhook_deliveries` has a check constraint `webhook_deliveries_attempts_bounded`
(`attempt_count <= max_attempts`, `api/src/db/schema/workflows.ts:113-116`). Any reclaim that
re-increments `attempt_count` must retain the `attempt_count < max_attempts` guard or the sweep
throws on a final-attempt row.

`ticket_creation_claims` is preferred over a column on `tickets`: it scopes the key per reporter,
allows expiry, and keeps the hot `tickets` table narrow. Model it on the two existing precedents —
`recurring_ticket_occurrences.idempotency_key` and `sla_escalation_events.idempotency_key`.

`agent_tool_calls` needs `UNIQUE (run_id, call_id)` and a `status` column supporting a two-phase
lifecycle. See A9 for why a single-phase ledger is insufficient.

No cursor column is needed for A8. `recurring_ticket_occurrences_slot_uidx
(recurring_ticket_id, occurs_at)` already makes `MAX(occurs_at) WHERE recurring_ticket_id = ?`
an index-only backward scan. A separate cursor column would create a second source of truth that
can drift from the occurrence rows.

### P2 — Contract change

A1 adds an idempotency key to `createTicket` (`api/src/contracts/tickets.ts:303-317`) and
`createCatalogueRequest` (`api/src/contracts/catalogue.ts`). `api/scripts/publish-contracts.mjs`
copies `api/src/contracts` into both `portal/src/sdk/contracts` and
`dashboard/src/sdk/contracts`, and `pnpm contracts:check` fails on stale generated files. Run
`pnpm contracts:publish` as part of A1 and expect the change to touch three trees.

### P3 — Protobuf change

`AgentMessage` (`proto/axioma.proto:32-39`) carries only `hello | run_update | tool_request |
heartbeat`. There is no acceptance message. `Heartbeat` (`proto:132-134`) is
`{ int64 unix_ms = 1; }` — connection-scoped, with no `run_id`, so it cannot renew a per-run
lease.

A2 therefore needs one of:
- a new `RunAccepted { string run_id = 1; }` variant on `AgentMessage`, or
- treating the first `RunUpdate` for a run as implicit acceptance, and renewing the lease from
  `RunUpdate` and `ToolRequest` — the only per-run signals that exist.

Take the explicit `RunAccepted` variant. The implicit path cannot distinguish "worker never
received the run" from "worker is thinking", which is exactly the distinction the lease exists
to make.

`proto/axioma.proto` is byte-identical across `api/proto/`, `agent/proto/`, and `cli/proto/`
(verified by hash). Any change updates all three and regenerates the Python and Go stubs.

### P4 — Helper signatures

`transitionTicketStopwatches(ticketId, toStatus, at)` (`api/src/server/sla/runtime.ts:100-104`)
closes over the module-level `db` and accepts no transaction. Its sibling
`attachTicketStopwatches` already takes `database: StopwatchDatabase = db`
(`api/src/server/sla/runtime.ts:21-26`). Give `transitionTicketStopwatches` the same parameter.
A2, A11, and A15 all depend on it.

`writeDynamicFieldValues(db: DynamicFieldsDb, ...)`
(`api/src/server/dynamic-fields/index.ts:237-242`) is typed
`DynamicFieldsDb = ReturnType<typeof createDb>`, which a Drizzle `PgTransaction` does not satisfy.
Widen the signature before A1 moves the call inside the ticket transaction. Note also that
`writeDynamicFieldValues` opens its own transaction at line 267 and performs a dynamic `import()`
plus `indexAsset` at lines 292-296; inside the ticket transaction that becomes a savepoint and a
dynamic import on the hot path. Harmless for `objectType === "ticket"`, but make it deliberate.

### P5 — Process-level rejection handler

There is no `process.on("unhandledRejection")` or `uncaughtException` handler anywhere in `api/`,
and `package.json` `start` is a bare `node dist/index.mjs` with no `--unhandled-rejections` flag.
Node's default mode is `throw`, so any unhandled rejection terminates the API process. Add a
handler in `api/src/index.ts` before A10.

---

## Critical

### C1 — Bound subprocess waits in the device daemon

Locations: `cli/internal/device/actions_windows.go:12-31`, `cli/internal/device/daemon.go:163-177`,
`cli/internal/device/daemon.go:179-203`, `cli/internal/device/inventory.go:69-74`,
`cli/internal/device/inventory_windows.go:24-30`

Two single-worker goroutines exist, not one: a command worker at `daemon.go:163-177` and an
inventory worker at `daemon.go:179-203`. Both read from unbuffered channels and both run their
work under `connCtx`, the connection-lifetime context created at `daemon.go:114`. No
`context.WithTimeout` appears anywhere on either path.

A context deadline alone does not fix this on Windows. `runCommand`
(`actions_windows.go:12-16`) assigns a `cappedBuffer` — not an `*os.File` — to `cmd.Stdout` and
`cmd.Stderr`, so `os/exec` allocates a real pipe and a copying goroutine. From the Go 1.25.6
toolchain on this machine, `%GOROOT%/src/os/exec/exec.go:299-300`: *"If WaitDelay is zero (the
default), I/O pipes will be read until EOF, which might not occur until orphaned subprocesses of
the command have also closed their descriptors for the pipes."* `cmd.Cancel` calls
`Process.Kill()` (`exec.go:484-486`), which on Windows is a bare `TerminateProcess`
(`os/exec_windows.go:73`) against the immediate child only — no job object, no process group.

`rg 'WaitDelay|SysProcAttr|JobObject|CREATE_NEW_PROCESS_GROUP'` across `cli/internal` and
`cli/cmd` returns nothing.

The concrete failure: `facets_windows.go:14` runs `& klist.exe 2>$null` as a grandchild
inheriting the pipe. A wedged `klist.exe` — a broken Kerberos or domain-controller path does
exactly this — survives the kill of `powershell.exe`, keeps the pipe write handle open, and
`cmd.Run()` never returns. Cancelling `connCtx` does not release it. The goroutine and the
orphaned process tree outlive the connection, leaking one pair per reconnect.

`daemon_test.go:267-309` (`TestServeConnectionHeartbeatsDuringActionAndCancels`) already
demonstrates the visible symptom: the main select loop keeps heartbeating while a worker is
blocked. The device shows green on the dashboard and silently executes nothing.

Changes:
1. Set `cmd.WaitDelay` (5s is appropriate) in `runCommand`. This is the load-bearing change.
2. Add a Windows job object with `KILL_ON_JOB_CLOSE` plus `CREATE_NEW_PROCESS_GROUP` via
   `SysProcAttr` so descendants are reaped.
3. Add a per-collection `context.WithTimeout` in `CollectInventory` and a per-command timeout in
   the command worker, independent of `connCtx`.
4. Report a timeout as an inventory error rather than a silent gap.
5. Replace `ctx.Err() == context.DeadlineExceeded` (`actions_windows.go:21`) with `errors.Is`,
   and handle `context.Canceled` as a cancellation rather than a command failure.

The command worker matters more than the inventory worker. `execute`'s five-minute
`context.WithTimeout` at `daemon.go:326` cannot rescue it, because that timeout kills only the
parent. When it wedges, every subsequent device command is silently never executed.

### C2 — Restore heartbeats when a maintenance sweep fails

Location: `api/src/server/grpc.ts:1024-1052`

`sweep()` runs `await Promise.all([sweepSla, sweepPending, sweepPresence,
sweepWebhookDeliveries, reconcileCoreSearchDocuments])` at lines 1026-1032, and only then writes
agent heartbeats (1033-1039) and device heartbeats (1040-1050). `Promise.all` rejects on the
first failure, so a single failing sweep skips every heartbeat for that cycle. With
`STALE_MS = 30_000` and `HEARTBEAT_MS = 10_000` (`grpc.ts:51-52`), three consecutive failures
mark every connected device stale and disconnect them.

Change: use `Promise.allSettled` and log per-sweep failures. Heartbeats must not depend on
maintenance work succeeding.

### C3 — Persist change verification state

Locations: `api/src/server/tools/change.ts:32-80`, `api/src/server/tools/index.ts:46, 88, 111, 145`

`patchImageWithChange` commits a `changes` row with `status: "in_progress"` inside a transaction
(lines 41-76), then patches a live Kubernetes deployment at line 78. The only path from
`in_progress` to `completed` runs through the in-memory `pendingVerification` Map
(`tools/index.ts:46`), set at line 145 and cleared at line 111 when the verifying tool actually
runs.

A gateway restart, a run that never calls the verifying tool, or a run that escalates, fails, or
exhausts its budget leaves the change record permanently `in_progress` after a real deployment
was mutated. No sweeper, no lease, no persistence. The Map also grows once per run that invokes
any `verifiedBy` tool and is never pruned for runs that do not complete normally.

Change: persist the pending-verification state on the `changes` row — it already carries
`source_run_id` and `source_step_id` — with a `verification_deadline_at`, sweep expired rows to a
terminal state, and drop the Map.

---

## High

### A1 — Make ticket creation idempotent

Locations: `api/src/server/tickets/create.ts:195-203`, `api/src/server/routers/tickets.ts:215-244`,
`api/src/server/mail/db.ts:217,242`, `api/src/server/scheduling-runtime.ts:53,73`,
`api/src/server/routers/catalogue.ts:255,298`, `api/src/server/routers/mail.ts:184,208`

The commit-then-finalize split lives in the shared helper at `create.ts:198-201`, not in the
portal router. Five call sites use it. Fixing only `routers/tickets.ts` leaves four identical
hazards in mail ingestion, recurrence generation, the catalogue, and the mail router.

Two points of the original framing need correcting:

`finalizeCreatedTicket` (`create.ts:209-232`) is **already fail-soft** — both `indexTicket` and
`fireEvent` are individually wrapped in `try/catch`. Nothing remains to make fail-soft. What
remains is that it is awaited inside the request, so a slow dispatch delays the response and
widens the very timeout window that provokes a duplicate.

There is no automatic client retry. Both frontends use TanStack Query `^5.101.4` with no
`defaultOptions` (`dashboard/src/utils/orpc.ts:10-25`, `portal/src/utils/orpc.ts:9-11`), so v5's
mutation default `retry: 0` applies. Double-click and Enter-key re-entry are both already guarded
(`portal/src/features/tickets/components/request-form.tsx:360-367` and `:793-801`, plus
`FormApi._handleSubmit` bailing on `!canSubmit`). The single real duplicate vector is a **human
clicking Send again** after a lost response: `request-form.tsx:186` clears `isSubmitting` on
failure and re-enables the button with the form fully populated. If the first request committed
but the response was lost, the second click creates a second ticket with a second INC/REQ number.

The server-side amplifier is real: `startTicketRun` throws `ORPCError("SERVICE_UNAVAILABLE")` at
`api/src/server/routers/shared.ts:192-194` *after* the ticket has committed, so the portal sees a
503 for a ticket that exists.

Changes:
1. Accept an idempotency key on `createTicket` and `createCatalogueRequest` (P2).
2. Claim it uniquely in `ticket_creation_claims` inside `createTicketInTransaction`, so all five
   call sites inherit the guarantee.
3. Move custom-field persistence into that transaction (P4 first).
4. Make `finalizeCreatedTicket` non-blocking at the call sites, keeping its existing per-effect
   `try/catch`.
5. In the portal, generate the key with native `crypto.randomUUID()` in a `useRef` inside
   `IncidentRequestForm` (near `request-form.tsx:140`) and `CatalogueRequestForm` (near `:430`),
   and reset it only inside the existing `onSuccess` handlers (`:142-151`, `:432-438`).

Point 5 has one trap that defeats the whole mechanism: generating the key inline at the
`mutateAsync` call site (`:166` and its catalogue equivalent) mints a fresh key on the manual
retry — precisely the failure path the key exists to cover. The key must outlive the failed
attempt. Neither frontend has any UUID source today (`randomUUID`, `nanoid`, `uuid` all return
zero hits across `dashboard/src` and `portal/src`), but `crypto.randomUUID()` is native in secure
contexts and needs no dependency.

Do not move additional work into this transaction without reading A16 first.

### A2 — Expire stranded agent runs

Locations: `api/src/server/grpc.ts:76, 155-199, 833-852, 874-908, 950-956, 984-1022`

Run assignment is in-memory only (`runAgents`, `grpc.ts:76`, set at `:164`). `stream.write` at
`:166` succeeding means the message was buffered, not that any worker accepted it; a `false`
return from backpressure is ignored entirely. `removeAgent` (`:950-956`) deliberately retains the
assignment — the comment reads "Keep run assignments so this stable worker ID may replay retained
terminal updates" — so a worker that dies mid-run leaves both the DB row `running` and the Map
entry resident for the process lifetime.

`reconcileOrphans` (`:984-1022`) already exists and does most of this work, but it runs **once**,
from `listen()` at `:98`. It is also unconditional: it marks *every* `running` run failed. Calling
it periodically as-is would kill healthy in-flight runs. The lease predicate is what makes a
periodic sweep possible, not an optimization on top of it.

Terminal write ordering is inverted: `:833` deletes the in-memory assignment *before* the DB
writes at `:834-852`, so any failure in the ticket update and `ticketTransitions` insert at
`:874-908` — three separate non-transactional statements — leaves the run unassigned, and every
later message from that worker fails the `run ... is not assigned to worker` check at `:481-482`.

Changes:
1. Add `RunAccepted` to the protobuf and have the Python agent send it (P3).
2. Persist `worker_id`, `accepted_at`, and `lease_expires_at` on `agent_runs` (P1).
3. Renew the lease on `RunAccepted`, `RunUpdate`, and `ToolRequest`.
4. Add a lease sweep to the periodic `sweep()` that terminates or requeues only runs whose lease
   has expired, and evict the corresponding `runAgents` entries there.
5. Wrap the terminal run and ticket writes at `:833-908` in one transaction (P4 first), and
   remove the in-memory assignment only after it commits.
6. Make `reconcileOrphans` transactional; it currently issues four independent statements plus an
   N+1 `resolveTicketStatus` call per orphan.

### A3 — Stop recurrence backlog starvation

Location: `api/src/server/scheduling.ts:53-62`

`dueRecurrenceOccurrences` throws `RangeError("due recurrence occurrence limit exceeded")` at
line 59 once `result.length === limit`. The caller has no `try/catch`:
`scheduling-runtime.ts:31-36` invokes it inline inside `for (const rule of rules)`, so the throw
escapes `generateDueRecurrences` entirely and is swallowed by the `.catch` at
`scheduling-runtime.ts:87-89`.

Every rule after the offender is skipped, and every subsequent sweep re-throws at the same rule.
This is a permanent, self-perpetuating stall, not a transient one. With the default `limit` of
100 (`scheduling-runtime.ts:14`), roughly 100 days of backlog on a daily rule disables recurrence
generation system-wide.

Change: `break` out of the loop and return the first `limit` occurrences. Occurrences are
generated in ordinal order, so this guarantees forward progress. No test asserts the throw
(`scheduling.test.ts` has no `limit` assertion), so nothing breaks.

Also signal truncation in the `triggerRecurrences` output
(`api/src/contracts/scheduling.ts:78-83`, currently `{created, skipped}`). Without it an operator
cannot tell a complete sweep from a truncated one.

### A4 — Bound the recurrence ordinal scan

Location: `api/src/server/scheduling.ts:49-62`, `api/src/contracts/scheduling.ts:74`

`triggerRecurrences.now` is `z.coerce.date()` with no upper bound. It flows into
`for (let ordinal = 0; ; ordinal++)` at `scheduling.ts:53`, whose only exit is
`occursAt > last` where `last` derives from `now` (line 51). An admin passing
`now: "9999-01-01"` spins roughly 2.9 million iterations per daily rule, each allocating a `Date`
and an ISO string, blocking the Node event loop.

A3's change does not fix this. When `existingKeys` is already full, `result.length` never reaches
`limit`, the `break` never fires, and the loop still runs to the horizon.

Change: clamp `last` to a bounded horizon beyond `now`, and bound `now` in the contract. Do this
in the same edit as A3 and A8 — all three modify the same loop.

### A5 — Recover interrupted webhook deliveries

Location: `api/src/server/workflows/webhooks.ts:82-127, 129-154`

The claim at `:82-99` sets `status: "delivering"` atomically. The settle at `:110-125` requires
`status = "delivering"`. The due-query at `:135-149` selects only `["pending", "retrying"]`.
Nothing anywhere looks at `delivering`, so a process interruption between line 99 and line 110
strands the row permanently.

Change: set `claimed_at` in the claim, and atomically reclaim `delivering` rows whose
`claimed_at` is older than a lease window. Preserve the `attempt_count < max_attempts` guard in
the reclaim predicate (P1).

### A6 — Prevent overlapping maintenance sweeps

Locations: `api/src/server/grpc.ts:109-114, 118-119, 1024-1052`

`setInterval(() => this.sweep().catch(...), HEARTBEAT_MS)` with `HEARTBEAT_MS = 10_000` and no
in-flight tracking. Overlap is the normal case, not an edge case: `sweep()` runs
`sweepWebhookDeliveries(db, 25, fetch, ...)` — up to 25 concurrent HTTP calls each bounded at 10s
by `AbortSignal.timeout` (`webhooks.ts:58`) — alongside `sweepSla`, which iterates every running
stopwatch with no `LIMIT` (`sla/sweep.ts:17-20`) and calls `fireEvent` inline per breach
(`sla/sweep.ts:83`), which itself performs synchronous webhook delivery
(`workflows/runtime.ts:76`).

Change: add an in-flight guard and re-arm with a recursive `setTimeout` in `finally`. `close()` at
`:118-119` calls `clearInterval`; switch it to `clearTimeout` and add a `closed` flag checked in
the re-arm, or an in-flight sweep reschedules itself past shutdown and the process hangs.

### A7 — Isolate poison inbound email messages

Location: `api/src/server/mail/poller.ts:40-60`

`await options.process(...)` at line 43 has no `try/catch`, and a rejection unwinds both the
message loop and the enclosing mailbox loop at line 41. One poison message therefore starves
every *other mailbox*, not merely the messages behind it.

It is also permanent rather than merely repetitive. `processReceivedEmail` wraps everything in a
transaction (`mail/db.ts:66`) and claims the message via `inboundEmails ... onConflictDoNothing()`
(`:76-94`), so a deterministic failure rolls back the claim too. `acknowledge` at line 44 runs
only after success, so the message is re-fetched and re-fails every 30 seconds forever.

Change: wrap each message in `try/catch`, continue the batch, and increment a persisted
`attempt_count` (P1). Route messages past the cap to `mailbox_activity_log`, which already exists
and is written for `"duplicate_ignored"` (`mail/db.ts:96-101`) — no new dead-letter table needed.
The claim row already gives at-most-once ticket creation, so retrying is safe; only the cap is
missing.

The poller's own scheduling is already correct — `schedule()` re-arms in `.finally` at
`poller.ts:59`, which is exactly the pattern A6 and A17 need. Use it as the reference.

### A8 — Avoid lifetime recurrence rescans

Locations: `api/src/server/scheduling.ts:53`, `api/src/server/scheduling-runtime.ts:27-30`

Two costs grow with rule age, not one. The ordinal loop restarts at zero on every 60-second tick.
Separately, `scheduling-runtime.ts:27-30` loads **every** occurrence row ever created for each
rule into a `Set` on every sweep, unbounded.

Change: derive the starting ordinal from `MAX(occurs_at) WHERE recurring_ticket_id = ?` (an
index-only backward scan on the existing unique index — no new column, P1), and bound the
`existingKeys` query to the same window.

Monthly clamping needs care. `occurrenceAt` (`scheduling.ts:65-80`) is a pure function of
`(startsAt, ordinal)` that clamps day-of-month against the target month's last day, so skipping
ordinals is safe. Inverting a *date* back to an ordinal is not safe for monthly rules — the clamp
is not injective (Jan 31 → Feb 28 → Mar 31). Compute the ordinal from month arithmetic on
`startsAt`, then verify by re-running `occurrenceAt`.

### A9 — Deduplicate replayed agent tool requests

Location: `api/src/server/grpc.ts:474-572`

`request.callId` is read only to echo it back at `:557` and `:568`. Nothing stores or checks it.
Between those points `handleToolRequest` performs a ticket status transition, a
`ticketTransitions` insert, and a stopwatch transition (`:518-541`), then `executeTool`
(`:542-548`) — which for `cluster_patch_image` creates a CHG record and patches a live Kubernetes
deployment (`tools/change.ts:32-80`). A replay repeats all of it.

The replay path is reachable in normal operation: `removeAgent` deliberately retains `runAgents`
entries (A2), so a worker reconnecting with the same stable ID passes the ownership check at
`:480-481`, and the Python agent reconnects automatically.

`ToolRequest.call_id` (`proto:118`) and `ToolResult.call_id` (`proto:126`) both exist, so no
protobuf change is needed.

Change: insert `(run_id, call_id)` into `agent_tool_calls` with `ON CONFLICT DO NOTHING` and
status `in_progress` **before** executing, then settle the row with the result. On a conflict,
return the stored result if settled.

A single-phase ledger does not close the window. The ledger write and the side effect cannot share
a transaction for `cluster_patch_image` (a Kubernetes API call) or for `device_*` tools (a gRPC
round-trip with a `timeoutSeconds` wait, `grpc.ts:341-363`). Define explicitly what a replay
arriving against an `in_progress` row receives — returning "in progress" is correct; re-executing
is not.

Key the ledger consistently with `resolveStepId` (`grpc.ts:913-937`), which already resolves a
durable `agent_steps.id` per `(run_id, ordinal, kind, tool_name)` and is backed by the unique
index `agent_steps_run_ordinal_uidx`.

### A10 — Handle detached workflow rejection

Location: `api/src/server/routers/tickets.ts:1245-1256`

`void fireEvent({ type: "ticket.updated", ... })` with no handler. `fireEvent` is genuinely
rejectable: its own `catch` block performs two awaited `db.update` calls
(`workflows/runtime.ts:195-208`) with no inner guard, so a database blip during error handling
rejects the outer promise.

This terminates the API process rather than logging a line, because no `unhandledRejection`
handler exists (P5). This is the only bare `void` on a rejectable promise in the API;
`index.ts:54`, `index.ts:63`, and `scheduling-runtime.ts:90` all have handlers.

Change: append a fail-soft `.catch(...)` that logs, and add the process-level handler from P5.

### A11 — Make ticket updates transactional

Location: `api/src/server/routers/tickets.ts:1123-1237`

Five writes on the module-level `db` with no transaction: the ticket UPDATE (`:1123-1203`),
`transitionTicketStopwatches` (`:1209`), a `ticketMessages` insert (`:1211-1218`), a
`ticketCsatResponses` insert (`:1220-1227`), and a `ticketTransitions` insert (`:1229-1237`). A
failure between the status change and the transition insert loses the audit trail permanently.

`startTicketRun` (`routers/shared.ts:131-155`) and `cancelRun` (`grpc.ts:207-250`) already wrap
the same trio in a transaction. This path is the inconsistent one.

Change: wrap `:1123-1237` in `db.transaction` (P4 first).

### A12 — Expire stranded workflow executions

Location: `api/src/server/workflows/runtime.ts:46-54, 187-207`

`workflow_executions` rows are written `status: "running"`, and the only exits are the
`succeeded`/`failed` updates at `:187-207` in the same call frame. A crash strands the row
forever. No sweeper exists for this table at all.

Change: add `claimed_at`/`lease_expires_at` (P1) plus a sweep, matching A5's design.

### A13 — Bound the SLA sweep

Location: `api/src/server/sla/sweep.ts:17-20, 56-93`

`sweepSla` selects every running stopwatch with no `LIMIT` and calls `fireEvent` inline per breach,
which performs synchronous webhook delivery. It is the single largest contributor to A6's overlap.

Separately, at `:56-93` the idempotent `slaEscalationEvents` insert commits, and only then does the
ticket `escalationFlag` update run. A crash in between means the unique key blocks every retry and
the escalation flag is never set — silently and permanently.

Changes: add a `limit` parameter with deterministic ordering, mirroring `sweepWebhookDeliveries`;
and put the insert and the ticket update in one transaction, firing the event post-commit.

### A14 — Persist the search reconciliation watermark

Location: `api/src/server/grpc.ts:1031`

`reconcileCoreSearchDocuments(db, new Date(now - HEARTBEAT_MS * 2))` uses a fixed 20-second
wall-clock window rather than a cursor. Any sweep delayed past 20 seconds permanently drops search
index updates for the gap. Fixing A6's overlap without this converts an overlap into silent data
loss.

Change: persist a `last_reconciled_at` watermark and read from it.

### A15 — Bound the pending sweep

Location: `api/src/server/pending.ts:21-31, 40-90`

`sweepPending` selects all due tickets with no `LIMIT`, then performs N sequential round-trips. The
per-ticket write sequence — ticket UPDATE, `ticketTransitions` insert, `transitionTicketStopwatches`,
`pendingFollowups` insert — is non-transactional inside the loop.

Changes: add a bounded `LIMIT` with ordering, and wrap the per-ticket writes in a transaction
(P4 first).

### A16 — Remove the ticket-number allocation bottleneck

Location: `api/src/server/tickets/create.ts:117-124`

The counter is allocated with `INSERT ... ON CONFLICT DO UPDATE SET last_value = last_value + 1`
on `ticket_number_counters (prefix, year)`. That holds a row lock for the remainder of the
transaction — lines 132-185, including `attachTicketStopwatches`. Every ticket creation in the
system serializes behind one row per prefix per year.

A1 moves custom-field writes into this same transaction, extending the lock hold. Address this
before or alongside A1, not after.

Change: allocate the number in its own short transaction, or move the counter to a Postgres
sequence and reconcile the display format afterwards. `ticket_number_history` (PK on `number`, FK
to `tickets`) tolerates gaps.

### A17 — Guard the ticket action effect

Location: `dashboard/src/features/tickets/components/ticket-actions.tsx:80-101`

This is a functional defect, not a cleanup item. `allowedActions(ticket, capabilities)` at line 80
returns a fresh array on every call, so `useCallback(..., [actions])` at `:81-84` never memoizes
and `has` is new every render. The effect at `:93-101` therefore runs after every commit. It reads
`window.location.hash` and never clears it.

The sequence: the user arrives from the queue's Reclassify action
(`ticket-queue.tsx:117-121` sets `hash: "operator-reclassify"`), the sheet opens, the user closes
it, `setClassificationOpen(false)` commits, the effect re-runs, the hash still matches, and the
sheet reopens. **The reclassify sheet cannot be closed.**

Change: depend on stable scalar values rather than `has`, perform the checks inside the effect,
gate on a one-shot ref, and clear the hash after acting on it.

### G1 — Send the agent terminal update reliably

Location: `agent/axel/server.py:97-99, 221-242`

Terminal-update construction at `:221-242` sits **outside** the `try/except` that ends at line 220.
Any failure there kills the task silently: the API never receives a terminal, and the run stays
`running` until A2's lease sweep or a gateway restart. The task is also discarded —
`task.add_done_callback(lambda _task, run_id=...: self.runs.pop(run_id, None))` at `:97-99` never
inspects `_task.exception()`.

Changes: move `:221-242` inside the guard, and log the exception in the done callback.

### G2 — Retain the terminal until it is on the wire

Location: `agent/axel/server.py:84-86`

`_RETAINED_TERMINALS.pop(run_id)` executes *before* `yield message`. If the new stream dies between
the pop and the wire write, the retained terminal is destroyed — permanent loss of the only
terminal update for that run, which is precisely the case the retention mechanism exists to cover.

Change: pop only after the peer acknowledges, or re-queue on generator close.

### L1 — Bound the pending device command slice

Location: `cli/internal/device/daemon.go:211, 281`

`pending []*pb.DeviceCommand` is appended with no cap and drained only when the (possibly wedged,
see C1) worker accepts. Each command's sequence is already durably persisted at `daemon.go:276`,
so under at-most-once semantics they are permanently consumed even though they never ran.

Change: cap `pending` and reject past the cap so the gateway learns the command was not accepted.

---

## Medium

### A18 — Prevent overlapping manual webhook sweeps

Location: `api/src/server/routers/automation.ts:171-175`

`retryWebhookDeliveries` calls `sweepWebhookDeliveries(db, input.limit)` directly, concurrent with
the 10-second gRPC sweep at `grpc.ts:1030`. A6 guards the sweep against itself but not against the
manual route. Route both through the same guard.

### A19 — Prevent overlapping recurrence sweeps

Locations: `api/src/server/scheduling-runtime.ts:84-97`, `api/src/server/routers/scheduling.ts:158-161`

`void run()` at `:90` retains no handle, and `setInterval(run, intervalMs)` at `:91` cannot know
whether the previous run finished. `triggerRecurrences` calls `generateDueRecurrences` directly
with no mutual exclusion. `closeRecurrenceSweep` (`:94-97`) clears the interval without awaiting
the in-flight run, so shutdown can leave a sweep half-done.

Change: route both through one mutex and re-arm with `setTimeout` in `finally`.

The manual call passes different arguments (`input.now`, `input.limit`). It must **queue behind**
the mutex, not coalesce with the in-flight run — coalescing returns the background sweep's
`{created, skipped}` to an admin who asked for a different window. Duplicate work is already
prevented at the database layer by `recurring_ticket_occurrences_key_uidx`, so this is about
response correctness, not duplication.

### A20 — Calculate webhook retry from completion time

Location: `api/src/server/workflows/webhooks.ts:20, 104-109`

`now` is the function parameter (`:80`), and `sweepWebhookDeliveries` passes a single `now`
captured once for the whole batch (`:133` → `:151`), itself snapshotted at the top of `sweep()`
(`grpc.ts:1025-1030`). So `nextAttemptAt` is anchored to *sweep start*, not even request start.
With `retryDelayMs` returning 1000ms on attempt 1 (`workflows/core.ts:57-71`) and a 10-second
request timeout, the first retry is due roughly 9 seconds in the past the moment it is written.
`completedAt: now` (`:20`) carries the same staleness.

Change: use a fresh `new Date()` after `sendWebhookRequest` resolves, for both `nextAttemptAt` and
`completedAt`. Keep the batch `now` for the due-check predicates at `:92-95` and `:141-144` so the
claim query stays consistent across the batch. These are two distinct clocks and must stay
distinct.

### A21 — Bound the inbound gRPC message chain

Locations: `api/src/server/grpc.ts:401-419, 578-586`

Both `connectAgent` and `connectDevice` serialize inbound messages with
`messages = messages.then(async () => ...)` in flowing mode. The stream is never paused, so the
API applies no backpressure and instead accumulates an unbounded promise chain. A chatty agent
outpacing the database writes in `onAgentMessage` grows the heap without limit and delays every
subsequent message.

Change: pause the stream when the chain depth exceeds a threshold and resume when it drains.

### A22 — Prune per-device gateway state

Location: `api/src/server/grpc.ts:78, 80, 334-337, 714-722`

`sequences` and `outboxes` are keyed by `deviceId` and never pruned; `disconnectDevice`
(`:714-722`) touches only `devices`. `outboxes` retains up to `OUTBOX_LIMIT = 100` commands per
device indefinitely. `sequences` is reloadable from the database via `loadSequence` (`:768-776`),
so retaining it buys nothing.

Change: delete both entries in `disconnectDevice`.

### A23 — Cap the calendar iteration loop

Location: `api/src/server/sla/calendar.ts:125-138, 208, 217-228`

`for (let date = ...; ; date = nextDate(date))` has no iteration cap. `validate()` checks
`hours.length > 0` and `hour <= 23` but not `startTime < endTime`. This is safe today only because
`calendar_hours_range_check` enforces the ordering in the database
(`api/src/db/schema/calendars.ts:39`). The function accepts an injected `CalendarLoader` (`:208`),
so any test double or constraint-free environment hangs the event loop.

Change: add a maximum-iterations guard (366 days) and a `start < end` check in `validate()`.

### A24 — Stop blocking the agent queue on rollout polling

Location: `api/src/server/tools/cluster.ts:89-109`

`pollRollout` blocks for up to 90 seconds inside a synchronous tool call, which runs inside
`handleToolRequest` (`grpc.ts:542`), which holds the agent's serialized message chain
(`grpc.ts:404`). The 90-second ceiling is correct in isolation and wrong in context.

Change: lower the ceiling substantially, or make rollout observation asynchronous.

### G3 — Bound outbound agent gRPC backpressure

Location: `agent/axel/server.py:71, 87, 139, 148, 242, 247, 265, 294`

`self.outbound: asyncio.Queue[...] = asyncio.Queue()` at `:71` has no `maxsize`. The only consumer
is `while (message := await self.outbound.get()) is not None:` at `:87`, inside the `requests()`
generator handed to `Connect()` at `:277`. Producers are `report` (`:139`), `call_tool` (`:148`),
the heartbeat (`:247`), and a terminal `put_nowait` (`:242`). `grpc.aio` pulls the request iterator
only as the HTTP/2 flow-control window allows, so a stalled writer grows the queue without bound.

The urgency is lower than it appears: this API never stalls the stream. `grpc.ts:401-419` and
`:578-586` run in flowing mode and never pause (see A21), so the scenario requires a slow network
path rather than this peer. G1 and G2 fire on ordinary disconnects and rank above this.

Bounding the queue naively converts a leak into a hang. Three sites must change together:

1. `:265` — `close()` ends with `await self.outbound.put(None)`. On a full bounded queue with a
   dead consumer this blocks, and it is awaited from the `finally` of `connect_forever` (`:294`),
   which stops all reconnection. Use `put_nowait` with an overflow fallback, or drain first.
2. `:139` — `report()` is awaited from `loop.run()` but, unlike `_think` and `call_tool`
   (`loop.py:302-304, 358-360`), is not covered by `run_deadline_seconds`. Bounded, it becomes the
   one unbounded await in the run and defeats the 300-second deadline. Give it its own
   `asyncio.wait_for`.
3. `:124-140` — `report()` never checks `self.closing`, so puts still land in an abandoned queue
   after `close()`. Bounded, they block a still-draining run forever.

Change: finite queue, bounded enqueue timeout that closes and reconnects the stream when
backpressure persists, plus all three sites above.

### G4 — Cap retained terminals and concurrent runs

Locations: `agent/axel/server.py:32, 73, 92-99, 143, 276`

`_RETAINED_TERMINALS` (`:32`) is a module-level dict with no cap; if reconnects keep failing at
`channel_ready()` (`:276`) the generator body never runs and entries accumulate for the process
lifetime. Separately, `self.runs` (`:73`) has no concurrency cap — `max_pending_calls` (100) bounds
tool calls *per run* (`:143`) but nothing bounds concurrent runs, so N `start_run` messages spawn N
tasks each holding a transcript for up to 300 seconds.

Changes: cap `_RETAINED_TERMINALS` by count and age; reject `start_run` past a
`max_concurrent_runs` ceiling.

### G5 — Reset agent reconnect backoff only after a stable connection

Location: `agent/axel/server.py:280`

`delay = config.reconnect_base_seconds` resets on *connect*, not on *stable* connect. An API that
accepts and immediately drops produces a permanent hot reconnect loop at roughly 0.75-second
intervals.

Change: mirror the CLI, which already solves this correctly — `cli/internal/device/daemon.go:73`
requires `connectedFor >= stablePeriod` before resetting.

### L2 — Budget device read_state facets

Locations: `cli/internal/device/actions.go:93-107`, `cli/internal/device/daemon.go:311`,
`cli/internal/device/facets_windows.go:12`, `api/src/server/grpc.ts:279`

`ReadStateWithParams` spawns one `powershell.exe` per facet, sequentially, all sharing a single
30-second budget (the API hard-codes 30 for `read_state`). The `reachability` facet alone costs up
to 6 seconds (two 3000ms pings) plus roughly a second of cold start each. Six facets routinely
exceed the budget, and every facet after the deadline returns `"timed out"`.

Change: give each facet a sub-budget, or collect facets concurrently.

### L3 — Do not orphan the detached process launcher

Location: `cli/internal/device/actions_windows.go:37-43`

`restart_user_process` calls `exec.CommandContext(...)`, `Start()`, and `Process.Release()` but
never `Wait()`. The `os/exec` context watchdog goroutine therefore lives until `connCtx` dies, and
its eventual `Cancel` calls `Kill()` on a released handle.

Change: use a plain `exec.Command` for the detached launch.

### D1 — Debounce the command menu search

Location: `dashboard/src/components/layout/command-menu.tsx:37-41`

`useQuery({ ...orpc.search.queryOptions({ input: { query, limit: 40, offset: 0 } }), enabled: open
&& query.length > 0 })` with no debounce and `staleTime: 0`. Typing "printer" fires seven
cross-record search requests. The ticket queue already debounces identically shaped input at 300ms
(`ticket-queue.tsx:87-93`), so this is an inconsistency rather than a design choice.

Change: mirror the queue's 300ms debounce into a separate state value used for the key.

### D2 — Deduplicate query error toasts

Location: `dashboard/src/utils/orpc.ts:12-23`

The global `QueryCache.onError` fires `toast.error` with no dedupe id for every failed query. With
v5's default `retry: 3` and concurrent pollers (devices 5s; ticket queue, SLA, and presence 15s;
notifications 30s), a backend outage produces a continuous stream of stacked toasts that buries
the UI.

Change: pass a stable `id` derived from the query hash so the toast replaces rather than stacks.

### D3 — Reconcile ticket custom fields on refetch

Location: `dashboard/src/features/tickets/components/ticket-detail.tsx:66, 92, 171-182`

`useState(ticket.customFields)` with no sync effect, in a component that never remounts (rendered
at a fixed position with no `key`). Ticket data refetches constantly via `invalidateTicketQueries`
and the 15-second SLA poll, but this local copy never updates. Operator B therefore saves a form
seeded from data predating operator A's change, silently overwriting it.

Change: key the subtree on a ticket revision, or reconcile explicitly on save.

---

## Low

### A25 — Guard the knowledge gap sweep

Location: `api/src/index.ts:47-53`

A 24-hour `setInterval` with no in-flight guard. `sweepKnowledgeGaps` is one long transaction over
all resolved tickets (`api/src/server/knowledge/gaps.ts:91-120`). Same treatment as A6.

### A26 — Clean up the failed-dispatch transition row

Location: `api/src/server/routers/shared.ts:146-154, 174-191`

The dispatch-failure rollback restores `tickets.status` and `progressMarker` but does not remove
the `ticketTransitions` row inserted at `:146-154`. A phantom `startRun` transition survives every
failed dispatch.

Change: delete the transition row in the same rollback transaction.

### A27 — Handle shutdown rejection

Location: `api/src/index.ts:63`

`void Promise.all([grpcGateway.close(), closeMailRuntime()]).finally(() => process.exit(0))` — the
`.finally` re-throws a rejection with no `.catch`.

### A28 — Bound the timezone formatter cache

Location: `api/src/server/sla/calendar.ts:17`

An unbounded `Map<string, Intl.DateTimeFormat>` keyed by timezone. Bounded in practice by
admin-controlled `calendars.timezone`. Bound it or annotate the assumption.

### A29 — Resolve the unreferenced rate-limit schema

Location: `api/src/db/schema/api-rate-limits.ts`

`apiRateLimits` is defined and referenced nowhere in `src/`. Either wire it up or drop it.

### G6 — Guard evidence extraction size

Location: `agent/axel/loop.py:338-340, 435-453`

`_evidence` recurses over tool output with no depth limit and accumulates every scalar. Cycles are
impossible (the input comes from `json.loads`) and Python's recursion limit fires first, but a very
large tool result is walked in full *before* the 4000-character truncation applies.

Change: add a size guard ahead of the walk.

### L4 — Bound the release probe

Location: `cli/internal/device/release_unix.go:12`

`exec.Command("uname","-sr").Output()` — the one non-`CommandContext` exec, unbounded, on the
`device.Load` startup path.

### L5 — Fix the cua detector cache and lock scope

Location: `cli/internal/cua/detect.go:37-42, 72`

`d.mu` is held across `Client.Do` and the body scan, bounded only by the 2-second
`http.Client.Timeout`. Separately, `:72` constructs a fresh `NewDetector()` per `Check`, so the TTL
cache at `:39-42` never caches anything.

### L6 — Propagate the signal context into doctor checks

Location: `cli/internal/tui/doctor.go:74`

`context.WithTimeout(context.Background(), ...)` ignores the parent `signal.NotifyContext` from
`cli/cmd/main.go:35`, so Ctrl-C leaves a check running for up to 10 seconds.

### L7 — Surface daemon state write failures

Locations: `cli/internal/device/daemon.go:64, 139, 280`

`_ = SaveDaemonState(...)` discards errors, so a full or read-only state directory is invisible.

### D4 — Memoize the widget arrangement

Locations: `dashboard/src/features/automation/components/index.tsx:14-15`,
`dashboard/src/routes/_auth/overview-widgets.tsx:57-65`

`useState(widgets)` plus `useEffect(() => setOrdered(widgets), [widgets])` is mirrored state. The
parent builds `widgets` via `.map()` — a new array every render — only when a saved arrangement
exists; otherwise it passes a stable module constant. The extra render settles after one pass and
never loops, so this is not a loop. The real cost is that any refetch of `getDashboardArrangement`,
including the automatic `refetchOnWindowFocus`, resets `ordered`, discarding an in-flight reorder
and leaving local state diverged from the server when `save` errors.

Change: make `WidgetArrangement` controlled. Memoizing the parent mapping also works, but only
because TanStack's structural sharing preserves `query.data` identity across no-op refetches;
controlling the component does not depend on that.

### D5 — Stabilize the keyboard shortcut listener

Location: `dashboard/src/components/keyboard-shortcuts.tsx:20-40`

`useKeyboardShortcuts` is called with a fresh object literal at `ticket-queue.tsx:139-146`, and the
effect deps are `[handlers, shortcutsOpen]`, so the `keydown` listener is removed and re-added on
every queue render. Performance only: both happen synchronously in one effect flush, so no
keystroke is dropped, and the re-subscription is currently what keeps the handlers from going stale
over `selected`, `tickets`, and `capabilities`.

Change: hold a ref to the **latest** handlers. A ref captured once reintroduces the staleness the
re-subscription currently prevents.

### D6 — Align the portal submit guards

Location: `portal/src/features/tickets/components/request-form.tsx:360-367`

The incident button omits `createTicket.isPending` from its `disabled` expression while the
catalogue button includes its equivalent (`:793-801`). `isSubmitting` covers the window in
practice, so there is no live defect — close the asymmetry while touching this file for A1.

---

## Verification

`grpc.ts` (C2, A2, A6, A9, A14, A21, A22) and `scheduling-runtime.ts` (A19) have **no test files**.
Those two carry the largest share of high-severity work. Add coverage as part of the change rather
than after it:

- `api/src/server/grpc.test.ts` — lease expiry, replayed `call_id`, sweep overlap, heartbeat
  delivery when a sweep rejects.
- `api/src/server/scheduling-runtime.test.ts` — mutex behavior, truncated batch, ordinal cursor.

Existing coverage to extend rather than duplicate: `scheduling.test.ts` (no `limit` assertion
today, so A3 breaks nothing), `workflows/webhooks.test.ts`, `tickets/create.test.ts`,
`mail/mail.test.ts`, `cli/internal/device/daemon_test.go`, `cli/internal/device/inventory_test.go`,
`agent/tests/test_server.py`.

C1 needs a Windows-specific test that spawns a child which itself spawns a surviving grandchild
holding the pipe, and asserts that `runCommand` returns within `WaitDelay`. A context-only test
passes against the broken implementation.

Run `pnpm db:check` after P1 and `pnpm contracts:check` after P2.

---

## No change required

Verified against the code rather than assumed.

- `portal/` contains **zero** `useEffect` calls across the entire tree, no timers, no
  subscriptions, no mirrored state, and no derived query keys. The one shape resembling the
  calendar defect — `routes/_auth/tickets/$ticketId.tsx:70-73` — is safe because its values are
  stable strings and key hashing is structural. Polling is conditional
  (`features/tickets/api/queries.ts:6-12` polls at 5s only while the ticket is `new`, `open`, or
  `pending`) and `components/notification-center.tsx:17` is a flat 30-second poll.
- Agent model retries and reasoning are bounded. `axel/config.py:29-36`: `max_tool_calls=20`,
  `max_model_turns=10`, `run_deadline_seconds=300.0`, `max_consecutive_failures=3`,
  `retry_attempts=3`, `retry_cap_seconds=10.0`. `loop.py:190` increments `model_turns` before every
  `continue` path, so the loop cannot spin. `model.py:128`'s `while True` has two exits, both
  capped, with a top-of-loop deadline check at `:129-131`. The one uncovered await
  (`model.py:149`, no timeout when `deadline is None`) is unreachable in production because
  `loop.py:358-359` always passes a deadline and wraps in `wait_for`. No streaming is configured,
  so there is no streaming-cancellation concern.
- CLI reconnect behavior is correct: `daemon.go:59-61, 65-67` (cancellation), `:78-85` (`select` on
  `ctx.Done()` with a proper timer drain), `:209, 229-230, 247` (60-second liveness timer reset per
  inbound message, backed by gRPC keepalive at `:104-108`), and `:76` with `nextBackoff` (`:90-99`)
  for jitter capped at 30 seconds with a stable-period reset. The gateway does feed the liveness
  timer — `api/src/server/grpc.ts:1046` writes device heartbeats each sweep. Every channel send in
  `daemon.go` sits inside a `select` with `<-ctx.Done()` (`:147-150, 153-157, 170-174, 196-200`),
  and every lock, file, ticker, and timer has its `defer`.
- Rollout polling is bounded at 90 seconds with a throw on exhaustion
  (`api/src/server/tools/cluster.ts:89-107`). See A24 for the separate concern about where it
  blocks.
- Webhook requests are bounded at 10 seconds by `AbortSignal.timeout`
  (`api/src/server/workflows/webhooks.ts:58`), and the response body read is covered by the same
  signal.
- Device command waits are bounded on both sides — `daemon.go:309-318, 326` (30-second default,
  5-minute cap) and `api/src/server/grpc.ts:342-361`. These bounds are nominal until C1 lands: a
  wedged `Wait` means the API's timeout fires while the device stays stuck, and a late result
  arrives for a command already marked `timed_out`.
- `api/src/server/scheduling.ts:59` is the only throw-on-limit in the API. The other limit-throws
  (`server/assets/csv.ts:24,58,75`, `server/documents/storage.ts:18`) are input-size validations
  where rejecting is correct.
- Dashboard sites that resemble the calendar defect but are clean:
  `ticket-queue.tsx:87-93` (deps include `updateSearch`, properly wrapped in `useCallback([navigate])`
  at `ticket-queue-page.tsx:34-46`; the `query.trim() !== (search.search ?? "")` guard makes the
  mirrored state self-terminating), `ticket-queue.tsx:94-101` (functional updater with a scalar
  dep), `agent-transcript.tsx:50-59` (all-scalar deps; `run-polling.ts:4` returns an interval only
  while `status === "running"`), `ticket-collaboration.tsx:51-57` (cleanup present, `[ticket.id]`
  dep), `command-menu.tsx:42-51`, `sidebar.tsx:97-110`, `use-mobile.ts:10-18`. Every
  `refetchInterval` is a fixed interval of 5 seconds or more with `refetchIntervalInBackground`
  unset, so background tabs do not poll. No `EventSource` or `WebSocket` exists in either app. No
  loader or `beforeLoad` re-navigation cycle exists — `dashboard/_auth/route.tsx:13-28` and
  `portal/_auth/route.tsx:16-22`, `index.tsx:7-11`, `login.tsx:11-15` are complementary.
