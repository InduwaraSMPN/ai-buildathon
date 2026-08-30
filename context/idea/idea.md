# Axiōma

**Document role:** Product context — what we are building and why
**Related:** [architecture.md](architecture.md) for system design and the invariants the code holds

## Naming

**Axiōma** is the platform — the whole solution, and the company.

**Axel** is the agent: the component that reads a ticket, gathers evidence, decides what to do, and does it. Axel is one reasoning surface, not a cast of characters, and which model backs it is configuration.

**axel-cli** is the binary that runs on an employee's laptop. It is Axel's reach onto a device, not a second agent — it executes typed actions it is told to execute and holds no reasoning of its own.

Prose uses `Axiōma` with the macron. Identifiers, package names, and paths use the ASCII form `axioma`.

## What Axiōma Is

An AI IT-support platform. An employee opens a ticket in a web portal. Axel reads it, works out what kind of problem it is, and routes it. It then tries to resolve the issue directly — against enterprise infrastructure, or against the employee's own laptop through axel-cli. If the fix works, the ticket closes on its own. If it does not, the ticket escalates to a human with everything Axel learned attached.

## The Problem

Employees report symptoms, not causes. "ExpenseHub is slow." "I can't sign in." "The deployment failed." Someone then has to work out which team owns it, and that person usually guesses, because the evidence needed to decide is spread across systems they cannot see.

Two costs follow. Tickets bounce between queues before anyone with the right access looks at them. And a large share of what does reach the right queue turns out to be a small, known, mechanical fix that a person had to perform by hand.

Axiōma targets the second cost first. If the fix is small and mechanical, an agent should apply it and close the ticket. The routing improves as a side effect, because deciding what to try is the same work as deciding who owns it.

## Users

| Who | What they do with it |
|---|---|
| Employee | Opens a ticket in the portal, sees progress in plain language, gets told what changed and when it is fixed |
| IT support staff | Works the dashboard: sees the queue, reads what Axel tried and why, takes over escalations |
| Platform engineer | Owns what Axel is allowed to touch, adds connectors and device actions |

## Ticket Flow

1. **Creation.** Employee logs in to the portal and opens a ticket.
2. **Routing.** The API captures the ticket and the employee's context — who they are, what device they use, what has happened before. Axel reads all of it and routes to the right system or team.
3. **Autonomous resolution.** An agent run starts. Axel gathers evidence through read tools, forms a diagnosis, and applies a fix if one is available to it.
4. **Device resolution.** If the problem is on the employee's laptop, the fix goes to axel-cli over its live connection.
5. **Escalation or closure.** A verified fix closes the ticket. Anything else escalates to the dashboard with the full transcript, the evidence, and what Axel was about to do.
6. **CMDB enrichment.** Everything observed along the way is written back to the CMDB with its source.

## How Axel Fixes A Device

Device remediation is tiered, and the order is deliberate.

1. **Typed action.** Deterministic, fast, provable. `ipconfig /flushdns` takes 200ms and you can say exactly what changed. Almost all IT remediation belongs here.
2. **Computer-use.** Driving the GUI, only when there is no programmatic path — GUI-only vendor apps, legacy config panels, one-off things nobody scripted.
3. **Escalate to a human.**

A vision model clicking through Settings is slow, non-deterministic, costs vision tokens per step, and leaves you unable to state precisely what changed. It earns its place in the tail and nowhere else. Having the capability available is not a reason to use it.

Computer-use is also **installed only where it is needed** rather than shipping with every agent, because it carries a runtime footprint the typed path does not.

## Scope

### In

- Portal: login, register, open a ticket, watch it progress, see the outcome.
- Dashboard: ticket queue, agent transcript, evidence, manual takeover, close or reassign.
- axel-cli: installs on a Windows laptop, runs in the background, holds a connection, executes typed actions, reports device state.
- API: one typed surface for the frontends, and the gateway both agents dial into.
- Axel: the run loop, tool registry, and per-ticket run history.
- Kubernetes as the first infrastructure connector, since the flagship scenario is a failing deployment.
- CMDB: a store the platform reads for context and writes observations back into.
- Three scenarios end to end, covering both resolution routes and one correct refusal.

### Out, deliberately

- **Sandboxing and blast-radius limits.** The action set is small and its contents are chosen to be safe, which is not the same as the system being safe.
- **Proactive detection.** Nothing watches for problems. Every interaction starts with a ticket the employee opened.
- **Multi-tenancy.** One organization; no `tenant_id` on any table.
- **Connectors beyond Kubernetes.** ITSM, identity, observability, endpoint management — later.

**Since delivered, and no longer out of scope.** Authorization is now real: roles carry capability keys,
every procedure names one, and deny-by-default is structural rather than conventional. Approval gates
exist too — change enablement with CAB voting, and catalogue requests that block on a manager's decision.
`architecture.md` records both, along with the invariants the implementation holds.

## Scenarios

Three, chosen to exercise different paths rather than to tell one story three ways.

**1. Failing pod deployment — infrastructure path, Axel fixes it.**
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

That is the whole bar. Not throughput, not accuracy across a broad problem space, not production readiness. One working loop, end to end, through every component.

## Open Questions

| Question | Why it matters |
|---|---|
| Which model backs Axel? | Affects tool-calling reliability and structured-output support. Provider is configuration; the agent plan sets a frontier OpenAI model as the default through LiteLLM, and switching is one environment variable. |
| How does axel-cli reach a real fleet? | Manual install works for a demo. Anything beyond needs packaging and distribution. |
| What is the CMDB seeded from? | Right now it is empty and fills from observation. A real deployment imports from an existing source of truth. |
| How much does Axel see of prior tickets? | Context improves routing and risks leaking one employee's information into another's ticket. |
| When does Axel stop trying? | There are ceilings on tool calls, model turns, and wall time. Whether those numbers are right is unvalidated. |

## Claim Discipline

Axiōma does not claim novelty for AI ticket triage, agentic remediation, remote endpoint management, or CMDB population. All four are established product categories. What is being built is a working end-to-end loop across them, in one system, that an employee can start and an agent can finish.

No performance, savings, accuracy, or production-readiness claim is supported by anything in this repository.
