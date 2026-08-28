# Axiōma

**Document role:** Canonical product and idea context  
**Status:** User-confirmed submitted concept; implementation is conditionally authorized  
**Product name:** Axiōma (name and trademark availability not checked)  
**Decision date:** 2026-08-28  
**Track:** 06 - Enterprise Customer Support  
**Evidence cutoff and access date:** 2026-08-28

## Canonical Status

Axiōma is the sole canonical idea for this project, superseding all earlier internal candidates and recommendations.

### Naming

**Axiōma** is the product. **Axel** is its supervisor, the single model-powered reasoning surface that plans reads, compares evidence, and drafts proposals. Axel is a role, not a model: which provider and model back it is deployment configuration.

Axel is the only named component in the system, and the name carries no authority with it. The authority matrix grants Axel nothing, and the five evidence-class probes are deliberately left unnamed so that nothing in the product reads as a cast of agents.

Prose uses `Axiōma` with the macron. Identifiers, package names, file paths, environment variables, and registry keys use the ASCII form `axioma` or `AXIOMA`, so that nothing depends on a non-ASCII character surviving a shell, a filesystem, or a config parser.

Product decisions belong here. Technical design belongs in [architecture.md](architecture.md), and execution details, testing, fixtures, and delivery planning belong in [implementation.md](implementation.md).

## One-Line Pitch

**Axiōma is a proof-carrying action substrate for AI agents that change enterprise state: every consequential write is tested in a sandbox first, bound to an exact immutable approval snapshot, executed at most once, and confirmed by an independent read rather than by the tool's own response. Its first proof is ambiguous employee IT support, where Axel, its model supervisor, turns a symptom into cross-domain claim-level evidence and the substrate carries that evidence through a discriminating test, an exact approval, independent verification, governed configuration learning, and a replayable regression.**

## Positioning

Two things are being built here, and they are worth naming separately because they have different lifespans.

**The substrate is the product.** The proof-carrying action loop — sandbox the smallest change, bind approval to an exact immutable snapshot, execute idempotently, verify by independent read, invalidate on any relevant change — is not specific to IT support. It applies wherever a model proposes a change to a system of record: provisioning, deployment, finance operations, data pipelines, configuration. The problem it addresses is the one every organization deploying agents meets immediately, which is deciding what an agent may change and how anyone knows afterwards that the change was correct.

**The IT support incident is the first proof.** Ambiguous employee incidents are a good first domain because they are genuinely cross-domain, the evidence really is fragmented and sometimes contradictory, the correct fix really is small, and the cost of a wrong or unverified action is visible without being catastrophic. The domain exercises every part of the substrate under conditions where a mistake is recoverable.

This ordering matters for how the work is judged and where it goes next. As an IT service management product, Axiōma competes with mature suites on their own ground and its differentiation is a hypothesis about workflow bindings. As a substrate, it addresses a problem that is newly urgent and not well served, and the IT support loop becomes a worked demonstration rather than the entire claim.

Neither framing changes the architecture. The records, bindings, state machine, and verification semantics are identical either way, which is what makes the substrate reusable rather than an abstraction invented after the fact.

## Substrate Contract

The substrate is defined by seven obligations. A system either meets them or it does not, and the demonstration is built to make each one visible.

| Obligation | Meaning | Failure it prevents |
|---|---|---|
| Proposal is not authority | Model output is untrusted proposed data and cannot create consent, grant a role, approve an operation, perform a write, or determine a verdict | An agent talking itself into an action |
| Smallest discriminating change | The proposed change is the minimum one that distinguishes the competing explanations | Broad speculative remediation |
| Sandbox before approval | The change runs against a pinned snapshot with an ordered check set, including a control that must remain unaffected | Approving a fix whose blast radius is unknown |
| Exact-snapshot approval | The grant binds the case, evidence, proposal, target, parameters, before/after/inverse state, sandbox run, check set, role, expiry, and nonce | A generic approval being spent on a different action than the one reviewed |
| At-most-once execution | One idempotency key yields at most one backend effect; an unknown outcome is reconciled by key before any retry | A duplicate write after a timeout |
| Independent verification | Outcome is established by a read on a separate path, never by the action's own response | A successful call being mistaken for a successful change |
| Live invalidation | Any relevant change to the facts supersedes a pending approval and a completed verification alike | Acting on, or closing against, a stale basis |

Every obligation is enforced by deterministic code and asserted by tests. None depends on model cooperation, model confidence, or an LLM acting as judge.

## Substrate Kernel And Extensions

The substrate has a small kernel. Everything else is an extension built on it, and each extension is separable.

**Kernel:** evidence with provenance and freshness, a bounded proposal, a sandbox run, an exact approval grant, an idempotent action gateway, an independent verification, and an append-only ledger with content digests. This is the loop, and it is what a second domain would reuse unchanged.

**Extensions:** cross-channel intake continuity, consented diagnostic collection, employee confirmation as a second closure requirement, governed CMDB drift correction, and incident-derived regression artifacts. Each adds a distinct capability to the kernel; none is required for the kernel to be correct.

Stating the split explicitly keeps the record count from reading as irreducible complexity. It also sets the order of proof: the kernel is demonstrated end to end before any extension is built on top of it.

## Submitted Background

The submitted concept describes an enterprise IT organization divided among Application Support, End User Experience (EUX), Server, Network, and Cloud teams. Employees usually report symptoms rather than infrastructure causes and often cannot identify the failing layer. Minimal or ambiguous requests can therefore bounce between queues while useful evidence remains fragmented across specialist tools and while the configuration management database (CMDB) may be stale.

The submission proposes coordinated cross-domain diagnosis, bounded sandbox investigation, a future consented endpoint capability, and a governed path from verified incident evidence to a proposed CMDB correction. These are the user's problem framing and design inputs. They are not presented as audited market prevalence, completed customer discovery, production incidents, or proven vendor-performance findings.

Official vendor documentation shows that the component categories are already active and often mature:

- ITSM suites document AI triage, virtual agents, workflow automation, swarming, approvals, discovery, service mapping, and CMDB reconciliation.
- Observability and AIOps products document telemetry correlation, topology, root-cause assistance, anomaly detection, and proactive incident workflows.
- Endpoint, DEX, and remote-support products document scripts, remediation, permissions, audit trails, and post-action status in different combinations.
- Discovery and service-mapping products cover logical application dependencies, not only physical assets.
- Employee-support vendors already describe conversational intake and automated resolution.

Axiōma therefore does not claim novelty for any isolated component. Its proposed boundary is the integrated **Proof-Carrying Resolution Loop**, an evidence-and-assurance layer across existing ITSM, observability, CMDB, change, and endpoint systems.

## Problem And Objectives

### Problem

Ambiguous employee incidents create a coordination problem rather than merely a classification problem. A route selected before evidence is gathered can cause blind transfers. A suggested fix without an exact evidence and approval basis can become unsafe. A successful tool response can be mistaken for restoration. Verified incident behavior can reveal stale configuration knowledge, but silently converting that observation into authoritative CMDB truth creates a second governance risk. Finally, a resolved incident often fails to become a reusable regression against recurrence.

### Product Objectives

1. Reduce blind queue transfers by testing cross-domain hypotheses before assigning ownership.
2. Make material diagnostic claims inspectable through provenance, observation time, freshness, validity, support, and contradiction.
3. Test the smallest discriminating fix in a sandbox before a consequential action is proposed.
4. Require an exact, role-appropriate approval for the action being proposed, rather than a generic approval for loosely related work.
5. Keep technical verification, employee confirmation, and administrative closure distinct.
6. Turn verified resolution evidence into a proposal-first, reversible CMDB drift workflow rather than an automatic authoritative write.
7. Convert a verified incident into a replayable regression artifact.
8. Demonstrate all four phrases in Track 06 with a real live model provider on the product path.

## Users, Buyer, And Value

### Users And Stakeholders

| Role | Need | Axiōma value |
|---|---|---|
| Service desk analyst or incident coordinator | Understand an ambiguous issue without guessing a queue | A shared evidence board, cross-domain hypotheses, contradictions, and an evidence-backed route |
| Application, EUX, Server, Network, and Cloud engineers | Avoid repetitive handoffs and inspect why their domain is implicated | Bounded domain observations connected to claims and the smallest useful next test |
| Action owner or change approver | Know exactly what is being approved and why | A sandbox result and an approval tied to the specific proposed action and evidence snapshot |
| Employee seeking support | Receive continuity across channels and avoid false closure | Consented diagnostics, visible progress, human collaboration when requested, and explicit confirmation of restoration |
| CMDB or service owner | Correct drift without surrendering source authority | A reversible evidence-backed candidate that remains separate from incident resolution until reviewed |
| Reliability or platform team | Prevent recurrence | A regression artifact derived from the verified incident and its postconditions |

### Buyer Hypothesis

Two buyers exist, they buy different things, and conflating them is the fastest way to sell to neither.

**Primary: the team accountable for what agents may change.** In organizations deploying AI agents against production systems, someone owns the decision of whether an agent gets write access. The title varies — platform engineering, AI enablement, infrastructure engineering, sometimes a CISO's delegate — but the function is consistent: they are asked to approve agent-initiated changes and have no principled basis on which to say yes.

Their situation has a specific shape. The alternatives available to them are all unsatisfying. Refusing write access entirely means the agent is a chatbot and the investment produces nothing. Granting it means accepting an actor whose behavior is not reproducible and whose successes and failures look identical from the outside. Building the controls themselves means writing an approval and idempotency layer from scratch for each integration, which is exactly the work nobody has budgeted. Axiōma's proposition to this buyer is that the substrate turns an unbounded question into a bounded one: not "do we trust the model" but "does every write satisfy the seven obligations."

**Secondary: the head of IT service management, service operations, or digital workplace.** The proposition here is the overlay one — coordination, assurance, and organizational learning across the existing help desk, observability stack, endpoint tools, change system, and CMDB, without replacing any of them. This is a more familiar purchase in a more crowded market against better-resourced incumbents.

Both buyers are hypotheses. Neither is validated. The specific questions that would validate or kill the primary one:

1. Does an identifiable person actually hold approval authority for agent-initiated writes, or is the decision diffused until an incident forces it?
2. Is the perceived blocker governance, or is it model reliability? If the latter, a safety substrate does not unblock anything.
3. Would a team adopt a substrate that constrains how their agents act, or would they prefer controls in the agent framework they already use?
4. Is at-most-once execution against real connectors valued enough to pay for, given that many target systems do not support it natively and the compensating design is per-connector work?
5. Does the incident-support demonstration read as evidence of a general capability, or as a vertical product that happens to be well engineered?

Question 5 is the one this work most directly influences, which is why the substrate contract is stated independently of the incident domain.

### Value Proposition

To the primary buyer, Axiōma makes agent-initiated change auditable by construction. Every write carries a complete chain from the evidence that motivated it to the independent read that confirmed it, the approval that authorized it binds the exact state it was reviewed against, and no part of that chain depends on the model being honest about what it did.

To the secondary buyer, Axiōma aims to reduce coordination waste and false closure for eligible ambiguous incidents while increasing the inspectability of consequential support actions. Its value is not another chatbot or autonomous help desk. It is the mandatory linkage between cross-domain evidence, a discriminating test, bounded remediation, exact approval, independent outcome verification, governed configuration learning, and recurrence prevention.

Neither statement is a measured outcome. Both are what the product is built to make measurable, using the metrics and denominators in [Pilot Metrics And ROI Hypotheses](#pilot-metrics-and-roi-hypotheses).

## Unsupported Statistic Quarantine

The previously discussed claim that **23-30% of tickets are misrouted** and that this creates hundreds of thousands in annual cost is unsupported by the reviewed evidence. Its source, population, definition of misrouting, observation period, currency, ticket volume, loaded labor rate, and causal denominator have not been validated.

The figure must not appear as a fact, pitch headline, market claim, ROI input, customer benchmark, or demo result. It can be reconsidered only after an independent source and all denominators are validated. Axiōma will instead use customer-specific baseline and pilot measurements defined in [Pilot Metrics And ROI Hypotheses](#pilot-metrics-and-roi-hypotheses).

## Track 06 Product Mapping

The submitted project targets the official Track 06 scope: **"Autonomous AI agents, omnichannel workflow automation, ticket resolution, and sentiment analysis."** The source is the [official event website](https://aibuildathon.imssa.lk/) and the team's retained submission record.

| Exact phrase | Axiōma product mapping | Judge-visible product meaning |
|---|---|---|
| Autonomous AI agents | Axel, one model supervisor, plans and orders reads across five independent evidence classes — Application, EUX, Server, Network, and Cloud | The AI chooses what to look at, compares support against contradiction, identifies missing facts, and proposes the smallest discriminating test; authority remains outside model confidence. The five classes are a policy boundary, not five agents: a hypothesis becomes actionable only with fresh corroboration from two of them |
| Omnichannel workflow automation | Portal and permanently labeled simulated Teams interactions continue one incident context | The employee, chronology, service-risk context, evidence, and prior action context remain continuous rather than creating duplicate tickets |
| Ticket resolution | Diagnosis proceeds through sandbox testing, exact approval, bounded action, independent technical verification, and employee confirmation | Resolution means verified restoration, not ticket categorization, generated instructions, or a successful action receipt alone |
| Sentiment analysis | Axel identifies quoted frustration, repeat-contact, and human-request cues as service-risk signals | Signals can change priority, response style, SLA attention, and human collaboration, but never establish root cause or authorize a fix |

A real live model call is central to the product and demo proposition. Recorded or offline outputs may support development and evaluation but cannot be represented as live product functionality.

Which provider backs Axel is configuration, and the architecture names none. Where an event, customer, or procurement rule requires a specific provider, that provider is configured and its identity is observed and recorded in the trace; nothing in the contract changes.

## Competitor Audit

### Method

This audit reviews public official vendor product pages and documentation available by the 2026-08-28 capability cutoff and accessed on 2026-08-28. It asks whether a vendor publicly documents a capability or close adjacency. It does not establish availability in every edition, default integration, workflow quality, deployment safety, customer adoption, pricing, performance, or outcomes.

No products were run, private roadmaps inspected, or comparative benchmarks performed. Marketing statements remain vendor claims. Broad suites are assessed at portfolio level, so a row does not imply that all capabilities share one license, workflow, or data model.

### Evidence Legend

- **D - Documented:** Official public material explicitly describes the capability or a close implementation.
- **P - Partial/adjacent:** Official material describes a component, integration, or narrower behavior, but not the full column meaning.
- **N - Not found:** The capability was not found in the reviewed official material by the cutoff. This is not evidence that the capability is absent.

Column meanings: `TRI` triage/routing; `XDIAG` multi-agent or cross-team diagnosis; `AIOPS` telemetry correlation/AIOps; `CMDB` discovery, dependencies, or drift governance; `ENDP` endpoint action; `APPR` approval/audit; `VERIFY` outcome verification beyond generation; `REG` replay/regression derived from the incident's evidence, action, and verified outcome rather than merely a reusable test or runbook; `PRO` proactive capture/interception.

### Capability Matrix

| Vendor and evidence note | TRI | XDIAG | AIOPS | CMDB | ENDP | APPR | VERIFY | REG | PRO | Conservative characterization |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| ServiceNow [M01] | D | D | D | D | P | D | P | P | D | Broad suite collision across agents, governed execution, routing, ITOM, discovery, service mapping, and CMDB reconciliation |
| Freshservice [M02] | D | P | D | D | P | D | P | P | D | Strong overlap in AI-assisted intake, service operations, discovery, dependency context, workflow, and assets |
| Device42 [M03] | P | P | P | D | N | P | P | N | P | Direct prior art for discovery, application mapping, and dependency visibility |
| Moveworks [M04] | D | P | P | P | P | D | P | N | D | Conversational support, enterprise search, integrations, and agentic automation make generic autonomous support non-novel |
| Jira Service Management, Rovo, and Assets [M05] | D | D | D | D | P | D | P | P | D | Virtual service, swarming, alerts, approvals, discovery, dependencies, and incident learning cover much of the conventional lifecycle |
| BMC Helix [M06] | D | D | D | D | P | D | P | P | D | ITSM, bot/live support, AIOps, discovery, automation, and proactive service management collide with most components |
| Ivanti Neurons [M07] | D | P | D | D | D | D | D | P | D | ITSM, discovery, DEX, endpoint remediation, and automation invalidate broad self-healing novelty claims |
| ManageEngine ServiceDesk Plus [M08] | D | P | D | D | D | D | P | P | D | Integrated ITSM, assets/CMDB, endpoint ecosystem, workflows, and analytics cover conventional automation |
| SysAid [M09] | D | P | P | P | P | D | P | N | D | AI intake, categorization, routing, and automation overlap with the support front door and routine resolution |
| Aisera / Automation Anywhere [M10] | D | D | P | P | P | D | P | P | D | AI service desk and agentic process automation make orchestration alone non-distinctive |
| Atomicwork [M11] | D | D | P | D | D | D | P | P | D | Agentic support, ITSM, CMDB, asset management, endpoint automation, and change overlap with much of the product shape |
| Rezolve.ai [M12] | D | D | P | D | D | D | P | N | D | Specialist collaboration, explainability, approvals, endpoint flows, CMDB graph, success criteria, and change verification are a close collision |
| TOPdesk [M13] | D | P | P | D | P | D | P | P | P | Mature service, asset, workflow, and change capabilities cover the conventional ticket lifecycle |
| Dynatrace [M14] | P | D | D | D | P | P | D | P | D | Observability, topology, causal analysis, automation, and validation strongly collide with telemetry-led diagnosis |
| Datadog [M15] | P | D | D | D | P | P | D | P | D | Unified telemetry, maps, incident workflows, synthetics, testing, and remediation overlap with diagnosis and verification |
| New Relic [M16] | P | P | D | D | P | P | D | P | D | Observability, maps, alerts, errors, synthetics, and workflows cover application-side diagnosis and reusable checks |
| BigPanda [M17] | P | D | D | P | P | P | P | P | D | Event correlation and incident intelligence support cross-tool operations and proactive incident reduction |
| ScienceLogic [M18] | P | D | D | D | P | P | P | P | D | Infrastructure monitoring, topology, event correlation, and automation overlap with behavioral dependency inference |
| OpsRamp [M19] | P | D | D | D | P | D | P | P | D | AIOps, discovery, topology, incident automation, and hybrid operations cover cross-domain operational diagnosis |
| IBM Instana / Turbonomic [M20] | P | D | D | D | P | D | D | P | D | Observability, optimization, and automated actions overlap with evidence-driven remediation and verification |
| Microsoft Intune Remediations [M21] | P | N | N | N | D | P | P | P | D | Detection/remediation scripts, targeting, schedules, permissions, and reports establish endpoint and proactive remediation precedent |
| Nexthink Remote Actions [M22] | P | N | D | P | D | D | P | P | D | DEX evidence and remote actions collide with endpoint diagnosis and action |
| Tanium Automate [M23] | P | N | D | D | D | D | D | P | D | Endpoint visibility, approval-gated automation, execution, and post-action reporting invalidate generic safe-remediation claims |
| BeyondTrust Remote Support [M24] | P | N | P | P | D | D | P | N | P | Privileged remote support, session controls, audit, and endpoint access are established safety precedents |
| TeamViewer DEX / Remote Management [M25] | P | P | D | P | D | D | D | P | D | DEX monitoring, endpoint automation, linked state/reporting, and remote management overlap with proactive action and verification |
| ConnectWise ScreenConnect [M26] | P | N | P | P | D | D | P | N | P | Remote support and access provide endpoint execution, permissions, session evidence, and operational tooling |
| Splashtop Enterprise [M27] | P | N | P | P | D | D | P | N | P | Remote support, endpoint management, permissions, logging, and session controls are adjacent to the future endpoint concept |

### Matrix Evidence Notes

Each note maps major `D` and `P` ratings to official material. `REG` is deliberately narrow: a reusable test, script, runbook, or automation is no more than partial unless the reviewed material connects it to an incident's evidence, action, and verified result.

| ID | Official evidence reviewed | Major cells supported or bounded |
|---|---|---|
| M01 | ServiceNow [ITSM incident-triage AI-agent workflow](https://github.com/servicenow/servicenowdocs/blob/australia/markdown/it-service-management/now-assist-for-it-service-management-itsm/now-assist-itsm-aiagents-catincidents-usecase.md), [AI-agent supervised execution](https://github.com/servicenow/servicenowdocs/blob/australia/markdown/intelligent-experiences/aia-security-implementation.md), [Predictive Intelligence](https://www.servicenow.com/products/predictive-intelligence.html), [Discovery](https://www.servicenow.com/products/discovery.html), [Service Mapping](https://www.servicenow.com/products/service-mapping.html), [CMDB](https://www.servicenow.com/products/servicenow-platform/configuration-management-database.html), [CMDB 360](https://www.servicenow.com/docs/r/servicenow-platform/configuration-management-database-cmdb/multisource-cmdb.html), [IRE](https://www.servicenow.com/docs/r/servicenow-platform/configuration-management-database-cmdb/identification-reconciliation-engine.html), and [IRE simulation API](https://github.com/servicenow/servicenowdocs/blob/australia/markdown/api-reference/rest-apis/c_IdentifyReconcileAPI.md) | TRI/XDIAG/AIOPS/CMDB/APPR/PRO are documented across the portfolio; VERIFY/REG remain partial under Axiōma's narrow definitions |
| M02 | Freshworks [Freddy AI](https://www.freshworks.com/freshservice/ai-itsm/), [ITOM](https://www.freshworks.com/freshservice/itom/), and [ITAM](https://www.freshworks.com/freshservice/itam/) | TRI/AIOPS/CMDB/APPR/PRO; other cells partial |
| M03 | Device42 [features](https://www.device42.com/features/) and [application mappings](https://www.device42.com/features/application-mappings/) | CMDB documented; TRI/XDIAG/AIOPS/APPR/VERIFY/PRO adjacent |
| M04 | Moveworks [platform](https://www.moveworks.com/us/en/platform) | TRI/APPR/PRO; integration-dependent XDIAG/AIOPS/CMDB/ENDP/VERIFY partial |
| M05 | Atlassian [JSM ITSM](https://www.atlassian.com/software/jira/service-management/features/itsm), [Rovo](https://www.atlassian.com/software/rovo), and [Assets](https://www.atlassian.com/software/jira/service-management/features/asset-and-configuration-management) | TRI/XDIAG/AIOPS/CMDB/APPR/PRO; VERIFY/REG partial |
| M06 | BMC [Helix portfolio](https://www.bmc.com/it-solutions/bmc-helix.html), [Helix ITSM](https://www.bmc.com/it-solutions/bmc-helix-itsm.html), and [Helix Discovery](https://www.bmc.com/it-solutions/bmc-helix-discovery.html) | TRI/XDIAG/AIOPS/CMDB/APPR/PRO; VERIFY/REG partial |
| M07 | Ivanti [ITSM](https://www.ivanti.com/products/itsm), [Agentic AI](https://www.ivanti.com/ai/agenticai), [Asset Discovery](https://www.ivanti.com/neurons/system-of-record/asset-discovery), and [Autonomous Endpoint Management](https://www.ivanti.com/autonomous-endpoint-management) | TRI/AIOPS/CMDB/ENDP/APPR/VERIFY/PRO; REG partial |
| M08 | ManageEngine [ServiceDesk Plus](https://www.manageengine.com/products/service-desk/) and [CMDB](https://www.manageengine.com/products/service-desk/itsm/it-cmdb-software.html) | TRI/AIOPS/CMDB/ENDP/APPR/PRO; XDIAG/VERIFY/REG partial across the ecosystem |
| M09 | SysAid [AI](https://www.sysaid.com/ai) and [ITSM](https://www.sysaid.com/itsm) | TRI/APPR/PRO; XDIAG/AIOPS/CMDB/ENDP/VERIFY partial |
| M10 | Automation Anywhere [Aisera AI Service Desk](https://www.automationanywhere.com/products/ai-service-desk), [Aisera AIOps](https://www.automationanywhere.com/products/aiops), and [Agentic Process Automation](https://www.automationanywhere.com/products/agentic-process-automation-system) | TRI/XDIAG/APPR/PRO; AIOPS/CMDB/ENDP/VERIFY/REG partial across a combined portfolio comparison |
| M11 | Atomicwork [platform](https://www.atomicwork.com/platform), [CMDB](https://www.atomicwork.com/features/cmdb), [IT asset management](https://www.atomicwork.com/features/it-asset-management), and [IT change management](https://www.atomicwork.com/features/it-change-management) | TRI/XDIAG/CMDB/ENDP/APPR/PRO; AIOPS/VERIFY/REG partial |
| M12 | Rezolve.ai [How it thinks](https://www.rezolve.ai/how-it-thinks), [Resolve](https://www.rezolve.ai/resolve), [Assist](https://www.rezolve.ai/assist), [Automate](https://www.rezolve.ai/automate), and [Record](https://www.rezolve.ai/record) | TRI/XDIAG/CMDB/ENDP/APPR/PRO documented; VERIFY partial and incident-derived REG not found |
| M13 | TOPdesk [features](https://www.topdesk.com/en/features/) and [asset management](https://www.topdesk.com/en/features/asset-management/) | TRI/CMDB/APPR; XDIAG/AIOPS/ENDP/VERIFY/REG/PRO partial |
| M14 | Dynatrace [platform](https://www.dynatrace.com/platform/) and [Davis AI](https://www.dynatrace.com/platform/artificial-intelligence/) | XDIAG/AIOPS/CMDB/VERIFY/PRO documented; REG partial |
| M15 | Datadog [platform](https://www.datadoghq.com/product/platform/), [Watchdog](https://www.datadoghq.com/product/watchdog/), [service map](https://docs.datadoghq.com/tracing/services/services_map/), [Synthetic Monitoring](https://www.datadoghq.com/product/synthetic-monitoring/), and [Continuous Testing](https://www.datadoghq.com/product/continuous-testing/) | XDIAG/AIOPS/CMDB/VERIFY/PRO documented; REG partial because incident-derived replay is not established |
| M16 | New Relic [platform](https://newrelic.com/platform) and [service maps](https://docs.newrelic.com/docs/new-relic-solutions/new-relic-one/ui-data/service-maps/service-maps/) | AIOPS/CMDB/VERIFY/PRO documented; TRI/XDIAG/ENDP/APPR adjacent and REG partial |
| M17 | BigPanda [Incident Intelligence](https://docs.bigpanda.io/docs/incident-intelligence) and [topology](https://docs.bigpanda.io/en/topology) | XDIAG/AIOPS/PRO; other adjacencies partial |
| M18 | ScienceLogic [device relationships](https://docs.sciencelogic.com/12-3-0/Content/Web_Monitoring_Tools/Device_Management/device_relationships.htm) and [Service Investigator](https://docs.sciencelogic.com/12-3-0/Content/Web_Monitoring_Tools/Business_Services/business_services_enhanced_investigator.htm) | XDIAG/AIOPS/CMDB/PRO; remaining adjacencies partial |
| M19 | OpsRamp [concepts](https://docs.opsramp.com/guides/concepts/) and [ServiceNow integration](https://docs.opsramp.com/integrations/service-management/servicenow/servicenow-using-standard-method/) | XDIAG/AIOPS/CMDB/APPR/PRO; remaining adjacencies partial |
| M20 | IBM [Instana](https://www.ibm.com/products/instana) and [Turbonomic](https://www.ibm.com/products/turbonomic) | XDIAG/AIOPS/CMDB/APPR/VERIFY/PRO; REG partial |
| M21 | Microsoft [Intune Remediations](https://learn.microsoft.com/en-us/intune/device-management/tools/deploy-remediations) | ENDP/PRO documented; TRI/APPR/VERIFY/REG partial; XDIAG/AIOPS/CMDB not found in this source |
| M22 | Nexthink [Remote Actions](https://docs.nexthink.com/platform/user-guide/remote-actions) and [DEX platform](https://nexthink.com/platform) | AIOPS/ENDP/APPR/PRO documented; CMDB/VERIFY/REG partial |
| M23 | Tanium [Automate](https://www.tanium.com/products/tanium-automate/) | AIOPS/CMDB/ENDP/APPR/VERIFY/PRO documented; REG partial |
| M24 | BeyondTrust [Remote Support](https://www.beyondtrust.com/products/remote-support) | ENDP/APPR documented; TRI/AIOPS/CMDB/VERIFY/PRO adjacent; incident-derived REG not found |
| M25 | TeamViewer [DEX](https://www.teamviewer.com/en/products/dex/) and [Remote Management](https://www.teamviewer.com/en/products/add-ons/remote-management/) | AIOPS/ENDP/APPR/PRO documented; TRI/XDIAG/CMDB/REG partial; VERIFY is limited to linked endpoint state/reporting |
| M26 | ConnectWise [ScreenConnect](https://screenconnect.connectwise.com/) | ENDP/APPR documented; TRI/AIOPS/CMDB/VERIFY/PRO adjacent; incident-derived REG not found |
| M27 | Splashtop [Enterprise](https://www.splashtop.com/products/enterprise) and [Remote Support](https://www.splashtop.com/products/remote-support) | ENDP/APPR documented; TRI/AIOPS/CMDB/VERIFY/PRO adjacent; incident-derived REG not found |

Some official pages are live and undated and may change after the cutoff. Ratings must be rechecked before publication, procurement use, or a novelty statement. Screenshots and archived copies were not collected for this audit.

## Commoditized Features

| Feature | Why it is not a defensible headline | Axiōma treatment |
|---|---|---|
| AI ticket categorization and routing | Common across ITSM suites and AI service desks | Intake aid only; routing follows evidence-backed hypothesis testing |
| Chat or Teams-based support | Widely offered by employee-support and ITSM vendors | Demonstrates continuity, not novelty; the initial Teams surface is explicitly simulated |
| Agent orchestration or swarming | Multiple vendors document agents, automation, and incident collaboration | Claim nothing here. There is one supervisor, Axel, and five typed read tools, and the product says so. The five-way split exists because the actionability rule requires corroboration across independent evidence classes, not because five personas are more persuasive than one |
| Telemetry correlation and root-cause suggestions | Core AIOps and observability behavior | Treat telemetry as one evidence class that can be stale or contradicted |
| Discovery, dependency maps, and CMDB population | Established in ITSM, discovery, and topology products | Produce an incident-derived candidate for owner review, not a replacement scanner or silent write |
| Endpoint scripts and self-healing | Established across endpoint, DEX, RMM, and remote-support products | Real endpoint execution remains P1; P0 is an honest simulation |
| Approval workflows and audit logs | Standard in service, change, endpoint, and remote-support tools | Make exact action and evidence binding mandatory rather than claiming approval itself as novel |
| Synthetic tests and post-action monitoring | Established in observability and endpoint platforms | Require independent technical verification plus employee confirmation |
| Proactive anomaly detection | Common across AIOps, DEX, endpoint, and observability categories | P1 only and never presented as novel by itself |

## Closest Collisions

| Collision | What it already covers | Remaining Axiōma hypothesis to validate |
|---|---|---|
| ServiceNow | Agents, governed execution, routing, ITSM, ITOM, discovery, service mapping, CMDB health, reconciliation, and approvals | Mandatory claim-level contradictory evidence, exact action-snapshot approval, independent technical and employee verification, incident-governed drift, and incident-derived replay as one linked assurance loop |
| Atomicwork | Agentic support, ITSM, CMDB, asset management, endpoint-oriented automation, and change | Whether requiring the same evidence-and-assurance bindings creates distinct customer value; public pages do not establish their absence in deployed workflows |
| Rezolve.ai | Multiple specialists, shared conversation, explainability, approval-gated actions, endpoint flows, CMDB graph/discovery, success criteria, and change verification | A narrow requirement for contradictory evidence, exact snapshot binding, dual verification, governed drift, and incident-generated replay |
| Ivanti Neurons | ITSM, DEX, discovery, endpoint automation, self-healing, and proactive capabilities | Cross-system proof and assurance semantics, not invention of endpoint remediation |
| Device42, BMC, Dynatrace, and Datadog | Discovery, dependencies/topology, AIOps, causal analysis, observability, and tests | Incident evidence may challenge stale knowledge but cannot silently become authoritative CMDB truth |
| Intune, Nexthink, Tanium, BeyondTrust, TeamViewer, ScreenConnect, and Splashtop | Endpoint detection, scripts, remediation, remote sessions, permissions, reporting, and verification in different combinations | An incident-bound consent and effect envelope layered on an existing managed-endpoint product rather than a competing agent. Axiōma supplies authority, scope, and proof; the endpoint product supplies transport, identity, and execution |

## Reframing The Five Submitted Gap Labels

| Submitted label | Established competitor behavior | Claim to avoid | Axiōma reframing | Priority |
|---|---|---|---|---|
| Swarm Triangulation | ITSM and AIOps products swarm responders, correlate alerts, route tickets, and run agents | "First multi-agent IT support swarm", implying that voting creates truth, or describing typed read tools as autonomous specialists | **Source-Class Independence:** five typed read tools produce observations across five independent evidence classes, and deterministic policy marks a hypothesis actionable only on fresh corroboration from two classes with no unresolved decisive contradiction. The split is a policy boundary that changes outcomes, not a persona layer | P0 |
| Behavioral CMDB Mapping | Discovery, service mapping, topology, dependency inference, and reconciliation are established | "Scanners see only physical assets" or "first behavioral CMDB" | **Incident-Governed CMDB Drift:** verified incident evidence creates a reversible, reconciliation-aware candidate for owner review and never silently writes the authoritative CMDB | P0 |
| Zero-Trust Ephemeral Action Tunnel | Endpoint, DEX, RMM, and remote-support products already execute constrained actions with permissions and audit | Calling a tokenized client "zero trust" without validating the complete security claim, or describing template-validated mock dispatch as real remediation | **Action-Bound Template Registry:** a closed set of reviewed, parameterized operations with declared effect constraints and inverses, bound to case, device, and approval. The model selects; it never composes | Real reads P0; real dispatch gated on the open control list |
| Predictive Regression Guard | Observability, synthetic testing, endpoint remediation, and post-incident practices already create tests and runbooks | "Predictive" without a prospective model and validated forward prediction | **Incident-to-Regression Guard:** turn verified evidence, preconditions, action, controls, and postconditions into a replayable regression artifact | P0 |
| Pre-Emptive Interception | AIOps, DEX, monitoring, and support products proactively detect or communicate issues | "First support system that fixes issues before tickets", or implying any background observation exists | **Consented Diagnostic Capsule:** a real, employee-approved device snapshot taken after the employee opens a ticket. There is no detection path and no background scan; proactive offers stay out of scope | Real consented reads P0; proactive P1 |

## Proposed Differentiation Hypothesis

The integrated chain is a **proposed differentiation hypothesis requiring hands-on product and customer-workflow validation**, not a research finding, patentability opinion, or novelty assertion. Current official ServiceNow, Rezolve.ai, and Atomicwork evidence covers much of the chain. This documentation review did not verify a reviewed public workflow end-to-end, but it also did not establish that such a workflow is absent.

The hypothesis is that making the following bindings mandatory produces meaningful customer value:

1. An ambiguous request is examined through bounded cross-domain perspectives rather than immediately routed.
2. Material claims carry provenance, freshness, support, and contradiction.
3. The product asks for the smallest test that can distinguish plausible causes.
4. A consequential fix is tested in a sandbox before approval.
5. Approval applies to the exact proposed action and evidence basis.
6. Outcome verification is independent of the action response, and the employee confirms restoration.
7. Verified evidence becomes a governed CMDB drift candidate rather than an automatic write.
8. The resolved incident becomes a replayable regression against recurrence.

The product may be described as an integrated proof-carrying resolution loop or evidence-and-assurance overlay. It must not claim to have invented triage, swarming, AI agents, discovery, remote action, approvals, verification, CMDB reconciliation, or regression testing.

### Claim Discipline

- Say **"not found in the reviewed official public documentation through 2026-08-28"**, never "no competitor does this."
- Say **"the components are individually established; the proposed distinction is the required integrated assurance chain."**
- Treat `D`, `P`, and `N` as documentation evidence, not product scores.
- Do not infer feature quality, adoption, accuracy, latency, security, licensing, deployment coverage, or interoperability from vendor pages.
- Do not convert vendor customer stories or ROI studies into Axiōma performance claims.
- Do not claim global novelty, production superiority, patentability, or proven savings.
- Recheck product packaging, acquisitions, and live official pages before a public comparison.

## Product Scope

### P0: Judge-Visible Product Spine

- One fictional enterprise and one ambiguous employee IT incident spanning Application, EUX, Server, Network, and Cloud evidence.
- Minimal portal intake plus a permanently labeled simulated Teams interaction that continues the same incident.
- Axel, one real live model supervisor, planning reads across five independent evidence classes.
- A consented diagnostic capsule reading a real Fleet-managed Windows device through allowlisted osquery queries, scoped to an exact field manifest the employee approves.
- A closed registry of pre-vetted, parameterized device action templates. The supervisor selects a template by ID at runtime and supplies typed parameters; the command is assembled server-side from a template the model cannot read or modify, and P0 dispatches it to a mock device adapter.
- Mock enterprise evidence sources for application, endpoint experience, server, network, cloud, telemetry, identity, change, and CMDB context.
- A claim-level evidence board showing provenance, freshness, validity, support, contradiction, uncertainty, and missing facts.
- Ranked hypotheses, an evidence-backed owner route, and the smallest discriminating sandbox test.
- One bounded mock remediation with sandbox results and exact role-appropriate approval.
- Independent technical verification and separate employee confirmation before resolution.
- A proposal-first CMDB drift feature with owner review, reversibility, and no silent authoritative write.
- An incident-derived regression artifact and a visible replay result.
- Service-risk cues that affect priority, response style, SLA attention, and human collaboration without affecting technical truth.
- Clear labels for all fictional, simulated, and mock product surfaces.

### P1: After Product Validation

- Real dispatch of device action templates to the enrolled machine, gated on the open control list in [architecture.md](architecture.md): action-bound tokens, posture checks, just-in-time privilege, a local watcher, revoke and kill paths, and the endpoint threat-test suite.
- Proactive diagnostic offers triggered by endpoint, DEX, or monitoring signals.
- Production connectors for identity, Teams, ITSM, observability, CMDB, change, endpoint, and service-mapping products.
- More incidents, applications, tenants, policy packs, roles, and scheduled regressions.
- Longitudinal learning from owner decisions and prospectively validated service-risk models.
- Enterprise policy administration and production-grade trust capabilities.

### Non-Goals

- No privileged endpoint action, script dispatch to a real device, or remote control in P0. Device reads are real; device writes reach a mock adapter.
- No detection, background scanning, or proactive remediation. Every device interaction begins with a ticket the employee opened.
- No real mutation of DNS, VPN, routes, cloud, servers, applications, CMDB, Teams, ticketing, or change platforms in P0.
- No replacement help desk, AIOps platform, observability suite, remote-support product, discovery scanner, authoritative CMDB, or autonomous change-management system.
- No unrestricted agent collective, majority voting, debate theater, hidden chain-of-thought display, or model-selected authority.
- No autonomous authoritative CMDB write, regardless of confidence.
- No generic dashboard, chatbot mascot, topology animation, or broad asset browser as a substitute for the resolution loop.
- No claims of "zero trust," "predictive," "first multi-agent," "self-healing," global novelty, production readiness, compliance, or proven financial impact.

Detailed technical boundaries and system design belong in [architecture.md](architecture.md). Implementation acceptance, test coverage, fixtures, and delivery execution belong in [implementation.md](implementation.md).

## Pilot Metrics And ROI Hypotheses

Axiōma currently claims no savings, resolution-rate lift, CMDB-accuracy gain, or production performance improvement. A pilot must define an eligible cohort using an agreed ambiguity rubric and compare it with the current process using explicit denominators.

| Metric | Definition | Product question |
|---|---|---|
| Reassignments per eligible incident | Owning-queue reassignments divided by eligible ambiguous incidents | Does evidence-backed diagnosis reduce blind transfers? |
| Evidence-backed route time | Time from intake to the first route supported by the agreed evidence standard | Does cross-domain probing establish ownership sooner? |
| Technically verified restoration time | Time from intake to independent technical verification | Does the loop restore service faster without counting unverified tool success? |
| Employee-confirmed resolution rate | Eligible incidents with both technical verification and employee confirmation divided by eligible incidents reaching a proposed resolution | Does dual verification reduce false closure? |
| Proof-complete action rate | Consequential actions with a complete proposal, matching approval, action result, and independent verification divided by consequential actions attempted | Does the assurance layer improve action traceability? |
| Smallest-test efficiency | Incidents resolved without unnecessary write attempts divided by eligible incidents | Does discriminating-test selection reduce avoidable actions? |
| Drift decision rate | Accepted, rejected, corrected, and expired CMDB candidates divided by reviewed candidates | Are incident-derived proposals useful and governable? |
| Drift correction lead time | Time from verified incident finding to owner disposition and, when accepted, verified correction | Does the proposal path improve CMDB learning speed? |
| Regression catch rate | Reintroduced or seeded failures blocked by incident-derived regressions divided by those regressions executed | Does resolution knowledge prevent recurrence in controlled environments? |
| Repeat-contact rate | Eligible incidents with another employee contact inside the agreed observation window divided by eligible incidents | Does verified resolution reduce repeat contact? |
| Human collaboration rate | Eligible incidents requiring human collaboration, with reasons | Where should automation stop or involve specialists? |

Pilot hypotheses, not promises:

- Evidence-backed parallel probing reduces reassignment count for eligible ambiguous incidents.
- Smallest-discriminating-test selection reduces unnecessary action attempts.
- Exact approval and result reconciliation reduce stale or duplicate action risk.
- Separate technical and employee verification reduces false closure.
- Owner-reviewed drift candidates shorten correction lead time without bypassing CMDB governance.
- Incident-derived regressions catch recurrence in controlled test environments.

Any ROI model must use the participating enterprise's validated incident volume, loaded labor rate, reassignment effort, outage impact, review cost, integration cost, model cost, and risk cost. It should report assumptions and sensitivity ranges rather than a single unsupported savings figure. The quarantined 23-30% statistic and associated cost claims are excluded.

## Rubric Positioning

| Published criterion | Axiōma positioning |
|---|---|
| Innovation & Originality | A conservative competitor audit acknowledges established components and positions the required proof-carrying chain as a hypothesis to validate, rather than relying on a generic agent novelty claim |
| AI Integration & Depth | A real live model plans and orders reads across five independent evidence classes, compares support against contradiction, identifies missing evidence, proposes the smallest discriminating test, and extracts service-risk cues, while deterministic policy owns every verdict |
| Technical Execution & Architecture | The product concept has a clear boundary between AI judgment and authoritative action, with sandboxing, exact approval, independent verification, governed CMDB learning, and replayable regression; technical detail is in [architecture.md](architecture.md) |
| Impact & Business Feasibility | The product has named users and a buyer hypothesis, overlays existing enterprise systems, and defines pilot metrics with denominators while avoiding unsupported ROI claims |
| Pitch & Demo Delivery | The story transforms a minimal ambiguous request into inspectable cross-domain evidence, a verified bounded resolution, a governed CMDB candidate, and a reusable regression |

## Risks And Open Questions

### Organizer Questions

| Question | Consequence | Required clarification |
|---|---|---|
| Is August 31 the authoritative deadline, and can the filed entry still be updated? | Work may not be eligible or attachable | Obtain written organizer confirmation before relying on the extended date or update path |
| Does Track 06 require a specific model provider or vendor surface? | Submission eligibility could differ from the product interpretation | Ask organizers and configure that provider. The architecture is provider-neutral, so this is a deployment answer rather than a design change |
| What repository, video, deck, and live-demo artifacts can still be added to an already filed concept? | The team may build assets that cannot be submitted | Confirm accepted artifact types and update permissions |

### Product Questions

| Risk or question | Why it matters | Validation response |
|---|---|---|
| Is ambiguous cross-domain routing frequent and costly enough for a dedicated overlay? | The user problem may be real but too narrow or infrequent | Interview service desk leaders and baseline an explicitly defined eligible cohort |
| Is the buyer ITSM, service operations, digital workplace, or another owner? | Budget, integrations, and success measures vary | Test the buyer hypothesis across organizations |
| Do operators trust claim-level evidence and contradictions, or find the proof burden excessive? | Assurance can become workflow friction | Conduct task-based usability tests and measure review time |
| Does the complete chain create value beyond capabilities already configured in ServiceNow, Atomicwork, Rezolve.ai, or other suites? | The differentiation may collapse into packaging | Run hands-on workflow comparisons and customer configuration audits |
| Which actions are safe and valuable enough for bounded remediation? | A demonstration action may not represent a viable product wedge | Identify high-volume, reversible actions with clear owners and postconditions |
| How should employee consent work for diagnostics? | Weak consent undermines trust; excessive prompts reduce completion | Test understandable manifests, refusal paths, and minimum data collection |
| Will action owners approve exact snapshots quickly enough? | Strong assurance may delay restoration | Measure approval latency and identify policy-based low-risk classes without weakening authority |
| How should technical success and employee confirmation disagreements be handled? | Either signal alone can cause false closure | Validate escalation and collaboration policies with service teams |
| Are CMDB owners willing to review incident-derived drift candidates? | The learning loop fails if proposals create review noise | Measure acceptance, correction, rejection, and review effort |
| Can incident-derived regressions be portable across test environments? | Artifacts may be too case-specific to prevent recurrence | Test reuse across representative environments and track catches versus maintenance cost |
| Can service-risk analysis avoid emotional inference and bias? | Sentiment features can unfairly influence technical decisions | Limit the proposition to quoted cues and objective contact signals for service handling only |
| Does the configured provider give reliable structured behaviour for the intended experience? | Variation could weaken the demo and product trust | Probe capability, validate on representative cases, and keep product claims bounded to what the probe supports |
| Is an orchestration layer necessary to customer value? | Optional tooling can distract from the core product | Treat orchestration vendor choice as non-differentiating and optional |
| What data retention and enterprise trust expectations apply? | The evidence layer touches sensitive operational context | Validate requirements before production positioning; do not claim compliance in P0 |
| Could the Axiōma name conflict with an existing mark? | Renaming late can affect submission and identity | Perform a name and trademark check before external launch |

### Market And Claim Risks

- Competitor documentation can change, and public pages do not reveal all deployed workflows.
- ServiceNow, Atomicwork, and Rezolve.ai are close enough that broad novelty language is not credible.
- Endpoint remediation, proactive support, CMDB discovery, approvals, and regression testing are established categories.
- A fictional demonstration can illustrate workflow coherence but cannot prove diagnostic accuracy, generalization, production safety, or ROI.
- ServiceNow identification and reconciliation concepts are a design reference only; Axiōma has no ServiceNow certification, compatibility claim, or production integration in P0.

## Official Sources

All capability sources are official public vendor pages or documentation reviewed with a cutoff and access date of 2026-08-28. They document vendor descriptions, not independently verified results. The complete vendor-to-capability mapping and exact URLs are preserved in [Matrix Evidence Notes](#matrix-evidence-notes).

### Event And Track

- [Official AI Buildathon website](https://aibuildathon.imssa.lk/).
- Team submission record and kickoff information supplied by the user, including the Track 06 wording, required GitHub repository, working demo video, project documentation, five evaluation criteria, and the unresolved August 27 versus August 31 deadline conflict. Retained here as project context after deletion of the original research dossier.

### Vendor Categories

- ITSM, employee support, discovery, and CMDB: ServiceNow, Freshworks, Device42, Moveworks, Atlassian, BMC, Ivanti, ManageEngine, SysAid, Automation Anywhere/Aisera, Atomicwork, Rezolve.ai, and TOPdesk official sources in M01-M13.
- Observability and AIOps: Dynatrace, Datadog, New Relic, BigPanda, ScienceLogic, OpsRamp, and IBM official sources in M14-M20.
- Endpoint, DEX, and remote action: Microsoft, Nexthink, Tanium, BeyondTrust, TeamViewer, ConnectWise, and Splashtop official sources in M21-M27.

## Product Lock

Axiōma is the sole canonical idea. Preserve its proof-carrying product spine: a real live model call, bounded cross-domain evidence, explicit disagreement, the smallest discriminating sandbox test, exact role-appropriate action approval, independent technical and employee verification, proposal-first CMDB drift, and incident-derived regression.

Do not turn P0 into a real endpoint client, broad ITSM suite, autonomous CMDB writer, or unsupported novelty, performance, security, or savings claim. Proceed with implementation or submission updates only if the organizer deadline and update path are confirmed. See [architecture.md](architecture.md) for technical design and [implementation.md](implementation.md) for implementation and validation details.
