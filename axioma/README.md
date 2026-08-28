# Axiōma — workspace

**Axiōma** is the platform. **Axel** is its agent — the component that reasons
about a ticket and decides what to do.

This repository is a workspace shell, not a monorepo. It holds orchestration,
shared documentation, and nothing else. Each component is an independent project
with its own toolchain, chosen for what that component actually does.

| Directory | Language | What it is |
|---|---|---|
| `api/` | TypeScript | oRPC surface for the frontends, gRPC gateways for the agent and devices. The only component that writes. |
| `portal/` | TypeScript | Employee-facing web app. Open a ticket, follow it, see the outcome. |
| `dashboard/` | TypeScript | IT-facing web app. Queue, agent transcript, evidence, takeover. |
| `agent/` | Python | Axel himself — the reasoning loop, tool registry, and model client. |
| `cli/` | Go | Axel's reach onto an employee laptop. Executes typed actions; holds no reasoning. |

Product and design documentation lives in `context/idea/`.

## Contracts across the boundaries

Two contracts, each where a boundary actually exists.

**oRPC**, for the TypeScript half. `api/src/contracts` declares procedures with
zod schemas and imports nothing else, which is what lets it be mirrored verbatim
into both frontends by `pnpm contracts:publish` from `api/`. Handlers live in
`api/src/server` and are checked against the contract, so the two cannot drift.
The mirrored copies are marked generated and are never edited in place.

**Protocol buffers**, for the language boundaries. `api/proto/axioma.proto` is
the source of truth and is mirrored into `agent/` and `cli/` by the same
command. It defines two services with the same shape: the remote side dials in
and holds one bidirectional stream, because neither a worker nor a laptop behind
NAT can be dialled directly.

## Running it

From this directory, start the whole workspace (including Postgres and setup) with:

```bash
tilt up
```

## Repository layout

Each component is intended to be its own git repository, checked out here side by
side — the pattern used by `marketrix.ai`, where the workspace repo tracks
orchestration and gitlinks while each service lives under its own remote.
