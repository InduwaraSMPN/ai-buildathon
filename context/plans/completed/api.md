# Axiōma `api` — implementation plan

**Document role:** Implementation plan for `axioma/api`
**Related:** [idea.md](../../idea/idea.md), [architecture.md](../../idea/architecture.md), [implementation.md](../../idea/implementation.md)

**Read this one first.** This component owns the schema, the oRPC contract and the proto. Every other
plan depends on the decisions taken here.

---

## 1. Current state

### Gates, run 2026-08-29

| Gate | Command | Result |
|---|---|---|
| Lint | `npx biome check .` | Clean, no issues |
| Types | `npx tsc --noEmit` | Clean, no errors |

`pnpm check` and `pnpm check-types` both pass. The contract mirrors in `portal/src/sdk/contracts` and
`dashboard/src/sdk/contracts` are byte-identical to `src/contracts` apart from the generated banner,
and `proto/axioma.proto` is byte-identical in `agent/proto` and `cli/proto`. No drift.

### What is built and real

**HTTP surface** — `src/index.ts`. Hono on :3000. oRPC `RPCHandler` at `/rpc`, `OpenAPIHandler` with
a reference plugin at `/api-reference`, Better Auth at `/api/auth/*`, CORS reading a comma-separated
`CORS_ORIGIN`. Graceful shutdown on SIGINT/SIGTERM closes the gRPC gateway.

**Auth** — `src/auth/index.ts`. Better Auth with the Drizzle adapter, email and password enabled,
`trustedOrigins` from the same env var. Identity only, which is the deliberate scope.

**Schema** — six tables in `src/db/schema/`, all with sensible indexes: `tickets`, `agent_runs`,
`agent_steps`, `devices`, `device_commands`, `cmdb_items`, plus Better Auth's four in `auth.ts`.
`cmdb_items` already carries the four provenance columns (`source_ticket_id`, `source_run_id`,
`source_step_id`, `observed_at`) — the part that would be expensive to add later is already there.

**Contract** — `src/contracts/index.ts`, importing only `@orpc/contract` and `zod` as required.
Seven procedures: `healthCheck`, `privateData`, `createTicket`, `listTickets`, `getTicket`,
`updateTicket`, `listDevices`.

**Handlers** — `src/server/routers/index.ts`. All implemented against real Drizzle queries.
`getTicket` assembles runs with their steps in two queries and groups them in memory.

**Vocabulary** — `src/shared/index.ts`. `TICKET_STATUSES`, `TICKET_ROUTES`, `RUN_STATUSES`,
`STEP_KINDS`, `DEVICE_CONNECTION_STATES`, `COMMAND_STATUSES`, and `RUN_LIMITS` (`maxToolCalls: 20`,
`maxModelTurns: 10`, `runDeadlineMs: 300000`).

**gRPC gateway** — `src/server/grpc.ts`, 482 lines, and the most complete part of the component. It
loads the proto at runtime with `@grpc/proto-loader`, registers both services, and binds on
`AXIOMA_GRPC_ADDRESS` (default `0.0.0.0:50051`). It really does:

- hold one agent stream in a single slot, set on `AgentHello`;
- track devices in a `Map` keyed by device ID with a `generation` symbol, so a stale `close` from a
  superseded connection cannot mark a freshly reconnected device offline;
- maintain a per-device monotonic sequence and a bounded in-memory outbox (`OUTBOX_LIMIT = 100`);
- replay commands past `DeviceHello.last_seen_sequence` on reconnect;
- sweep every 10s, heartbeat both sides, and drop a device silent for 30s;
- drive `device_commands` through `pending → dispatched → succeeded | failed | timed_out`, including
  a real dispatch timeout that rejects the pending promise;
- persist every `RunUpdate` into `agent_steps` as it arrives, and close out `agent_runs` on the
  terminal update.

**Contract publishing** — `scripts/publish-contracts.mjs` mirrors `src/contracts` into both frontends
and `proto/axioma.proto` into both agents, stamping the copies as generated.

**Local infrastructure** — `docker-compose.yml` runs `postgres:18` with a healthcheck;
`drizzle.config.ts` points at `./src/db/schema` and `./src/db/migrations`; the workspace `Tiltfile`
orchestrates postgres, api, portal, dashboard, agent, a cli build, and `web` — a fourth app at
`axioma/web` (the public marketing site, TanStack Start, :3003 under Tilt) that no plan in this set
covers. Nothing here touches it, but note its own `dev` script defaults to `--port 3000`, colliding
with this API when run outside Tilt.

### What is stubbed

- **`POST /grpc/start-run`** and **`POST /grpc/device-read`** in `src/index.ts` are raw operator hooks
  with no auth, no validation and no ticket linkage. Their own comment says production dispatch will
  be driven by ticket runs. No oRPC procedure starts a run.
- **The agent slot is single-tenant.** `private agent?: Duplex` — the most recent `AgentHello` wins
  and any earlier worker is silently orphaned rather than closed.
- `AgentHello.model_label` is logged at `grpc.ts:229` and then discarded.

### What is missing outright

- **Kubernetes. Entirely.** No client dependency in `package.json`, no connector module, no kubeconfig
  handling. `grpc.ts:246-248` throws `tool not implemented` for anything that is not `device.*`, so
  `cluster.read_pods`, `cluster.read_deployment` and `cluster.patch_image` all fail. **Scenarios 1 and
  3 cannot run at all today.**
- **`cmdb.record_observation`** hits the same throw. `cmdb_items` has never been written to.
- **Every ITIL field.** No `impact`, `urgency`, `priority`, `category`, `subcategory`, or record-type
  discriminator.
- **The status machine.** `tickets.status` is `open` on insert and can only become `closed` or
  `escalated` through `updateTicket`. `routing`, `resolving` and `resolved` are declared in
  `TICKET_STATUSES` and are unreachable.
- **Device ownership.** `devices.owner_id` is never written. `DeviceHello` carries a local `username`
  string but nothing links a device to a Better Auth user, so no ticket can resolve its reporter to
  their laptop. `createTicket` accepts `deviceId` and the portal never sends one.
- **Migrations.** `src/db/migrations/` holds only `.gitkeep`. The project runs on `drizzle-kit push`.
- **Scenario seeds.** Nothing creates the failing deployment, the unschedulable pod, or the device
  fault.

### Defects found while reading

| # | Location | Defect |
|---|---|---|
| D1 | `src/server/grpc.ts:445` | `agent_steps.id` is built from run ID and ordinal. A replayed or duplicated ordinal is a primary-key collision that throws inside the stream `data` handler — and because that handler is invoked as `void this.onAgentMessage(...)` (`grpc.ts:212`) with no catch, the throw is an unhandled promise rejection, which kills the process under Node's default policy. |
| D2 | `src/server/grpc.ts:160-162` | `this.sequences.get(id) ?? await this.loadSequence(id)` — two concurrent dispatches to a device with no cached sequence both await the load and compute the same next value, violating `device_commands_seq_idx`. |
| D3 | `src/server/routers/index.ts:110` | `closedAt: input.action === "close" ? now : null` resets `closed_at` to null when a previously closed ticket is escalated, destroying a real timestamp. |
| D4 | `src/contracts/index.ts:20,115` | `status` and `connected` are declared `z.string()` on output while the enums exist a few lines above. Both frontends receive `string` and hand-roll their own status maps as a result. |
| D5 | `src/server/grpc.ts:184-186` | A command created while a device is offline is written `pending` and only replayed from the in-memory outbox. An API restart loses it while the row still says `pending` forever. |
| D6 | `src/server/grpc.ts:97-109` | `startRun` inserts `agent_runs` with no `model` and performs no ticket status transition. |
| D7 | `src/server/grpc.ts:212,80` | The D1 mechanism generalised: every rejection on the agent message path (`void this.onAgentMessage(...)`) and the sweep (`void this.sweep()`) is unhandled. Any database error while persisting a step — not only a key collision — crashes the whole API. |
| D8 | `src/server/grpc.ts:217-221` | The agent slot is cleared only on a clean `end` — no `close`/`error` cleanup. A killed worker leaves `this.agent` pointing at a dead stream, so `startRun` "succeeds", inserts a run, and writes into the void: the run sticks in `running` and `Axel is not connected` never fires. |
| D9 | `src/server/grpc.ts:348-358` | When any replay happens on device reconnect, **all** `pending` rows for that device are flipped to `dispatched` — including rows evicted from the 100-item outbox or created before a restart, which were never transmitted. |
| D10 | `src/server/grpc.ts:193-204,389-402` | A timed-out command stays in the outbox: on reconnect it is replayed and executed, and `completeCommand` unconditionally overwrites `timed_out` with `succeeded`. A double execution, after the run already observed a failure. |
| D11 | `src/server/grpc.ts:437-449` | The gateway writes `terminal` and `unspecified` into `agent_steps.kind`, while `STEP_KINDS` declares only the four model-facing kinds — the live data already holds a `terminal` row. The vocabulary lies about the data. |
| D12 | `src/server/grpc.ts:160-175` | The D2 race has a second cost: on the unique-index violation, the in-memory counter has already advanced and the command already sits in the outbox — a phantom command awaits replay and a sequence number is skipped, so memory and database diverge even after the throw. |

D1, D2, D3, D7, D11 and D12 are correctness bugs, scheduled in milestone A. D8, D9 and D10 are
gateway-lifecycle bugs, scheduled in milestone H. D5 is the documented "dispatch is not durable" gap
and gets a bounded mitigation in milestone H rather than a fix.

---

## 2. Gaps

1. No ITIL classification on `tickets` — record type, impact, urgency, derived priority, category.
2. Ticket status never advances; `routing`, `resolving` and `resolved` are unreachable.
3. `resolved` and `closed` are distinguished in the enum but not in behaviour.
4. No oRPC procedure starts an agent run; dispatch is an unauthenticated HTTP hook.
5. Tool execution is hardcoded into the gRPC message handler and covers `device.*` only.
6. No Kubernetes connector: no reads, no JSON Patch, no dry-run, no rollout polling.
7. No CMDB write path and no provenance capture, despite the columns existing.
8. Devices are never linked to a user, so the device path cannot be reached from a ticket.
9. Run telemetry — model label and token counts — is never persisted.
10. Contract output types are looser than the vocabulary that already exists.
11. Defects D1–D3 and D7–D12.
12. No migrations, no scenario seeds, no repeatable demo reset.

---

## 3. Milestones

Dependency-ordered.

### A — Schema: ITIL alignment and defect fixes
**Files:** `src/db/schema/tickets.ts`, `src/db/schema/agent.ts`, `src/shared/index.ts`,
`src/server/grpc.ts`, `src/server/routers/index.ts`, new `src/db/migrations/0000_*.sql`.

Add to `tickets`:

| Column | Type | Notes |
|---|---|---|
| `record_type` | `text not null default 'incident'` | `incident` \| `service_request` |
| `impact` | `text not null default 'medium'` | `high` \| `medium` \| `low` |
| `urgency` | `text not null default 'medium'` | `high` \| `medium` \| `low` |
| `priority` | `text not null default 'P3'` | `P1`–`P4`, written by the server, never accepted as input |
| `category` | `text` | top level, null until routing runs |
| `subcategory` | `text` | second level |
| `resolved_at` | `timestamp` | technical resolution, distinct from `closed_at` |
| `progress_marker` | `text` | closed enum, safe to show an employee; set by the tool router in milestone D |

Index `tickets_priority_idx` on `(priority, createdAt)` and `tickets_type_idx` on
`(recordType, status)`.

Add to `src/shared/index.ts`: `RECORD_TYPES`, `IMPACT_LEVELS`, `URGENCY_LEVELS`, `PRIORITIES`,
`CATEGORIES` (a flat map from category to its subcategories), and

```ts
export function derivePriority(impact: Impact, urgency: Urgency): Priority
```

implementing the standard 3×3 matrix — H/H → P1; H/M and M/H → P2; H/L, M/M and L/H → P3; M/L, L/M
and L/L → P4.

Fix in the same pass:

- **D1** — `agent_steps.id` becomes `crypto.randomUUID()` with a new unique index on
  `(run_id, ordinal)`, and the insert becomes `onConflictDoNothing` on that index, so a replayed
  update is idempotent rather than fatal.
- **D7** — the `data` handlers and the sweep stop being `void`-discarded: a rejection is caught,
  logged, and errors the offending stream, never the process. This is the containment D1's fix
  removes one trigger for; the catch removes the class.
- **D2** — serialise sequence allocation per device with a promise chain keyed by device ID inside
  `Gateway`, so `loadSequence` runs at most once per device.
- **D12** — the same serialisation rolls the counter and the outbox entry back when the insert
  fails, so an allocation that did not commit leaves no phantom command behind.
- **D3** — `closedAt` is only ever written on close; escalation leaves it untouched.
- **D11** — `STEP_KINDS` gains `terminal`, matching what the gateway already writes and the data
  already holds; `unspecified` is never written — an unrecognised proto kind is persisted as an
  `observation` carrying the raw kind in its output, so the enum stays true.
- `tickets.device_id` gains a foreign key to `devices.id` — nothing enforces it today and
  `createTicket` accepts any string, so dangling device references are accepted silently.

Stop treating `drizzle-kit push` as the source of truth: run `pnpm db:generate` and commit the first
migration, so the ITIL columns arrive as a reviewable diff.

**Done when:** `pnpm db:migrate` applies cleanly to an empty database and to one created by the old
`push`; `derivePriority` is checked against all nine matrix cells; two `RunUpdate`s with the same
ordinal leave one row and throw nothing; and a forced insert failure on the step path errors that
stream while the process keeps serving.

### B — Contract and vocabulary
**Files:** `src/contracts/index.ts`, then `pnpm contracts:publish`.

- Tighten `ticket.status` to the existing `ticketStatus` enum and `device.connected` to a
  `deviceConnection` enum (**D4**).
- Add `recordType`, `impact`, `urgency`, `priority`, `category`, `subcategory`, `resolvedAt` to the
  `ticket` output object.
- `createTicket` input gains `recordType` (default `incident`), `impact`, `urgency` and optional
  `deviceId`. **It does not accept `priority`** — that is the whole point of deriving it.
- `listTickets` input gains `priority`, `recordType`, `category` and `route` filters plus
  `limit`/`cursor`, so the dashboard stops fetching every ticket in order to count them.
- `updateTicket.action` widens from `close | escalate` to
  `close | escalate | resolve | reopen | reclassify | assign`, with `impact`, `urgency`, `category`,
  `subcategory` and `route` as optional payload fields.
- New `startRun`: input `{ ticketId }`, output the created run summary.
- New `getRun`: polls one run's steps while it is in flight, so the dashboard can refresh a transcript
  without re-reading the whole ticket.
- New `listDeviceCommands`: input `{ deviceId, limit }`, for the dashboard device page.
- `listDevices` output gains `ownerEmail` and a last-command summary.
- `agentStep` output gains `evidence: z.string().nullable()` — the decisive line from an observation,
  produced by `agent.md` milestone E. The dashboard already declares this field locally and nothing
  supplies it.

Four additions requested by the frontend plans, each argued there and accepted here:

- **`getMyTicket`** (requested by `portal.md`) — the same ticket shape **without `runs`**, plus a
  `progressMarker`. Today `getTicket` returns every run with every step — model reasoning, tool names,
  raw tool output — to whichever client asks, and the portal asks. Nothing renders it, so the
  plain-language rule holds visually while the data sits in the browser. Authorization is out of scope
  by decision, so the fix is not a permission check but a differently shaped procedure: the portal
  cannot leak what it never receives.
- **`tickets.progress_marker`** (requested by `portal.md`) — a small closed enum on the ticket, set as
  a run proceeds: `gathering_evidence`, `checking_device`, `checking_service`, `applying_fix`,
  `verifying_fix`, `handing_to_person`. Derived server-side in milestone D from the surface of the tool
  being executed — never from anything the model wrote. This is a column added in milestone A; it is
  listed here because it is a contract field. It carries no model output, which is what makes it safe
  to render to an employee.
- **`ticketStats`** (requested by `dashboard.md`) — aggregate counts by status, priority and record
  type, plus a daily series over a window and a median time to resolution, in one call. The overview
  currently fetches every ticket and counts in the browser.
- **`listMyDevices`** (requested by `portal.md`) — the signed-in user's enrolled devices with hostname
  and last-seen, nothing more, so the request form can offer device attachment.

**Done when:** `pnpm check-types` passes in `api`, and after `pnpm contracts:publish` both frontends
either still typecheck or fail with errors naming exactly the fields that changed — no silent
widening.

### C — Ticket lifecycle and run dispatch
**Files:** `src/server/routers/index.ts`, new `src/server/tickets.ts` for the transition table,
`src/index.ts` (delete the raw hooks).

Implement the state machine as a table rather than conditionals — six states and seven actions is
exactly the size at which conditionals rot:

```
open       --(startRun)-------------------> routing
routing    --(first tool call observed)---> resolving
resolving  --(run resolved)---------------> resolved
resolving  --(escalated|exhausted|failed)-> escalated
resolved   --(reporter or staff confirms)-> closed
resolved   --(reporter says not fixed)----> escalated
escalated  --(staff closes)---------------> closed
closed     --(reopen)---------------------> open
```

An invalid transition throws `ORPCError("CONFLICT")` naming both states. `resolve` writes
`resolved_at`; `close` writes `closed_at` and leaves `resolved_at` alone.

`createTicket` now derives `priority` from the submitted impact and urgency, resolves the reporter's
device when `deviceId` is absent (see milestone G), and — behind an `AXIOMA_AUTO_DISPATCH` env flag,
default on — calls `startRun` immediately, so the demo needs no second click.

`startRun` moves out of `src/index.ts` into a protected procedure that inserts the `agent_runs` row,
transitions the ticket to `routing`, and calls `grpcGateway.startRun`. It returns
`ORPCError("SERVICE_UNAVAILABLE")` with the message `Axel is not connected` when the agent slot is
empty, instead of today's 503 text blob. Both raw HTTP hooks are deleted.

**Done when:** creating a ticket in the portal with Axel connected produces an `agent_runs` row and a
ticket in `routing` with no manual step, and every one of the eight transitions above has been driven
once through the oRPC surface with the invalid ones rejected.

### D — Tool execution router
**Files:** new `src/server/tools/index.ts`, `src/server/tools/device.ts`,
`src/server/tools/cluster.ts`, `src/server/tools/cmdb.ts`; `src/server/grpc.ts` reduced to transport.

`grpc.ts` currently decides what a tool is, translates it and dispatches it inside a `switch` in a
message handler. Extract a registry mirroring `agent/axel/tools.py`:

```ts
type ToolHandler = {
  name: string
  input: z.ZodType          // validated server-side too — the agent is not trusted
  verifiedBy?: string       // the read tool that confirms this write
  run(input: unknown, ctx: { runId: string; ticketId: string }): Promise<unknown>
}
```

`grpc.ts` then only parses `input_json`, looks the tool up, validates, runs it, and writes the
`ToolResult`. An unknown tool returns `ok: false` with a message naming the registered tools, so the
agent can correct itself inside its budget instead of burning a turn on a bare string.

The API validates input a second time even though `agent/axel/tools.py` already validated it. The
agent is a separate process on the far side of a wire; "the API owns every side effect" is not true if
the API trusts its caller's validation.

The router is also where `tickets.progress_marker` is set, because it is the only place that knows
which tool is executing and it knows it without reading anything the model wrote. The mapping is a
constant: `cluster.read_*` → `checking_service`, `device.read_state` → `checking_device`,
`cluster.patch_image` and `device.run_action` → `applying_fix`, a read that follows a write →
`verifying_fix`, an escalation → `handing_to_person`. Deriving it from the tool surface rather than
from reasoning text is what makes it safe to render on the portal.

**Done when:** `device.read_state` and `device.run_action` still round-trip end to end against a real
`axel-cli`, an unknown tool name returns a structured error naming the seven registered tools, and a
ticket's `progress_marker` advances through the run without ever containing text the model produced.

### E — Kubernetes connector
**Files:** new `src/server/tools/cluster.ts`, new `src/k8s/client.ts`, `src/env.ts`, `package.json`
(add `@kubernetes/client-node`).

`src/k8s/client.ts` loads from the default kubeconfig, with `KUBECONFIG` and `AXIOMA_K8S_CONTEXT`
overrides declared in `src/env.ts`. The kind-in-WSL2 reachability problem named in
`implementation.md` is configuration, not code: the API either runs inside WSL2, or the kind API
server port is mapped. The plan assumes the mapping plus the env var, and nothing in the connector
depends on which is chosen.

**`cluster.read_pods(namespace, labelSelector?)`** returns, per pod: `name`, `phase`,
`containerStatuses[].state.waiting.{reason,message}`,
`containerStatuses[].lastState.terminated.reason`, `restartCount`, and
`conditions[PodScheduled].{reason,message}`. Status, not events — status is structured and events are
prose. Events are read only for volume mount failures, the one signal that lives nowhere else, and
that is a follow-on rather than part of this milestone.

**`cluster.read_deployment(namespace, name)`** returns spec containers with their images, `replicas`,
`readyReplicas`, `updatedReplicas`, `conditions`, and the current revision annotation.

**`cluster.patch_image(namespace, name, containerIndex, image)`** applies a JSON Patch with the
explicit path `/spec/template/spec/containers/{index}/image` and `op: replace`. `replace` fails
loudly if the object is not the shape the caller believed; strategic merge would apply silently and
surface the mistake later. Mechanics of the v1.x client: the JSON Patch content type must be set
explicitly — `setHeaderOptions("Content-Type", PatchStrategy.JsonPatch)` on the
`patchNamespacedDeployment` call — or the client defaults to strategic merge and the explicit-path
guarantee is lost; `dryRun: "All"` is a field on the same request object. It runs once with the dry
run and only proceeds if that succeeds, returning both the dry-run result and the real one so the
transcript records both. `verifiedBy: "cluster.read_deployment"`.

**Rollout polling** is a helper that polls `read_deployment` until `readyReplicas === replicas` or a
90s ceiling, returning the observation sequence rather than a boolean, so the transcript shows the
`0/1 → 1/1` progression the demo depends on. Polled, not watched — fewer moving parts, and the caller
gets a progress stream for free.

**Done when:** against a kind cluster seeded with `nginx:1.99.99-nope`, `cluster.read_pods` returns
`ImagePullBackOff` with the manifest-unknown message verbatim; `cluster.patch_image` dry-runs then
patches; polling observes ready; and against the 64-CPU-request seed, `cluster.read_pods` returns
`Unschedulable` with the scheduler's `Insufficient cpu` message intact and unparaphrased.

### F — CMDB writes with provenance
**Files:** new `src/server/tools/cmdb.ts`.

`cmdb.record_observation` writes one additive row per observation, never an update. The four
provenance columns are filled from the run context the tool router already carries: `sourceTicketId`
and `sourceRunId` from `ctx`, `sourceStepId` from the step the agent reported alongside the call.
`device_commands.step_id` gets the same treatment — the column exists and the dispatch insert never
writes it, so command provenance is dead today; the tool router fills it from the same step context.

Add a read helper `readContextForTicket(ticketId, deviceId)` returning the newest row per
`(kind, externalId)`, used by milestone C to populate `StartRun.context_json` instead of today's
hardcoded `"{}"`.

**Done when:** a closed scenario-1 ticket has left at least one `cmdb_items` row whose `source_run_id`
and `source_step_id` both resolve to real rows, and a second run against the same deployment adds a
row rather than mutating the first.

### G — Device linkage and enrolment
**Files:** `src/db/schema/devices.ts`, `src/contracts/index.ts`, `src/server/routers/index.ts`,
`src/server/grpc.ts`, `proto/axioma.proto`.

A device today has no owner, so the device path is unreachable from a ticket. Add an `enrollDevice`
procedure taking a short-lived enrolment code, plus an `enrolment_code` column with an expiry on
`devices`. `axel-cli enroll` presents the code; the signed-in employee redeems it in the portal,
which sets `devices.owner_id`.

**Proto change:** `DeviceHello` gains `string enrolment_code = 8`. Additive and field-numbered, so
existing binaries keep working, but both agents must regenerate bindings.

`createTicket` resolves an absent `deviceId` to the reporter's most recently seen owned device. That
is what makes "my laptop is broken" reach the right machine without asking an employee to identify
hardware.

**Done when:** a freshly enrolled laptop shows an owner name in the dashboard devices table, and a
ticket opened by that employee with no `deviceId` arrives at Axel with the right `device_id`
populated.

### H — Gateway hardening and run telemetry
**Files:** `src/server/grpc.ts`, `src/db/schema/agent.ts`, `proto/axioma.proto`.

- **Agent slot** — replace the single `agent?: Duplex` with a small pool keyed by a worker ID from
  `AgentHello`, round-robin on dispatch. A superseded stream is closed explicitly rather than
  orphaned, and a slot is removed on `close` and `error` as well as `end`, so a killed worker cannot
  leave `startRun` writing into a dead stream (fixes **D8**).
- **Replay honesty** — only rows actually transmitted are marked `dispatched` (fixes **D9**), a
  command that timed out is removed from the outbox rather than replayed, and `completeCommand`
  refuses to overwrite a terminal status — a late result can no longer turn `timed_out` into
  `succeeded` (fixes **D10**).
- **`outcome` normalised** — proto-loader `defaults: true` turns an unset `outcome` into `""`, which
  is currently stored verbatim; empty becomes null at the persistence boundary.
- **Model and tokens** — persist `AgentHello.model_label` onto the `agent_runs` row at `startRun`, and
  add `prompt_tokens` / `completion_tokens` to the terminal `RunUpdate` in the proto so the numbers
  the dashboard already renders stop being zero. **Proto change**, additive.
- **Evidence** — add `string evidence = 11` to `RunUpdate` and an `evidence` column to `agent_steps`,
  carrying the decisive line from an observation: the `ImagePullBackOff` reason, the scheduler's
  message. Produced by `agent.md` milestone E, rendered by `dashboard.md` milestone F. **Proto
  change**, additive.
- **Worker identity** — add `string worker_id = 4` to `AgentHello` so the pool above can key on
  something stable rather than on stream identity. **Proto change**, additive.
- **D5, bounded** — the outbox stays in memory by decision, but on startup, commands still marked
  `pending` beyond a threshold are marked `timed_out` with an explicit error, and runs still marked
  `running` are marked `failed`. This is a mitigation, not durability, and is stated as such.
- **`CancelRun`** — wire the message that already exists in the proto to a `cancelRun` procedure, so
  the dashboard can stop a run that is misbehaving.

**Done when:** killing and restarting the API marks orphaned commands `timed_out` and orphaned runs
`failed` within one sweep; killing the agent worker mid-run frees the slot so the next `startRun`
returns `Axel is not connected` instead of inserting a stuck run; a completed run row shows a
non-null model and non-zero token counts; and cancelling from the dashboard ends the run as `failed`
with `run cancelled` rather than leaving it `running`.

### I — Scenario seeds and repeatable reset
**Files:** new `scripts/seed-scenarios.mjs`, new `k8s/` manifests, `package.json`.

Three idempotent seeds, each runnable more than once because a demo gets run more than once:

1. `checkout` Deployment in namespace `demo` with image `nginx:1.99.99-nope`.
2. `reporting` Deployment with `resources.requests.cpu: "64"`.
3. A device fault script paired with whatever facet and action `cli.md` settles on.

`pnpm seed:reset` tears all three down and re-applies them.

**Done when:** `pnpm seed:reset && pnpm seed` returns the cluster to the exact failing state twice in
a row with no manual `kubectl`.

---

## 4. Cross-component impact

| Change | Forced on | Owned by |
|---|---|---|
| ITIL columns on `tickets` | Contract republish; both frontends render and capture the new fields | `dashboard.md`, `portal.md` |
| `status`/`connected` tightened to enums (D4) | Both frontends can delete hand-rolled status maps | `dashboard.md`, `portal.md` |
| `updateTicket.action` widened | Dashboard takeover controls stop calling `escalate` for three different intents | `dashboard.md` |
| `startRun`, `getRun`, `cancelRun`, `listDeviceCommands`, `ticketStats` | New dashboard surfaces | `dashboard.md` |
| `getMyTicket`, `listMyDevices`, `tickets.progress_marker` | Portal device attachment, and the portal never receiving transcript data | `portal.md` |
| `DeviceHello.enrolment_code` | `cli` regenerates Go bindings and implements `enroll` | `cli.md` |
| `device.run_action` / `device.read_state` input schemas | `cli.md` milestone B replaces the action and facet sets; the server-side tool schemas must move with them, as must `agent/axel/tools.py`'s literals | `cli.md`, `agent.md` |
| Terminal `RunUpdate` gains token counts | `agent` reports usage from the litellm response | `agent.md` |
| `RunUpdate` gains `evidence` | `agent` extracts the decisive line; the dashboard renders it | `agent.md`, `dashboard.md` |
| `AgentHello` gains `worker_id` | `agent` persists and reports a stable worker identity | `agent.md` |
| `StartRun.context_json` becomes real CMDB context | `agent` must use it in prompt construction instead of ignoring it | `agent.md` |
| `StartRun` carries record type, impact and urgency | `agent`'s prompt distinguishes an incident from a service request | `agent.md` |
| Server-side tool input validation | `agent` receives structured refusals it must treat as observations | `agent.md` |
| `RUN_LIMITS` in `src/shared/index.ts` | Must equal the constants in `agent/axel/loop.py`; today both say 20/10/300s independently | `agent.md` |

All proto changes are additive with new field numbers. `pnpm contracts:publish` must run after
milestones B and G, and both agents must regenerate bindings after G and H.

---

## 5. Decisions taken

**Add a record-type discriminator.** `tickets.record_type` is `incident | service_request`. ITIL
treats these as separate practices with different objectives — restore service fast, versus fulfil a
pre-defined low-risk request — and they are prioritised differently: incidents by impact and urgency,
requests generally in order received. It also changes Axel's judgement: "the checkout service is
down" and "please install Figma" are not the same kind of problem. The cost is one column and one
enum. The alternative is a system that quietly models only incidents while calling them tickets.

**Store impact and urgency, derive priority.** Priority is never an input on any procedure. Letting a
reporter type a priority is how every real service desk ends up with a queue that is 60% P1. The
matrix lives in `src/shared/index.ts` so the API is the only place it exists, and the derived value is
written onto the row so the queue can index and sort on it rather than computing in the browser.

**Two levels of category, seeded from the scenarios.** `category` and `subcategory` only —
`infrastructure/deployment`, `device/network`, `access/account`. Categorisation exists to route and to
report; a deeper tree would be invented rather than observed. `TICKET_ROUTES` stays separate as the
routing target: category is what the problem *is*, route is who owns it.

**Keep the six existing statuses and make `resolved → closed` real.** Our names are not ITIL's, and
renaming them would ripple through both frontends and the proto for no behavioural gain. What matters
is the distinction ITIL insists on — resolution is technical, closure is confirmed — and here that
distinction is load-bearing rather than ceremonial, because Axel resolves autonomously and a human
confirms. The portal's "This solved it" button is already this transition. No `Cancelled` state:
nothing in the product can cancel a ticket.

**Patching a deployment is a Change.** In ITIL terms `cluster.patch_image` is a standard change, and a
real service desk would route it through Change Enablement. Axiōma has no change record, no CAB and
no approval gate, and is not getting them — `idea.md` puts safeguards out of scope by decision. Stated
rather than glossed, because anyone with an ITSM background will look for it.

**Server-side validation of tool input.** The agent validates against pydantic before sending and the
API validates again with zod before executing. Duplicated on purpose, for the reason given in
milestone D.

**The new enums are written out twice, in `src/shared/index.ts` and again in `src/contracts/index.ts`.**
The contract may import only `@orpc/contract` and `zod`, because it is copied verbatim into two
frontends that have no database, no auth module and no Hono context. That rule forbids the contract
importing the vocabulary module, so the impact, urgency, priority, record-type and category enums exist
in both files. This is a real cost and it is accepted: the alternative is a contract that cannot be
mirrored, which breaks the arrangement that makes separate repositories possible at all. Both files
carry a comment naming the other, and `derivePriority` lives only in `shared` — the duplication is
values, never logic.

**A differently shaped procedure for the portal, not a permission check.** `getTicket` currently
returns full transcripts to any authenticated caller, and the portal is one. Authorization is out of
scope by decision, so the fix cannot be a check on who is asking. `getMyTicket` returns a shape that
contains no run and no step, which means the portal is structurally unable to leak what it must not
show. This is the one place where "no authorization" and "never show an employee model output" collide,
and shaping the data is the only tool available.

**`cmdb.record_observation` is the one write with no verifying read, and that is deliberate.** The
brief's rule is that every write names the read that verifies it, and the registry in
`agent/axel/tools.py` — matching the table in `architecture.md` — leaves `verified_by` null for this
one. The reason is that a CMDB observation has no external state to re-read: the write *is* the record,
and it is additive rather than corrective, so a failed insert is visible in the tool result and nothing
else can have drifted. `agent.md` milestone C's enforcement therefore exempts tools whose `verified_by`
is null rather than treating the null as an omission.

**`@kubernetes/client-node`.** The official client. Writing raw fetch against a kubeconfig means
reimplementing exec credential plugins and TLS handling for no benefit.

**Fix the primary key on `agent_steps` rather than deduplicating upstream.** A composite natural key
built from run and ordinal assumes ordinals are never repeated, which is exactly what a replay or a
reconnect breaks. A surrogate key with a unique index and `onConflictDoNothing` makes the write
idempotent at the only layer that can guarantee it.

**Migrations, not `push`.** `db:push` is right for a schema nobody has data in. The moment the ITIL
columns land with defaults on existing rows, the change deserves a reviewable artefact.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| kind runs in WSL2 and the API is a Windows-side Node process, so the cluster may be unreachable. | Settle this in milestone E's first hour, before writing connector code: either map the kind API server port or run the API inside WSL2 with the checkout on the Linux filesystem. `AXIOMA_K8S_CONTEXT` keeps the code indifferent. |
| The ITIL schema change ripples into the contract and both frontends at once, so a bad landing breaks three components' gates. | Land A and B together, run `pnpm contracts:publish` immediately, and fix both frontends in the same session. New columns carry defaults, so no existing row becomes invalid. |
| Auto-dispatch on ticket creation makes every portal test start a real model run and spend tokens. | `AXIOMA_AUTO_DISPATCH` env flag, and `AXIOMA_MODEL=demo` still short-circuits the model in the agent. |
| `cluster.patch_image` can patch any deployment the service account reaches — no blast-radius limit, by decision. | Keep the service account scoped to the `demo` namespace in the seed manifests. That is a deployment control, not a code control, and is named honestly as such. |
| Concurrent runs against one device can interleave commands, and dispatch is not idempotent, so a retried action can apply twice. | One in-flight run per ticket, enforced in `startRun`; the existing unique `(deviceId, sequence)` index makes a double dispatch visible after the fact. |
| The gateway holds all connection state in memory, so an API restart mid-demo loses in-flight work. | Startup reconciliation in milestone H marks orphaned commands `timed_out` and orphaned runs `failed`, so state ends up wrong-but-final rather than wrong-and-stuck. |

---

## 7. Definition of done

1. `pnpm check` and `pnpm check-types` pass; `pnpm db:migrate` applies from empty.
2. `derivePriority` returns the matrix value for all nine impact × urgency combinations, and no
   procedure accepts `priority` as input.
3. A ticket created in the portal reaches Axel automatically, with `deviceId` resolved from the
   reporter's enrolled device when the ticket is about a laptop, and `context_json` carrying real CMDB
   rows rather than `{}`.
4. All seven tools in `agent/axel/tools.py` execute through the API — three cluster, three device, one
   CMDB. None returns `tool not implemented`.
5. Scenario 1 — `cluster.read_pods` reports `ImagePullBackOff`, `cluster.patch_image` dry-runs then
   patches, rollout polling observes `1/1`, and the ticket reaches `resolved` then `closed`.
6. Scenario 3 — `cluster.read_pods` returns `Unschedulable` with the scheduler's message verbatim, no
   write tool is called, and the ticket reaches `escalated` with the proposed patch stored on the
   terminal step.
7. Scenario 2 — a device command round-trips and the ticket closes on a verifying second read.
8. Every transition in milestone C's table has been exercised; the invalid ones return `CONFLICT`.
9. Every closed ticket has `cmdb_items` rows whose `source_run_id` and `source_step_id` resolve.
10. Every finished `agent_runs` row has a non-null `model` and non-zero token counts.
11. Restarting the API leaves no `device_commands` row stuck in `pending` and no `agent_runs` row
    stuck in `running`.
12. `pnpm seed:reset && pnpm seed` reproduces all three scenarios twice in succession.
13. `getMyTicket` returns no `runs` and no `agent_steps` field at all, and `progress_marker` advances
    through a run carrying only values from its closed enum.
14. `ticketStats` answers the overview in one call, and `listMyDevices` returns only the caller's own
    enrolled devices.
15. `src/contracts/index.ts` still imports nothing but `@orpc/contract` and `zod`.
