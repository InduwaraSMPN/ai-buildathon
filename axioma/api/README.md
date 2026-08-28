# Axiōma API

TypeScript. The only component that writes to anything.

Three surfaces:

- **oRPC** at `/rpc` — the portal and dashboard call this, and the contract in
  `src/contracts` is the source of truth for their inferred types.
- **Better Auth** at `/api/auth/*`.
- **gRPC gateways** — `AgentChannel` for the Python agent and `DeviceChannel` for
  the Go device agent. Both dial in and hold a bidirectional stream; neither can
  be dialled directly.

The agent has no database credentials and no device access. It asks the API to
execute tools, and the API owns the side effect and the persistence.

## Setup

```bash
pnpm install
pnpm db:start
pnpm db:push
pnpm dev
```

## Contracts

`src/contracts` is mirrored into the frontends by `pnpm contracts:publish`. Edit
it here; never edit the copies. `proto/axioma.proto` is the source of truth for
the two gRPC boundaries and is mirrored into `agent/` and `cli/`.
