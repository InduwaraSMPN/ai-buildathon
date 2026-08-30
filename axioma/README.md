# Axiōma — workspace

**Axiōma** is the platform. **Axel** is its agent — the component that reasons
about a ticket and decides what to do.

This repository is a workspace shell, not a monorepo. It holds orchestration,
shared documentation, and nothing else. Each component is an independent project
with its own toolchain, chosen for what that component actually does.

| Directory | Language | What it is |
| --- | --- | --- |
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
The mirrored copies are marked generated and are never edited in place. Run
`pnpm contracts:publish` in `api/` to regenerate them, or `pnpm contracts:check`
to perform the same freshness check CI uses without modifying files.

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

Each project also stands alone. The per-project path:

```bash
cd api        && pnpm install && pnpm db:start && pnpm db:migrate && pnpm dev   # :3000
cd portal     && pnpm install && pnpm dev                                       # :3001
cd dashboard  && pnpm install && pnpm dev                                       # :3002
cd web        && pnpm install && pnpm exec vite dev --port 3003                 # :3003
cd agent      && uv sync --all-extras && uv run python -m axel.server
cd cli        && go build -o bin/axel-cli ./cmd/axel-cli
```

> [!NOTE]
> `web/package.json` declares port 3000, which collides with the API — the `Tiltfile` overrides it to 3003, so pass the port explicitly when starting it by hand. `CORS_ORIGIN` admits only `http://localhost:3001` and `http://localhost:3002`; serving a frontend anywhere else makes auth cookies fail silently.

## Gates

| Project | Lint | Types | Tests |
| --- | --- | --- | --- |
| `api` | `npx biome check .` | `npx tsc --noEmit` | `npm test` |
| `portal`, `dashboard` | `npx biome check .` | `npx tsc --noEmit` | — |
| `agent` | `uv run ruff check .` | — | `uv run pytest -q` |
| `cli` | `go vet ./...` | `go build ./...` | `go test ./...` |

`pnpm db:check` in `api/` validates the migration ledger against a clean replay.

> [!WARNING]
> On Windows, `pytest` and Lighthouse can both fail cleaning their temporary directories (`EPERM`). Pass `--basetemp` to pytest and an explicit output directory to Lighthouse if that happens; it is environmental, not a regression.

## Local environment

Known-good toolchain: Node 24.13.0, pnpm 11.24.0, Python 3.14.2, uv 0.9.28, Go 1.25.6, Docker 29.7.2 with
Compose v5.4.0.

**Kubernetes** is kind inside WSL2 on Docker Desktop's WSL2 backend — kind rather than k3d because k3s
differs from upstream in ways that matter when scenarios assert on exact status strings. Reaching a kind
cluster in WSL2 from a Windows-side Node process needs port mapping: either run the API inside WSL2 or
accept the mapping. The checkout is on `D:\`, and `node_modules` on `/mnt/d/` from inside WSL2 has poor
file I/O, so if development moves into WSL2, move the checkout to the Linux filesystem rather than
reaching across.

**Protobuf codegen** is wired on both sides. Python needs nothing installed — `grpcio-tools` bundles
protoc and `agent/scripts/generate-proto.sh` uses it. Go regenerates with `cli/scripts/generate-proto.ps1`,
which needs `protoc-gen-go` and `protoc-gen-go-grpc` installed once. Generated bindings live in
`agent/axel/pb/` and `cli/internal/pb/`; rerun the scripts after any proto publish.

## Installing axel-cli on a test machine

A logon Scheduled Task as the interactive user, no administrator rights:

```powershell
schtasks /Create /TN "AxelAgent" /SC ONLOGON /RL LIMITED /F /TR "%LOCALAPPDATA%\axioma\axel-cli.exe daemon"
```
