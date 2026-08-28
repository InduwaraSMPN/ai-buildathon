# Axiōma Implementation

**Document role:** Repo layout, build order, and how to run it
**Related:** [idea.md](idea.md) for product intent, [architecture.md](architecture.md) for system design

## Repo Layout

The scaffold is generated. Package scope is `@axioma/*`, workspaces are `apps/*` and `packages/*`, and dependency versions are pinned in the pnpm catalog in `pnpm-workspace.yaml` rather than per package.

```
axioma/
  apps/
    web/                 employee portal            (generated)
    server/              API service + device gateway (generated)
    dashboard/           IT-facing app
    cli/                 device agent
  packages/
    api/                 oRPC routers and contracts (generated)
    auth/                Better Auth                (generated)
    db/                  Drizzle schema, migrations, docker compose (generated)
    env/                 environment loading        (generated)
    config/              shared tsconfig            (generated)
    ui/                  shared components          (generated)
    shared/              domain vocabulary and the device wire protocol
    agent/               Axel: the run loop and tool registry
    connectors/          Kubernetes, and later systems
```

Nothing generated is renamed. `apps/web` is the portal and `apps/server` is the API; both keep their directory names so the generated scripts, Turborepo filters, and workspace references keep working. `apps/dashboard` is a copy of `web` on port 3002.

**On the backend components from the product spec.** Only two are processes. `api` is `apps/server`. `infra` is not a process at all — the scaffold delivers it as `packages/db`, `packages/env`, and `packages/config`, and a service wrapping those would be a hop with no work in it.

`agent` and `connectors` are packages rather than services, which is a deviation worth stating. Three reasons. The agent has to dispatch device commands through the socket `apps/server` holds, so a separate process would have to call back into the API immediately — the hop buys nothing and costs a routing table. Running five dev processes instead of three is friction against the MVP's actual goal, which is end-to-end connectivity. And the package boundary is real: `@axioma/agent` imports no database and no HTTP, so extracting it to a process later is a deployment change, not a rewrite.

**Where the device gateway lives:** in `apps/server` alongside the oRPC surface. The socket is stateful and long-lived, and whatever dispatches to a device must be whatever holds that device's socket.

## Build Order

Each milestone ends with something demonstrable. The order is set by dependency, and the goal is to reach a full loop early and then widen it, rather than to build every component to completion in isolation.

| # | Build | Done when |
|---|---|---|
| M0 | Postgres up, schema for the six tables, Better Auth wired | `pnpm db:start && pnpm db:push` succeeds; you can register and log in |
| M1 | Ticket CRUD through oRPC; portal can open a ticket and list tickets | A ticket created in the portal appears after a reload |
| M2 | Dashboard app: queue view reading the same procedures | The ticket from M1 shows in the dashboard |
| M3 | Agent service skeleton: run and step records, a model call, no tools | Opening a ticket produces a run with a routing decision, visible in the dashboard |
| M4 | Tool registry, bounded loop, transcript persisted per step | A run shows an ordered transcript; hitting the call limit escalates instead of hanging |
| M5 | Kubernetes connector: read tools against a local cluster | Axel reads real pod status from a seeded failure |
| M6 | Kubernetes write: JSON Patch with dry-run first, rollout polling | **Scenario 1 closes on its own** |
| M7 | Escalation path and dashboard takeover | **Scenario 3 escalates** with the scheduler message and proposed patch |
| M8 | CLI: connects, registers, survives sleep and reconnect | Device shows online in the dashboard; still online after the laptop sleeps and wakes |
| M9 | Device read and action dispatch, replay on reconnect | **Scenario 2 closes on its own** |
| M10 | CMDB writes with provenance on every observation | Both closed tickets left CMDB rows naming the run and step that produced them |

M6 is the first milestone that proves the thesis. Everything before it is plumbing; everything after widens the surface.

## Scenarios

Three, seeded deliberately. Each needs a repeatable setup so a run can be demonstrated more than once.

### 1. Failing pod deployment — resolves

**Seed.** Deploy a service with a deliberately wrong image tag, for example `nginx:1.99.99-nope`. Pods go `Pending`, container status reports `ImagePullBackOff`.

**Ticket.** "The checkout service isn't coming up after the last deploy."

**Expected run.** Read deployment, read pods, find `state.waiting.reason = ImagePullBackOff` with the `.message` naming the manifest as unknown. Read the intended tag. Patch `/spec/template/spec/containers/0/image` with dry-run, then for real. Poll rollout until ready. Close.

**Why this one is flagship.** The signal is a single unambiguous string on the container status — no log parsing, no distinguishing between overlapping causes — and the fix is one field, natively reversible through the deployment's own revision history. The visual is a clean `0/1 Pending → 1/1 Running` in about ten seconds.

### 2. Laptop issue — resolves through the CLI

**Seed.** Put the device into a bad state the CLI can read and fix. The state must be observable through a read tool and restorable through an action tool.

**Ticket.** "I can't reach the internal site, everything else works fine."

**Expected run.** Read device state through the CLI, identify the fault, dispatch the fix, re-read to confirm, close.

**Why it matters.** It is the only scenario that exercises the full device round trip: dispatch over a live socket, execution on a real machine, result returned, verification by a second read.

### 3. Unschedulable pod — escalates

**Seed.** Deploy with `requests.cpu` set beyond node capacity, for example `"64"`. Pods sit `Pending`.

**Ticket.** "New service is stuck, nothing is starting."

**Expected run.** Read pods, find `conditions[PodScheduled].reason = Unschedulable` with the scheduler's message. Diagnose confidently. **Do not act.** Escalate with the verbatim message and the patch it would have proposed.

**Why it is in the set.** Every available fix here is a policy decision — shrinking a CPU request changes the workload's performance contract, and adding capacity is not in the API. An agent that acts on everything is fast, not trustworthy. This scenario is what gives the other two their meaning, and it should be demonstrated, not just tested.

## Local Environment

**Prerequisites present on the dev machine:** Node 24.13.0, pnpm 11.24.0, Docker 29.7.2 with Compose v5.4.0.

**Kubernetes:** kind, running inside WSL2 with Docker Desktop's WSL2 backend. kind over k3d because k3d runs k3s, which differs from upstream in ways that matter when scenarios assert on exact status strings; the few seconds of extra startup are not worth debugging a divergence.

One consequence worth planning for: reaching a kind cluster in WSL2 from a Node process on the Windows side needs port mapping. Either run the connectors service inside WSL2 too, or accept the mapping. The repository currently lives on `D:\`, and `node_modules` on `/mnt/d/` from inside WSL2 has poor file I/O — so if development moves into WSL2, move the repo to the Linux filesystem rather than reaching across.

**Commands.**

```bash
pnpm install
pnpm db:start          # Postgres via Docker Compose
pnpm db:push           # schema to database
pnpm dev               # everything, via Turborepo
pnpm dev:web           # portal alone
pnpm dev:server        # API alone
pnpm check             # Biome format and lint
pnpm check-types       # tsc across the workspace
```

**CLI on a test machine.** Install as a logon Scheduled Task running as the interactive user:

```powershell
schtasks /Create /TN "AxiomaAgent" /SC ONLOGON /RL LIMITED /F /TR "node %LOCALAPPDATA%\axioma\agent.js"
```

No administrator rights required, and it runs in the user's session where the user's problems actually are.

## Conventions

- **Types cross boundaries through `packages/api`.** A procedure's input and output schemas are defined once and imported by the API, both frontends, and the CLI. Nothing generates or syncs a client.
- **Versions are pinned in the catalog.** Add a dependency to the catalog in `pnpm-workspace.yaml` and reference it as `catalog:` in the package. Two packages on different versions of the same library is a bug, not a preference.
- **Agent steps are written as they happen.** A run that hangs must still show how far it got.
- **Every tool declares its schema.** Parameters are validated before execution. The agent selects tools; it never composes commands.
- **Every write is followed by a read.** A successful API call means the call was accepted, not that the problem is fixed.

## Definition Of Done

The MVP is done when, from a clean checkout and a running cluster:

1. An employee registers, logs in, and opens a ticket in the portal.
2. Scenario 1 resolves autonomously and the ticket closes without a human acting.
3. Scenario 2 resolves autonomously through the CLI on a real machine.
4. Scenario 3 escalates with its transcript, evidence, and proposed patch intact.
5. Every run's transcript is readable in the dashboard, step by step.
6. Closed tickets have left CMDB observations naming the run and step that produced them.
7. `pnpm check` and `pnpm check-types` pass across the workspace.

Not in scope for done: authorization, idempotency, durable dispatch, signed CLI distribution, or any second organization. Those are named in [architecture.md](architecture.md) as deliberate gaps.
