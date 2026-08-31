# Deploying Axiōma

Axiōma installs into a Kubernetes cluster the customer runs, alongside the
systems it manages. This directory holds the chart and the example values; the
container images are built from each project's own `Dockerfile`.

| Path | What it is |
| --- | --- |
| `helm/axioma/` | The chart. Five workloads, an optional bundled Postgres, RBAC, and the migration Job. |
| `examples/values-minimal.yaml` | The smallest values file that installs a working stack. |
| `examples/values-full.yaml` | Every knob set to something other than its default. Not a recommended configuration — it exists so the templates are exercised end to end. |

The Dockerfiles live with the projects they build, because each project is
standalone — its own lockfile, its own toolchain — and a build context that
reached outside its directory would contradict that:
`api/Dockerfile`, `agent/Dockerfile`, `portal/Dockerfile`, `dashboard/Dockerfile`,
`web/Dockerfile`.

`api/k8s/` is not part of this. It holds two deliberately broken demo workloads
for the agent to diagnose. Do not extend it.

`web/` is the public marketing site. It is outside the platform loop, but it is
packaged, because it publishes the service status page the portal header links
to on every route — `portal.siteUrl` points at it. It is the one frontend that
is not a static bundle: TanStack Start renders it on a Nitro server so `/status`
can read the API server-side, which is why the marketing origin never appears in
`api.config.corsOrigin`.

## Read this before you install

Three things are true of the tree today. Each of them is a property of the
software, not of how you configure it.

**Ticket text goes to a third-party model provider, on two independent paths.**
Axel sends the ticket, the messages on it, and the system state it observes to
the provider named in `agent.model.apiBase`. The API separately sends knowledge
and ticket text to the provider named in `api.config.llm.apiBase`, to compute
embeddings. Both are unset in the chart's defaults and both must be filled in;
they are configured separately, so changing one does not move the other, and
they may be different vendors with different credentials. This is inherent to
using hosted inference: **no data-residency claim survives it**, and the chart
does not pretend otherwise. See "Model providers" below.

**The gRPC gateway requires TLS, and the default certificate is self-signed.**
The API refuses to start without `AXIOMA_GRPC_TLS_CERT` and
`AXIOMA_GRPC_TLS_KEY`, so the chart always supplies them: either a
`kubernetes.io/tls` Secret you name, or a self-signed certificate it generates
on first install and reuses on every upgrade. Self-signed means it is its own
trust anchor — anything that dials the gateway has to be given that certificate,
and a device dialling a name that is not in its SANs fails the handshake rather
than falling back. Only the server presents a certificate; client certificates
are not requested. See "The device gateway" below for how to extract it and how
to add names.

**Nothing constrains blast radius inside the granted scope.** The RBAC below is
narrow in verbs — read pods, read and patch deployments — but within the
namespaces you grant, the agent can patch the image of any deployment it can
see. There is no approval step before an agent action.

## Prerequisites

- A Kubernetes cluster, 1.23 or later, and `kubectl` pointed at it.
- Helm 3.8 or later.
- Docker, to build the images.
- A way to get locally built images into the cluster. On kind that is
  `kind load docker-image`; on k3d, `k3d image import`; on a remote cluster,
  push to a registry the cluster can pull from and set `images.*.repository`.
- A namespace to install into. The chart does not create one.

This phase does not publish images and has no CI pipeline for them. Building
locally and loading into a cluster is the supported path.

## 1. Build the images

From `axioma/`:

```bash
docker build -t axioma/api:dev ./api
```

```bash
docker build -t axioma/agent:dev ./agent
```

```bash
docker build -t axioma/portal:dev ./portal
```

```bash
docker build -t axioma/dashboard:dev ./dashboard
```

```bash
docker build -t axioma/web:dev ./web
```

Each build context is the project directory and nothing outside it. The agent
build regenerates its protobuf bindings, which are not committed; the frontend
builds generate their route trees the same way.

Load them into a kind cluster — `--name` is the cluster, and you need it unless
yours is called `kind`:

```bash
kind load docker-image --name axioma axioma/api:dev axioma/agent:dev axioma/portal:dev axioma/dashboard:dev axioma/web:dev
```

If you are using the bundled Postgres, load its image the same way rather than
making the node pull it:

```bash
docker pull pgvector/pgvector:pg18 && kind load docker-image --name axioma pgvector/pgvector:pg18
```

The chart's default `pullPolicy` is `IfNotPresent`, which is what makes a
side-loaded image work. `Always` would send the kubelet to a registry that does
not have it.

## 2. Write a values file

Copy `examples/values-minimal.yaml` and fill in the things that have no default:

| Value | Why it has no default |
| --- | --- |
| `secrets.betterAuthSecret` | Session signing key, minimum 32 characters. A default would be a shared secret across every install. |
| `postgresql.auth.password` | Same reason. Not needed if you set `postgresql.enabled: false`. |
| `api.config.betterAuthUrl` | Better Auth validates callbacks against it. A value that does not match the origin the browser used fails authentication silently. |
| `api.config.corsOrigin` | Comma-separated exact origins for the portal and dashboard. Both send credentialed requests, so an origin missing here makes sign-in fail with nothing in the console to explain it. |
| `agent.model.name`, `agent.model.apiBase`, `secrets.llmKey` | The chat provider. A default would send tickets to a vendor nobody chose. Set `agent.enabled: false` to install without Axel instead. |
| `api.config.llm.apiBase`, `api.config.llm.embeddingModel` | The embeddings provider. Leave all three of these and the keys empty to install with knowledge retrieval lexical. |

The chart refuses to render rather than falling back to an endpoint compiled
into the code, so a half-filled provider block fails at `helm install` with a
message naming the missing value.

Generate the secrets:

```bash
openssl rand -base64 48
```

`secrets.providerEncryptionKey` is the AES-256-GCM key for stored credentials —
base64, exactly 32 bytes decoded:

```bash
openssl rand -base64 32
```

Set `api.config.bootstrapAdminEmail` to the address you will sign up with. The
first account created for it is promoted to administrator. Nothing else grants
administrator rights on a fresh install, so skipping this leaves an install
nobody can administer.

## Model providers

Two slots, configured independently. They may be the same vendor or different
ones, and each has its own credential.

| | Chat | Embeddings |
| --- | --- | --- |
| Called by | the agent, through LiteLLM | the API, with a plain `fetch` |
| Endpoint | `agent.model.apiBase` | `api.config.llm.apiBase` |
| Model | `agent.model.name` | `api.config.llm.embeddingModel` |
| Credential | `secrets.llmKey` | `secrets.embeddingKey`, falling back to `secrets.llmKey` |
| Carries | ticket text, message bodies, observed system state | knowledge and ticket text |
| If unset | Axel cannot run; set `agent.enabled: false` | retrieval stays lexical, which is a supported state |

Both slots expect an **OpenAI-compatible** endpoint. For chat that is a property
of the client rather than a preference: `agent/axel/model.py` always sends
`api_base`, so LiteLLM talks to that one endpoint and the model string should
carry the `openai/` prefix. Native `anthropic/…` or `gemini/…` routing would be
an agent code change, not a values change.

Endpoints that work as written:

| Provider | `apiBase` |
| --- | --- |
| OpenAI | `https://api.openai.com/v1` |
| Azure OpenAI | `https://<resource>.openai.azure.com/openai/deployments/<deployment>` — also set `AZURE_API_VERSION` through `agent.extraEnv` |
| Together | `https://api.together.xyz/v1` |
| Fireworks | `https://api.fireworks.ai/inference/v1` |
| Groq | `https://api.groq.com/openai/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |

Two requirements that will bite if you pick the wrong model:

- **The chat model must support tool calling.** The loop sends
  `tool_choice="required"` with typed schemas on every turn and has no
  text-parsing fallback. `agent.model.strictFunctionCalling` asks for strict
  schema adherence and retries once without it if the provider objects.
- **The embedding model must return exactly 1536 dimensions.** The column is
  `vector(1536)` and `api/src/server/search/embeddings.ts` discards anything
  else — silently, falling back to lexical retrieval. OpenAI's
  `text-embedding-3-small` is 1536 natively; most others need a `dimensions`
  parameter the provider actually honours.
- **The credential must be allowed to reach the embedding model.** The same
  silence covers an authorization failure: a non-2xx response returns `null` and
  retrieval carries on lexically with nothing logged. Seen in a live run, where
  a gateway key scoped to chat models answered
  `{"error":{"code":"403","type":"key_model_access_denied"}}` and every document
  was stored with a null embedding. Check it directly after installing rather
  than assuming:

  ```bash
  kubectl -n axioma exec deploy/axioma-api -- node -e "fetch(process.env.AXIOMA_LLM_API_BASE.replace(/\/$/,'')+'/embeddings',{method:'POST',headers:{Authorization:'Bearer '+process.env.AXIOMA_LLM_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.AXIOMA_EMBEDDING_MODEL,input:'probe'})}).then(async r=>console.log(r.status, (await r.text()).slice(0,200)))"
  ```

### Unsupported parameters

`agent.model.reasoningEffort` is an OpenAI-family parameter sent on every call,
and a provider that does not understand it rejects the request rather than
ignoring it. The run then ends `failed` on its first model turn:

```
litellm.UnsupportedParamsError: openai does not support parameters: ['reasoning_effort']
```

Clearing it in values does not stop it being sent — `agent/axel/config.py`
defaults it to `"max"` and an empty value reaches the provider as an empty
string. Let LiteLLM strip what the provider will not take instead:

```yaml
agent:
  extraEnv:
    - name: LITELLM_DROP_PARAMS
      value: "1"
```

LiteLLM reads that at import — `drop_params = bool(os.getenv("LITELLM_DROP_PARAMS", False))`
— so it is a Python truthiness check on the string and **any non-empty value
switches it on**, `"false"` and `"0"` included. Omit the entry to leave it off.

Most installs against a hosted provider want this set.

Provider-specific settings the chart does not model go through `agent.extraEnv`
and `api.extraEnv` as plain environment variables. The agent's settings class
ignores unknown `AXIOMA_*` names and LiteLLM reads its own, so anything LiteLLM
understands can be passed that way.

## 3. Install

```bash
helm install axioma ./helm/axioma --namespace axioma --create-namespace -f my-values.yaml --wait
```

`--wait` is worth passing: it holds until the migration Job has finished and
every pod is Ready, which is the difference between "the chart applied" and "the
stack works".

Expect API pods to sit in `Init` for a while. That is the design — see
Migrations below.

## 4. Reach it

Without an ingress, port-forward to the ports the development stack uses, so the
default URLs in `values-minimal.yaml` are correct as written:

```bash
kubectl -n axioma port-forward svc/axioma-api 3000:3000
```

```bash
kubectl -n axioma port-forward svc/axioma-portal 3001:80
```

```bash
kubectl -n axioma port-forward svc/axioma-dashboard 3002:80
```

```bash
kubectl -n axioma port-forward svc/axioma-web 3003:80
```

With an ingress, set `ingress.enabled: true` and the four hostnames, and set
`api.config.betterAuthUrl`, `api.config.corsOrigin`, `portal.apiUrl`,
`dashboard.apiUrl` and `dashboard.portalUrl` to match. Those five are the ones
that silently break authentication when they disagree with reality.

`portal.siteUrl` is separate: it points at the public website that publishes the
service status page, which the portal header links to on every route. The portal
fails to render when it is missing, so it carries a working default rather than
being left empty. It is a browser-facing URL — `ingress.hosts.web`, or the
port-forward above — not the in-cluster Service name that `web.apiUrl` uses.

The website is the one component whose API URL is not browser-facing. It calls
the API from its own server, so `web.apiUrl` takes the in-cluster Service (its
default) and must NOT be added to `api.config.corsOrigin`.

## 5. Verify

1. Open the dashboard, sign up with `api.config.bootstrapAdminEmail`, and
   confirm you land on the staff side rather than being redirected to the
   portal. That proves the API, the database, the migrations, CORS, and the
   frontend's runtime configuration all agree.
2. Confirm Axel is connected:

   ```bash
   kubectl -n axioma get pods -l app.kubernetes.io/component=agent
   ```

   The agent's readiness probe reports 503 while its gRPC stream is down, so a
   Ready agent pod means the stream to the API is up.
3. Register an environment from the dashboard.
4. Open the portal, raise a ticket, and watch the run in the dashboard. With
   `api.config.autoDispatch` left at `true`, creating a ticket starts a run; it
   should reach a terminal state rather than hanging.

## Cluster access

Two modes, set with `api.cluster.mode`.

**`in-cluster`** — the default. The API uses the ServiceAccount token mounted
into its own pod. The chart creates the ServiceAccount and, per namespace in
`rbac.managedNamespaces`, a Role granting exactly:

- `get`, `list` on `pods`
- `get`, `patch` on `apps/deployments`

Nothing else. No create, no delete, no scale, no reading Secrets. Empty
`managedNamespaces` means the release namespace alone. Those namespaces must
already exist; the chart does not create them.

`rbac.clusterWide: true` swaps the per-namespace Roles for a single ClusterRole
with the same verbs in every namespace. It is opt-in because it grants access to
namespaces nobody chose.

**A namespace you did not grant produces an escalation, not an error.** That is
the design working, but it is easy to mistake for a broken install. Observed in
a live run against a real model: the agent issued `cluster_read_pods`, got a
403, tried `cluster_read_deployment`, got a 403, and escalated with

> The checkout outage cannot be diagnosed because this support identity lacks
> Kubernetes RBAC to list pods or read the checkout deployment in the checkout
> namespace.

So name every namespace the agent is meant to reach:

```yaml
rbac:
  managedNamespaces:
    - axioma
    - demo        # api/k8s/ puts the seeded scenarios here
    - production
```

The namespaces must already exist — the chart binds Roles in them, it does not
create them. Note also that the Kubernetes client renders a 403 as
`HTTP-Code: 403 / Message: Unknown API Status Code!`, which reaches the
transcript verbatim and reads worse than it is.

**`kubeconfig`** — for a cluster the API does not run in. Put a kubeconfig in a
Secret and name it:

```bash
kubectl -n axioma create secret generic axioma-kubeconfig --from-file=config=/path/to/kubeconfig
```

```yaml
api:
  cluster:
    mode: kubeconfig
    kubeconfig:
      existingSecret: axioma-kubeconfig
      key: config
      context: prod
```

The chart mounts it at `/etc/axioma/kubeconfig` and sets `KUBECONFIG`, which is
what makes the API's Kubernetes client read the file instead of falling back to
the in-cluster token. In this mode the ServiceAccount token is not mounted at
all.

There is one cluster per install: the client is built once at first use from
`KUBECONFIG` and `AXIOMA_K8S_CONTEXT`. Naming a target environment per tool call
is a later phase; when it lands, external credentials come from the database
rather than from this chart.

## Database

**Bundled, for evaluation.** `postgresql.enabled: true` deploys one
`pgvector/pgvector:pg18` StatefulSet with one PVC. No backup, no failover, no
replication. It uses the pgvector image rather than stock Postgres because later
phases need the vector extension available; nothing uses it yet.

**External, for anything else.** Set `postgresql.enabled: false` and
`secrets.databaseUrl` to a DSN for a database you operate. That database must
have the pgvector extension available.

If you keep the bundled Postgres but supply its password through
`postgresql.auth.existingSecret`, the chart cannot read that password and so
cannot compose a DSN — set `secrets.databaseUrl` as well. The chart fails the
render with that message rather than producing a broken release.

## Migrations

`drizzle-kit migrate` runs in its own Job, one per release revision, from the
API image. The API does not migrate on boot.

The Job is a plain resource rather than a Helm hook, deliberately. A
`pre-install` hook runs before the release's own resources exist, so it would
deadlock against a bundled Postgres that the same install has not created yet; a
`post-install` hook runs after `--wait` has already given up on pods that are
waiting for the schema.

Ordering is enforced from the other side instead. Every API pod runs an init
container that blocks until the row count in `drizzle.__drizzle_migrations`
reaches the number of entries in the migration journal baked into that image.
Two consequences worth knowing:

- Migrations run exactly once no matter how many API replicas there are. The Job
  is the only writer.
- No replica serves traffic against a schema older than its own code, on install
  or upgrade.

Commit `ab84929` deliberately squashed the migration history into
`0000_baseline.sql`. Existing installations whose migration ledger predates that
squash must be baselined manually before upgrading; the row-count init check
cannot identify equivalent old migration hashes and is only safe for fresh
installs created from the baseline.

If API pods stay in `Init`, read the Job:

```bash
kubectl -n axioma logs job/axioma-migrate-1
```

## Reconfiguring the frontends without rebuilding

Both SPAs are static bundles. Their `index.html` loads `/config.js` before the
application bundle, and the container entrypoint writes that file from the
environment at start. `portal.apiUrl`, `portal.siteUrl`, `dashboard.apiUrl` and
`dashboard.portalUrl` therefore take effect on a redeploy, not on a rebuild:

```bash
helm upgrade axioma ./helm/axioma --namespace axioma -f my-values.yaml --set portal.apiUrl=https://api.example.com
```

The pod annotation carries a hash of those URLs, so changing one rolls the pods.
The build-time `VITE_SERVER_URL`, `VITE_SITE_URL` and `VITE_PORTAL_URL` remain
as the development fallback, used only when `/config.js` leaves the key empty.

## The device gateway

`axel-cli` runs on employee laptops, outside the cluster, and dials in. Both
agent channels share one gRPC port, exposed as the `axioma-api-grpc` Service.

- **Axel** reaches it as a `ClusterIP`. Nothing further is needed.
- **Devices** need it reachable from where the laptops are. That means
  `api.grpcService.type: LoadBalancer` or `NodePort`, or `grpcIngress.enabled`.

gRPC ingress is not HTTP ingress, and three things about it are easy to get
wrong:

- **`GRPCS`, not `GRPC`.** The two annotations differ in what the controller
  speaks to the backend. `GRPC` terminates TLS at the ingress and forwards
  cleartext h2c; this gateway binds with `ServerCredentials.createSsl` and
  speaks TLS only, so cleartext never completes a handshake. The chart defaults
  to `GRPCS`, which keeps TLS to the pod.
- **TLS on the listener is mandatory.** ingress-nginx will not serve gRPC over
  plaintext port 80 — h2c there needs a custom template it does not ship. Name
  a `tls` secret under `grpcIngress.tls`.
- **The controller's own certificate needs the device's hostname.** That is
  separate from the gateway certificate the chart generates, which is what the
  *backend* presents.

`className` and the annotations are values, not assumptions, because
**ingress-nginx is retired** — best-effort maintenance ended in March 2026, with
no further releases and no fixes for security vulnerabilities. Kubernetes SIG
Network recommends moving to Gateway API or another controller. If you are
choosing now, choose something else and set `grpcIngress.className` and
`grpcIngress.annotations` to that controller's equivalents; nothing in the chart
depends on nginx beyond those two values.

If devices cannot connect, check the annotation first, then whether TLS is
configured on the listener at all.

Point a device at it with the gateway address it should dial:

```powershell
.\scripts\install.ps1 -Gateway 'devices.axioma.internal:50051'
```

### The certificate

Every name a client dials has to be in the certificate's SANs. The chart
includes the Service DNS names, `localhost`, and `grpcIngress.host` when one is
set. Anything else — an external load balancer hostname, a NodePort address —
must be added before the first install, because the certificate is generated
once and then reused:

```yaml
api:
  grpc:
    tls:
      extraSans:
        - devices.axioma.internal
        - 10.0.0.50
```

Read the generated certificate out when you need to distribute it:

```bash
kubectl -n axioma get secret axioma-grpc-tls -o jsonpath='{.data.tls\.crt}' | base64 -d > axioma-grpc-ca.crt
```

To rotate, delete the Secret and upgrade — the chart generates a new one, and
every client that was given the old certificate has to be given the new one.

To use a certificate from your own CA instead, put it in a `kubernetes.io/tls`
Secret and set `api.grpc.tls.existingSecret`.

### What the gateway does and does not check

Verified against `api/src/server/grpc.ts` in this tree, because it changed while
this chart was being written:

- The listener presents a server certificate and does **not** request a client
  certificate.
- A device connects with either a single-use, expiring enrolment token — which
  issues it a stored credential — or the credential it was issued earlier. A
  connection with neither, with a revoked device, or with a mismatched
  credential is refused.

That is device channel authentication landing under its own phase, not
something this chart provides. Deploy against the tree you have rather than
against this paragraph: if the API in your image predates it, the gateway is
plaintext with a client-asserted device identity and must not leave a network
you control.

## Limits of this deployment

Stated because someone reading the chart will look for them.

- **Agent dispatch silently stops working past one API replica.** The agent
  holds one gRPC stream to one API pod, and `grpcGateway.hasWorker()` — the
  third condition on the auto-dispatch gate in
  `api/src/server/routers/tickets.ts` — is in-process state with no shared
  registry. A ticket created on a pod that does not hold the stream returns 200
  and starts no run, with nothing in the logs to say why. Observed directly: at
  two replicas the ticket succeeded and `agent_runs` stayed empty; at one
  replica the same ticket produced a run. Keep `api.replicaCount: 1` if you want
  runs to start.
- **The API does not scale cleanly past one replica for other reasons too.**
  Recurrence sweeps, the knowledge-gap sweep, and the mail runtime all run
  in-process on a timer with no leader election, so a second replica duplicates
  that work. Uploaded
  documents are written to local disk, so a second replica needs a
  `ReadWriteMany` volume or it will serve a different set of files. With
  `api.documents.persistence.enabled`, the chart refuses to render more than one
  replica unless the access modes include `ReadWriteMany`; without persistence
  every replica gets its own `emptyDir`, which the chart allows and the
  post-install notes call out.
- **In-flight device commands are lost if the API restarts.** Rolling the API
  Deployment drops them.
- **Axel's worker ID is not persistent by default.** Enable
  `agent.persistence` to keep it across restarts. One replica only — a shared
  volume would give every replica the same worker identity.
- **No high availability, autoscaling, backup, or disaster recovery.** Out of
  scope for this phase, in the chart and in this document.
- **`SKIP_ENV_VALIDATION` has no value in the chart.** It is read straight off
  the process environment by the API and would disable environment validation;
  if you genuinely need it, pass it through `api.extraEnv`.
