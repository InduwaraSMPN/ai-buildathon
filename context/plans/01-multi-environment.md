# Phase 1 — Multi-Environment

**Document role:** Implementation plan, executed in its own chat session.
**Read first:** [00-overview.md](00-overview.md) for the program and cross-phase contracts · [architecture.md](../idea/architecture.md) for the invariants · this document's Progress Log at the end.
**Depends on:** nothing. **Blocks:** everything else gets more expensive if this lands late.

## Problem

Axiōma can reach exactly one Kubernetes cluster, chosen at process start.

`api/src/k8s/client.ts` builds a client from `KUBECONFIG` and `AXIOMA_K8S_CONTEXT`, memoises it in a module-level variable, and returns that same pair forever. `api/src/server/tools/cluster.ts` takes `namespace` and `name` but has no way to express *which* cluster. A customer with development, staging, and production — or with regional clusters — has nowhere to put that distinction.

The target system resolves the environment per ticket, preferring the ticket, then the CMDB, then configured default.

## Scope

**In.**

- An `environments` table with encrypted per-environment connection credentials.
- A keyed client cache replacing the singleton.
- An `environment` parameter on all three cluster tools, on both schema sides.
- Server-side environment resolution, authoritative, in the order ticket → CMDB → default.
- The resolved environment carried in `StartRun` and rendered in the agent prompt.
- Administration surface for environments in the dashboard.
- Tests, including an extension to the parity test.

**Out.**

- New connectors of any kind. The cluster stays the only one.
- Per-environment policy beyond a `mode` column reserved for later use (see below).
- Multi-tenancy. One stack per customer; no `tenant_id`.
- Changing what a cluster write is allowed to do. `assertStandardImageChange` stays exactly as it is.

## Design

### Environment resolution is server-side and authoritative

The requested priority is ticket first, then CMDB, then config. Implement that ordering **in the API, before the run starts**, and pass one resolved environment to the agent. The agent may name an environment in a tool call only if it is linked to that ticket's service; anything else is rejected as invalid input and becomes an observation in the transcript.

The reason is specific rather than general caution. Ticket title and body are attacker-chosen text — anyone who can open a ticket, or send mail that becomes one, picks those bytes, and they reach the model verbatim through `build_user_prompt`. If "which cluster do I write to" can be steered by ticket prose, then production is one sentence away in any ticket anyone files. Resolving server-side keeps the stated priority order and removes that path.

"From the ticket" therefore means **a structured field**, not text parsed out of the body. The ticket already carries `serviceId` and `serviceSubcategoryId`; environment hangs off the service, or off a service×environment pair. A dynamic field is acceptable if it is validated against the `environments` table on write.

### Reserve the mode column now

Add `mode` to `environments` with values `act` and `shadow`, defaulting to `act`, and read it in exactly one place: a guard in `executeTool` that refuses write-effect tools when the environment is in shadow mode. Nothing else in this phase uses it.

This is three lines of work now and saves a schema migration plus a second pass through the tool dispatcher later. The ITSM connector track (`06-itsm-connector.md`) proposes a shadow mode where Axel proposes rather than acts; per-environment `mode` is where that belongs, and the agent must not know about it — suppression happens at the API tool layer so the transcript still records what Axel intended to do.

### Credentials

Follow the existing scheme in `api/src/auth/providers.ts`: AES-256-GCM, `v1:iv:ciphertext:tag` with base64url segments, key from `AXIOMA_PROVIDER_ENCRYPTION_KEY` (base64-encoded 32 bytes).

Note that only `aesGcmProviderSecretLoader` exists — a decrypt path. **There is no encrypt helper in the tree.** Add one alongside it, symmetric in shape, and use it for both auth providers and environments. Do not introduce a second encryption scheme; the overview names this a cross-phase contract.

Two connection modes must both work:

| Mode | Use |
|---|---|
| In-cluster ServiceAccount | The platform runs inside the cluster it manages |
| Explicit kubeconfig or endpoint plus token | The platform manages a cluster it does not run in |

The second is the common case once there is more than one environment, so it cannot be the afterthought.

## Build order

Work in this sequence. Each step leaves the tree compiling and the tests green.

### 1. Schema and migration

`api/src/db/schema/` gains an `environments` table. Suggested columns — adjust to match the conventions already in that directory:

| Column | Notes |
|---|---|
| `id` | uuid primary key |
| `key` | stable string, unique, `prod`/`staging`/`eu-prod` |
| `label` | human name for the dashboard |
| `connectionType` | `in_cluster` or `kubeconfig` |
| `contextName` | nullable; the context to select within a supplied kubeconfig |
| `credentialEncrypted` | nullable; kubeconfig or token, encrypted |
| `mode` | `act` or `shadow`, default `act` |
| `isDefault` | boolean; exactly one row true, enforced by partial unique index |
| standard timestamps | match neighbouring tables |

Plus the linkage that makes ticket-first resolution possible — a service×environment association. Look at how `serviceId` is modelled before choosing between a join table and a column; match what is there.

Generate the migration with drizzle-kit. Do not hardcode a number; `meta/_journal.json` has uncommitted changes in the working tree, so check its state first.

### 2. Encryption helper

Add the encrypt counterpart in `api/src/auth/providers.ts` (or a shared crypto module if that reads better — decide once, note it in the Progress Log). Round-trip test it.

### 3. Client factory

Replace the singleton in `api/src/k8s/client.ts` with a cache keyed by environment id. Requirements:

- Lazy construction, bounded size, eviction on environment update or delete.
- A clear failure when an environment names credentials that no longer decrypt.
- The `KUBECONFIG` and `AXIOMA_K8S_CONTEXT` environment variables keep working as the bootstrap for a single default environment, so an existing deployment does not break.

### 4. Resolution function

One function, one place, testable in isolation. Signature roughly: given a ticket, return an environment id and how it was resolved. Order: ticket linkage → CMDB object for the affected CI → default row. Return the provenance too — the dashboard should be able to say *why* a run targeted production.

### 5. Tool signatures, both sides

`api/src/server/tools/cluster.ts` — add `environment` to `readPodsInput`, `readDeploymentInput`, and by extension `patchImageInput`. Thread it into `getKubernetesClients(environmentId)`. `pollRollout` takes it too.

`agent/axel/tools.py` — add the matching field to `ClusterReadPods`, `ClusterReadDeployment`, `ClusterPatchImage`.

Decide and record: is `environment` optional on the tool input, defaulting server-side to the resolved value, or required? Optional-with-server-default is the smaller change and the safer default, since a model that omits it cannot accidentally reach the wrong cluster. Whichever you choose, both sides must agree.

`_same_resource` in `agent/axel/loop.py` computes the verification obligation by intersecting write and read payload keys, with an exclusion list. Check whether `environment` needs to be in the shared set — it should be, since a read against a different environment must not discharge a write's verification obligation. This is easy to get wrong and the test in step 8 must cover it.

### 6. Proto and prompt

`api/proto/axioma.proto` — add the resolved environment to `StartRun`. Mirror it into `agent/` and `cli/` with the existing publish command rather than editing the copies.

`api/src/server/grpc.ts` — populate it in `startRun`.

`agent/axel/prompt.py` — render it in `build_user_prompt`, in the classification block, alongside record type and priority. State it as fact, not as something the model chooses.

### 7. Contracts and dashboard

`api/src/contracts/` — procedures to list, create, update, and delete environments. Capability-gated like everything else; `os` and `authenticatedProcedure` are deliberately not exported, so name a capability. Add the capability key to the roles vocabulary rather than inventing a parallel one.

`pnpm contracts:publish` after changing contracts, so both frontends mirror.

Dashboard — an environments administration screen. Shared primitives live in `axioma/ui/src/components` and are mirrored into `dashboard/` by `ui/scripts/publish-ui.mjs`; build from those, do not hand-roll. The run detail view should show which environment a run targeted and how that was resolved.

### 8. Tests

| Test | Asserts |
|---|---|
| Resolution unit test | Ticket beats CMDB beats default; provenance is reported correctly; a ticket naming an environment not linked to its service is rejected |
| Client cache test | Two environments yield different clients; eviction on update; decrypt failure surfaces clearly |
| Crypto round-trip | Encrypt then decrypt returns the input; a tampered tag fails |
| Parity test extension | `api/src/server/tools/parity.test.ts` currently compares tool **names** and two hardcoded regexes. Extend it to compare parameter names per tool between `tools.py` and the zod schemas. Without this, a parameter added on one side only ships silently |
| Verification-obligation test | A `cluster_read_deployment` against environment B does not discharge a `cluster_patch_image` obligation from environment A |
| Shadow guard test | A write-effect tool against a `shadow` environment is refused, the refusal reaches the transcript, and no cluster call is made |
| Regression | `agent/tests/test_regressions.py` — the existing suite must stay green. It has uncommitted changes in the tree; read it before assuming its shape |

## Acceptance checklist

- [x] Two environments configured; the same ticket resolves to the correct one for each linkage.
- [x] A run against `staging` cannot read or write `prod`, verified by test.
- [x] Environment appears in the agent prompt and in the run record.
- [x] Dashboard lists environments, creates one with credentials, and shows resolution provenance on a run.
- [x] `mode: shadow` blocks writes at the API and records the attempt.
- [x] Parity test fails when a parameter is added to only one schema side — verified by deliberately breaking it, then fixing it.
- [x] Existing single-environment deployment still works with only `KUBECONFIG` set.
- [x] Full test suite green: `api` node tests, `agent` pytest, `cli` go test.

## Known traps

- **The parity test gives false confidence.** It compares names, not shapes. Extend it before relying on it.
- **`_same_resource` exclusion list.** Adding a field to tool inputs changes which keys are shared between a write and its verifying read. Read `agent/axel/loop.py` before touching tool schemas.
- **`meta/_journal.json` is dirty.** The working tree has uncommitted migration metadata. Resolve that before generating a new migration or the journal will conflict.
- **Contracts are mirrored, not imported.** Editing `portal/src/sdk/contracts` or `dashboard/src/sdk/contracts` by hand is wrong; they are generated. Same for `axioma/ui` mirrors.
- **`getKubernetesClients` is called from more than one place.** Grep before changing its signature.

## Progress Log

Append-only. Date, what was done, what remains, any blocker. A later session reads this first.

---

- **2026-08-30 — implemented.** Added environment/service/ticket/CMDB schema and generated migration, shared AES-256-GCM encryption, keyed bounded Kubernetes client cache with bootstrap and explicit credential modes, authoritative ticket → CMDB → default resolution with provenance, environment-aware cluster tools and shadow write guard, StartRun/prompt/run-record propagation, capability-gated CRUD, dashboard administration and run provenance UI, cross-language parameter parity, and focused regression coverage. Validation: API 270/270 tests, API typecheck/build, agent 65/65 tests + ruff, dashboard build/typecheck/25 validation tests, CLI tests/vet/build, and generated contract/proto freshness passed. `db:check` clean-replay validation is currently affected by concurrently added migrations and the local database's extra historical ledger rows; the Phase 1 migration itself applied and its focused DB tests pass.
