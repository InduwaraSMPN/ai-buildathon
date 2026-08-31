# Axiōma

**Document role:** Product context — what we are building and why
**Related:** [architecture.md](architecture.md) for system design and the invariants the code holds · [../plans/demo-plan.md](../plans/demo-plan.md) for how this is shown

## Naming

**Axiōma** is the platform — the whole solution, and the company.

**Axel** is the agent: the component that reads a ticket, gathers evidence, decides what to do, and does it. Axel is one reasoning surface, not a cast of characters, and which model backs it is configuration.

**axel-cli** is the binary that runs on an employee's laptop. It is Axel's reach onto a device, not a second agent — it executes typed actions it is told to execute and holds no reasoning of its own.

Prose uses `Axiōma` with the macron. Identifiers, package names, and paths use the ASCII form `axioma`.

## What Axiōma Is

An IT service management platform with an agent inside it. An employee opens a ticket — in the portal, by email, or through a messaging channel. Axel reads it, works out what kind of problem it is, and routes it. It then tries to resolve the issue directly: against the infrastructure the company runs, or against the employee's own laptop through axel-cli. If the fix works, the ticket closes on its own. If it does not, the ticket escalates to a human with everything Axel learned attached.

The service-management half is not a thin shell around the agent. It carries the record types, catalogue, change enablement with CAB voting, problem and known-error records, knowledge base with access control, SLA and OLA stopwatches against business-hours calendars, asset and licence inventory, a rules engine, workflows, and a CMDB with typed classes and provenance. The agent is a participant in that system rather than a bolt-on to it — it reads the same knowledge IT staff read, it opens the same change records a human would, and its work appears in the same audit trail.

## Deployment posture

Axiōma installs **inside the customer's own infrastructure**, running alongside the systems it manages, holding live outbound connections to the estate and inbound streams from employee laptops. It is not hosted by us on the customer's behalf.

One consequence is decided and load-bearing: **one stack per customer**. There is no multi-tenancy, no `tenant_id` on any table, and none should be added. That is the per-customer-stack choice made deliberately, not a deferral.

## The Problem

Employees report symptoms, not causes. "ExpenseHub is slow." "I can't sign in." "The deployment failed." Someone then has to work out which team owns it, and that person usually guesses, because the evidence needed to decide is spread across systems they cannot see.

Two costs follow. Tickets bounce between queues before anyone with the right access looks at them. And a large share of what does reach the right queue turns out to be a small, known, mechanical fix that a person had to perform by hand.

Axiōma targets the second cost first. If the fix is small and mechanical, an agent should apply it and close the ticket. The routing improves as a side effect, because deciding what to try is the same work as deciding who owns it.

## Users

| Who | What they do with it |
|---|---|
| Employee | Opens a ticket, sees progress in plain language, gets told what changed and when it is fixed |
| IT support staff | Works the dashboard: sees the queue, reads what Axel tried and why, takes over escalations, approves changes, writes knowledge |
| Platform engineer | Owns what Axel is allowed to touch, registers environments, adds connectors and device actions, authorises the commands Axel proposes |

## Ticket Flow

1. **Creation.** A ticket arrives from the portal, from email, or from a messaging channel. Origin is recorded, because a monitoring alert is not an employee claim and Axel is told which it is reading.
2. **Routing.** The API captures the ticket and the reporter's context. The rules engine may settle actions on it — including routing it straight to a human, which suppresses the agent.
3. **Autonomous resolution.** An agent run starts with reporter and CMDB context. Axel searches the authorized knowledge corpus through hybrid lexical/vector retrieval, fetches full evidence when needed, then gathers live evidence and applies a fix if one is available to it.
4. **Device resolution.** If the problem is on the employee's laptop, the fix goes to axel-cli over its live connection.
5. **Escalation or closure.** A verified fix closes the ticket with a resolution code. Anything else escalates to the dashboard with the full transcript, the evidence, and what Axel was about to do.
6. **CMDB enrichment.** A run cannot resolve until it has successfully written at least one observation with its ticket, run, step, and time provenance.

## How Axel Fixes A Device

Device remediation is tiered, and the order is deliberate.

1. **Typed action.** Deterministic, fast, provable. `ipconfig /flushdns` takes 200ms and you can say exactly what changed. Almost all IT remediation belongs here.
2. **Driving the GUI.** Only when there is no programmatic path — GUI-only vendor apps, legacy config panels, one-off things nobody scripted. Two mechanisms, and which applies is a property of the application: Windows UI Automation where it exposes an accessibility tree, pixels where it does not.
3. **Escalate to a human** — carrying, where Axel has one, an exact command it proposes running and the reason for it. Axel can name a command; it cannot run one.

The accessible path is not the thing the tiering argument used to describe. It reads a window as text — the controls present, their names, their roles, and what each one supports — and a step names one of those controls, so it is deterministic, costs roughly 1,200 tokens of structured text per look rather than thousands of vision tokens, and can state exactly which control it acted on. It is also non-admin, needs nothing installed, and takes no cursor or keyboard away from the person using the machine. What it is not is free: it takes a round trip per step where a typed action takes one, and a control name is a weaker thing to depend on than a command — an application can rename a control, re-nest it, or expose nothing at all, and then the step fails where the typed action would not. So the ordering above stands, but for a plainer reason than before. Tier two is slower and more fragile than a typed action. It is no longer more expensive and less knowable.

The pixel path is what the old argument still describes exactly. A vision model clicking through Settings is slow, non-deterministic, costs vision tokens per step, and leaves you unable to state precisely what changed. It earns its place in the tail of the tail. Having the capability available is not a reason to use it.

The pixel fallback is also **installed only where it is needed** rather than shipping with every agent, because it carries a runtime footprint neither the typed path nor UI Automation does. A device without it **refuses** rather than falling back to something else: a missing path means escalate, not improvise.

**Tier two is implemented for accessible GUIs and unimplemented for pixel-only ones.** UI Automation ships: one `screen` facet that enumerates a window's actionable controls, and five steps that each drive one control that facet reported. The facet enumerates, the step selects a name out of that enumeration, so caller input picks a key from a set the device produced — the same boundary tier one holds, rather than an exception to it. The pixel path is still an unconditional refusal: its request path exists end to end — tool, schema, proto field, prompt guidance — and the daemon refuses it on every device rather than only on those without it installed. Seventeen typed actions ship today, twelve tier-one and the five GUI steps, each paired with a diagnostic facet that observes its effect, so every fix has a read that confirms it; the API, the agent, the proto, and the binary all name the same seventeen selectable actions and the same eleven facets. The binary implements one more — tier three's approved-command action, which the model may not select.

**Tier three is no longer only a handoff.** Where no typed action and no GUI step fits, Axel may name an exact command and the reason a person should run it. The proposal is recorded and the run escalates with the diagnosis; nothing waits on the decision, because a run is measured in seconds and a person decides in hours. Someone holding `device.approve` reads that exact argument vector and approves or rejects it, and only then does the command reach the device — dispatched from what was approved rather than from anything Axel said afterwards. It is an argument vector rather than a command line, so no shell is involved and a metacharacter is an ordinary argument. The approval binds to that one vector, authorises one run of it, and expires undecided; the device is opted out unless an operator turned it on and left a marker file on the machine. The separation of duty is deliberate: the analysts who issue typed actions do not hold `device.approve`. The controls have unit coverage and have not been exercised end to end against a live gateway and a real device.

The widened typed surface, the GUI tier, and the gate on general execution have all shipped, and the device channel is authenticated. What still gates the pixel fallback, whatever the channel does, is what the spike found: `cua-computer-server` exposes no objective-submission endpoint and no reasoning loop of its own, so there is nothing to send an objective to, and implementing that reasoning in axel-cli would contradict what axel-cli is. That gate is on the pixel path alone. GUI remediation turned out not to need a driver at all.

## Scope

### In, and built

- **Portal.** Login, register, open a ticket, watch it progress, see the outcome.
- **Dashboard.** Ticket queue, agent transcript, evidence, manual takeover, close or reassign, plus administration of the service-management surfaces below.
- **Service management.** Record types and a status vocabulary whose behaviour keys off flags rather than names; service catalogue and subcategories; catalogue requests that block on a manager's decision; change enablement with CAB membership and voting; problem and known-error records; a knowledge base with folders, versions, tags, and an access-control list; SLA and OLA stopwatches against business-hours calendars with holidays; ticket audit and time entries; dynamic fields, forms, templates, views, and dashboards.
- **Authorization.** Roles carry capability keys, every procedure names one, and deny-by-default is structural rather than conventional. API keys share the same capability vocabulary, with per-key rate limits.
- **Channels.** Inbound and outbound email with threading by retained ticket reference; messaging channels and threads; notifications.
- **Directory.** HTTP directory sync importing people with job title, department, and manager chain, with a shrink safety brake that refuses a sync losing more than 40 percent of the directory.
- **Assets and inventory.** Assets, inventory, software licences, suppliers, scheduling.
- **Automation.** A rules engine over tickets with recorded firings, workflows with executions, and webhook deliveries.
- **axel-cli.** Installs on a Windows laptop without administrator rights, runs as a logon Scheduled Task, holds an outbound connection, executes typed actions, reports device state.
- **API.** One typed surface for the frontends, and the gateway both agents dial into. The only component that writes.
- **Axel.** The run loop, a registry of twelve tools, and per-ticket run history recorded as it happens.
- **Kubernetes**, as the first infrastructure connector. Cluster writes are wrapped in an automatically-created standard change record with a rollback plan and a post-change verification deadline.
- **CMDB.** Typed classes with properties and relationships, an impact walk, and provenance on every observation.

### Out, deliberately

- **Sandboxing and blast-radius limits.** The action set is small and its contents are chosen to be safe, which is not the same as the system being safe. A command that clears the approval gate is bounded by the approver's judgement rather than by the system: it runs with the logged-in user's rights, like anything else that person could have started.
- **Proactive detection.** Nothing watches for problems. Every interaction starts with a ticket someone opened.
- **Multi-tenancy.** One organization per deployment; no `tenant_id` on any table.
- **Idempotency.** Retrying a dispatched action can apply it twice.
- **Connectors beyond Kubernetes** for infrastructure — cloud consoles, virtual machines, databases. The ITSM connector is built; these are not.

### Known gaps

Not scope decisions — the distance between what the product describes and what the tree does.

| Gap | Consequence |
|---|---|
| The pixel fallback is not implemented | GUI remediation ships through UI Automation, so a surface with no accessibility tree — canvas applications, remote desktop, Citrix, some Electron — has no path at all. The daemon refuses computer-use on every device, and the blocker is not the device channel: `cua-computer-server` exposes no objective-submission endpoint to call |
| The binary is unsigned | SmartScreen warns, and managed-device policy may block the installer. Deferred pending certificate procurement, not design |
| Images are not published | Four Dockerfiles and a Helm chart exist; images are built locally and loaded into a cluster. No registry, no release pipeline, and no HA, autoscaling, backup or disaster recovery in the chart |
| Retrieval runs lexical-only until an embedding key is configured | The vector column, index and fusion are in place and unexercised. It degrades rather than failing, which is correct, and silently, which is not |

## Scenarios

Three, chosen to exercise different paths rather than to tell one story three ways.

**1. Failing deployment — infrastructure path, Axel fixes it.**
A service will not come up. Pods report `ImagePullBackOff` from a bad image tag. Axel reads pod status, identifies the tag, verifies the intended one resolves, patches the deployment, and watches the rollout go green. Ticket closes.

Flagship because the signal is unambiguous — one string on the container status, no log parsing, no guessing between causes — and the fix is a single reversible patch on one field.

**2. Laptop issue — device path, axel-cli fixes it.**
Something is wrong on the employee's machine. Axel reads device state through axel-cli, identifies it, and dispatches a typed action over the same connection. The result is confirmed by re-reading state, and the ticket closes.

This proves the device round trip, which nothing else in the system can demonstrate.

**3. Unschedulable pod — infrastructure path, Axel correctly refuses.**
Pods sit `Pending` with `Unschedulable` and `Insufficient cpu`. Axel diagnoses this perfectly and correctly does not act, because every available fix is a policy decision: shrinking a CPU request changes the workload's performance contract, and adding capacity is not in the API. It escalates with the scheduler's verbatim message and the patch it would have proposed.

An agent that always acts is not trustworthy, it is just fast. This case is what makes the other two mean something.

## What Success Looks Like

An employee opens a ticket, Axel resolves it without a human touching anything, and the ticket closes — across both the infrastructure path and the device path. A third ticket escalates cleanly with its reasoning intact.

That is the bar for the loop. It is not the bar for the product: a deployable artifact, an authenticated device channel, and more than one environment are all required before a customer can run this, and none of them are proven by the loop working on a laptop.

## Open Questions

| Question | Why it matters |
|---|---|
| Where does inference run for a customer deployment? | The agent already points at an owned OpenAI-compatible gateway, which answers "whose model" but not "whose network". If a customer's cluster calls out to it, ticket text leaves their perimeter, and the pitch says otherwise |
| What is the CMDB seeded from? | Nine classes are seeded and zero objects. It fills from observation, so the first ticket about a service has no prior belief about it. A real deployment imports from an existing source of truth |
| When does Axel stop trying? | There are ceilings on tool calls, model turns, and wall time. Whether those numbers are right is unvalidated |

One question that stood here has an answer. **What gates general execution on a device?** A person does. Axel may propose an exact command but must escalate; a holder of `device.approve` — a capability deliberately withheld from the analysts who issue typed actions — authorises that exact argument vector before anything reaches a device. The approval is single-use, expires undecided, is invalidated if the command is edited after it was given, and applies only to a device an operator opted in.

## Claim Discipline

Axiōma does not claim novelty for AI ticket triage, agentic remediation, remote endpoint management, or CMDB population. All four are established product categories. What is being built is a working end-to-end loop across them, in one system, that an employee can start and an agent can finish.

No performance, savings, accuracy, or production-readiness claim is supported by anything in this repository. Neither is any claim about data residency until the inference question above is answered.
