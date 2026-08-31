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
| `dashboard/` | TypeScript | IT-facing web app. Queue, agent transcript, evidence, takeover, administration. |
| `ui/` | TypeScript | Governed UI primitives, mirrored verbatim into `portal/` and `dashboard/`. Not an app; nothing serves it. |
| `agent/` | Python | Axel himself — the reasoning loop, tool registry, and model client. |
| `cli/` | Go | Axel's reach onto an employee laptop. Executes typed actions; holds no reasoning. |
| `web/` | TypeScript | Public marketing site. Part of the workspace and the Tiltfile, not of the platform loop. |
| `deploy/` | Helm, YAML | The Helm chart and example values that install the platform into a cluster. Not a project; nothing runs here. |

Product and design documentation lives in `../context/idea/`. The demo script
lives in `../context/plans/`.

## Contracts across the boundaries

Three mirrors, each generated, none edited in place. The pattern is the same in
all three: there is no registry to publish to, the consumers are checked out
beside the source, and a copied file that is regenerated is easier to reason
about than a version range that silently drifts.

**oRPC**, for the TypeScript half. `api/src/contracts` declares procedures with
zod schemas and imports nothing else, which is what lets it be mirrored verbatim
into both frontends by `pnpm contracts:publish` from `api/`. Handlers live in
`api/src/server` and are checked against the contract, so the two cannot drift.
Run `pnpm contracts:check` to perform the same freshness check CI uses without
modifying files.

**Protocol buffers**, for the language boundaries. `api/proto/axioma.proto` is
the source of truth and is mirrored into `agent/` and `cli/` by the same
command. It defines two services with the same shape: the remote side dials in
and holds one bidirectional stream, because neither a worker nor a laptop behind
NAT can be dialled directly.

**UI primitives**, for the two frontends. `ui/src/` is the source of truth and
is mirrored by `node scripts/publish-ui.mjs` from `ui/`, listing each file in
`manifest.json` for every app that consumes it. `--check` is the CI freshness
check. Intentional divergences from the upstream shadcn primitives are noted as
inline comments in `ui/src/components/ui/`, because a future re-vendor would
otherwise revert them silently.

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
cd agent      && uv sync --all-extras && bash scripts/generate-proto.sh && uv run python -m axel.server
cd cli        && go build -o bin/axel-cli ./cmd/axel-cli
```

`ui/` has no dev server. Edit `ui/src/`, list the file in `manifest.json`, then
run `pnpm mirror` from `ui/` to mirror it into both apps.

On Windows, use `pwsh scripts/generate-proto.ps1` instead of the Bash generation command before starting the agent.

> [!NOTE]
> `web/package.json` declares port 3000, which collides with the API — the `Tiltfile` overrides it to 3003, so pass the port explicitly when starting it by hand. `CORS_ORIGIN` admits only `http://localhost:3001` and `http://localhost:3002`; serving a frontend anywhere else makes auth cookies fail silently.

## Demo scenarios

From `api/`, with a cluster reachable and `kubectl` on PATH:

```bash
pnpm seed
```

That applies the `demo` namespace and two deployments: `checkout`, pinned to an
image tag that does not exist, and `reporting`, requesting more CPU than any
node has. The first is the fix path, the second is the correct-refusal path.
`pnpm seed:reset` deletes the namespace first.

The device path needs a fault on the machine running axel-cli:

```bash
pnpm seed:device
```

That writes a stale per-user `ProxyOverride`, which the `clear_proxy_override`
action repairs and the `proxy` facet verifies.

## Deploying it

`tilt up` is the development path and is not a deployment description. To install
the platform into a cluster, build the four images and use the Helm chart:

```bash
docker build -t axioma/api:dev ./api
```

`deploy/README.md` carries the full path — prerequisites, the minimum values,
the two cluster-access modes, and the three things about this deployment that
are properties of the software rather than of how it is configured. Read it
before exposing anything.

## Gates

These are what CI runs, per project, in this order.

| Project | Commands |
| --- | --- |
| `api` | `pnpm check` · `pnpm check-types` · `pnpm db:migrate` · `pnpm test` · `pnpm build` |
| `portal`, `dashboard` | `pnpm check` · `pnpm validate` · `pnpm build` · `pnpm check-types` |
| `ui` | `node scripts/publish-ui.mjs --check` |
| `web` | `pnpm check` · `pnpm check-types` · `pnpm build` |
| `agent` | `uv run ruff check axel tests` · `uv run pytest` |
| `cli` | `gofmt -l ./internal ./cmd` · `go vet ./...` · `go test ./...` · `go build ./...` |
| contracts | `pnpm --dir api contracts:check` |

`build` precedes `check-types` in the frontends because Vite generates
`routeTree.gen.ts` before TypeScript consumes it.

`cli` regenerates protobuf bindings first and then asserts `git diff
--exit-code -- internal/pb`, so a proto change that was not published fails the
build rather than drifting.

`pnpm db:check` in `api/` validates the migration ledger against a clean replay.

### Opt-in local E2E evidence

With the local stack running and demo data seeded, run from `api/`:

```bash
pnpm e2e:local -- --run
```

The read-only verifier records every test-plan scenario as `ran`, `skipped`, or
`failed` and always writes timestamped JSON and Markdown under `../../temp/results/`.
Skips exit 2 by default; use `--allow-skips` when known external prerequisites are
unavailable. Add `--json` for machine output or `--report=PATH` for an extra Markdown
copy. Run `pnpm e2e:local -- --self-test` without a stack to test its pure logic.

## Local environment

Known-good toolchain: Node 24.13.0, pnpm 11.24.0, Python 3.14.2, uv 0.9.28, Go 1.25.6, Docker 29.7.2 with
Compose v5.4.0.

**Kubernetes** is kind inside WSL2 on Docker Desktop's WSL2 backend — kind rather than k3d because k3s
differs from upstream in ways that matter when scenarios assert on exact status strings. Reaching a kind
cluster in WSL2 from a Windows-side Node process needs port mapping: either run the API inside WSL2 or
accept the mapping. The checkout is on `D:\`, and `node_modules` on `/mnt/d/` from inside WSL2 has poor
file I/O, so if development moves into WSL2, move the checkout to the Linux filesystem rather than
reaching across.

**Postgres** is `pgvector/pgvector:pg18`, in Compose locally and as a CI service. `search_documents`
carries a `vector(1536)` embedding column behind an HNSW index, and knowledge retrieval fuses lexical and
vector ranks. Embeddings are only written when `AXIOMA_LLM_KEY` is set; without it retrieval degrades to
lexical and reports `mode: "lexical"`.

**Protobuf codegen** is wired on both sides. After syncing the agent dependencies, `grpcio-tools`
provides protoc for `agent/scripts/generate-proto.sh` and `agent/scripts/generate-proto.ps1`. CLI
generation requires Go and either system `protoc` or `uv` for the pinned `grpcio-tools` fallback;
`cli/scripts/generate-proto.ps1` installs pinned `protoc-gen-go` and `protoc-gen-go-grpc` binaries
automatically. Generated bindings live in `agent/axel/pb/` and `cli/internal/pb/`; rerun the scripts
after any proto publish.

> [!WARNING]
> On Windows, `pytest` and Lighthouse can both fail cleaning their temporary directories (`EPERM`). Pass `--basetemp` to pytest and an explicit output directory to Lighthouse if that happens; it is environmental, not a regression.

## Installing axel-cli on a test machine

A logon Scheduled Task as the interactive user, no administrator rights:

```powershell
schtasks /Create /TN "AxelAgent" /SC ONLOGON /RL LIMITED /F /TR "%LOCALAPPDATA%\axioma\axel-cli.exe daemon"
```

`cli/scripts/install.ps1` and `uninstall.ps1` do this and the file placement
around it. Run `axel-cli enroll` with a short-lived token issued from the dashboard;
the daemon then connects over TLS with its per-device credential. The binary remains
unsigned pending Authenticode certificate procurement, so managed-device policy or
Windows SmartScreen may still block it.
