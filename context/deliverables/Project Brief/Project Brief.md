# PROJECT BRIEF

### Axiōma: an IT service management platform with a resolving agent inside it
**Team Groknetic** | **Intra-University AI Build-athon** | **IMSSA** | **Technical Specification**

---

## 1. Summary

Axiōma is the platform. Axel is its agent: the component that reads a ticket, gathers evidence, decides what to do, and does it.

An employee opens a ticket in the portal, by email, or through a messaging channel. Axel reads it, works out what kind of problem it is, and routes it. It then attempts the fix directly: against the infrastructure the company runs, or against the employee's own laptop through `axel-cli`. A verified fix closes the ticket on its own. Anything else escalates to a human with the full transcript, the evidence, and the action Axel was about to take.

The service-management half is a full system, not a thin shell around the agent. It has record types, a service catalogue, change enablement with CAB voting, problem and known-error records, a knowledge base with access control, SLA and OLA stopwatches against business-hours calendars, asset and licence inventory, a rules engine, workflows, and a CMDB with typed classes and provenance. Axel participates in that system instead of sitting beside it: it reads the same knowledge IT staff read, it opens the same change records a human would, and its work lands in the same audit trail.

**Deployment posture.** Axiōma installs inside the customer's own infrastructure, alongside the systems it manages, holding outbound connections to the estate and inbound streams from employee laptops. That leads to one decision the rest of the design depends on: one stack per customer. There is no multi-tenancy, no `tenant_id` on any table, and none is to be added.

---

## 2. Background and context

Large organisations run IT support as specialist queues (application support, end-user experience, server, network, cloud), each with different escalation paths, different runbooks, and different acceptable-risk thresholds for automation. This description draws on direct exposure to enterprise ITSM operations, including SAP-BASIS and Run-Apps style support environments.

Employees report symptoms, not causes. *"ExpenseHub is slow." "I can't sign in." "The deployment failed."* Someone then has to work out which team owns it, and that person usually guesses, because the evidence needed to decide sits in systems they cannot see. Two costs follow: tickets bounce between queues before anyone with the right access looks at them, and a large share of what does reach the right queue turns out to be a small, known, mechanical fix that a person performed by hand.

---

## 3. Problem statement

Three measurable failure modes, each with a distinct root cause and a distinct engineering requirement.

### 3.1 Ownership is guessed rather than determined

Industry data places first-assignment misrouting at 23 to 30 percent of enterprise tickets, and manual classification accuracy at 60 to 70 percent. Category structure drives this directly: routing accuracy falls to roughly 78 percent once a taxonomy exceeds 20 overlapping categories, against roughly 92 percent for a well-defined 8 to 15 category structure.

The engineering requirement that follows is evidence before assignment, not a better classifier. Deciding what to try and deciding who owns it are the same work, so Axiōma targets the fix first and takes the routing improvement as a consequence.

### 3.2 Mechanical fixes are performed by hand

A stale proxy override, a DNS cache that needs flushing, a deployment pinned to an image tag that does not exist: each is a known, bounded, reversible fix, and each currently costs a human ticket cycle. Axiōma targets this cost first, because it is where an agent can produce a verified outcome instead of a suggestion.

### 3.3 CMDB decay

Industry reporting citing Gartner attributes 75 percent of CMDB failures to inaccurate or stale data, and organisations spend up to 60 hours per week manually reconciling records across sources. Because routing and remediation decisions read the CMDB, decay in it propagates as silent error in every downstream decision, however accurate the model is in isolation.

The requirement is that the CMDB fills from the work itself. A run cannot resolve until it has successfully written at least one observation carrying its ticket, run, step, and timestamp.

### 3.4 Why a single confidence number is not the answer

Auto-resolution risk is not uniform. An end-user password reset has near-zero blast radius; a server or network configuration change has organisation-wide blast radius. A single confidence threshold applied across all queues therefore either under-automates the low-risk ones or over-automates the high-risk ones.

Axiōma's answer goes further than a per-queue threshold, and it is an invariant of the codebase: no verdict is taken from model confidence. Authority comes from a typed action surface, a verifying read after every write, and a human gate on anything outside that surface. Section 4 describes the mechanisms that enforce it.

---

## 4. Solution and system architecture

### 4.1 Shape

Six projects, each with the toolchain its job calls for. They are not a monorepo and share no package manager; the workspace holds them side by side the way a set of checked-out repositories would. A seventh directory, `web/`, holds the public marketing site and is not part of the platform loop.

| Project | Language | Job |
| :--- | :--- | :--- |
| `api` | TypeScript | oRPC surface for the frontends, gRPC gateways for both agents. The only component that writes. |
| `portal` | TypeScript | Employee web app: open a ticket, follow it, see the outcome. |
| `dashboard` | TypeScript | IT web app: queue, agent transcript, evidence, takeover, administration. |
| `ui` | TypeScript | Governed UI primitives, mirrored verbatim into `portal` and `dashboard`. |
| `agent` | Python | Axel: the reasoning loop, tool registry, and model client. |
| `cli` | Go | `axel-cli`: one static binary on an employee laptop. |

Each language boundary follows from a constraint. Python is where the agent ecosystem lives. Go produces a single binary with no runtime to install on a laptop, which is the constraint that dominates that component. TypeScript holds the frontends and the API because the contract between them infers end to end there and nowhere else.

### 4.2 Component map

```text
  portal ──oRPC──┐
                 ├──►  api  ──►  Kubernetes API
  dashboard ─────┘   (owns every write)
                     │   ├──►  Directory source (HTTP)
                     │   ├──►  Mail in and out
                     │   └──►  Postgres + pgvector
                     │
   agent (Axel) ◄────┤  gRPC bidirectional stream, agent dials out
   axel-cli     ◄────┘  gRPC bidirectional stream, device dials out
        │
        └─ Axel proposes ──►  Model gateway (OpenAI-compatible)
```

Both agents are gRPC clients; the API runs both servers. Neither can be dialled directly, because one is a worker on whatever network it runs on and the other is behind NAT on a laptop that sleeps. Each therefore dials out and holds one bidirectional stream down which work is pushed.

### 4.3 Axel holds no credentials

Axel has no database credentials, no cluster credentials, and no path to a device.

Every side effect is a `ToolRequest` sent to the API, which executes it and returns the result. Axel decides; the API acts and persists. Three properties follow:

* Persistence and authority live in one place: no second ORM, no duplicated schema, no question about which component wrote a row.
* A run is reproducible from its transcript, because tool name plus validated input is the whole record of what happened.
* Credentials never leave the API. Compromising the agent yields the ability to *ask* for things, not to do them.

### 4.4 Ticket flow

1. Creation. A ticket arrives from the portal, from email, or from a messaging channel. Origin is recorded, because a monitoring alert is not an employee claim and Axel is told which it is reading.
2. Capture. The API records the ticket and the reporter's context. The rules engine may settle actions on it, including routing it straight to a human, which suppresses the agent entirely.
3. Autonomous resolution. A run starts with reporter and CMDB context. Axel searches the authorised knowledge corpus, fetches full evidence where needed, gathers live evidence, and applies a fix if one is available to it.
4. Device resolution. If the problem is on the employee's laptop, the fix goes to `axel-cli` over its live connection.
5. Escalation or closure. A verified fix closes the ticket with a resolution code. Anything else escalates to the dashboard with the transcript, the evidence, and the action Axel was about to take.
6. CMDB enrichment. A run cannot resolve until it has written at least one observation with full provenance.

### 4.5 Knowledge retrieval is forced

Before the model takes its first turn, the loop issues `knowledge_search` itself with the ticket title and body as the query. The API fuses lexical and vector rank lists by reciprocal rank over a `search_documents` projection carrying a `vector(1536)` embedding beside a weighted full-text index. HNSW cosine indexes are partial, one per retrieval scope, because every vector query here carries mandatory non-vector predicates and a single whole-table index is either ignored by the planner or post-filtered.

Results are safe projections of published unrestricted articles, known errors, de-identified resolved-ticket and terminal-run outcomes, and documents linked to the current ticket. Access is applied in SQL before ranking; the projection is not the boundary. Prior tickets and runs are precedent, not authority.

### 4.6 The agent loop

A bounded loop: read, think, act, verify. The loop owns the sequence and the limits; the model owns only what to try next.

Tools are typed and registered. Axel picks a tool by name and supplies parameters validated against a pydantic schema before anything leaves the process. It does not compose commands, shell strings, or API calls. Adding a capability means adding a tool, which is a code change and a review.

| Tool | Effect | Verified by |
| :--- | :--- | :--- |
| `ticket_read_messages` | read | n/a |
| `knowledge_search` | read | n/a |
| `knowledge_fetch` | read | n/a |
| `cluster_read_pods` | read | n/a |
| `cluster_read_deployment` | read | n/a |
| `cluster_patch_image` | write | `cluster_read_deployment` |
| `device_read_state` | read | n/a |
| `device_run_action` | write | `device_read_state` |
| `device_computer_use` | write; pixel fallback, refused on every device | `device_read_state` |
| `device_propose_command` | write; writes a proposal, reaches no device | n/a |
| `cmdb_record_observation` | write | n/a |
| `cmdb_impact` | read | n/a |

Every write names the read that confirms it. A write returning success means the call was accepted, not that the problem is fixed, so after acting Axel re-reads through the named read tool, and a run cannot resolve while a verification obligation is outstanding. Two exceptions, both intended: a CMDB observation has no external state to re-read, and `device_propose_command` changes nothing on a device.

The loop is bounded. There are ceilings on tool calls (15), model turns (14), wall time (300 seconds), per-call time (60 seconds), and consecutive failures (3). Hitting any of them ends the run as `exhausted` and escalates, instead of leaving a ticket in a partial state. Unknown tools and invalid input are fed back into the transcript as observations, so the model can correct itself inside the same budget.

Terminal states carry a resolution code: `fixed`, `workaround`, `not_reproducible`, `duplicate`, `no_action_required`, or `rejected`. The list is shared with the API and asserted by a parity test.

### 4.7 Device remediation is tiered, and the order matters

**Tier one, typed action.** Deterministic and fast, and you can state exactly what changed: `ipconfig /flushdns` takes 200 milliseconds. Almost all IT remediation belongs here.

**Tier two, driving the GUI.** Only where there is no programmatic path. This runs on Windows UI Automation, driven from PowerShell like every other facet: non-admin, no new dependency, no vision model, nothing installed over the network. The `screen` facet returns one window's accessibility tree reduced to actionable controls (name, role, enabled state, and the patterns each supports) as text instead of pixels. Five actions (`gui_invoke_control`, `gui_set_control_value`, `gui_toggle_control`, `gui_select_item`, `gui_expand_control`) each drive exactly one pattern on a control `screen` has already reported, and `screen` is also the facet that verifies them. The facet enumerates; the step selects a name out of that enumeration, so caller input picks a key from a set the device produced. There are no coordinates, so no pixel drift and no resolution dependence, and there is no free-text keyboard step. Measured on real hardware with a cold PowerShell process and a 30-control cap: 3.6 seconds and 2.9KB of JSON for one browser window, against thousands of vision tokens and a set of coordinates for the same look in pixels.

**Tier three, a human gate on general execution.** Where no typed action and no GUI step fits, Axel may name an exact argument vector and the reason a person should run it. `device_propose_command` writes a row and the run escalates immediately with its diagnosis; nothing waits, because a run is measured in seconds and a person decides in hours. A holder of the `device.approve` capability reads that exact vector untruncated and approves or rejects, and only then is the command dispatched, from the stored row, outside any run, through a gateway branch the tool executor cannot reach. It is an argument vector rather than a command line, so no shell is involved and a metacharacter is an ordinary argument. A digest binds the approval to one exact vector; dispatch consumes it through a `status = 'approved'` predicate, so one approval authorises exactly one execution and a concurrent dispatch loses rather than double-running; an undecided proposal expires; `devices.execution_enabled` is false unless an operator turns it on; and the device refuses independently unless a local opt-in marker file is present. `device.approve` is granted to `platform-engineer` and withheld from `it-analyst`, so the analysts who issue routine typed actions cannot both propose and authorise.

The surface is fixed and asserted. The binary implements eighteen actions: twelve tier-one, the five GUI steps, and the approved-command action. The API schema, the agent's tool definitions, the proto enums, and the binary name the same seventeen model-selectable actions and the same eleven diagnostic facets, and a parity test asserts that agreement in both directions, including the eighteenth's absence from the model-facing enum. Every action is paired with a facet that observes its effect: an action nothing can observe cannot discharge its own verification obligation and is not added.

`axel-cli` itself is one Go binary with two modes. `axel-cli daemon` is headless and runs as a logon Scheduled Task, not a Windows service, because a service runs as LocalSystem in session 0 and cannot reach the user profile, mapped drives, or per-user applications, which is where most real laptop problems live. It also installs without administrator rights, and UI Automation needs the interactive desktop session for the same reason. `status`, `enroll`, and `doctor` are operator-facing and carry a Bubble Tea terminal UI. The device dials out, so NAT, home networks, and corporate proxies need no firewall change. Identity is a UUID minted on first run and persisted under the user profile, which is the right lifetime for "this person's laptop". Ownership is a second, separate act: the gateway issues a short claim code with the credential, `axel-cli status` prints it, and the employee types it into the portal. It is stored hashed, expires in a day, and is cleared on use, so IT never types an employee's name against a serial number.

### 4.8 Infrastructure connector: Kubernetes

The first connector, and it lives in the API because the API owns every side effect.

* Reads come from pod status rather than events wherever the signal exists there: status is structured, events are prose. `containerStatuses[].state.waiting.reason` gives `ImagePullBackOff` directly; `conditions[PodScheduled].reason` gives `Unschedulable` with the scheduler's own message.
* Writes use JSON Patch with an explicit path, not strategic merge, so a wrong assumption about the object's shape fails loudly instead of applying silently. Every write runs once with `dryRun` before running for real.
* Writes are change-gated. A patch is wrapped in an automatically created standard change record: implementation plan, test plan, rollback plan naming the previous image, and a five-minute post-change verification deadline. The verifying read completes the change; an expired deadline sweeps it to `failed` with a post-implementation review recording why.
* The write surface is one field. Only a tag or digest change on the *same* image name is permitted. Scaling, revision rollback, environment variables, probes, and configuration are all outside what Axel can change.
* Target environment is resolved server-side (ticket, then CMDB, then configured default), and the agent may only name an environment already linked to that ticket's service. Ticket text is written by whoever files the ticket and reaches the model verbatim, so letting it steer the target would let one sentence choose production. An environment in `shadow` mode refuses every write-effect tool while still recording the attempt in the transcript.
* The namespace allowlist is enforced by the API itself, not left to cluster RBAC, because the namespace on a tool call is model-supplied and the chart's per-namespace Role is inert under `kubeconfig` connection mode.

### 4.9 CMDB

Two jobs, kept separate.

As context, it is read. Before diagnosing, Axel is given what the platform already believes about the affected service and device (the newest observation per class and external id), labelled in the prompt as prior belief rather than established fact. `cmdb_impact` walks relationships breadth-first with a bounded depth.

As a record, it is written. Observations are additive: `cmdb_record_observation` always inserts a new object with its properties and relationships, validated against the class's declared properties. Accuracy is a read-time property produced by taking the newest observation per identity, never by overwriting.

Every row records where the fact came from: which ticket, which run, which step, and when. That provenance is a few columns, and it is the only part of a governed CMDB that is expensive to add later; proposal workflows, separate ownership, approval before correction, and rollback all build on top of it. The store ships with nine seeded classes and zero objects: it fills from observation, so the first ticket about a service carries no prior belief about that service.

### 4.10 The service-management surface

Built, and the reason Axel participates in the system instead of sitting beside it: record types and a status vocabulary whose behaviour keys off flags rather than names; service catalogue and subcategories; catalogue requests that block on a manager's decision; change enablement with CAB membership and voting; problem and known-error records; a knowledge base with folders, versions, tags, and an access-control list; SLA and OLA stopwatches against business-hours calendars with holidays; ticket audit and time entries; dynamic fields, forms, templates, views, and dashboards. Inbound and outbound email threads by retained ticket reference *and* resolved sender address, so a reference token alone cannot join someone else's ticket. HTTP directory sync imports people with job title, department, and manager chain, behind a safety brake that refuses any sync losing more than 40 percent of the directory.

Authorization is deny-by-default and structural. Roles carry capability keys, every procedure names one, and the base procedure builders are not exported, so a procedure cannot be written without naming a capability. A test asserts this. API keys share the same capability vocabulary, snapshotted at issue time for auditability and intersected with the owner's live capabilities at request time for authority, so revoking a role revokes every key that rode on it instead of leaving one valid until its TTL expires.

### 4.11 Data model and stack

144 tables across 46 schema modules. `agent_steps` rows are written as a run proceeds rather than at the end, so a run that hangs still shows how far it got. `agent_tool_calls` doubles as the duplicate-suppression record: a tool request is keyed by run and call id, and a repeat returns the stored result rather than executing again.

| Layer | Choice |
| :--- | :--- |
| Frontends | TanStack Router + React 19, Tailwind 4, Vite |
| Shared UI | `axioma/ui`, mirrored into both frontends |
| API | Hono, oRPC, Better Auth |
| Database | PostgreSQL with pgvector, Drizzle |
| Agent | Python 3.14, uv, pydantic, LiteLLM against an OpenAI-compatible endpoint |
| Device agent | Go 1.25, one static binary; Bubble Tea v2 for operator commands |
| Wire | gRPC for both agent boundaries |
| Deployment | Four images, a Helm chart, the customer's own cluster |

Three generated mirrors hold the boundaries: oRPC contracts from `api/src/contracts` into both frontends, `api/proto/axioma.proto` into `agent/` and `cli/`, and `ui/src/` into both frontends. Each is regenerated and checked in CI, never edited in place.

---

## 5. AI usage

### 5.1 Where the model sits

The model is one participant in a bounded loop, not the controller of it. It selects a tool name and supplies typed parameters; the loop enforces the sequence, the ceilings, and the verification obligation; the API holds every credential and performs every side effect. The run record stores which model actually answered, instead of which one was configured.

### 5.2 Model and endpoint

Inference runs against Alibaba Cloud Model Studio through its OpenAI-compatible DashScope endpoint, with Qwen3-Max as the reasoning model for the agent loop. The adapter is LiteLLM, so endpoint, model, and credentials are configuration rather than architecture. A customer pointing `agent.model.apiBase` at a gateway they operate keeps inference inside their own perimeter, and the Helm chart deploys no inference server of its own.

| Variable | Purpose |
| :--- | :--- |
| `AXIOMA_LLM_API_BASE` | OpenAI-compatible endpoint for chat completions |
| `AXIOMA_LLM_KEY` | Credential for that endpoint |
| `AXIOMA_INTAKE_MODEL` | Model that drafts a ticket in the portal's AI composer |
| `AXIOMA_INTAKE_VISION` | Whether the composer may read uploaded screenshots |
| `AXIOMA_EMBEDDING_API_BASE` / `_KEY` / `_MODEL` | Embedding endpoint, which commonly must differ from the chat endpoint because a gateway credential scoped to chat models answers `/embeddings` with a 403 |

The embedding model must return exactly 1536 values, because `search_documents.embedding` is `vector(1536)` and its HNSW index is built for that width. A vector of any other width is discarded and logged with the width that came back. Without an embedding key, retrieval degrades to lexical and reports `mode: "lexical"`; the run proceeds.

Reasoning effort is set to maximum and no temperature override is applied, because these are diagnostic and policy decisions, not generative writing. Model calls retry with exponential backoff, bounded by a per-call timeout, so a stalled provider cannot spend the whole run budget on its first attempt.

### 5.3 Structured output and the tool contract

Axel never emits free text that a downstream service parses. It emits a tool name plus parameters validated against a pydantic schema, and the schema is the contract. That makes a transcript reproducible and an unknown tool a recoverable observation instead of a crash. It also stops a ticket talking the agent into composing a command: no registered tool executes caller-supplied command text at all, and a test asserts that absence instead of assuming it.

### 5.4 AI in the employee's hands

The portal's intake composer is the one place where a model faces an employee directly. It interviews the reporter, optionally reads an uploaded screenshot, and produces a structured draft ticket the employee reviews before submitting. It is switched on by the presence of a credential: with no key configured, `/tickets/new` falls back to the plain ticket form.

### 5.5 AI in development

Qoder was the development environment used to build the system. Repo Wiki and codebase indexing gave orientation across six projects that share no build graph. Quest in Experts Mode handled the vertical slices that cross `api`, `agent`, the proto, `cli`, and `dashboard` at once. Quest's spec-driven mode covered the two paths where acceptance criteria had to exist before code: the human-approved device command and the change-gated cluster write. Workspace rules held the invariants and kept Git read-only, and two MCP servers supplied current library documentation and drove both frontends in a real browser. The accompanying AI Usage Statement has the full detail: which feature did which work, what was generated against team specification, and how it was verified.

---

## 6. Evaluation plan

### 6.1 Demo scenarios

Three, chosen to exercise different paths rather than to tell one story three times.

**1. Failing deployment, infrastructure path, Axel fixes it.** A service will not come up; pods report `ImagePullBackOff` from a bad image tag. Axel reads pod status, identifies the tag, verifies the intended one resolves, patches the deployment, and watches the rollout go green. The ticket closes. This is the flagship scenario because the signal is unambiguous (one string on the container status, no log parsing, no guessing between causes) and the fix is a single reversible patch on one field.

**2. Laptop issue, device path, `axel-cli` fixes it.** A stale per-user proxy override breaks connectivity. Axel reads device state through `axel-cli`, dispatches `clear_proxy_override`, and confirms the result by re-reading the `proxy` facet. This proves the device round trip, which nothing else in the system can demonstrate.

**3. Unschedulable pod, infrastructure path, Axel correctly refuses.** Pods sit `Pending` with `Unschedulable` and `Insufficient cpu`. Axel diagnoses it exactly and does not act, because every available fix is a policy decision: shrinking a CPU request changes the workload's performance contract, and adding capacity is not in the API. It escalates with the scheduler's verbatim message and the patch it would have proposed. An agent that acts on everything is faster without being more trustworthy, and this scenario is what gives the other two their meaning.

### 6.2 Metrics and targets

Targets for the demo, not measured claims about production behaviour.

| Metric | Definition | Target |
| :--- | :--- | :--- |
| Routing accuracy | Correct owning queue against a labelled ticket set | ≥ 85% |
| Ambiguous-case accuracy | Routing accuracy restricted to the ambiguous subset | ≥ 70% |
| Escalation precision | Of escalated tickets, the share a human reviewer agrees required escalation | ≥ 90% |
| Auto-resolve safety | Of auto-resolved tickets, the share with no reviewer-flagged risk | 100% (zero tolerance) |
| CMDB observation provenance | Share of resolving runs carrying at least one observation with ticket, run, step, and time | 100% (enforced by the resolution gate) |
| Verification discharge | Share of writes followed by their named verifying read | 100% (enforced by the loop) |

The last two are structural rather than statistical: the loop rejects a resolution attempted with a verification outstanding or without a successful CMDB observation, twice, before the run escalates.

Where agreement with human decisions is measured, it is reported three ways at once and never pooled. Axel's action distribution is imbalanced by design, so raw percentage agreement flatters a system that always says the common thing, while Cohen's kappa fails in the other direction under the kappa paradox. Raw agreement, kappa, and Gwet's AC1 are reported together and stratified by action class.

### 6.3 Gates

CI runs, per project, in this order:

| Project | Commands |
| :--- | :--- |
| `api` | `pnpm check` · `check-types` · `db:migrate` · `test` · `build` |
| `portal`, `dashboard` | `pnpm check` · `validate` · `build` · `check-types` |
| `ui` | `node scripts/publish-ui.mjs --check` |
| `web` | `pnpm check` · `build` · `check-types` · `audit-figures` |
| `agent` | `uv run ruff check` · `uv run pytest` |
| `cli` | `gofmt -l` · `go vet` · `go test` · `go build` |
| contracts | `pnpm --dir api contracts:check` |

`cli` regenerates protobuf bindings and then asserts `git diff --exit-code -- internal/pb`, so a proto change that was not published fails the build instead of drifting. `pnpm db:check` validates the migration ledger against a clean replay. A read-only local end-to-end verifier records every test-plan scenario as `ran`, `skipped`, or `failed` and always writes timestamped JSON and Markdown evidence.

---

## 7. Expected impact

* The mechanical fix stops costing a human cycle. Where a typed action exists, the ticket is diagnosed, fixed, verified, and closed without anyone touching it, on both the infrastructure path and the device path.
* Routing improves as a side effect of resolution, because deciding what to try is the same work as deciding who owns it. The baseline misrouting rate is 23 to 30 percent.
* The CMDB improves under load. Every resolving run writes at least one observation with full provenance, which targets the 75 percent stale-data failure attribution directly.
* Refusal is a first-class outcome. An escalation carries the transcript, the evidence, and the exact action Axel was about to take, which is what makes an automated decision reviewable and not merely fast.
* Authority is auditable. Cluster writes are wrapped in a standard change record with a rollback plan; device commands outside the typed surface require a named human approver holding a capability withheld from the analysts who issue routine actions.

No performance, savings, accuracy, or production-readiness claim beyond the demo targets in Section 6.2 is supported by this repository, and none is made.

---

## 8. Roadmap

### Phase 1: the loop (Build-athon scope)
* Ticket intake across portal, email, and messaging, with origin recorded.
* Forced knowledge retrieval fusing lexical and vector ranks.
* Bounded agent loop with twelve typed tools, verification obligations, and a CMDB resolution gate.
* Kubernetes connector: pod and deployment reads, change-gated single-field image patch, `dryRun` first.
* Device path: seventeen model-selectable actions and eleven facets over an authenticated outbound gRPC stream, plus the human-gated command proposal.
* Dashboard transcript, evidence, and manual takeover; portal progress in plain language.

### Phase 2: closing the known gaps
* Sign the binary. SmartScreen warns and managed-device policy may block the installer. This is pending certificate procurement, not design.
* Publish images and a release pipeline. Four Dockerfiles and a Helm chart exist; images are built locally and loaded into a cluster today, and the chart carries no HA, autoscaling, backup, or disaster recovery.
* Make lexical-only retrieval loud. The vector column, index, and fusion are in place and degrade correctly without an embedding key, but they do it silently, which is not correct.
* Exercise the device approval path end to end against a live gateway and a real device. Coverage is unit-level today.

### Phase 3: reach
* The pixel fallback, for surfaces UI Automation cannot see: canvas applications, remote desktop, Citrix, some Electron. This is blocked on a finding rather than on effort. `cua-computer-server` exposes no objective-submission endpoint and no server-side reasoning loop, and putting that reasoning into `axel-cli` would contradict what `axel-cli` is. Until then the daemon refuses computer-use on every device, because a missing path means escalate, not improvise.
* Connectors beyond Kubernetes: cloud consoles, virtual machines, databases.
* CMDB seeding from an existing source of truth, so the first ticket about a service is not the first thing the platform knows about it.
* Inference inside the customer perimeter, co-deploying a model server instead of defaulting to an outbound gateway.

---

## 9. Scope boundaries

These are decisions, not omissions.

| Out of scope | Why |
| :--- | :--- |
| Sandboxing and blast-radius limits | The action set is small and its contents are chosen to be safe, which is not the same as the system being safe. An approved command runs with the logged-in user's rights, like anything else that person could have started. |
| Proactive detection | Nothing watches for problems. Every interaction starts with a ticket someone opened. |
| Multi-tenancy | One organisation per deployment. Decided against, not deferred. |
| Idempotency | Retrying a dispatched action can apply it twice. |
| Wholesale ticket migration | Retention obligations name no service-desk ticket class, so migration buys little and costs a great deal. Co-existence with a phased cutover is the honest shape. |

**Claim discipline.** Axiōma does not claim novelty for AI ticket triage, agentic remediation, remote endpoint management, or CMDB population. All four are established product categories. What is built is a working end-to-end loop across them, in one system, that an employee can start and an agent can finish.

---

## 10. Deliverables

| Item | Where |
| :--- | :--- |
| Source repository | `https://github.com/InduwaraSMPN/ai-buildathon` |
| Demo video | Walkthrough of the three scenarios in Section 6.1 |
| Hosted prototype | Portal and dashboard, with the demo namespace seeded |
| AI Usage Statement | Accompanying document: Qoder usage, component by component |
