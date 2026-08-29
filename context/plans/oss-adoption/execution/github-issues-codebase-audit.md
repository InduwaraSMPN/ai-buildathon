# GitHub issues — cross-codebase architecture audit

**Document role:** Copy-ready GitHub issues from a read-only audit of Axiōma's frontend, backend, AI agent, CLI, and live PostgreSQL database  
**Audited:** 2026-08-29  
**Scope:** `dashboard/`, `portal/`, `api/`, `agent/`, `cli/`, and the configured `axioma` PostgreSQL database  
**Parent:** [oss-adoption.md](../oss-adoption.md) · **Related:** [chat-0-refactor.md](chat-0-refactor.md)

No source files or database records were changed during the audit that produced these issues.

---

## Issue 1 — Split oRPC contracts, routers, and dashboard features by product domain

### Summary

Temporary OSS-adoption tiers have become permanent source-code boundaries in parts of the API and dashboard:

- `api/src/contracts/tier2.ts`
- `api/src/contracts/tier4.ts`
- `api/src/server/routers/tier2.ts`
- `api/src/server/routers/tier3.ts`
- `api/src/server/routers/tier4.ts`
- `dashboard/src/features/tier4/components.tsx`

The organization is inconsistent:

- Contract files exist for Tier 2 and Tier 4 only.
- Router files exist for Tier 2, Tier 3, and Tier 4.
- Tier 0, Tier 1, and Tier 3 contracts remain in `api/src/contracts/index.ts`.
- `dashboard/src/features/tier4/components.tsx` combines assets, scheduling, suppliers, mail, dashboard configuration, and documents in one file.

Tiers are delivery phases from `context/plans/oss-adoption/tiers/`; they are not durable product boundaries.

### Evidence

- Tier contracts are flattened at `api/src/contracts/index.ts:3-4,405-407`.
- Tier routers are flattened at `api/src/server/routers/index.ts:92-94,358-361`.
- Tier 3 contracts remain in `api/src/contracts/index.ts:731-937` while their handlers live in `api/src/server/routers/tier3.ts`.
- The tier buckets are large and heterogeneous:
  - `api/src/contracts/tier2.ts`: 367 lines
  - `api/src/contracts/tier4.ts`: 461 lines
  - `api/src/server/routers/tier2.ts`: 629 lines
  - `api/src/server/routers/tier3.ts`: 498 lines
  - `api/src/server/routers/tier4.ts`: 1,142 lines
  - `dashboard/src/features/tier4/components.tsx`: 643 lines

### Proposal

Organize contracts and routers by stable product domain. Complete the ownership map before moving code.

Suggested domains:

```text
api/src/contracts/
  index.ts
  shared.ts
  system.ts
  identity.ts
  tickets.ts
  agent-runs.ts
  devices.ts
  catalogue.ts
  problems.ts
  changes.ts
  approvals.ts
  knowledge.ts
  cmdb.ts
  custom-fields.ts
  automation.ts
  notifications.ts
  search.ts
  api-keys.ts
  assets.ts
  software-licences.ts
  scheduling.ts
  status.ts
  channels.ts
  mail.ts
  documents.ts
  suppliers.ts
  dashboards.ts
  directory.ts
  identity-providers.ts
```

Use corresponding domain files under `api/src/server/routers/`. Closely related, small domains may share a file when the ownership remains obvious; the goal is stable ownership, not one file per noun.

Split the dashboard Tier 4 bucket into its existing or new domain folders:

```text
dashboard/src/features/
  assets/
  scheduling/
  suppliers/
  mail/
  documents/
  overview/
```

### Preserve

- Flat procedure names and URLs
- `appContract`, `AppContract`, and `appRouter` exports
- Inputs, outputs, defaults, and validation
- Authorization builders and policies
- OpenAPI output
- Query-key behavior

Do not introduce nested procedure names such as `assets.list` in this mechanical refactor. That would be a separate API migration.

### Shared-module rule

Do not replace tier buckets with a generic `shared.ts` bucket:

- `findTicket`, `findTicketMessages`, and `decodeCursor` belong to tickets.
- `getRun` belongs to agent runs.
- Only genuinely cross-domain orchestration should be shared.

### Out of scope

- Database migrations
- Procedure renaming
- Authorization changes
- Reorganizing the agent or CLI merely to imitate TypeScript folders
- Renaming historical migrations

### Acceptance criteria

- [ ] No production source module is named after an adoption tier.
- [ ] Every current procedure has an explicit domain owner, including agent runs, dashboards, directory sync, identity providers, channel intake, and software licensing.
- [ ] `contracts/index.ts` primarily composes and exports the public contract.
- [ ] `server/routers/index.ts` primarily composes and exports the application router.
- [ ] `dashboard/src/features/tier4/components.tsx` is replaced by domain-owned components.
- [ ] Procedure names, URLs, input/output schemas, defaults, and authorization remain unchanged.
- [ ] Portal and dashboard contract copies are republished.
- [ ] API, dashboard, and portal checks pass.

### References

- [oRPC router composition](https://github.com/dinwwwh/orpc/blob/main/skills/orpc/SKILL.md)
- [oRPC client types composed from smaller routers](https://github.com/dinwwwh/orpc/blob/main/apps/content/docs/recipes/exceeds-the-maximum-length-problem.mdx)

---

## Issue 2 — Add automated freshness checks for copied contracts and generated protobuf bindings

### Summary

The API is the source of truth for two copied interfaces:

1. `api/src/contracts/` is mirrored into `dashboard/src/sdk/contracts/` and `portal/src/sdk/contracts/`.
2. `api/proto/axioma.proto` is mirrored into `agent/proto/axioma.proto` and `cli/proto/axioma.proto`.

The copies were synchronized at audit time, but freshness depends on developers remembering to run `pnpm contracts:publish`. There is no CI check that fails when copied or generated artifacts drift.

### Evidence

- `api/scripts/publish-contracts.mjs:34-57` recursively copies the contracts tree.
- `api/scripts/publish-contracts.mjs:60-70` copies the canonical proto.
- Dashboard and portal copies were byte-identical to API contract sources after removing the generated banner.
- All three proto copies had identical hashes.
- Python bindings under `agent/axel/pb/` are intentionally ignored.
- Go bindings under `cli/internal/pb/` are checked in.

### Proposal

Add one repository-level verification command that:

1. Republishes contracts and proto files from the API source.
2. Regenerates checked-in Go bindings.
3. Generates Python bindings before agent tests.
4. Fails if tracked generated artifacts change.
5. Runs relevant compilation or type checks.

Use a clean checkout or temporary output in CI so verification does not leave changes behind.

### Acceptance criteria

- [ ] CI fails when either frontend contract copy differs from `api/src/contracts/`.
- [ ] CI fails when agent or CLI proto copies differ from `api/proto/axioma.proto`.
- [ ] CI fails when checked-in Go protobuf bindings are stale.
- [ ] Python bindings are generated before agent tests and remain uncommitted.
- [ ] Newly added contract domain files are copied automatically.
- [ ] Generated files remain clearly marked and are never manually edited.
- [ ] Contributor documentation provides one canonical regeneration/verification command.

### Not required yet

Do not split `axioma.proto` solely because it contains `AgentChannel` and `DeviceChannel`. Split it into agent, device, and common files only when independent ownership, release, or compilation cost justifies it.

### References

- [Protocol Buffers Go generation](https://github.com/protocolbuffers/protocolbuffers.github.io/blob/main/content/getting-started/gotutorial.md)
- [Protocol Buffers Python generation](https://github.com/protocolbuffers/protocolbuffers.github.io/blob/main/content/reference/python/python-generated.md)
- [Protocol Buffer compatibility rules](https://github.com/protocolbuffers/protocolbuffers.github.io/blob/main/content/programming-guides/editions.md)

---

## Issue 3 — Reconcile Drizzle declarations and migration metadata with PostgreSQL

### Summary

The live database and migration history contain constraints that are missing from the current Drizzle declarations. Migration journal entries also extend beyond the available snapshots.

This creates schema drift: PostgreSQL behavior is stricter than the schema represented to application code and future Drizzle generation may propose duplicate or destructive changes.

### Confirmed declaration drift

#### Tickets

The live database contains:

- A composite relationship between `tickets.service_subcategory_id` and `tickets.service_id`.
- A self-reference for `tickets.merged_into_id`.

These are not declared in `api/src/db/schema/tickets.ts:52-55,78`.

#### Catalogue

The live database/migrations contain relationships for:

- `services.sla_id`
- `services.ola_id`
- `service_subcategories.form_id`

The source declarations leave these as loose text IDs at `api/src/db/schema/catalogue.ts:38-41,68`.

Circular TypeScript imports should not make source declarations omit integrity already enforced by PostgreSQL.

### Confirmed metadata gap

- The live database records 16 applied Drizzle migrations.
- `_journal.json` contains migrations `0000` through `0015`.
- Snapshot files stop at `0006_snapshot.json`.
- `drizzle.config.ts:8-10` points generation at the complete schema and this migration directory.

### Proposal

1. Update Drizzle declarations to represent existing live constraints.
2. Break schema import cycles with supported deferred references or a neutral schema dependency layout.
3. Establish a current schema snapshot/baseline through `0015`.
4. Add a drift check using a clean migrated database.
5. Review the next generated migration and confirm it contains no unexpected recreation or removal.

### Migration safety

The existing migrations and journal entries are applied history. Do not rename, reorder, or edit them to remove tier terminology:

```text
0008_tier1_core.sql
0009_tier0_identity_rbac.sql
0011_tier2_service_management.sql
0012_tier3_extensible_platform.sql
0013_tier4_operations.sql
0014_tier1_integrity.sql
0015_ticket_update_capability.sql
```

Use descriptive, domain-based names for future migrations.

### Acceptance criteria

- [ ] Drizzle declarations represent all existing ticket and catalogue foreign keys.
- [ ] A clean database applies migrations `0000` through `0015`.
- [ ] The migrated database matches the declared Drizzle schema.
- [ ] Current migration metadata represents the schema through `0015`.
- [ ] A subsequent reviewed generation has no unexpected create/drop operations.
- [ ] Existing migration SQL, journal timestamps, and applied hashes remain unchanged.
- [ ] CI includes a documented migration/schema drift check.

### References

- [Drizzle schema directory configuration](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/mssql/sql-schema-declaration.mdx)
- [How `drizzle-kit migrate` uses migration history](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/pg/drizzle-kit-migrate.mdx)

---

## Issue 4 — Finish retiring legacy ticket classification and CMDB compatibility storage

### Summary

Two completed adoption migrations left legacy models active beside their replacements.

### Ticket classification

The service catalogue was intended to supersede `category` and `subcategory`, but the legacy fields remain in:

- `api/src/db/schema/tickets.ts:56-58`
- `api/src/contracts/index.ts`
- `api/src/shared/index.ts`
- `api/src/server/routers/index.ts`
- `api/src/server/rules/index.ts`
- `api/src/server/workflows/core.ts`
- Dashboard queue, detail, classification form, and search state

Tickets carry both:

- `serviceId` / `serviceSubcategoryId`
- `category` / `subcategory`

The old vocabulary remains writable and visible after the backfill migration.

### CMDB

The live database retains both:

- Legacy `cmdb_items`
- Replacement `cmdb_objects` and metamodel tables

Production source now uses `cmdb_objects`; `cmdb_items` remains for migration verification. Keeping both indefinitely leaves an ambiguous source of truth.

### Proposal

Create forward-only cleanup migrations after explicit data preflight:

1. Verify every ticket has a valid, matching service and subcategory.
2. Move rules/workflows from category values to catalogue identifiers.
3. Remove legacy category filters, DTO properties, controls, and constants.
4. Drop `tickets.category` and `tickets.subcategory`.
5. Verify every `cmdb_items` row exists in `cmdb_objects` with matching provenance.
6. Archive or drop `cmdb_items` after an agreed rollback window.
7. Replace permanent compatibility tests with migration/preflight checks that do not require the old tables forever.

### Database note

The audited development database contained no ticket or CMDB rows, and sampled inconsistency checks returned zero. Empty development tables do not replace production/staging preflight.

### Acceptance criteria

- [ ] Catalogue IDs are the only ticket classification source.
- [ ] Rules and workflows no longer use legacy category criteria or `set_category`.
- [ ] Dashboard no longer displays or edits legacy classification.
- [ ] Legacy ticket columns are removed through a new migration.
- [ ] `cmdb_objects` is the sole production CMDB object store.
- [ ] Legacy CMDB rows and all provenance fields are verified before removal.
- [ ] Backup and rollback requirements are documented before destructive migration.
- [ ] Historical migrations remain unchanged.

---

## Issue 5 — Eliminate drift between API, agent, and CLI tool contracts

### Summary

AI tool contracts are independently declared in TypeScript, Python, protobuf, and Go-facing dispatch code. They have already drifted.

### Confirmed mismatch

`agent/axel/tools.py:42-45` declares:

```text
knowledge_search.limit: default 5, maximum 10
```

`api/src/server/tools/knowledge.ts:7-10` declares:

```text
knowledge_search.limit: default 8, maximum 20
```

Device actions and related vocabularies are also repeated across:

- `agent/axel/tools.py`
- `api/src/server/tools/device.ts`
- `api/src/server/grpc.ts`
- `cli/internal/device/actions.go`

The model may validate one definition while the API or device executes another.

### Proposal

Use one wire-level source of truth for tool names and input constraints.

Minimal implementation:

1. Keep implementations domain-owned in each language.
2. Export a machine-readable manifest from the API or define typed tool messages in protobuf.
3. Add parity tests for names, required fields, defaults, limits, and device actions.
4. Resolve the existing knowledge-search mismatch deliberately.
5. Split `agent/axel/tools.py` by domain behind one stable registry facade.

Suggested Python layout:

```text
agent/axel/tools/
  __init__.py
  knowledge.py
  cluster.py
  device.py
  cmdb.py
  change.py
```

Do not build a custom generator unless parity tests prove insufficient.

### Acceptance criteria

- [ ] `knowledge_search.limit` has one documented default and maximum.
- [ ] API and agent expose identical tool names and validation boundaries.
- [ ] Device action names match across API, agent, proto, and CLI.
- [ ] A parity test fails when one component changes independently.
- [ ] The agent tool registry remains a stable public facade.
- [ ] Existing wire names remain compatible unless explicitly migrated.

---

## Issue 6 — Replace source-layout tests with behavior tests

### Summary

Several tests verify implementation by reading source files and matching regular expressions. These tests break during harmless file moves and can pass while runtime behavior is wrong.

### Evidence

- `api/src/server/tier4-gaps.test.ts` reads router, runtime, server, and dashboard files.
- `api/src/server/tier4-integration.test.ts` reads `routers/tier4.ts` and asserts source patterns.
- `api/src/server/authorization-policy.test.ts` has reporter-specific assertions tied to `routers/index.ts`.
- `agent/tests/test_prompt_config.py:161-177` reads sibling source `api/src/shared/index.ts` and parses run limits with regular expressions.

The agent test contradicts the architecture in which components can be separate repositories.

### Proposal

- Test exported functions, router behavior, authorization outcomes, and database behavior.
- Make authorization coverage inspect composed router behavior rather than one filename.
- Move dashboard behavior assertions into dashboard tests.
- Give run-limit ownership to an explicit contract/configuration rather than sibling-source parsing.
- Rename tests after behavior rather than rollout tiers.

A small composition-key test is acceptable if it verifies the public router shape rather than source formatting.

### Acceptance criteria

- [ ] No test reads router source to prove a call or string exists.
- [ ] Agent tests do not read files from a sibling API checkout.
- [ ] Reporter authorization coverage follows procedures after file moves.
- [ ] Dashboard behavior is tested within the dashboard.
- [ ] Run-limit compatibility uses an explicit interface or independently owned documented defaults.
- [ ] Domain file moves do not cause unrelated test failures.

---

## Issue 7 — Narrow the portal API surface and centralize document uploads

### Summary

The employee portal types its client against the complete staff-facing `AppContract` at `portal/src/utils/orpc.ts:7,60`.

Server authorization remains the security boundary, but exposing administrative procedures to portal code makes accidental staff-procedure usage easier and weakens the intended component boundary.

The portal also combines typed document operations with a direct multipart request inside `portal/src/routes/_auth/tickets/$ticketId.tsx:315-340`. That route owns URL construction, request handling, upload toasts, and cache invalidation.

### Proposal

1. Export a reporter-facing contract subset from the canonical API contract.
2. Type the portal client against that subset.
3. Keep all authorization enforcement on the server.
4. Create a documents-domain upload adapter for multipart upload.
5. Centralize upload error handling and document-query invalidation.
6. Move request-catalogue orchestration out of ticket-specific modules.
7. Rename generic portal shell helpers in `components/ticket-ui.tsx`, which are also consumed by login, home, and knowledge routes.

### Acceptance criteria

- [ ] Portal code cannot reference staff-only procedures at compile time.
- [ ] Server-side authorization remains authoritative.
- [ ] Reporter ticket mutation exposes only allowed reporter actions such as `add_detail`.
- [ ] Multipart upload has a typed request/result adapter.
- [ ] Upload errors and cache invalidation are centralized.
- [ ] Generic shell components are no longer ticket-named.
- [ ] Portal build and type checks pass.

---

## Issue 8 — Centralize ticket-creation invariants across intake channels

### Summary

Tickets are inserted through at least five production paths:

1. Direct API: `api/src/server/routers/index.ts`
2. Request catalogue: `api/src/server/routers/tier2.ts`
3. External channel ingestion: `api/src/server/routers/tier4.ts`
4. Inbound email: `api/src/server/mail/db.ts`
5. Recurrence generation: `api/src/server/scheduling-runtime.ts`

Each path independently handles some combination of defaults, rules, numbering, SLA attachment, audit, indexing, workflows, and notifications.

Confirmed differences include:

- Catalogue creation omits number history, rules, indexing, and `ticket.created`.
- Channel creation calculates a priority but attaches SLA using hard-coded `P3`.
- Email creation omits rule audit rows, SLA attachment, indexing, and `ticket.created`.
- Recurrence creation omits ticket number/history, SLA, indexing, and `ticket.created`.

This is a correctness issue, not only organization.

### Proposal

Create one domain-owned ticket creation service, for example:

```text
api/src/server/tickets/create.ts
```

It should own the common transaction and invariants while accepting explicit source-specific input:

```ts
createTicket({
  source: "portal" | "catalogue" | "email" | "channel" | "recurrence",
  reporterId,
  title,
  body,
  serviceId,
  serviceSubcategoryId,
  origin,
  metadata,
});
```

Keep parsing, authentication, authorization, deduplication, and source-specific behavior in each adapter.

Centralize only invariants shared by every ticket:

1. Input normalization and defaults
2. Service/subcategory consistency
3. Rule evaluation and rule-result persistence
4. Number allocation/history
5. Initial status and assignment
6. SLA/OLA attachment
7. Initial audit/transition record
8. Search indexing
9. Creation event/workflow dispatch
10. Transaction and failure semantics

Decide explicitly which effects must be atomic and which run after commit with retry support.

### Tests

Add table-driven coverage for:

- Portal/API ticket
- Catalogue request
- Inbound email
- External channel message
- Recurring ticket

### Acceptance criteria

- [ ] All five production intake paths call one shared creation service.
- [ ] Adapters no longer insert directly into `tickets`.
- [ ] Every ticket receives a valid number, status, service classification, and required defaults.
- [ ] Rules and SLA/OLA initialization run consistently.
- [ ] Audit, search, and workflow behavior is consistent across sources.
- [ ] Source-specific metadata and authorization remain outside the common service.
- [ ] Duplicate external messages remain idempotent.
- [ ] Recurrence generation remains atomic.
- [ ] Tests prove equivalent core invariants across all intake paths.

---

## Issue 9 — Test the production asset-import planner and remove the test-only Tier 4 implementation

### Summary

Asset import has two independent implementations:

- Test-only planner: `api/src/server/t4-asset-import.ts`
- Production implementation: `api/src/server/assets/import.ts`

The only consumer of the Tier 4 planner is `api/src/server/t4-asset-import.test.ts`. Production routes use the other implementation. The planner tests can therefore pass while production behavior is broken.

### Proposal

Move useful pure planning logic into the production assets module and test that implementation directly:

```text
api/src/server/assets/
  csv.ts
  import.ts
  import.test.ts
```

Delete:

```text
api/src/server/t4-asset-import.ts
api/src/server/t4-asset-import.test.ts
```

Do not retain a Tier 4 forwarding wrapper.

### Acceptance criteria

- [ ] Production import calls the same planning function covered by tests.
- [ ] Missing-name validation is covered.
- [ ] Duplicate identity handling is covered.
- [ ] Insert-versus-update behavior is covered.
- [ ] Rejected-row reporting is covered.
- [ ] The test-only Tier 4 implementation is removed.
- [ ] API tests and type checks pass.

---

## Issue 10 — Correct API dependency direction and expose a side-effect-free app factory

### Summary

Some API dependencies currently point in the wrong direction:

```text
db/schema → server implementation types
oRPC router → HTTP transport module
```

Examples:

- `api/src/db/schema/rules.ts` imports types from `api/src/server/rules`.
- The Tier 4 oRPC router imports document policy/query helpers from `api/src/server/documents/http.ts`.

`api/src/index.ts` also constructs the app, starts HTTP and gRPC listeners, starts background sweeps, and installs signal handlers at import time. This makes genuine app/router tests difficult and helps explain the source-regex tests.

### Proposal

#### Move shared domain definitions below adapters

Create transport-neutral modules for:

- Persisted rule criteria and actions
- Document visibility and target authorization
- Shared document queries

The database schema must not import server/router implementation modules. HTTP and oRPC adapters should call the same document domain functions.

#### Separate construction from startup

Use a side-effect-free factory and a minimal executable entry point:

```text
api/src/app.ts       # constructs and returns the Hono/oRPC app
api/src/index.ts     # starts servers, sweeps, and signal handling
```

Importing `app.ts` in tests must not bind ports, start gRPC, start recurring jobs, or install process handlers.

Do not introduce a dependency-injection framework or speculative interfaces.

### Acceptance criteria

- [ ] Database schema files do not import server implementation modules.
- [ ] oRPC routers do not import domain policy from HTTP adapters.
- [ ] Document HTTP and oRPC transports share one transport-neutral policy implementation.
- [ ] Importing the app factory has no process-level side effects.
- [ ] Runtime startup remains in a minimal executable entry point.
- [ ] Router and HTTP behavior can be tested without network listeners.
- [ ] Relevant source-regex tests are replaced with behavior tests.
- [ ] API tests and type checks pass.

---

## Do not change

The audit also identified several things that are unusual but intentional or harmless:

1. **Do not rename historical tier migration files or journal tags.** They are applied operational history.
2. **Do not reorder migrations to make Tier 0 precede Tier 1.** The existing ordering is immutable history.
3. **Do not edit generated Python or Go protobuf files manually.** Regenerate them from the canonical proto.
4. **Do not create tier directories under `api/src/db/schema/`.** The schema is already domain-oriented.
5. **Do not redesign `publish-contracts.mjs` just to support domain files.** It already copies the whole contracts directory recursively.
6. **Do not require one router per service module.** Domain ownership does not require a strict one-to-one file map.
7. **Do not split the proto until independent ownership or release needs justify it.** Its current mirroring model is valid.

---

## Recommended execution order

1. Reconcile Drizzle declarations and migration metadata.
2. Resolve the confirmed API/agent tool-contract mismatch.
3. Complete the domain ownership map.
4. Perform the mechanical contract/router/dashboard split.
5. Republish contracts and add freshness checks.
6. Replace source-layout tests with behavior tests.
7. Centralize ticket-creation invariants.
8. Connect asset-import tests to production code.
9. Correct dependency direction and add the app factory.
10. Retire legacy classification and CMDB storage.
11. Narrow the portal contract and centralize uploads.
