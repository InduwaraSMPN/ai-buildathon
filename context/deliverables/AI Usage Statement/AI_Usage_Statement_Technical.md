# AI USAGE STATEMENT

**Team Groknetic** | **Intra-University AI Build-athon** | **IMSSA** | **Technical Detail**

---

## 1. Tools and scope

Qoder was the development environment for the whole of Axiōma: six projects across four languages, plus the Helm chart that installs them.

| Project | Language | What Qoder was used on |
| :--- | :--- | :--- |
| `api` | TypeScript | oRPC procedures and zod contracts, Drizzle schema and migrations, the two gRPC gateways, connectors |
| `agent` | Python | Axel's run loop, the typed tool registry, the LiteLLM model client |
| `cli` | Go | The daemon, the typed action and facet dispatch, the PowerShell scripts each action runs |
| `portal` | TypeScript | Employee ticket flow, progress views, device claim, the AI intake composer |
| `dashboard` | TypeScript | Queue, agent transcript, evidence, takeover, and the administration surfaces |
| `ui` | TypeScript | Governed primitives and the mirroring script that publishes them into both frontends |
| `deploy` | Helm, YAML | Chart templates, values, and the migration Job |

Inference for Axel and for the portal's intake composer runs against Alibaba Cloud Model Studio through its OpenAI-compatible DashScope endpoint, with Qwen3-Max as the reasoning model. That is a runtime dependency of the product and is separate from the development-time use of Qoder described here.

---

## 2. Qoder features and where each one was used

| Qoder feature | Where it was used in this build |
| :--- | :--- |
| Repo Wiki | Orientation across a workspace that is not a monorepo. Six projects, four toolchains, no shared package manager, and three generated mirrors between them. Repo Wiki's structured view of project structure and module interaction made cross-project work tractable without a single build graph to walk. |
| Real-time codebase indexing | Keeping answers accurate across 144 tables in 46 schema modules and a 46-procedure contract surface. Index freshness matters most on the mirrored files, where the same content exists in three checked-out places. |
| Agentic Chat, Ask mode | Read-only questions during design: tracing a request path, locating a call site, checking whether a decision already had a precedent in the tree. Used where no edit was wanted. |
| Agentic Chat, Agent mode | The bulk of implementation. Autonomous edits with tool use, to-do list generation on multi-file goals, and direct terminal control to run the project's own gates after each change. |
| Quest, Agent Mode | Single-track features with one clear goal and a verifiable end state: an oRPC procedure with its contract and handler, a device facet with its script, a chart template. |
| Quest, Experts Mode | The vertical slices that cross every layer at once. A device action is a schema in `api`, a tool parameter in `agent`, an enum in the proto, a dispatch case and a PowerShell script in `cli`, and a screen in `dashboard`. The Team Lead / Frontend / Backend / QA / Code Review split matches that shape, and parallel expert work is why the parity test between those five surfaces was written alongside them instead of after. |
| Quest, spec-driven development | The parts where acceptance criteria had to exist before code: the human-approval path for device commands (digest binding, single-use consumption, expiry, per-device opt-in), and the change-gated Kubernetes write. Each control is a refusal with a named test, which is the traceable requirement/acceptance shape the Spec toggle produces. |
| Terminal and Sandbox | Running the per-project gates in place (`pnpm check`, `pytest`, `go vet`, `gofmt`, `drizzle` migrations) and running the PowerShell facet scripts against a real Windows session, which is where the timing findings in Section 3.3 came from. Risky commands stayed behind confirmation; nothing in the device path was accepted on a generated result alone. |
| MCP integration | Two servers, configured in `.mcp.json` at the workspace root. context7 for current library documentation: TanStack Router, Drizzle, oRPC, LiteLLM, Bubble Tea v2, and pgvector all moved during the build, and a stale API shape is expensive across three mirrored copies. chrome-devtools for driving the portal and dashboard in a real browser, to confirm rendered behaviour instead of inferring it from the component tree. |
| Custom rules | Workspace rules held in `.agents/rules/` and `.claude/rules/rules.md`, loaded as always-on context: PowerShell-compatible commands only, `rg` preferred for search, no Unix-only command forms, and read-only Git. Inspection commands are allowed; no staging, commit, push, merge, reset, tag, or GitHub mutation happens without explicit approval. A further rule requires library documentation to be pulled through Context7 instead of answered from memory. |
| Context references (`@`) | Pointing a task at the exact files that constrain it (the proto beside the Go dispatch table, the contract beside its handler, a rule file beside the task that must obey it) instead of relying on retrieval to find them. |
| Memory | Carrying decisions across sessions that are cheap to break by accident: that behaviour never keys off a status name, that the contract package may import nothing but `@orpc/contract` and `zod`, and that the base oRPC procedure builders stay unexported. |
| Next Edit Suggestion | Mechanical propagation. Adding one device action touches a schema, a proto enum, a Go case, a dispatch table entry and a test fixture in the same shape each time. |
| Inline Chat | Local, bounded rewrites where opening a full agent task would have been heavier than the change: a single SQL predicate, one zod refinement, one error branch. |
| Checkpoints and History | Reverting generated changes that failed a gate instead of patching over them, and auditing what an agent actually did on the multi-file tasks. Both Helm migration strategies described in Section 3.6 were rolled back this way. |
| Read-only code review subagent | Reviewing diffs without the ability to modify code, used on the boundary-holding files where a well-intentioned edit is the risk: the tool registry, the gateway dispatch, the capability middleware. |
| Test execution subagent | Running the gate suites and analysing failures, particularly the parity tests that assert agreement between the API schema, the agent tool definitions, the proto enums and the Go binary in both directions. |
| Security review subagent | Focused passes on authentication, authorization, injection and sensitive-information leakage, on the surfaces where this system's risk sits: the two authenticated gRPC channels, the capability model and API key intersection, the same-site middleware ahead of cookie-bearing writes, and the device command approval path. |
| Web search | Checking current external behaviour that documentation alone does not settle: Windows UI Automation pattern support, Kubernetes status field shapes, and the state of `cua-computer-server`. |

---

## 3. Qoder usage by component

### 3.1 `api`, the only component that writes

* Qoder generated the oRPC contract declarations in `api/src/contracts` and their matching handlers in `api/src/server`. The team fixed the constraint that makes those contracts safe to mirror: the contract package may import nothing but `@orpc/contract` and `zod`. Qoder worked inside it, with that constraint held as a rule instead of restated per task.
* Qoder generated the Drizzle schema across 46 modules and 144 tables, and the migration files that follow from it. The team specified the shapes that carry design decisions: `state_type` / `is_closed` / `pauses_sla` flags on `ticket_statuses` so behaviour never keys off a status name, `accumulated_ms` and `pending_ms` on `ticket_stopwatches` so a pause is expressible where a stored deadline could not express one, and `merged_into_id` and `snoozed_until` as columns rather than statuses.
* Qoder implemented the two gRPC gateways against `api/proto/axioma.proto`. The team specified that both remote sides dial in and hold one bidirectional stream, because neither a worker nor a laptop behind NAT can be dialled directly.
* Qoder generated the Kubernetes connector's read paths and the JSON Patch write path. The team specified the constraints: read from pod status rather than events, `op: replace` on an explicit path rather than strategic merge, a `dryRun` pass before every real write, and a write surface narrowed to a tag or digest change on the same image name.
* Qoder implemented the capability model and the API key intersection rule, and the security review subagent was run over it. The team specified that the base procedure builders stay unexported so a procedure cannot be written without naming a capability, and asked for the test that asserts it.

### 3.2 `agent`, Axel

* Qoder generated the run loop skeleton, the LiteLLM client, and the retry and reconnect machinery. The team set the ceilings and the reasons behind each of them, including the specific finding that a tool-call ceiling of 8 cut an infrastructure run off one call short of resolving, and that 11 ended an endpoint run on the turn ceiling after the fix had already been applied and before anything was recorded.
* Qoder implemented the twelve tool schemas as pydantic models. The team specified the property that shapes the registry: every write names the read that confirms it, and a run cannot resolve while a verification obligation is outstanding. The two exceptions (a CMDB observation has no external state to re-read, and a command proposal touches no device) are team decisions Qoder was told to encode, not inferences it drew.
* Qoder wrote the forced-retrieval step. The team specified that it is forced rather than offered, and that prior tickets and runs enter the prompt as precedent rather than authority.
* Qoder wrote the prompt assembly. The team specified that CMDB context is labelled as prior belief rather than established fact, and that no verdict is taken from model confidence anywhere in the loop.

### 3.3 `cli`, axel-cli

* Qoder generated the Go daemon: the outbound gRPC client, the ping-and-backoff liveness handling, the replay-on-reconnect sequence, and the typed dispatch table.
* Qoder generated the PowerShell scripts behind the twelve tier-one actions and the eleven diagnostic facets, and the five UI Automation steps that make up the GUI tier.
* The team specified the boundary those scripts hold: the gateway sends an action name and typed parameters, the argument list for each action is written out in the binary, and no command string crosses on the model's authority. `restart_user_process` accepts only allowlisted process names. The `screen` facet enumerates a window's actionable controls and a GUI step selects one by name out of that enumeration, so caller input picks a key from a set the device produced.
* Several of these were corrected against real hardware, run through Qoder's terminal instead of reasoned about, and the corrections are recorded in the tree:
  * A `Get-Printer` facet piped into `Get-PrintJob` per printer measured 50 seconds on a six-printer laptop, and eight separate `Get-Process -Name` lookups measured 25 seconds, both against a 30-second budget. Rewritten against CIM and a single process query they measure 3 seconds and under 1.
  * A caller value bound through `powershell.exe -Command "& { param($x) ... }"` is silently re-split on spaces, and control and window names are full of spaces. Values now reach the script through the environment, where they cannot be parsed as code. Found by executing it, not by reading it.
  * The `screen` facet at 21 seconds was traced to uncached UI Automation property reads, each a separate call into the target process; a cached request brought the same look to 3.6 seconds.
  * `refresh_user_policy` was designed, built, and then removed, because no non-admin, edition-portable read observes a user Group Policy refresh: `gpresult /x` does not exist on Home editions, verified by running it and reading back `Invalid argument/option - '/x'`. An action nothing can observe cannot discharge its verification obligation, so it is not in the surface.

### 3.4 `portal` and `dashboard`

* Qoder generated the TanStack Router route trees, the ticket flows, the queue and transcript views, and the administration screens, with router and Tailwind 4 API details pulled through the Context7 MCP server instead of recalled.
* Qoder implemented the AI intake composer against the API, including the multi-turn interview, optional screenshot input, and the draft the employee reviews before submitting.
* Rendered behaviour was confirmed by driving both apps through the chrome-devtools MCP server, with real navigation and real network calls, instead of inferring it from the component tree.
* The team specified the portal's data boundary and its mechanism: `getMyTicket` filters visibility in SQL *and* omits the field from its contract type, because a page that renders nothing sensitive while fetching it is still a leak. A client-side filter as the mechanism was rejected.
* The team specified the device claim flow: the daemon cannot know who is sitting at the machine, so ownership is a separate act. A short claim code, stored hashed, expiring in a day, cleared on use, typed in by the employee.

### 3.5 `ui`

* Qoder produced the governed primitives and the `publish-ui.mjs` mirroring script with its `--check` mode for CI. The team set the discipline: edit the source, run the publish, never touch a copy, and note every intentional divergence from the upstream shadcn primitive as an inline comment so a future re-vendor cannot revert it silently. That discipline is one of the rules held as always-on context, because it is the kind of thing an agent editing a mirrored copy would otherwise violate reasonably.

### 3.6 `deploy`

* Qoder generated the chart templates, the values files, and the four Dockerfiles.
* The migration strategy is a team decision Qoder implemented after two generated approaches failed on inspection and were rolled back through checkpoints: a `pre-install` hook runs before the release's own resources exist and deadlocks against the bundled Postgres on a clean install, and a `post-install` hook runs after `--wait` has already given up on pods waiting for the schema. The shipped form is a plain Job as the only writer, with an init container on every API pod that blocks until the migration count in `drizzle.__drizzle_migrations` reaches the number of journal entries baked into its own image.
* The team specified that a bundled Postgres with its password in an `existingSecret` is refused at template time, because the chart cannot read that password and therefore cannot compose a DSN, and a broken release later is worse than a failed render now.

---

## 4. Division between team-directed design and tool-assisted implementation

| Decision | Origin |
| :--- | :--- |
| Axel holds no database, cluster, or device credentials; every side effect is a request to the API | Team, from direct ITSM operational exposure |
| Every write names the read that confirms it, and a run cannot resolve with a verification outstanding | Team |
| No verdict is taken from model confidence | Team |
| Tiered device remediation: typed action, then UI Automation, then a human-approved command | Team |
| A device action nothing can observe is not added to the surface | Team |
| `device.approve` withheld from the analysts who issue typed actions | Team, separation of duty |
| Behaviour never keys off a status name; status is data | Team |
| Elapsed working time in stopwatches, never stored deadlines | Team |
| One stack per customer, no `tenant_id` on any table | Team |
| Contract-first mirroring across oRPC, protobuf, and UI primitives | Team |
| oRPC procedures, Drizzle schema and migrations, gateway plumbing | Qoder Agent mode against team specification |
| Kubernetes read and patch paths, change-record wrapping | Qoder Quest, spec-driven |
| Device command approval path: digest, single-use consumption, expiry, opt-in | Qoder Quest, spec-driven, against team-written acceptance criteria |
| Cross-layer device actions spanning `api`, `agent`, proto, `cli`, `dashboard` | Qoder Quest, Experts Mode |
| Go daemon, PowerShell action and facet scripts, GUI steps | Qoder Agent mode, corrected against real hardware through the integrated terminal |
| Both frontends, the intake composer, the administration surfaces | Qoder Agent mode, verified in a real browser through the chrome-devtools MCP server |
| Helm chart and Dockerfiles | Qoder Agent mode; migration strategy specified by the team after two rollbacks |

The architecture is defined by what Axel may not hold, may not compose, and may not decide alone, and those constraints came from the team. Qoder's role was to implement them precisely and to carry the volume of surface area that follows: 144 tables, six projects, four languages, and the three generated mirrors that hold the boundaries between them.

---

## 5. What Qoder did not originate

Recorded because the distinction matters more than the volume of generated code.

* The invariants. Each one in the architecture document is a decision that is cheap to break by accident and expensive to restore. They were argued by the team, then written into rules and memory so they survive a session boundary instead of being restated per prompt.
* The refusal scenario. Demonstrating that Axel correctly declines to shrink a CPU request, because that changes the workload's performance contract, is a product decision about what trustworthy automation looks like. An agent that acts on everything is faster without being more trustworthy.
* The findings from running things. The printer facet at 50 seconds, the PowerShell re-splitting of values on spaces, the uncached UI Automation property reads at 21 seconds, `gpresult /x` on Home editions, and the two Helm hook deadlocks were all found by executing code on real machines and reading what came back.
* The cua spike conclusion. The pixel fallback is unimplemented because `cua-computer-server` exposes no objective-submission endpoint and no server-side reasoning loop, so the contract the design assumed does not exist to call. Implementing that reasoning inside `axel-cli` would contradict the rule that `axel-cli` holds none. That is a team judgement recorded in `cli/docs/cua-spike.md`, and it is why the daemon refuses computer-use unconditionally instead of degrading to something else.
* The known gaps. The unsigned binary, the unpublished images, and the silently lexical retrieval are stated in the project documentation as gaps rather than hidden as features.

---

## 6. Verification

* Every generated change passed the project's own gates before merge, run through Qoder's integrated terminal. `api`: `pnpm check`, `check-types`, `db:migrate`, `test`, `build`. `portal` and `dashboard`: `check`, `validate`, `build`, `check-types`. `agent`: `ruff` and `pytest`. `cli`: `gofmt`, `go vet`, `go test`, `go build`. `ui`: the mirror freshness check. Contracts: `contracts:check`.
* Drift is caught mechanically rather than by review. `cli` regenerates its protobuf bindings and asserts `git diff --exit-code -- internal/pb`, so a proto change that was not published fails the build. `pnpm db:check` replays the migration ledger from clean. A parity test asserts that the API schema, the agent's tool definitions, the proto enums, and the Go binary name the same seventeen model-selectable actions and the same eleven facets, in both directions, including the absence of the eighteenth action from the model-facing enum.
* The security-relevant refusals each have a test, rather than being assumed from the code's shape: that no registered tool executes caller-supplied command text; that a procedure cannot be written without naming a capability; that every declared contract procedure is actually mounted; that an approval digest binds to one exact argument vector; and that dispatch consumes an approval through a `status = 'approved'` predicate so a concurrent dispatch loses rather than double-running.
* Device scripts were measured on real hardware, not on fixtures, and two facets were rewritten as a result. A live test drives a real Notepad window through the Go dispatch path (read the `screen` facet, set a control value, read again, confirm the facet saw the change) behind an environment variable, because it drives a real window.
* End-to-end evidence is recorded rather than asserted. A read-only verifier runs the test plan against a live local stack and writes timestamped JSON and Markdown, marking every scenario `ran`, `skipped`, or `failed`, with skips failing the run by default.
* Git stayed under human control throughout. An always-on rule restricts the agent to read-only Git and GitHub operations: inspection is free, and staging, committing, pushing, merging, resetting, tagging, and every GitHub mutation require explicit approval. Where a commit was needed, the agent produced the command and the message for a person to run.
* No customer or employer data was used. All ticket content, knowledge articles, and CMDB objects used in development, testing, and the demo are synthetic. The seeded demo scenarios are a Kubernetes namespace with two deliberately broken deployments and a stale per-user proxy override written onto the demo machine. No content originates from any employer's proprietary systems.
