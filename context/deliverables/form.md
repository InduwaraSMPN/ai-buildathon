# SUBMISSION FORM: ANSWERS

**Team Groknetic** | **Intra-University AI Build-athon** | **IMSSA** | **Project: Axiōma**

Copy each block into the matching field. Full detail lives in `../deliverables/Project Brief/Project Brief.md`, `../deliverables/AI Usage Statement/AI_Usage_Statement_Technical.md`, and `../deliverables/Limitations/Limitations.md`.

---

## 1 · Project Brief

### Problem: *What problem does your project solve?*

Employees report symptoms, not causes. "ExpenseHub is slow." "I can't sign in." "The deployment failed." Someone in IT then has to work out which team owns it, and that person usually guesses, because the evidence needed to decide sits in systems they cannot see.

Two costs follow. Tickets bounce between queues before anyone with the right access looks at them; industry data puts first-assignment misrouting at 23 to 30 percent of enterprise tickets. And a large share of what finally reaches the right queue turns out to be a small, known, mechanical fix that a person then applies by hand: a stale proxy setting, a DNS cache, a deployment pinned to an image tag that does not exist.

Underneath both sits a third problem. The CMDB that routing and remediation depend on decays. Reporting citing Gartner attributes 75 percent of CMDB failures to inaccurate or stale data, so every downstream decision inherits a silent error, however good the classifier is.

### Solution: *How does your solution solve it?*

Axiōma is an IT service management platform with an agent inside it. The agent is called Axel.

An employee opens a ticket in the portal, by email, or through a messaging channel. Axel reads it, searches the authorised knowledge base, gathers live evidence, and tries to fix the problem directly: against the infrastructure the company runs, or against the employee's own laptop through a small agent binary. A verified fix closes the ticket without a human touching it. Anything else escalates with the full transcript, the evidence, and the exact action Axel was about to take.

We target the mechanical fix first and take the routing improvement as a consequence, because deciding what to try is the same work as deciding who owns it.

Three properties make it safe enough to switch on. Axel holds no database, cluster or device credentials; every side effect is a request to the API, which executes it. Every write names the read that confirms it, and a run cannot close while that verification is outstanding. And a run cannot resolve until it has written at least one CMDB observation carrying its ticket, run, step and timestamp, so the configuration record improves as a by-product of support work.

### AI Features in Your Product: *What does AI actually do for your users?*

Three things, each in a specific place.

Axel diagnoses and fixes tickets. An LLM runs a bounded read, think, act, verify loop. It selects from twelve typed tools with validated parameters (read pod status, read a deployment, patch an image tag, read device state, run a named device action, record a CMDB observation) and the loop enforces the sequence, the ceilings and the verification. For an employee, that means a ticket that gets diagnosed, fixed and closed without a person picking it up. It also refuses. Shown pods that cannot be scheduled, it diagnoses the cause exactly and escalates instead of shrinking a CPU request, because that changes a workload's performance contract and is somebody's decision to make.

Hybrid retrieval finds the right knowledge. Before the model takes its first turn, the platform searches the knowledge base and fuses full-text and vector ranks over a pgvector index, with permissions applied in SQL before ranking.

An AI composer helps employees file a good ticket. It interviews the reporter, optionally reads an uploaded screenshot, and produces a structured draft the employee reviews before submitting.

No verdict anywhere is taken from model confidence. Authority comes from the typed action surface, the verifying read, and a human gate on anything outside it.

### Technical Brief: *Stack, architecture, and tools you used*

Six projects, each with the toolchain its job calls for, plus a Helm chart.

* `api`: TypeScript, Hono, oRPC, Better Auth, Drizzle. The oRPC surface for both frontends and the gRPC gateway both agents dial into. The only component that writes: 144 tables across 46 schema modules.
* `portal` and `dashboard`: TypeScript, TanStack Router, React 19, Tailwind 4, Vite. Employee app and IT console.
* `ui`: governed shadcn-derived primitives, mirrored verbatim into both frontends.
* `agent`: Python 3.14, uv, pydantic, LiteLLM against an OpenAI-compatible endpoint. Axel's run loop and tool registry.
* `cli`: Go 1.25, one static binary, Bubble Tea v2 for operator commands. Installs on a Windows laptop without administrator rights, runs as a logon Scheduled Task, holds an outbound gRPC stream, and executes seventeen typed actions verified by eleven diagnostic facets.
* Database: PostgreSQL with pgvector; a `vector(1536)` column behind partial HNSW indexes, fused with a weighted full-text index by reciprocal rank.
* Deployment: four Docker images and a Helm chart into the customer's own cluster.

Both agents are gRPC clients that dial out, because neither a worker nor a laptop behind NAT can be dialled directly. Three generated mirrors hold the boundaries (oRPC contracts, protobuf, and the UI primitives), each regenerated and checked in CI so they cannot drift. The first infrastructure connector is Kubernetes: reads come from structured pod status, writes are JSON Patch on an explicit path, run once with `dryRun` first, limited to a tag or digest change on the same image, and wrapped in an automatically created standard change record with a rollback plan.

Built in Qoder. Development tooling also included Context7 and Chrome DevTools over MCP, Biome, ruff, gofmt, Drizzle migrations and Tilt.

### Impact: *What impact does this have?*

The ticket class that needed a human to route it *and* a human to hand-apply a known fix now closes on its own, across both the infrastructure path and the employee's laptop. Routing improves as a side effect, against a baseline misrouting rate of 23 to 30 percent.

The CMDB improves under load instead of decaying, because a run cannot resolve without writing an observation that names where the fact came from: which ticket, which run, which step, when.

Refusal is a first-class outcome. An escalation carries the transcript, the evidence and the exact action Axel was about to take, which is what makes an automated decision reviewable. An agent that acts on everything is faster without being more trustworthy.

The work also stays inside the customer's process. Cluster writes raise a standard change record with a rollback plan; a command outside the typed action set requires a named human approver holding a capability withheld from the analysts who issue routine actions.

### Roadmap: *What's next for this project?*

**Next:** hardening for deployment. Code signing for the Windows binary, so the installer clears SmartScreen and managed-device policy. A published image registry and release pipeline on top of the Dockerfiles and chart we already have. Explicit reporting when retrieval runs in lexical-only mode. And an end-to-end exercise of the human-approved device command path against a live gateway.

**Then:** reach. A pixel-based fallback for GUI surfaces that expose no accessibility tree, such as canvas apps, remote desktop and Citrix. Connectors beyond Kubernetes: cloud consoles, virtual machines, databases. Seeding the CMDB from an existing source of truth, so the first ticket about a service is not the first thing the platform knows about it. And co-deploying inference inside the customer's perimeter, so ticket text never leaves their network.

---

## 2 · Links & Statement

### Demo Video
`FILL IN — unlisted YouTube link, 3 minutes max`
Shooting script and cut list: `../deliverables/Demo Video/Demo_Video_Script.md`

### Source Repository
```
https://github.com/InduwaraSMPN/ai-buildathon
```
*Confirm the repository is public before submitting.*

### Hosted Prototype
```
https://axioma-portal.viosu.com
```
IT console: `https://axioma-dashboard.viosu.com` · Product site: `https://axioma.viosu.com`
No sign-in required. See `../deliverables/Hosted Prototype/Hosted_Prototype.md` for what is live and what is mocked.

### WhatsApp Number
`FILL IN — +94 ...`

### Qoder Usage Statement: *How Qoder helped, start to finish, and how was the experience?*

Qoder was the development environment for all of it: six projects across four languages, plus the Helm chart.

**Start.** Repo Wiki and codebase indexing gave orientation across a workspace that is not a monorepo: six projects, four toolchains, no shared build graph. Agent mode did the bulk of implementation, including the oRPC contracts and handlers, the Drizzle schema across 144 tables, the Go daemon and its PowerShell action scripts, both frontends, and the Helm templates.

**Middle.** Quest in Experts Mode handled the vertical slices that cross every layer at once. A single device action is a schema in the API, a tool parameter in the Python agent, an enum in the proto, a dispatch case and a script in the Go binary, and a screen in the dashboard. Quest's spec-driven mode covered the two places where acceptance criteria had to exist before code: the human-approved device command path, and the change-gated cluster write. Workspace rules held the invariants as always-on context and kept Git read-only, so no commit happened without us asking for it. Two MCP servers helped throughout: Context7 for current library docs across fast-moving dependencies, and Chrome DevTools for checking rendered behaviour in a real browser instead of inferring it from the component tree.

**End.** The integrated terminal ran every project's own gates after each change, and checkpoints let us roll back generated work that failed one instead of patching over it. Both of our failed Helm migration strategies went out that way.

**The experience.** It was fastest where the work was wide and shaped: schema, contracts, plumbing, UI, and propagating one change through five files that must agree. Where correctness depended on the real machine, we did the verification ourselves, and that is where our own time went. A PowerShell facet Qoder generated measured 50 seconds on a real six-printer laptop and had to be rewritten against CIM. A value bound through `powershell.exe -Command` was silently re-split on spaces, which only running it revealed. A device action we designed and built was then deleted, because no non-admin, edition-portable read could observe its effect: `gpresult /x` does not exist on Windows Home, which we found by running it.

The pattern we settled into: let Qoder carry the volume and the boilerplate, hold the architecture and the refusals ourselves, and never accept a device-facing result that had not actually been executed. It occasionally needed re-prompting on edge cases, and it was consistently good at doing the fifth mechanical edit correctly once the first four were agreed.
