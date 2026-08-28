# Axiōma Implementation

**Document role:** Layout, build order, and how to run it
**Related:** [idea.md](idea.md) for product intent, [architecture.md](architecture.md) for system design

## Layout

Five independent projects under `axioma/`, each intended to become its own git repository checked out side by side — the pattern `marketrix.ai` uses, where a workspace repo tracks orchestration and gitlinks while each service lives under its own remote.

```
axioma/
  api/          TypeScript   oRPC surface, gRPC gateways, every write
    src/
      contracts/    the contract, mirrored to both frontends
      server/       handlers, context, procedure builders
      db/           Drizzle schema and migrations
      auth/         Better Auth
      shared/       domain vocabulary
    proto/          source of truth for both gRPC boundaries
    scripts/publish-contracts.mjs
  portal/       TypeScript   :3001  employee
  dashboard/    TypeScript   :3002  IT staff
  agent/        Python       package `axel`
  cli/          Go           binary `axel-cli`
```

Nothing is shared by a package manager. Each project installs, lints, and typechecks on its own, and a change to one cannot break another's build except through a contract that was deliberately published.

Folder names describe the role; artifacts keep the product name. `agent/` holds the package `axel`; `cli/` builds `axel-cli` from `cmd/axel-cli/`.

## Contracts

Edit contracts in `api`. Never edit the copies.

```bash
cd api && pnpm contracts:publish
```

That mirrors `src/contracts` into both frontends' `src/sdk/contracts` and `proto/axioma.proto` into `agent/proto` and `cli/proto`. Copies are stamped `GENERATED — do not edit`. If the proto changed, both consumers must regenerate their bindings.

The contract imports only `@orpc/contract` and `zod`. That is a hard constraint, not a style preference: the frontends have no database, no auth module, and no Hono context, so anything else in that file breaks their build.

## Build Order

Each milestone ends with something demonstrable. The order is set by dependency, and the goal is to reach a full loop early and widen it, rather than finish each component in isolation.

| # | Build | Done when |
|---|---|---|
| M0 | Postgres up, six tables, Better Auth wired | `pnpm db:start && pnpm db:push` succeeds; register and log in works |
| M1 | Ticket procedures in the contract; portal opens and lists tickets | A ticket created in the portal survives a reload |
| M2 | Dashboard queue reading the same procedures | The M1 ticket appears in the dashboard |
| M3 | `AgentChannel` gRPC server in api; Axel dials in and holds the stream | The dashboard shows the agent connected, with its model label |
| M4 | `StartRun` dispatch, run and step records, transcript persisted per step | Opening a ticket produces a run whose transcript is readable step by step |
| M5 | `ToolRequest` round trip; Kubernetes read tools executed by the api | Axel reads real pod status from a seeded failure |
| M6 | Kubernetes write: JSON Patch with dry-run first, rollout polling | **Scenario 1 closes on its own** |
| M7 | Escalation path and dashboard takeover | **Scenario 3 escalates** with the scheduler message and proposed patch |
| M8 | `DeviceChannel` server; axel-cli connects, survives sleep, replays on reconnect | Device shows online; still online after the laptop sleeps and wakes |
| M9 | Device read and typed action dispatch | **Scenario 2 closes on its own** |
| M10 | CMDB writes with provenance on every observation | Both closed tickets left rows naming the run and step that produced them |

M6 is the first milestone that proves the thesis. Everything before it is plumbing; everything after widens the surface.

M3 is the first that proves the architecture — two processes in two languages agreeing on a contract neither of them owns.

## Scenarios

Three, seeded deliberately, each repeatable so a run can be demonstrated more than once.

### 1. Failing pod deployment — resolves

**Seed.** Deploy a service with a wrong image tag, e.g. `nginx:1.99.99-nope`. Pods go `Pending` with `ImagePullBackOff`.

**Ticket.** "The checkout service isn't coming up after the last deploy."

**Run.** Read deployment, read pods, find `state.waiting.reason = ImagePullBackOff` with `.message` naming the manifest as unknown. Patch the image path with dry-run then for real. Poll rollout until ready. Close.

**Why flagship.** One unambiguous string on the container status — no log parsing, no distinguishing overlapping causes — and a one-field fix that the deployment's own revision history makes reversible. The visual is a clean `0/1 Pending → 1/1 Running` in about ten seconds.

### 2. Laptop issue — resolves through axel-cli

**Seed.** Put the device into a bad state that a read facet exposes and a typed action restores.

**Ticket.** "I can't reach the internal site, everything else works fine."

**Run.** Read device state, identify the fault, dispatch the typed action, re-read to confirm, close.

**Why it matters.** The only scenario exercising the full device round trip: dispatch over a live stream, execution on a real machine, result returned, verification by a second read.

### 3. Unschedulable pod — escalates

**Seed.** Deploy with `requests.cpu` beyond node capacity, e.g. `"64"`. Pods sit `Pending`.

**Ticket.** "New service is stuck, nothing is starting."

**Run.** Read pods, find `conditions[PodScheduled].reason = Unschedulable` with the scheduler's message. Diagnose confidently. **Do not act.** Escalate with the verbatim message and the patch that was considered.

**Why it is in the set.** Every available fix is a policy decision — shrinking a CPU request changes the workload's performance contract, and adding capacity is not in the API. An agent that acts on everything is fast, not trustworthy. Demonstrate this one, do not merely test it.

## Local Environment

Present on the dev machine: Node 24.13.0, pnpm 11.24.0, Python 3.14.2, uv 0.9.28, Go 1.25.6, Docker 29.7.2 with Compose v5.4.0.

**Kubernetes:** kind inside WSL2 with Docker Desktop's WSL2 backend. kind over k3d because k3d runs k3s, which differs from upstream in ways that matter when scenarios assert on exact status strings.

One consequence to plan for: reaching a kind cluster in WSL2 from a Windows-side Node process needs port mapping. Either run the API inside WSL2 or accept the mapping. The repository is on `D:\`, and `node_modules` on `/mnt/d/` from inside WSL2 has poor file I/O — so if development moves into WSL2, move the checkout to the Linux filesystem rather than reaching across.

**Protobuf codegen** is not wired yet. Python needs nothing installed — `grpcio-tools` bundles protoc, and `agent/scripts/generate-proto.sh` uses it. Go needs one `go install` of `protoc-gen-go` and `protoc-gen-go-grpc`. Both `pb` directories are gitignored placeholders until then.

## Commands

Each project stands alone.

```bash
cd api        && pnpm install && pnpm db:start && pnpm db:push && pnpm dev
cd portal     && pnpm install && pnpm dev      # :3001
cd dashboard  && pnpm install && pnpm dev      # :3002
cd agent      && uv sync --all-extras && uv run python -m axel.server
cd cli        && go build -o bin/axel-cli ./cmd/axel-cli
```

Per-project gates:

| Project | Lint | Types |
|---|---|---|
| `api`, `portal`, `dashboard` | `pnpm check` | `pnpm check-types` |
| `agent` | `uv run ruff check .` | — |
| `cli` | `go vet ./...` | `go build` |

**Installing axel-cli on a test machine** — a logon Scheduled Task as the interactive user, no administrator rights:

```powershell
schtasks /Create /TN "AxelAgent" /SC ONLOGON /RL LIMITED /F /TR "%LOCALAPPDATA%\axioma\axel-cli.exe daemon"
```

## Conventions

- **Contracts change in `api` and are published.** A copy edited in place is lost on the next publish.
- **Agent steps are written as they happen.** A run that hangs must still show how far it got.
- **Every tool declares its schema.** Parameters are validated before execution. Axel selects tools; it never composes commands.
- **Every write is followed by a read.** A successful call means the call was accepted, not that the problem is fixed.
- **Side effects belong to the API.** If the agent needs something done, it asks. It holds no credentials of its own.
- **Frontend `check-types` runs a build first.** The router plugin regenerates the route tree, which `tsc` then reads. Dropping the build makes a renamed route fail to typecheck.

## Definition Of Done

The MVP is done when, from a clean checkout and a running cluster:

1. An employee registers, logs in, and opens a ticket in the portal.
2. Scenario 1 resolves autonomously and the ticket closes without a human acting.
3. Scenario 2 resolves autonomously through axel-cli on a real machine.
4. Scenario 3 escalates with its transcript, evidence, and proposed patch intact.
5. Every run's transcript is readable in the dashboard, step by step.
6. Closed tickets left CMDB observations naming the run and step that produced them.
7. All five projects pass their own lint and type gates.

Not in scope for done: authorization, idempotency, durable dispatch, signed distribution, or a second organization. Those are named in [architecture.md](architecture.md) as deliberate gaps.
