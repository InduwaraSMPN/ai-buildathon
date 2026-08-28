# ResolveMesh

**Document role:** Canonical product and idea context  
**Status:** User-confirmed submitted concept; implementation is conditionally authorized  
**Product name:** ResolveMesh (name and trademark availability not checked)  
**Decision date:** 2026-08-28  
**Track:** 06 - Enterprise Customer Support  
**Evidence cutoff and access date:** 2026-08-28

## Canonical Status And Deadline

ResolveMesh is the sole canonical idea for this project. The user has confirmed that the ResolveMesh concept was already submitted, superseding all earlier internal candidates and recommendations. No other idea is active unless the user explicitly changes direction.

The public event website states an August 27 deadline, which had passed by the decision date. The kickoff deck states August 31. That conflict is unresolved. Building or updating submission artifacts on August 28-30 is conditional on organizers confirming that the August 31 date controls and that the submission portal still accepts repository, demo, or entry updates. The filed concept remains the source of truth even if updates are no longer accepted.

Product decisions belong here. Technical design belongs in [architecture.md](architecture.md), and execution details, testing, fixtures, and delivery planning belong in [implementation.md](implementation.md).

## One-Line Pitch

**ResolveMesh is a Qwen-powered proof-carrying resolution loop that turns an ambiguous employee IT request into cross-domain, claim-level evidence; tests the smallest safe fix in a sandbox; binds approval to the exact action snapshot; independently verifies the outcome; and proposes reversible CMDB drift and a replayable regression without silently changing an authoritative system.**

## Submitted Background

The submitted concept describes an enterprise IT organization divided among Application Support, End User Experience (EUX), Server, Network, and Cloud teams. Employees usually report symptoms rather than infrastructure causes and often cannot identify the failing layer. Minimal or ambiguous requests can therefore bounce between queues while useful evidence remains fragmented across specialist tools and while the configuration management database (CMDB) may be stale.

The submission proposes coordinated cross-domain diagnosis, bounded sandbox investigation, a future consented endpoint capability, and a governed path from verified incident evidence to a proposed CMDB correction. These are the user's problem framing and design inputs. They are not presented as audited market prevalence, completed customer discovery, production incidents, or proven vendor-performance findings.

Official vendor documentation shows that the component categories are already active and often mature:

- ITSM suites document AI triage, virtual agents, workflow automation, swarming, approvals, discovery, service mapping, and CMDB reconciliation.
- Observability and AIOps products document telemetry correlation, topology, root-cause assistance, anomaly detection, and proactive incident workflows.
- Endpoint, DEX, and remote-support products document scripts, remediation, permissions, audit trails, and post-action status in different combinations.
- Discovery and service-mapping products cover logical application dependencies, not only physical assets.
- Employee-support vendors already describe conversational intake and automated resolution.

ResolveMesh therefore does not claim novelty for any isolated component. Its proposed boundary is the integrated **Proof-Carrying Resolution Loop**, an evidence-and-assurance layer across existing ITSM, observability, CMDB, change, and endpoint systems.

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
8. Demonstrate all four phrases in Track 06 with real Alibaba-hosted Qwen use on the live product path.

## Users, Buyer, And Value

### Users And Stakeholders

| Role | Need | ResolveMesh value |
|---|---|---|
| Service desk analyst or incident coordinator | Understand an ambiguous issue without guessing a queue | A shared evidence board, cross-domain hypotheses, contradictions, and an evidence-backed route |
| Application, EUX, Server, Network, and Cloud specialists | Avoid repetitive handoffs and inspect why their domain is implicated | Bounded domain observations connected to claims and the smallest useful next test |
| Action owner or change approver | Know exactly what is being approved and why | A sandbox result and an approval tied to the specific proposed action and evidence snapshot |
| Employee seeking support | Receive continuity across channels and avoid false closure | Consented diagnostics, visible progress, human collaboration when requested, and explicit confirmation of restoration |
| CMDB or service owner | Correct drift without surrendering source authority | A reversible evidence-backed candidate that remains separate from incident resolution until reviewed |
| Reliability or platform team | Prevent recurrence | A regression artifact derived from the verified incident and its postconditions |

### Buyer Hypothesis

The economic buyer is likely the head of IT service management, service operations, or digital workplace. The buying case is an overlay that improves coordination, assurance, and organizational learning without requiring replacement of the enterprise's help desk, observability stack, endpoint tools, change system, or CMDB. This buyer and procurement path require customer validation.

### Value Proposition

ResolveMesh aims to reduce coordination waste and false closure for eligible ambiguous incidents while increasing the inspectability of consequential support actions. Its value is not another chatbot or autonomous help desk. It is the mandatory linkage between cross-domain evidence, a discriminating test, bounded remediation, exact approval, independent outcome verification, governed configuration learning, and recurrence prevention.

## Unsupported Statistic Quarantine

The previously discussed claim that **23-30% of tickets are misrouted** and that this creates hundreds of thousands in annual cost is unsupported by the reviewed evidence. Its source, population, definition of misrouting, observation period, currency, ticket volume, loaded labor rate, and causal denominator have not been validated.

The figure must not appear as a fact, pitch headline, market claim, ROI input, customer benchmark, or demo result. It can be reconsidered only after an independent source and all denominators are validated. ResolveMesh will instead use customer-specific baseline and pilot measurements defined in [Pilot Metrics And ROI Hypotheses](#pilot-metrics-and-roi-hypotheses).

## Track 06 Product Mapping

The submitted project targets the official Track 06 scope: **"Autonomous AI agents, omnichannel workflow automation, ticket resolution, and sentiment analysis."** The source is the [official event website](https://aibuildathon.imssa.lk/) and the team's retained submission record.

| Exact phrase | ResolveMesh product mapping | Judge-visible product meaning |
|---|---|---|
| Autonomous AI agents | One Qwen supervisor coordinates five bounded specialist capabilities for Application, EUX, Server, Network, and Cloud evidence | The AI chooses relevant evidence gathering, compares hypotheses and contradictions, identifies missing facts, and proposes the smallest discriminating test; authority remains outside model confidence |
| Omnichannel workflow automation | Portal and permanently labeled simulated Teams interactions continue one incident context | The employee, chronology, service-risk context, evidence, and prior action context remain continuous rather than creating duplicate tickets |
| Ticket resolution | Diagnosis proceeds through sandbox testing, exact approval, bounded action, independent technical verification, and employee confirmation | Resolution means verified restoration, not ticket categorization, generated instructions, or a successful action receipt alone |
| Sentiment analysis | Qwen identifies quoted frustration, repeat-contact, and human-request cues as service-risk signals | Signals can change priority, response style, SLA attention, and human collaboration, but never establish root cause or authorize a fix |

Real Alibaba-hosted Qwen use is central to the live product and demo proposition. Recorded or offline outputs may support development and evaluation but cannot be represented as live product functionality or as satisfying the submission's AI requirement.

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
| M01 | ServiceNow [ITSM incident-triage AI-agent workflow](https://github.com/servicenow/servicenowdocs/blob/australia/markdown/it-service-management/now-assist-for-it-service-management-itsm/now-assist-itsm-aiagents-catincidents-usecase.md), [AI-agent supervised execution](https://github.com/servicenow/servicenowdocs/blob/australia/markdown/intelligent-experiences/aia-security-implementation.md), [Predictive Intelligence](https://www.servicenow.com/products/predictive-intelligence.html), [Discovery](https://www.servicenow.com/products/discovery.html), [Service Mapping](https://www.servicenow.com/products/service-mapping.html), [CMDB](https://www.servicenow.com/products/servicenow-platform/configuration-management-database.html), [CMDB 360](https://www.servicenow.com/docs/r/servicenow-platform/configuration-management-database-cmdb/multisource-cmdb.html), [IRE](https://www.servicenow.com/docs/r/servicenow-platform/configuration-management-database-cmdb/identification-reconciliation-engine.html), and [IRE simulation API](https://github.com/servicenow/servicenowdocs/blob/australia/markdown/api-reference/rest-apis/c_IdentifyReconcileAPI.md) | TRI/XDIAG/AIOPS/CMDB/APPR/PRO are documented across the portfolio; VERIFY/REG remain partial under ResolveMesh's narrow definitions |
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

| Feature | Why it is not a defensible headline | ResolveMesh treatment |
|---|---|---|
| AI ticket categorization and routing | Common across ITSM suites and AI service desks | Intake aid only; routing follows evidence-backed hypothesis testing |
| Chat or Teams-based support | Widely offered by employee-support and ITSM vendors | Demonstrates continuity, not novelty; the initial Teams surface is explicitly simulated |
| Agent orchestration or swarming | Multiple vendors document agents, automation, and incident collaboration | Use bounded specialist capabilities; differentiate through evidence and assurance bindings |
| Telemetry correlation and root-cause suggestions | Core AIOps and observability behavior | Treat telemetry as one evidence class that can be stale or contradicted |
| Discovery, dependency maps, and CMDB population | Established in ITSM, discovery, and topology products | Produce an incident-derived candidate for owner review, not a replacement scanner or silent write |
| Endpoint scripts and self-healing | Established across endpoint, DEX, RMM, and remote-support products | Real endpoint execution remains P1; P0 is an honest simulation |
| Approval workflows and audit logs | Standard in service, change, endpoint, and remote-support tools | Make exact action and evidence binding mandatory rather than claiming approval itself as novel |
| Synthetic tests and post-action monitoring | Established in observability and endpoint platforms | Require independent technical verification plus employee confirmation |
| Proactive anomaly detection | Common across AIOps, DEX, endpoint, and observability categories | P1 only and never presented as novel by itself |

## Closest Collisions

| Collision | What it already covers | Remaining ResolveMesh hypothesis to validate |
|---|---|---|
| ServiceNow | Agents, governed execution, routing, ITSM, ITOM, discovery, service mapping, CMDB health, reconciliation, and approvals | Mandatory claim-level contradictory evidence, exact action-snapshot approval, independent technical and employee verification, incident-governed drift, and incident-derived replay as one linked assurance loop |
| Atomicwork | Agentic support, ITSM, CMDB, asset management, endpoint-oriented automation, and change | Whether requiring the same evidence-and-assurance bindings creates distinct customer value; public pages do not establish their absence in deployed workflows |
| Rezolve.ai | Multiple specialists, shared conversation, explainability, approval-gated actions, endpoint flows, CMDB graph/discovery, success criteria, and change verification | A narrow requirement for contradictory evidence, exact snapshot binding, dual verification, governed drift, and incident-generated replay |
| Ivanti Neurons | ITSM, DEX, discovery, endpoint automation, self-healing, and proactive capabilities | Cross-system proof and assurance semantics, not invention of endpoint remediation |
| Device42, BMC, Dynatrace, and Datadog | Discovery, dependencies/topology, AIOps, causal analysis, observability, and tests | Incident evidence may challenge stale knowledge but cannot silently become authoritative CMDB truth |
| Intune, Nexthink, Tanium, BeyondTrust, TeamViewer, ScreenConnect, and Splashtop | Endpoint detection, scripts, remediation, remote sessions, permissions, reporting, and verification in different combinations | A future incident-bound consent and effect envelope; P0 explicitly does not build a real endpoint client |

## Reframing The Five Submitted Gap Labels

| Submitted label | Established competitor behavior | Claim to avoid | ResolveMesh reframing | Priority |
|---|---|---|---|---|
| Swarm Triangulation | ITSM and AIOps products swarm responders, correlate alerts, route tickets, and run agents | "First multi-agent IT support swarm" or implying that voting creates truth | **Evidence-Diverse Incident Board:** five bounded specialist perspectives produce observations while one supervisor records support, contradiction, freshness, provenance, disagreement, and the smallest discriminating test | P0 |
| Behavioral CMDB Mapping | Discovery, service mapping, topology, dependency inference, and reconciliation are established | "Scanners see only physical assets" or "first behavioral CMDB" | **Incident-Governed CMDB Drift:** verified incident evidence creates a reversible, reconciliation-aware candidate for owner review and never silently writes the authoritative CMDB | P0 |
| Zero-Trust Ephemeral Action Tunnel | Endpoint, DEX, RMM, and remote-support products already execute constrained actions with permissions and audit | Calling a tokenized client "zero trust" without validating the complete security claim | **Action-Bound Endpoint Capsule:** a future device-, case-, consent-, and action-bound execution envelope with explicit scope, rollback, and revocation | P1; simulated diagnostics only in P0 |
| Predictive Regression Guard | Observability, synthetic testing, endpoint remediation, and post-incident practices already create tests and runbooks | "Predictive" without a prospective model and validated forward prediction | **Incident-to-Regression Guard:** turn verified evidence, preconditions, action, controls, and postconditions into a replayable regression artifact | P0 |
| Pre-Emptive Interception | AIOps, DEX, monitoring, and support products proactively detect or communicate issues | "First support system that fixes issues before tickets" | **Consented Diagnostic Capsule:** P0 offers a simulated, user-approved diagnostic snapshot after intake; a future client may offer diagnostics before submission without silently acting | Simulated P0; real/proactive P1 |

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
- Do not convert vendor customer stories or ROI studies into ResolveMesh performance claims.
- Do not claim global novelty, production superiority, patentability, or proven savings.
- Recheck product packaging, acquisitions, and live official pages before a public comparison.

## Product Scope

### P0: Judge-Visible Product Spine

- One fictional enterprise and one ambiguous employee IT incident spanning Application, EUX, Server, Network, and Cloud evidence.
- Minimal portal intake plus a permanently labeled simulated Teams interaction that continues the same incident.
- One real Alibaba-hosted Qwen supervisor coordinating five bounded specialist capabilities.
- A simulated consented diagnostic capsule with a visible, limited collection purpose.
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

- A real Action-Bound Endpoint Capsule only after its consent, identity, scope, reversibility, revocation, privacy, and safety proposition is validated.
- Proactive diagnostic offers triggered by endpoint, DEX, or monitoring signals.
- Production connectors for identity, Teams, ITSM, observability, CMDB, change, endpoint, and service-mapping products.
- More incidents, applications, tenants, policy packs, roles, and scheduled regressions.
- Longitudinal learning from owner decisions and prospectively validated service-risk models.
- Enterprise policy administration and production-grade trust capabilities.

### Non-Goals

- No real endpoint client, privileged endpoint action, or remote control in P0.
- No real mutation of DNS, VPN, routes, cloud, servers, applications, CMDB, Teams, ticketing, or change platforms in P0.
- No replacement help desk, AIOps platform, observability suite, remote-support product, discovery scanner, authoritative CMDB, or autonomous change-management system.
- No unrestricted agent collective, majority voting, debate theater, hidden chain-of-thought display, or model-selected authority.
- No autonomous authoritative CMDB write, regardless of confidence.
- No generic dashboard, chatbot mascot, topology animation, or broad asset browser as a substitute for the resolution loop.
- No claims of "zero trust," "predictive," "first multi-agent," "self-healing," global novelty, production readiness, compliance, or proven financial impact.

Detailed technical boundaries and system design belong in [architecture.md](architecture.md). Implementation acceptance, test coverage, fixtures, and delivery execution belong in [implementation.md](implementation.md).

## Pilot Metrics And ROI Hypotheses

ResolveMesh currently claims no savings, resolution-rate lift, CMDB-accuracy gain, or production performance improvement. A pilot must define an eligible cohort using an agreed ambiguity rubric and compare it with the current process using explicit denominators.

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

| Published criterion | ResolveMesh positioning |
|---|---|
| Innovation & Originality | A conservative competitor audit acknowledges established components and positions the required proof-carrying chain as a hypothesis to validate, rather than relying on a generic agent novelty claim |
| AI Integration & Depth | Real Alibaba-hosted Qwen coordinates bounded specialist evidence gathering, compares support and contradiction, identifies missing evidence, proposes discriminating tests, and extracts service-risk cues |
| Technical Execution & Architecture | The product concept has a clear boundary between AI judgment and authoritative action, with sandboxing, exact approval, independent verification, governed CMDB learning, and replayable regression; technical detail is in [architecture.md](architecture.md) |
| Impact & Business Feasibility | The product has named users and a buyer hypothesis, overlays existing enterprise systems, and defines pilot metrics with denominators while avoiding unsupported ROI claims |
| Pitch & Demo Delivery | The story transforms a minimal ambiguous request into inspectable cross-domain evidence, a verified bounded resolution, a governed CMDB candidate, and a reusable regression |

## Risks And Open Questions

### Organizer Questions

| Question | Consequence | Required clarification |
|---|---|---|
| Is August 31 the authoritative deadline, and can the filed entry still be updated? | Work may not be eligible or attachable | Obtain written organizer confirmation before relying on the extended date or update path |
| Does Track 06 require QwenWork/QoderWork specifically, or does direct Alibaba-hosted Qwen satisfy the ecosystem requirement? | Submission eligibility could differ from the product interpretation | Ask organizers and document the exact accepted component |
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
| Does live Qwen provide reliable structured behavior for the intended experience? | Variation could weaken the demo and product trust | Validate on representative cases while keeping product claims bounded |
| Are MuleRun or other orchestration products necessary to customer value? | Optional tooling can distract from the core product | Treat orchestration vendor choice as non-differentiating and optional |
| What data retention and enterprise trust expectations apply? | The evidence layer touches sensitive operational context | Validate requirements before production positioning; do not claim compliance in P0 |
| Could the ResolveMesh name conflict with an existing mark? | Renaming late can affect submission and identity | Perform a name and trademark check before external launch |

### Market And Claim Risks

- Competitor documentation can change, and public pages do not reveal all deployed workflows.
- ServiceNow, Atomicwork, and Rezolve.ai are close enough that broad novelty language is not credible.
- Endpoint remediation, proactive support, CMDB discovery, approvals, and regression testing are established categories.
- A fictional demonstration can illustrate workflow coherence but cannot prove diagnostic accuracy, generalization, production safety, or ROI.
- ServiceNow identification and reconciliation concepts are a design reference only; ResolveMesh has no ServiceNow certification, compatibility claim, or production integration in P0.

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

ResolveMesh is the sole canonical idea. Preserve its proof-carrying product spine: real Alibaba-hosted Qwen, bounded cross-domain evidence, explicit disagreement, the smallest discriminating sandbox test, exact role-appropriate action approval, independent technical and employee verification, proposal-first CMDB drift, and incident-derived regression.

Do not turn P0 into a real endpoint client, broad ITSM suite, autonomous CMDB writer, or unsupported novelty, performance, security, or savings claim. Proceed with implementation or submission updates only if the organizer deadline and update path are confirmed. See [architecture.md](architecture.md) for technical design and [implementation.md](implementation.md) for implementation and validation details.
