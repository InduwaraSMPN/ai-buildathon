# Phase 2 — Deployable Artifact

**Document role:** Implementation plan, executed in its own chat session.
**Read first:** [00-overview.md](00-overview.md) for the program and cross-phase contracts · [architecture.md](../idea/architecture.md) for the component map · this document's Progress Log at the end.
**Depends on:** Phase 1 for the configuration shape, softly. Can start before Phase 1 finishes; the environments table only affects what goes in a values file.

## Problem

The product's stated deployment model is that a company installs Axiōma inside its own infrastructure, running alongside its existing systems, holding live connections to the estate it manages and the laptops it manages.

**There is no deployment artifact in the repository.** No Dockerfile, no Helm chart, no platform Kubernetes manifest, no image build. `axioma/Tiltfile` runs `pnpm dev` development servers on ports 3000–3003 and `api/docker-compose.yml` contains exactly one service, Postgres. The `api/k8s/` directory holds demo workloads to break, not the platform.

Today this is a laptop-run development stack. Nothing about the described deployment model is buildable.

## Scope

**In.**

- Production container images for `api`, `agent`, `portal`, `dashboard`.
- A Helm chart that deploys all four plus a Postgres dependency.
- In-cluster ServiceAccount and RBAC as an alternative to a mounted kubeconfig.
- Configuration and secret handling, including a decision on model-gateway reachability.
- Database migration strategy on deploy.
- Health, readiness, and resource requests.
- A documented install path and a smoke test that proves it.

**Out.**

- CI/CD pipelines and image publishing. Building locally and loading into a cluster is enough for this phase.
- High availability, autoscaling, backup, and disaster recovery.
- The marketing site under `web/` — it is not part of the platform loop.
- axel-cli distribution and packaging. That is Phase 3 and Phase 5 territory.

## Design decisions to make and record

### Model gateway reachability

`agent/axel/config.py` points at an owned OpenAI-compatible gateway:

```python
model: str = "openai/gpt-5.6-terra"
api_base: str = "https://llm.marketrix.io/v1"
api_key: SecretStr | None = Field(default=None, validation_alias="AXIOMA_LLM_KEY")
```

That satisfies "our own infrastructure and wiring" and needs no code change. What it needs is a **decision**, recorded in the Progress Log and in the chart's values documentation:

| Option | Consequence |
|---|---|
| Customer's cluster reaches `llm.marketrix.io` outbound | Simplest. But ticket text and system state leave the customer's perimeter, which contradicts the pitch and will surface in any security review |
| Gateway co-deploys into the customer's cluster | Honest to the pitch. Adds an inference workload and its hardware requirements to the chart |
| Configurable, defaulting to outbound | Ships now, defers the conversation. Acceptable only if the chart documents the data-egress consequence plainly |

Pick one. This is the single most consequential decision in the phase because it determines whether "nothing leaves your network" is a claim the product can make. Note that `idea.md` carries a Claim Discipline section — whatever is chosen, the documentation must not overstate it.

### Cluster access

Two paths, both needed, mirroring Phase 1's connection modes:

- **In-cluster** — the API uses a mounted ServiceAccount token for the cluster it runs in. Needs a Role or ClusterRole granting exactly: `get`/`list` on pods, `get`/`patch` on deployments, in the namespaces it manages. Nothing wider. Write it namespace-scoped by default and document the ClusterRole variant as opt-in.
- **External** — credentials from the `environments` table, per Phase 1.

Note honestly in the chart's documentation that nothing constrains blast radius within the granted scope. `architecture.md` already records this; the chart should not imply otherwise.

### Database

Postgres is `pgvector/pgvector:pg18` in development, and Phase 4 will start using the vector extension. The chart must therefore either depend on a pgvector-capable image or document the extension requirement for a customer-supplied database. Support both: a bundled Postgres for evaluation, an external DSN for production.

Migrations run as a Helm hook or an init container, never automatically on API boot from multiple replicas.

## Build order

### 1. Dockerfiles

Four images. Multi-stage, non-root, minimal final layer.

| Image | Notes |
|---|---|
| `api` | Node. Needs the built output plus migrations. `pnpm` with a frozen lockfile |
| `agent` | Python 3.14, `uv`. It is a gRPC *client* — it needs no inbound port except the health endpoint on `health_port` (8090) |
| `portal` | Vite SPA build, served by a static server. Runtime configuration for the API URL must be injectable, not baked at build time |
| `dashboard` | Same as portal |

The SPA runtime-configuration point matters: both frontends are static builds, and a chart that bakes an API URL into the bundle cannot be reconfigured without a rebuild. Solve it once, the same way, for both.

### 2. Helm chart

`axioma/deploy/helm/axioma/` — or wherever fits the workspace convention; decide and record.

Contents: Deployments for the four components, Services, an optional Ingress, ConfigMaps for non-secret configuration, Secrets for `BETTER_AUTH_SECRET`, `AXIOMA_PROVIDER_ENCRYPTION_KEY`, `AXIOMA_LLM_KEY`, `DATABASE_URL`, the ServiceAccount and RBAC for cluster access, and the migration hook.

Every environment variable in `api/src/env.ts` needs a home in values. Read that file — it is the authoritative list, and it includes mail, directory sync, bootstrap admin, and auto-dispatch settings that are easy to miss.

### 3. gRPC exposure

Both agents dial *out* to the API. Inside one cluster that is a ClusterIP Service. But axel-cli runs on employee laptops **outside** the cluster, so the device gateway needs ingress that supports HTTP/2 — plain nginx ingress needs explicit configuration for gRPC, and some ingress controllers need a separate listener.

Document what the customer must expose and on which port. Note plainly that until Phase 3 lands, that endpoint is unauthenticated and plaintext, and therefore must not be exposed to the internet. This constraint should appear in the chart's documentation, not only here.

### 4. Health and resources

`api` already serves `/health` — the Tiltfile probes it. `agent` exposes health on `health_host`/`health_port`. Wire both into readiness and liveness probes. Set requests and limits; without requests, a cluster with real pressure will schedule these badly and Phase 1's environment work will be debugged against noise.

### 5. Install documentation

A short `axioma/deploy/README.md`: prerequisites, `helm install` with the minimum values, how to bootstrap the first admin (`AXIOMA_BOOTSTRAP_ADMIN_EMAIL`), how to register the first environment, how to verify.

## Testing

| Test | Method |
|---|---|
| Images build | All four build clean from a fresh clone with no network-dependent steps beyond package installs |
| Chart lints | `helm lint`, and `helm template` renders with the minimum values and with a full values file |
| Deploys to kind | Load images into a kind cluster, install, all pods reach Ready |
| Migrations run once | Scale API to two replicas; confirm migrations did not run twice and did not race |
| End-to-end smoke | Sign in to the dashboard, register an environment, create a ticket, confirm a run starts and reaches a terminal state |
| RBAC is sufficient and no wider | The ServiceAccount can read pods and patch deployments in its namespace; confirm it cannot delete a deployment or read secrets |
| Frontends reconfigure | Change the API URL in values, redeploy without rebuilding images, confirm the SPAs use the new URL |

## Acceptance checklist

- [x] `helm install` on a clean kind cluster brings up all four components.
- [x] A ticket created in the portal produces an agent run that reaches a terminal state.
- [x] Migrations run exactly once with more than one API replica.
- [x] Cluster access works both in-cluster and with an external kubeconfig.
- [x] Every variable in `api/src/env.ts` is reachable through values.
- [x] The model-gateway decision is recorded, and the documentation states the data-egress consequence accurately.
- [x] ~~Chart documentation states that the device gateway is unauthenticated until Phase 3 and must not be internet-exposed.~~ **The premise expired mid-phase.** Phase 3 landed while this one was running: the gateway now requires TLS and the device channel requires an enrolment token or a stored credential. The chart documents what the tree actually does, and says plainly that an older API image behaves the old way and must not leave a network you control.
- [x] Install documentation is complete enough that someone who has not read this plan can follow it. Two caveats it now carries: registering the first environment needs a manual capability grant, and the embeddings credential must be checked because it fails silently.

## Known traps

- **`api/k8s/` is demo workloads, not the platform.** Do not extend it; create a separate deploy directory.
- **The Tiltfile is a development tool.** It is not a deployment description and should not be translated into the chart. Read `api/src/env.ts` for configuration instead.
- **SPA configuration baked at build time** is the most common way this phase produces an unusable chart. Solve it deliberately.
- **gRPC ingress is not HTTP ingress.** Budget time for it.
- **`web/` is not part of the platform.** `architecture.md` says so explicitly. Do not package it.

## Progress Log

Append-only. Date, what was done, what remains, any blocker.

---

### 2026-08-30 — decisions, artifacts, and the SPA configuration change

**Decisions recorded.**

*Model gateway reachability — configurable, defaulting to outbound.* Option three
from the table above. `agent.model.apiBase` defaults to
`https://llm.marketrix.io/v1`, and pointing it at an OpenAI-compatible endpoint
the customer operates is the only change needed to keep inference inside their
perimeter. The chart deploys no inference server.

The reason it is not option one is that the pitch says otherwise; the reason it
is not option two is that co-deploying inference means choosing a model server
and owning its hardware requirements, which is a larger piece of work than this
phase and was not in scope. The acceptability condition the plan attaches to
option three — that the chart documents the egress consequence plainly — is met
in three places: a block comment above `agent.model` in `values.yaml`, the first
of three warnings at the top of `deploy/README.md`, and the post-install NOTES,
which name the endpoint and say that ticket contents leave the perimeter to
reach it whenever `apiBase` still points at the default host. No data-residency
claim is made anywhere.

*Chart location — `axioma/deploy/helm/axioma/`*, with `axioma/deploy/examples/`
alongside it and `axioma/deploy/README.md` as the install document. The four
Dockerfiles live with the projects they build (`api/Dockerfile` and so on),
because each project is standalone — its own lockfile and toolchain — and a
build context reaching outside its directory would contradict that. Each build
context is exactly one project directory.

*Migrations — a plain Job, one per release revision, not a Helm hook.* A
`pre-install` hook runs before the release's own resources exist, so it
deadlocks against the bundled Postgres on a clean install; a `post-install` hook
runs after `--wait` has already given up on pods waiting for the schema. Instead
every API pod runs an init container that blocks until the row count in
`drizzle.__drizzle_migrations` reaches the number of journal entries baked into
its own image. The Job stays the only writer, so "exactly once" holds at any
replica count, and no replica serves traffic against a schema older than its
code.

*Database — both shapes supported.* `postgresql.enabled` deploys one
`pgvector/pgvector:pg18` StatefulSet for evaluation; `postgresql.enabled: false`
plus `secrets.databaseUrl` points at a customer database, whose pgvector
requirement is documented. The combination the chart cannot serve — bundled
Postgres with its password in an `existingSecret`, where the chart cannot read
the password and so cannot compose a DSN — fails the render with that
explanation rather than producing a broken release.

**Built.**

- `api/Dockerfile`, `agent/Dockerfile`, `portal/Dockerfile`,
  `dashboard/Dockerfile`, each multi-stage, non-root, with a `.dockerignore`.
  The agent image generates its protobuf bindings during the build, since
  `axel/pb` is gitignored. The API image carries `drizzle-kit`, the migration
  journal and `src/db/schema` deliberately, so one image both serves and
  migrates rather than needing a fifth.
- `axioma/deploy/helm/axioma/` — Deployments and Services for the four
  components, the bundled Postgres StatefulSet, the migration Job and its
  script ConfigMap, ServiceAccount and RBAC, an HTTP Ingress and a separate
  gRPC Ingress, and NOTES that restate the three warnings.
- `axioma/deploy/examples/values-minimal.yaml` and `values-full.yaml`.
- `axioma/deploy/README.md` — prerequisites, image build and load, minimum
  values, both cluster-access modes, the migration mechanism, how to
  reconfigure the frontends without a rebuild, and the device-gateway warning.

**Source change: runtime configuration for both SPAs.** This was the plan's
named trap and it could not be solved in the chart alone. `import.meta.env` is
inlined by Vite at build time, so `VITE_SERVER_URL` was baked into the bundle —
portal in two chunks, dashboard in one. Both apps now load `/config.js` before
their bundle; the container entrypoint writes that file from the environment at
start. New in each app: `src/lib/runtime-config.ts` and `public/config.js`, plus
`src/lib/api-url.ts` for the portal, which previously had no choke point and
carried two copies of a 35-line dead `getServerUrl` helper full of Vercel and
SSR branches that never fire in a browser SPA. Both are now routed through one
`apiUrl(path)`, matching what the dashboard already did. `VITE_SERVER_URL` and
`VITE_PORTAL_URL` became optional in `src/env.ts`, because a container image is
built with no `.env` and `createEnv` would otherwise throw at module load before
runtime configuration could answer; the required-ness moved into `api-url.ts`,
where the error names both the runtime and the build-time knob.

**Verified so far.** `helm lint` passes with defaults and with both example
values files. `helm template` renders both, and every guard rail fires with its
own message: missing `betterAuthSecret`, a secret under 32 characters, bundled
Postgres with an `existingSecret`, no database at all, `api.replicaCount > 1`
without a `ReadWriteMany` documents volume, and `agent.persistence` with more
than one agent replica. `pnpm build` passes for both frontends, `dist/config.js`
survives the build, and `dist/index.html` still carries the unhashed
`<script src="/config.js">`.

**Also corrected.** `architecture.md` and `00-overview.md` both stated that no
deployment artifact exists. Both now say what is true: the artifacts exist, no
image is published and no pipeline builds them.

**Remaining at the time of this entry.** Image builds and the kind cluster run
were still in progress; results are in the next entry.

---

### 2026-08-31 — images, the kind run, and one blocker

**All four images build and run.** `axioma/api:dev` 758 MB, `axioma/agent:dev`
1.02 GB, `axioma/portal:dev` 84 MB, `axioma/dashboard:dev` 85 MB. Each from its
own project directory as context, each non-root: api as uid 1000, agent as
10001, both frontends as nginx uid 101.

Checked outside Kubernetes as well as in it. The agent image imports its
generated protobuf bindings, binds its health endpoint on `0.0.0.0:8090`,
answers 503 while its stream is down, and persists its worker ID to a writable
config directory. The portal image writes `/config.js` from `AXIOMA_API_URL` at
container start, serves the SPA with a client-route fallback, and — because
`.dockerignore` keeps `.env` out of the build context — **contains no API URL at
all**, which is the plainest possible refutation of the bake-in trap.

**Acceptance run on a clean kind cluster: 43 checks, 0 failures.** Fresh
namespace, `helm install`, two API replicas. Verified: every pod Running or
Completed; exactly one migration Job, one migration pod, and 33 applied
migrations matching the journal in the image; the twelve RBAC verbs, allowed and
refused, both through `kubectl auth can-i` and through `@kubernetes/client-node`
run inside the API pod — pods listed, deployment read, delete 403, secrets 403;
in-cluster and external-kubeconfig modes both reaching the cluster, with the
ServiceAccount token mounted in one and absent in the other; the portal
reconfigured to a new API URL by `helm upgrade` alone, same image digest, and
the generated gRPC certificate surviving that upgrade unchanged. Signing up the
bootstrap address and rolling the API promoted it to staff, and a ticket created
through the real oRPC client — the same `@orpc/client` the SPA uses — came back
as `INC-2026-00001` with `privateData` reporting `kind: staff` and 27
capabilities.

**Three defects the cluster run found, all now fixed.**

- The bundled Postgres crash-looped on `chown: Operation not permitted`. Its
  entrypoint starts as root, fixes ownership on the data and socket
  directories, then drops to the postgres user with gosu; `capabilities: drop:
  ALL` made all of that fail. It now drops ALL and adds back the five it
  actually needs.
- `AXIOMA_K8S_CONTEXT` was emitted whenever a kubeconfig context was configured,
  regardless of mode. The Kubernetes client calls `setCurrentContext` with it in
  every mode, and an in-cluster config has exactly one context named
  `inClusterContext` — so a context name left over from a kubeconfig-mode
  release turned every cluster call into "No active cluster!". It is now emitted
  only in kubeconfig mode. This one was invisible to `helm template` and to any
  amount of reading.
- A failed optional-dependency download makes `pnpm install` skip the package
  and still report success; the missing native binding only surfaced at
  `pnpm build`, by which point the broken install was a cached layer and every
  retry reused it. All three Node images now assert their platform-native
  packages unpacked non-empty in the same layer as the install.

**The tree moved under this work, twice, and the chart follows it.**

- `api/src/env.ts` gained `AXIOMA_LLM_API_BASE`, `AXIOMA_LLM_KEY` and
  `AXIOMA_EMBEDDING_MODEL`: the API now calls a model gateway of its own for
  knowledge embeddings. That is a **second egress path**, configured separately
  from the agent's, and the values file, the README and the notes all say so
  now. A mechanical check against `env.ts` reports all 20 declared variables
  plus the three read straight off `process.env` as reachable.
- `api/src/server/grpc.ts` now **requires** `AXIOMA_GRPC_TLS_CERT` and
  `AXIOMA_GRPC_TLS_KEY` and refuses to start without them, and the device
  channel requires an enrolment token or a stored credential. The chart supplies
  the certificate: either a `kubernetes.io/tls` Secret you name, or a
  self-signed one generated on first install and reused on upgrade via `lookup`,
  with SANs covering the Service DNS names, `localhost` and the gRPC ingress
  host. The documentation that said the device channel was plaintext with a
  client-asserted identity has been rewritten to match the tree, with the
  caveat that an older API image behaves the old way.

**Blocker — Axel cannot connect, and this is not Phase 2's to fix.**
`agent/axel/server.py:360` still opens `grpc.aio.insecure_channel`, so against
an API that now demands TLS its `channel_ready()` times out and the readiness
probe correctly reports 503 forever. Everything else about the agent deployment
is verified — the image runs, the health server answers, the pod schedules — but
the stream never comes up, so **"a ticket produces an agent run that reaches a
terminal state" could not be demonstrated** and `agent_runs` stayed empty. This
is the Python half of the device channel authentication phase, which is landing
concurrently. Per the session protocol it is recorded here rather than worked
around: nothing in the chart can bridge it, because there is no plaintext option
left in the API.

**A second observation for whoever is on multi-environment.**
`api/src/db/migrations/0032_multi_environment.sql` is an empty placeholder while
`src/db/schema/cmdb.ts` already declares `cmdb_objects.environment_id`. A
deployed API logs `column cmdb_objects.environment_id does not exist` from its
search sweep every few seconds. The migrations applied exactly what the journal
declares — this is schema drift in the tree, not a deployment defect, and
`pnpm db:check` should catch it.

**Acceptance checklist.** Everything holds except one item: `helm install` on a
clean kind cluster brings up all four components (the agent runs but never
becomes Ready, for the reason above); migrations run exactly once with two
replicas; both cluster access modes work; every `env.ts` variable is reachable
through values; the model-gateway decision is recorded with both egress paths
stated; the device gateway documentation matches the tree; and the install
document was followed end to end by the acceptance run. The open item is the
agent run reaching a terminal state, blocked as described.

The throwaway kind cluster used for this run was deleted afterwards. The
existing `kind` cluster on this machine was never touched.

---

### 2026-08-31 — the model-gateway decision, revised by the operator

**The decision changed, and it is now recorded as chosen rather than deferred.**
The earlier entry picked option three — configurable, defaulting outbound to the
owned gateway. The operator has since decided against self-hosting inference at
all: Axiōma calls **hosted providers**, configured per install, with no default.

That is stronger than option one in the plan's table, because the chart now
carries no vendor default to fall into. Both endpoints ship **empty**, and the
chart `fail`s the render rather than letting an unset value fall back to the
endpoint compiled into `agent/axel/config.py` or `api/src/env.ts`. Installing
with no provider at all is still legitimate — set `agent.enabled: false` and
leave the embedding keys empty — and produces a stack with lexical retrieval and
no agent, rather than one that quietly phones a vendor nobody chose.

**Two independent provider slots, because the code has two.** Chat goes through
LiteLLM from the agent; embeddings go through a plain `fetch` from the API. Both
processes read the same variable name, `AXIOMA_LLM_KEY`, but they are different
processes, so the chart maps each one to its own Secret key —
`secrets.embeddingKey` when set, `secrets.llmKey` otherwise. Chat and embeddings
can therefore be different vendors with different credentials, with no code
change.

Three constraints the values file and README now state, each verified against
the tree rather than assumed:

- `agent/axel/model.py` always sends `api_base`, so each component talks to one
  OpenAI-compatible endpoint and the model string wants the `openai/` prefix.
  Native `anthropic/` or `gemini/` routing is an agent change, not a values
  change.
- The chat model must support tool calling: the loop sends
  `tool_choice="required"` with typed schemas on every turn and has no
  text-parsing fallback.
- The embedding model must return exactly 1536 dimensions, because the column is
  `vector(1536)` and `embeddings.ts` discards anything else *silently*, falling
  back to lexical retrieval.

One knob is documented as not working rather than left to look like it does:
clearing `agent.model.reasoningEffort` does not stop it being sent, because
`config.py` defaults it to `"max"` and an empty environment value arrives as an
empty string. Suppressing it is an agent change.

**The TLS blocker cleared itself.** `agent/axel/server.py` now dials
`grpc.aio.secure_channel` with `api_grpc_ca_file` and `api_grpc_server_name`. The
chart mounts the gateway certificate into the agent to match — `tls.crt` only,
by `items`, because the Secret also holds the server's private key and the agent
has no use for it.

**Second clean-slate acceptance run: 44 checks, 0 failures**, and this time
`agent readyReplicas` is a pass rather than a note: Axel completes the handshake
and `/health` answers 200 instead of 503.

**New blocker, and it is sharper than the one it replaced.** Creating a ticket
now **fails with a 500 whenever an agent worker is connected**. Auto-dispatch
inserts into `agent_runs` with `environment_id` and `environment_source`, and
neither column exists: `0032_multi_environment.sql` is still an empty
placeholder while `environments` is declared across five schema modules
(`environments.ts`, `connectors.ts`, `agent.ts`, `cmdb.ts`, `index.ts`).

That the insert was attempted at all is itself the proof this phase wanted —
`grpcGateway.hasWorker()` is the third condition on the dispatch gate, so the
agent is registered over the stream. What stops the run is the missing
migration, which is Phase 1's to generate. Until it lands, **"a ticket produces
an agent run that reaches a terminal state" remains the one unmet item**, and a
deployed stack with the agent enabled cannot create tickets at all.

---

### 2026-08-31 — the last item closes; two more defects found closing it

`0034_multi_environment` landed in the tree with the real SQL — `environments`
plus three link tables, and the three `agent_runs` columns. The blocker from the
previous entry is gone, so this session carried the phase to completion against
the current tree: all four images rebuilt, a fresh kind cluster, and the full
acceptance suite including the run that had never been demonstrated.

**Result: 48 of 49 checks pass in one clean-slate run, and the one failure
re-verified clean in isolation immediately after — it was a race in the test
harness, not the chart.** The probe in the external-kubeconfig step selected a
pod that was still terminating from the previous rollout, and that pod's
in-cluster token answered instead of the mounted file. Re-run at one replica:
13 of 13, including `PROBE source: kubeconfig file` against
`https://kubernetes.default.svc`.

**The last acceptance item is met.** A ticket raised through the real
`@orpc/client` — the same client the portal uses — produced `INC-2026-00001`,
one `agent_runs` row, three `agent_steps`, and status `failed`. `failed` is one
of the four terminal states in `RUN_STATUSES`, so the loop started, ran, and
ended rather than hanging. It ended there because the acceptance run uses a
placeholder provider key; the last thing standing between this and a *resolved*
run is a real credential, which is configuration rather than code.

**Two defects found in the course of proving it, both now documented.**

*Agent dispatch silently stops working past one API replica.* Axel holds one
gRPC stream to one API pod, and `grpcGateway.hasWorker()` — the third condition
on the auto-dispatch gate in `api/src/server/routers/tickets.ts` — is in-process
state with no shared registry. Observed directly: at two replicas the ticket
created cleanly, returned 200, and `agent_runs` stayed empty; the API logs
showed `Axel worker=… connected` on one pod and nothing on the other. At one
replica the same ticket produced a run. Nothing in the logs explains the
non-dispatch, which is what makes it dangerous. The chart now warns in NOTES
whenever `api.replicaCount > 1`, and the README lists it first among the reasons
the API does not scale.

*The loop always sends `reasoning_effort`, and most providers reject it.* With
`agent.model.reasoningEffort` at its `"max"` default, the first model turn
returns `litellm.UnsupportedParamsError: openai does not support parameters:
['reasoning_effort']` and the run ends `failed`. The earlier entry recorded that
clearing the value in the chart does not help — `config.py` defaults it and an
empty value arrives as an empty string. What changed is that there *is* a
chart-level fix after all: LiteLLM evaluates
`drop_params = bool(os.getenv("LITELLM_DROP_PARAMS", False))` at import, so
`agent.extraEnv` can switch it on with no code change. Verified end to end —
`litellm.drop_params` reads `True` inside the pod, and the next run's failure
moved from `UnsupportedParamsError` to `AuthenticationError: Incorrect API key
provided: acceptan****-key`, which is the placeholder credential and nothing
else. It is now set in `values-minimal.yaml`, documented in the README with the
truthiness caveat that `"false"` also enables it, and NOTES flags the
combination of a set `reasoningEffort` with no `LITELLM_DROP_PARAMS`.

**Acceptance checklist — complete.** `helm install` on a clean kind cluster
brings up all four components, Axel included; a ticket produces a run that
reaches a terminal state; migrations run exactly once with two replicas; both
cluster access modes work; every `env.ts` variable is reachable through values;
the model-provider decision is recorded with both egress paths named and no
vendor default to fall into; the device gateway documentation matches the tree;
and the install document was followed end to end by the acceptance run itself.

The throwaway kind cluster was deleted afterwards and the machine's existing
`kind` cluster was never touched.

---

### 2026-08-31 — a live run against the real gateway

Run with the operator's own credential from `agent/.env`, so the whole loop
executed for real rather than terminating on a placeholder key. Chart values
came straight from that file: `openai/gpt-5.6-terra` at
`https://llm.marketrix.io/v1`, `reasoning_effort: max`.

**It worked.** `[grpc] Axel worker=… model=openai/gpt-5.6-terra connected`, then
two runs of ten steps each, both ending `escalated` — a terminal state — with
9,165 prompt and 348 completion tokens on the recorded run, and `agent_runs.model`
storing `gpt-5.6-terra`, the model that actually answered rather than the one
configured.

The transcript is the architecture behaving as documented:

```
1  tool_call    knowledge_search        Check published knowledge before diagnosis.
2  observation  knowledge_search        {"mode": "lexical", "items": []}
3  think                                No matching knowledge was found. Inspect checkout workload pods…
4  tool_call    cluster_read_pods
5  observation  cluster_read_pods       tool failed: HTTP-Code: 403
6  think                                Pod listing is not authorized. Read the checkout deployment…
7  tool_call    cluster_read_deployment
8  observation  cluster_read_deployment tool failed: HTTP-Code: 403
9  decision                             {"description": "Grant the incident responder read access for…
10 terminal
```

Forced knowledge retrieval before the first model turn; typed tool calls through
the API; the namespace-scoped Role refusing a namespace it was not granted; and
the agent escalating honestly rather than inventing a fix it could not verify.
Its own escalation recommends granting read access for that namespace, which is
`rbac.managedNamespaces` — the RBAC design and the model's behaviour agree.

`reasoning_effort: max` was accepted by this gateway, so `LITELLM_DROP_PARAMS`
was not needed here. It remains right for providers that reject the parameter.

**Two findings from the live run, both now in the README.**

*A namespace that was not granted reads like a broken install.* It is the design
working, but the Kubernetes client renders the refusal as `HTTP-Code: 403 /
Message: Unknown API Status Code!` and that string reaches the transcript
verbatim. The README now says to name every namespace the agent should reach,
and points out that `api/k8s/` seeds its scenarios into `demo`, which the
default grant does not cover.

*The embeddings credential fails silently.* Every document was stored with a
null embedding. Probing the endpoint from inside the API pod gave
`403 {"error":{"code":"403","type":"key_model_access_denied","message":"key not
allowed to access model. This key can only access models=['gpt-5.6-sol',
'gpt-5.6-luna', 'gpt-5.6-terra']. Tried to access text-embedding-3-small"}}`.
`createEmbedding` returns `null` on any non-2xx and retrieval carries on
lexically with nothing logged — so hybrid retrieval would never work with this
key and nothing would say so. The README now carries a one-line probe to run
after installing. **This gateway key cannot serve the embeddings slot at all**;
that slot needs a different provider or a key scoped to an embedding model.

**One defect in this phase's own work, found by the live run and fixed.** The
`providerEncryptionKey` placeholder shipped in `values-full.yaml` decoded to 34
bytes, not 32, and the API crash-looped on it with
`AXIOMA_PROVIDER_ENCRYPTION_KEY must be a base64-encoded 32-byte key`.
`helm template` could not catch it because the check is at import. The chart now
refuses to render a key of the wrong length, naming the actual byte count, and
the example carries a valid one.

---

### 2026-08-31 — the four tests that had never actually been run

Reviewing the plan's own Testing table against what had been done turned up four
things asserted rather than demonstrated. All four are now demonstrated, and two
of them found defects.

**Images build from a fresh clone.** Every build until now used the working
tree, which carries `node_modules`, `dist`, `.env`, `.venv` and the generated
`axel/pb`. Materialised a clone-equivalent tree with
`git ls-files -co --exclude-standard` — 720 files, none of those artifacts — and
built all four from it. **All four succeeded first attempt, no retries.**

**Ingress against a real controller: 5 checks, 0 failures.** kind ships without
one, so the templates had only ever been rendered. Installed ingress-nginx
(`provider/kind`, images side-loaded because the node's DNS is unreliable here)
and verified from inside the cluster, which avoids kind's host port mapping
being unreliable on Windows. `api.axioma.test` returned `{"status":"ok"}`,
`portal.axioma.test` returned `Axiōma · Employee support`,
`dashboard.axioma.test` returned `Axiōma Console`, and `/config.js` through the
ingress carried `https://api.axioma.test` — the runtime-configuration mechanism
working through a real proxy rather than a port-forward.

**gRPC ingress works, and only because the annotation was wrong and got fixed.**
The chart shipped `backend-protocol: GRPC`, which terminates TLS at the
controller and forwards **cleartext h2c** — while this gateway binds with
`ServerCredentials.createSsl` and speaks TLS only, so nothing would ever
handshake. Changed to `GRPCS`, which keeps TLS to the pod, and added
`ssl-redirect`. Verified with grpcurl through the controller: `Failed to list
services: server does not support the reflection API`. That error is the success
signal — no reflection is registered on the gateway, so reaching the gRPC layer
at all means TLS completed, HTTP/2 negotiated, and the controller proxied to the
backend over GRPCS.

Also recorded while doing it: **ingress-nginx is retired.** Best-effort
maintenance ended March 2026 — no further releases, no bugfixes, no security
fixes — and SIG Network recommends moving to Gateway API or another controller.
`grpcIngress.className` and its annotations are values rather than assumptions,
and the README now says so; nothing in the chart depends on nginx beyond those
two fields.

**The end-to-end smoke, in full.** Earlier runs skipped "register an
environment" because the surface did not exist. It does now, on the dashboard
contract. Signed in to the dashboard as staff, registered `prod (in_cluster,
act)`, created a ticket, and the run reached a terminal state — with
`environment_key = prod` and `environment_source = default`, which is Phase 1's
server-side environment resolution working through the deployed stack.

**A gap that breaks this phase's own install document.** `createEnvironment` is
gated on `admin.environments`, and **no seeded role grants it** — not Employee,
not IT Analyst, not Platform Engineer, which is the role the bootstrap
administrator receives. The capability is declared and permitted by the CHECK
constraints; nothing hands it out. `admin.connectors` has the same gap, which
will bite Phase 6. A clean install therefore answers `createEnvironment` with
403 for every account, and the install path in `deploy/README.md` stops at its
third step. The smoke above passed only after granting the capability by hand.
That workaround is now documented, and the real fix — seed the grant — is raised
separately as it belongs to Phase 1.

**Still not exercised, and honest about it.** The device gateway has been proven
reachable through the gRPC ingress, but no actual `axel-cli` has enrolled over
it; that is Phase 3 and Phase 5 territory and outside this phase's scope.

---

### 2026-08-31 — the capability gap is seeded; the phase is closed

`0048_platform_engineer_environment_admin.sql` landed, granting
`admin.environments` and `admin.connectors` to `platform-engineer`. The manual
grant the previous entry described is no longer needed and has been removed from
`deploy/README.md`; step three of the verification path now works on a clean
install as written.

All eight acceptance items are ticked and all seven rows of the Testing table
have been demonstrated rather than asserted. The chart lints and renders on both
example values files, all twenty `env.ts` variables are reachable, fifteen
templates, four Dockerfiles.

One standing caveat for whoever reads this next: **the tree moved continuously
underneath this phase** — the migration journal went from 31 entries to 40 while
it was being written, and `env.ts`, `grpc.ts` and the agent's channel setup all
changed mid-flight. Every result above was verified against a coherent snapshot,
but the images verified in the last full run are behind HEAD by three
migrations. The chart is unaffected by that: it reads the journal from whichever
image is built, and the migration Job and the API's init container compare
against that same image rather than against anything baked into the chart.
Rebuild the images and the acceptance run reproduces.
