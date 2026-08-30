# Loop and Hang Remediation Plan

Date: 2026-08-30
Scope: `dashboard/`, `portal/`, `api/`, `agent/`, and `cli/`

The calendar render-driven request loop has already been fixed in `dashboard/src/routes/_auth/calendar.tsx`. No additional continuous query/refetch loops of that kind were found in the dashboard or portal.

## Required changes

### API

1. **Critical — Make portal ticket creation idempotent**
   - Location: `api/src/server/routers/tickets.ts:215-244`
   - Problem: ticket creation commits before custom fields and auto-dispatch complete. A later timeout or failure can make a client retry create a duplicate ticket.
   - Change: accept a client-generated idempotency key, claim it uniquely in the ticket transaction, persist custom fields in that transaction, and make post-commit dispatch asynchronous and fail-soft.

2. **High — Expire stranded agent runs**
   - Locations: `api/src/server/grpc.ts:155-199,833-852,950-956,984-1052`
   - Problem: dispatch has no persisted acceptance or lease deadline, and disconnected assignments can remain `running` forever.
   - Change: persist acceptance/heartbeat lease deadlines, sweep expired runs to a terminal state or requeue them, and persist terminal run/ticket changes transactionally before removing assignments.

3. **High — Stop recurrence backlog starvation**
   - Location: `api/src/server/scheduling.ts:53-59`
   - Problem: encountering missing occurrence `limit + 1` throws before returning the first batch, so an overdue rule repeatedly creates nothing and blocks later rules.
   - Change: return the first `limit` missing occurrences instead of throwing; apply a sweep-wide budget if necessary.

4. **High — Prevent overlapping recurrence sweeps**
   - Locations: `api/src/server/scheduling-runtime.ts:84-92`, `api/src/server/routers/scheduling.ts:158-161`
   - Problem: async recurrence generation is started by `setInterval` without tracking completion, and manual runs can overlap it.
   - Change: route scheduled and manual execution through one shared in-flight promise or mutex; preferably schedule the next `setTimeout` in `finally`.

5. **High — Recover interrupted webhook deliveries**
   - Location: `api/src/server/workflows/webhooks.ts:82-149`
   - Problem: a process interruption after claiming a delivery leaves it permanently in `delivering`, which future sweeps ignore.
   - Change: persist a claim/lease timestamp and atomically reclaim stale `delivering` rows, or reconcile them at startup.

6. **Medium-high — Prevent overlapping gRPC maintenance sweeps**
   - Location: `api/src/server/grpc.ts:109-114,1024-1052`
   - Problem: a maintenance sweep lasting longer than ten seconds overlaps the next invocation.
   - Change: add an in-flight guard and schedule the next run only after completion, preferably with recursive `setTimeout` in `finally`.

7. **Medium — Isolate poison inbound email messages**
   - Location: `api/src/server/mail/poller.ts:40-60`
   - Problem: one failing message aborts the batch and is retried every 30 seconds, blocking later messages.
   - Change: catch failures per message, continue processing the batch, and persist bounded attempts with dead-letter handling or acknowledge classified permanent failures.

8. **Medium — Avoid lifetime recurrence rescans**
   - Location: `api/src/server/scheduling.ts:53-62`
   - Problem: every sweep starts at ordinal zero, so cost grows with each rule's age.
   - Change: persist/query the latest claimed occurrence or calculate the first relevant ordinal while preserving monthly date-clamping behavior.

9. **Medium — Deduplicate replayed agent tool requests**
   - Location: `api/src/server/grpc.ts:474-572`
   - Problem: replaying a protocol `callId` can execute side effects again.
   - Change: add a durable result ledger with a unique `(runId, callId)` key and return the stored result on replay.

10. **Medium — Handle detached workflow rejection**
    - Location: `api/src/server/routers/tickets.ts:1245-1256`
    - Problem: `void fireEvent(...)` can reject without a handler.
    - Change: append a fail-soft `.catch(...)` that logs the error.

11. **Low — Calculate webhook retry from completion time**
    - Location: `api/src/server/workflows/webhooks.ts:76-109`
    - Problem: retry time is calculated from request start, so a slow failed request can make the next retry immediately due.
    - Change: calculate `nextAttemptAt` using a fresh timestamp after the request completes.

### Agent

12. **Medium — Bound outbound gRPC backpressure**
    - Location: `agent/axel/server.py:71,87,139,148,247`
    - Problem: the outbound queue is unbounded; a connected peer that stops consuming can cause unlimited memory growth.
    - Change: use a finite queue and a bounded enqueue timeout that closes and reconnects the stream when backpressure persists.

### CLI

13. **High — Bound inventory collection time**
    - Locations: `cli/internal/device/daemon.go:181-203`, `cli/internal/device/inventory.go:69-74`, `cli/internal/device/inventory_windows.go:24-30`
    - Problem: inventory commands use the connection-lifetime context and can occupy the sole inventory worker forever.
    - Change: add a per-collection or per-command `context.WithTimeout`, await subprocess termination, and report timeout as an inventory error.

## low-priority dashboard cleanup

1. `dashboard/src/features/automation/components/index.tsx:14-15`
   - Memoize the parent widget mapping or make `WidgetArrangement` controlled to avoid mirrored-state resets and extra renders.

2. `dashboard/src/features/tickets/components/ticket-actions.tsx:80-101`
   - Remove the unstable `has` callback from the effect dependency path; depend on stable scalar values and perform direct checks inside the effect.

3. `dashboard/src/components/keyboard-shortcuts.tsx:20-40`
   - Keep current handlers in a ref or memoize the caller object to avoid removing and adding the global listener on every queue render.

## No change required

- `portal/`: no confirmed loop or related defect.
- Agent model retries and reasoning are bounded by attempt counts, deadlines, and tool/model-turn ceilings.
- CLI reconnect behavior has cancellation, liveness detection, and capped jittered backoff.
- Device-command waits, rollout polling, and ordinary webhook retry attempts are bounded.
