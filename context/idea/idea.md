# Axiōma

**Document role:** Product context — what we are building and why
**Related:** [architecture.md](architecture.md) for system design, [implementation.md](implementation.md) for build order and delivery

## What Axiōma Is

Axiōma is an AI IT-support platform. An employee opens a ticket in a web portal. An LLM reads it, works out what kind of problem it is, and routes it. AI agents then try to resolve it directly — against enterprise infrastructure, or against the employee's own laptop through a CLI agent installed on that machine. If the fix works, the ticket closes on its own. If it does not, the ticket escalates to a human with everything the agent learned attached.

The agent is called **Axel**. It is one reasoning surface, not a cast of characters, and which model backs it is configuration.

## The Problem

Employees report symptoms, not causes. "ExpenseHub is slow." "I can't sign in." "The deployment failed." Someone then has to work out which team owns it, and that person usually guesses, because the evidence needed to decide is spread across systems they cannot see.

Two costs follow. Tickets bounce between queues before anyone with the right access looks at them. And a large share of what does reach the right queue turns out to be a small, known, mechanical fix that a person had to perform by hand.

Axiōma targets the second cost first. If the fix is small and mechanical, an agent should apply it and close the ticket. The routing improves as a side effect, because deciding what to try is the same work as deciding who owns it.

## Users

| Who | What they do with it |
|---|---|
| Employee | Opens a ticket in the portal, sees progress in plain language, gets told what changed and when it is fixed |
| IT support staff | Works the dashboard: sees the queue, reads what Axel tried and why, takes over escalations |
| Platform / infrastructure engineer | Owns what Axel is allowed to touch, adds connectors and action templates |

## Ticket Flow

1. **Creation.** Employee logs in to the portal and opens a ticket.
2. **Routing.** The API captures the ticket and the employee's context — who they are, what device they use, what has happened before. Axel reads all of it and routes to the right system or team.
3. **Autonomous resolution.** An agent run starts. It gathers evidence through read tools, forms a diagnosis, and applies a fix if one is available to it.
4. **Device resolution.** If the problem is on the employee's laptop, the fix goes to the CLI agent running on that machine over its live connection.
5. **Escalation or closure.** A verified fix closes the ticket. Anything else escalates to the dashboard with the full agent transcript, the evidence, and what it was about to do.
6. **CMDB enrichment.** Everything observed along the way — services, dependencies, devices, what was actually true at the time — is written back to the CMDB with its source.

## Scope

### In

- Portal: login, register, open a ticket, watch it progress, see the outcome.
- Dashboard: ticket queue, agent transcript, evidence, manual takeover, close or reassign.
- CLI: installs on a Windows laptop, runs in the background, holds a connection, executes what it is told, reports device state.
- API: one typed surface that everything else speaks to.
- Agent service: the LLM loop, tool registry, and per-ticket run history.
- Connectors: Kubernetes first, since the flagship scenario is a failing deployment.
- CMDB: a store the platform reads for context and writes observations back into.
- Three scenarios end to end, covering both resolution routes and one correct refusal.

### Out, deliberately

- **Authorization and permissions.** Better Auth gives real login and register because step 1 needs identity — who filed this, whose laptop is it. Nothing checks whether a user is allowed to do a thing.
- **Safeguards on dangerous actions.** No approval gates, no sandboxing, no blast-radius limits. The action set is small and its contents are chosen to be safe, which is not the same as the system being safe.
- **Multi-tenancy.** One organization.
- **Proactive detection.** Nothing watches for problems. Every interaction starts with a ticket the employee opened.
- **Real enterprise connectors beyond Kubernetes.** ITSM, identity, observability, endpoint management — later.

The last two are worth stating plainly, because the first is what makes the CLI agent acceptable to install at all, and the second is what keeps the demo honest about what it proves.

## Scenarios

Three, chosen to exercise different paths rather than to tell the same story three ways.

**1. Failing pod deployment — infrastructure path, agent fixes it.**
A service will not come up. The pods report `ImagePullBackOff`, and the reason is a bad image tag in the deployment. Axel reads pod status, identifies the tag, verifies the intended tag resolves in the registry, patches the deployment, and watches the rollout go green. Ticket closes.

This is the flagship because the signal is unambiguous — one string on the container status, no log parsing, no guessing between causes — and the fix is a single reversible patch on one field.

**2. Laptop issue — device path, CLI fixes it.**
Something is wrong on the employee's machine. Axel reads device state through the CLI, identifies it, and runs a fix through the same connection. The result is confirmed by re-reading state, and the ticket closes.

This proves the CLI round trip, which is the part nothing else in the system can demonstrate.

**3. Unschedulable pod — infrastructure path, agent correctly refuses.**
Pods sit `Pending` with `Unschedulable` and `Insufficient cpu`. Axel diagnoses this perfectly and correctly does not act, because every available fix is a policy decision: shrinking a CPU request changes the workload's performance contract, and adding capacity is not in the API. It escalates with the scheduler's verbatim message and the patch it would have proposed.

An agent that always acts is not trustworthy, it is just fast. This case is what makes the other two mean something.

## What Success Looks Like For The MVP

An employee opens a ticket, an agent resolves it without a human touching anything, and the ticket closes — across both the infrastructure path and the device path. A third ticket escalates cleanly with its reasoning intact.

That is the whole bar. Not throughput, not accuracy across a broad problem space, not production readiness. One working loop, end to end, through every component.

## Open Questions

| Question | Why it matters |
|---|---|
| Which model backs Axel? | Affects tool-calling reliability and structured-output support. Provider is configuration; the choice is not yet made. |
| How does the CLI get installed on a real fleet? | Manual install works for a demo. Anything beyond that needs packaging and a distribution story. |
| What is the CMDB seeded from? | Right now it is empty and fills from observation. A real deployment imports from an existing source of truth. |
| How much does Axel see of prior tickets? | Context improves routing and risks leaking one employee's information into another's ticket. |
| When does an agent stop trying? | No budget or stopping rule is defined yet. Without one, a confused agent loops. |

## Claim Discipline

Axiōma does not claim novelty for AI ticket triage, agentic remediation, remote endpoint management, or CMDB population. All four are established product categories. What is being built is a working end-to-end loop across them, in one system, that an employee can start and an agent can finish.

No performance, savings, accuracy, or production-readiness claim is supported by anything in this repository.
