# Implementation Program

**Document role:** Program plan — what gets built, in what order, and how each phase is run.
**Related:** [idea.md](../idea/idea.md) for product intent · [architecture.md](../idea/architecture.md) for system design and invariants

## What this program delivers

Axiōma today is a working end-to-end loop against one hardcoded Kubernetes cluster and a laptop with five typed actions. The target is a product a company can deploy inside its own infrastructure, alongside its existing systems, that resolves tickets against:

1. **The company's own production estate** — the microservices behind their customer-facing product. An employee reports the product is down; Axel connects to that environment, applies a fix, verifies it, closes the ticket, and writes what it learned back to the CMDB.
2. **The employee's own machine** — axel-cli installed at onboarding, resident, dialling out. The central agent instructs the local agent, which resolves the fault on the device and reports back.

Both paths share one spine: assemble context automatically (ticket, reporter, CMDB beliefs, domain knowledge), diagnose from evidence, act, verify by re-reading, close or escalate, record.

Six phases get from here to there.

## How these documents are used

**Each numbered plan is executed in its own chat session.** They are written to be read cold, by an agent with no memory of this conversation.

Session protocol:

1. Open a fresh chat with the repository root as the working directory.
2. Say: `Execute context/plans/0N-<name>.md`.
3. The session reads that document, then the prerequisites it names, then the specific source files it lists — before writing anything.
4. Work proceeds to the acceptance checklist at the end of that document.
5. **On a blocker:** append to that document's Progress Log, state the blocker plainly, and stop. Do not work around it, do not expand scope into another phase to unblock yourself.
6. A later session resumes by reading the Progress Log first.

Every plan carries a **Progress Log** section at the end. It is append-only: date, what was done, what is left, any blocker. That log is the handoff between sessions, and it is the only thing that makes "come back to it later" work.

Do not run two phases in one session. The point of the split is that a blocker in one does not stall the others.

## Order and dependencies

| Phase | Document | Depends on | Blocked by nothing else — can start any time |
|---|---|---|---|
| 1 | [Multi-environment](01-multi-environment.md) | — | Yes |
| 2 | [Deployable artifact](02-deployable-artifact.md) | Phase 1 for config shape (soft) | Mostly — see note |
| 3 | [Device channel authentication](03-device-channel-auth.md) | — | Yes |
| 4 | [Knowledge and context](04-knowledge-and-context.md) | Phase 1 for environment in context (soft) | Mostly |
| 5 | [Device capability](05-device-capability.md) | Phase 3, hard | No |
| 6 | [ITSM connector](06-itsm-connector.md) | Phase 1, hard | No — research first, no production code in that session |

**Phase 1 first.** Every later phase either consumes its output or gets more expensive if it lands afterwards. Adding an environment dimension to tool signatures once is cheap; doing it after Phase 4 has broadened the knowledge corpus and Phase 5 has widened the device surface means touching all of it twice.

**Phases 1 and 3 can run genuinely in parallel** — they share no files. Phase 3 touches `cli/`, `api/src/server/grpc.ts`, and the proto; Phase 1 touches `api/src/k8s`, `api/src/server/tools`, `api/src/db`, and `agent/axel/tools.py`.

**Phase 5 must not start before Phase 3 completes.** Widening what a device can be told to do, over a channel where the device identity is client-asserted and the stream is plaintext, converts a prompt-injection into remote code execution across the fleet. This is not a preference; treat it as a gate.

## Cross-phase contracts

Decisions that more than one phase touches. Stated once here so two sessions do not disagree.

**Environment identity.** An environment is a first-class row with a stable string `key` (`prod`, `staging`, `eu-prod`). Everything that needs to name an environment names that key. No phase invents a second identifier for the same concept.

**Environment resolution is server-side and authoritative.** The API resolves which environment a run targets before the agent sees anything, in the order: ticket → CMDB → configured default. The agent may only name an environment already linked to that ticket's service. Rationale in Phase 1; every phase honours it.

**Tool schema parity.** Every tool exists twice — a pydantic model in `agent/axel/tools.py` and a zod schema in `api/src/server/tools/`. `api/src/server/tools/parity.test.ts` asserts the two agree. It currently checks tool *names* plus two hardcoded regexes; it does not catch a parameter added on one side only. Any phase that changes a tool signature extends that test in the same change.

**Credential storage.** Secrets at rest use the existing AES-256-GCM scheme from `api/src/auth/providers.ts`: format `v1:iv:ciphertext:tag`, base64url segments, key from `AXIOMA_PROVIDER_ENCRYPTION_KEY` (base64, 32 bytes). Note that only a *decrypt* helper exists today; Phase 1 adds the encrypt side. No phase introduces a second encryption scheme.

**Migrations.** Do not hardcode a migration number. Generate with drizzle-kit and let it read `api/src/db/migrations/meta/_journal.json`. That journal is currently uncommitted work in the tree; check its state before generating.

**The API owns every write and every credential.** Axel holds no database connection, no cluster credentials, and no path to a device. Every side effect is a request the API executes. No phase moves a credential or a write into the agent or the CLI.

**Behaviour never keys off a name.** Status is data — `ticket_statuses` carries `state_type`, `is_closed`, `pauses_sla`, and behaviour reads those flags. No phase adds a status whose *name* is load-bearing, and no phase adds a stored deadline column.

## Ground truth

Verified against the tree on 2026-08-30. Recorded here so each session does not re-derive it, but **verify before relying on any line** — the tree has uncommitted work in it.

| Fact | Location |
|---|---|
| Kubernetes client is a memoised module singleton, one kubeconfig + one context from env | `api/src/k8s/client.ts` |
| Cluster tools take `namespace` and `name`, no environment | `api/src/server/tools/cluster.ts` |
| The only cluster write is an image tag/digest replace on the same image name | `api/src/server/tools/change.ts`, `assertStandardImageChange` |
| Tool registry is 10 tools, not the 7 the architecture table lists | `agent/axel/tools.py`, `api/src/server/tools/index.ts` |
| Run auto-starts on portal ticket create, gated by `AXIOMA_AUTO_DISPATCH` and the rules engine | `api/src/server/routers/tickets.ts` |
| Knowledge search is Postgres lexical FTS over known errors and published articles; returns `mode: "lexical"` | `api/src/server/tools/knowledge.ts` |
| Database image is `pgvector/pgvector:pg18`; no vectors are used anywhere | `api/docker-compose.yml` |
| `reporter_id` crosses the wire in `StartRun` and is never read by the agent | `api/proto/axioma.proto`, `agent/axel/prompt.py` |
| CMDB seeds nine classes and zero objects; observations are insert-only, deduped at read time | migration `0012_tier3_extensible_platform.sql`, `api/src/server/tools/cmdb.ts` |
| Computer-use is an unconditional refusal in the daemon; `internal/cua` only probes a version for `doctor` | `cli/internal/device/daemon.go`, `cli/internal/cua/detect.go` |
| Five typed device actions; `restart_user_process` allowlists exactly one process, `notepad` | `cli/internal/device/actions.go` |
| Dockerfiles for `api`, `agent`, `portal`, `dashboard` and a Helm chart exist; no image is published and no pipeline builds them | `axioma/*/Dockerfile`, `axioma/deploy/` |
| The model already points at an owned OpenAI-compatible gateway via LiteLLM | `agent/axel/config.py` |
| Repeated tool calls within a run return their recorded result; device sequence replays report *indeterminate*; in-flight commands are lost on API restart | `db/schema/agent.ts`, `api/src/server/grpc.ts`, `cli/internal/device/daemon.go` |
| Around 128 tables across 44 schema modules — the platform is a full ITSM surface, not a ticket table plus an agent | `api/src/db/schema/` |
| Shared UI primitives live in `axioma/ui/src/components` and are mirrored into portal and dashboard by `ui/scripts/publish-ui.mjs` | `axioma/ui/package.json` |
| oRPC contracts are mirrored into both frontends by `pnpm contracts:publish` | `api/scripts/publish-contracts.mjs` |

## Working rules for every session

- PowerShell-compatible commands. Prefer `rg` for search.
- No Git or GitHub write actions without explicit approval. Inspection commands are fine.
- Read before writing. Verify claims against the tree; correct this document if something here is wrong.
- Use Context7 for library and API documentation rather than guessing.
- Keep the documentation tone of `context/idea/` — declarative, honest about gaps, no marketing register, tables only where a table genuinely helps.

## What this program does not cover

- **Additional infrastructure connectors** beyond Kubernetes — cloud consoles, virtual machines, databases, SaaS admin APIs. Deferred by decision. Phase 1 leaves the shape that makes them cheap; Phase 6 is the ITSM connector specifically, which is a different kind of integration.
- **Multi-tenancy.** The deployment model is one stack per customer, inside that customer's infrastructure. No `tenant_id` is needed and none should be added. The question only returns if the deployment model ever becomes vendor-hosted across prospects.
- **Blast-radius limits, approval-before-action, and idempotency.** Still out of scope, still deliberate, still the next things to want after this program. Phase 5 Stage C depends on the approval question being answered.
- **Migration tooling** from a customer's existing ITSM. Comes after Phase 6, not with it.
