# Track 06 Decision Hub: Enterprise Customer Support

**Decision date:** 2026-08-23  
**Evidence access date:** 2026-08-23  
**Planning horizon:** four-day delivery target, August 24-27; the deck's later August 31 submission deadline is usable only if coordinators confirm it in writing  
**Recommended build:** **ResolveGuard**, a Qwen-powered, policy-gated omnichannel resolution supervisor for one e-commerce service-recovery workflow

This document is the Step 6 synthesis hub. It turns the five source dossiers into one build decision; it does not replace their detailed evidence or the official event material.

## Mission and constraints

### Mission

Build a functional Track 06 prototype that resolves a concrete enterprise support problem rather than merely generating answers. The product must make AI central, visibly use the Alibaba Cloud/Qwen ecosystem, and create an end-to-end live moment that judges can understand without reading the architecture first.

The official Track 06 scope is:

> "Autonomous AI agents, omnichannel workflow automation, ticket resolution, and sentiment analysis."

Source: [kickoff-deck Track 06 transcription](aibuildathon.imssa.lk.md#problem-tracks---choose-your-problem-space).

### Non-negotiable requirements

| Area | Working requirement | Consequence for the build |
|---|---|---|
| Real-world impact | Address a defined problem in one official track. | Name a buyer, a narrow workflow, the current failure, and measurable outcomes. |
| AI at the core | ML, LLMs, or GenAI must be central. | Qwen must classify, retrieve/reason, plan, or verify; it cannot be a cosmetic text generator. |
| Ecosystem integration | Leverage Alibaba Cloud AI tools and be powered by the Qwen ecosystem; the deck inconsistently writes the companion product as `QwenWork` and `Qwenwork`. | Show Qwen and Alibaba/MuleRun components in the live trace, architecture, README, and video. |
| Functional prototype | A testable live demo, not static wireframes or slides. | At least one request must enter, use tools/data, change workflow state, and end in verified resolution or a useful escalation. |
| Deliverables | GitHub repository, working demo video, and project documentation. | Freeze the reliable path early enough to record and document it. |
| Team and format | One to three University of Kelaniya students; web, mobile, agents/workflows, enterprise backends, and GenAI APIs are accepted. | Scope must fit the actual team, not a hypothetical post-hackathon organization. |

Primary details: [at-a-glance rules](aibuildathon.imssa.lk.md#at-a-glance-rules), [solution requirements](aibuildathon.imssa.lk.md#solution-guidelines--deliverables), and [accepted formats](aibuildathon.imssa.lk.md#accepted-formats).

### Rubric used for planning

The five published criteria have no disclosed weights. This hub therefore uses an **equal-weight planning score**, 1-5 on each criterion, for a maximum of 25. This is a comparison aid, not an official judging formula.

| Code | Published criterion | 1 means | 3 means | 5 means |
|---|---|---|---|---|
| **IO** | Innovation & Originality | Commodity clone or generic chatbot | Distinct combination in a known category | Clearly differentiated mechanism addressing evidenced whitespace |
| **AI** | AI Integration & Depth | AI is decorative | One meaningful model capability plus grounding/tools | Multiple necessary, inspectable AI capabilities with evaluation and safe failure |
| **TA** | Technical Execution & Architecture | Mostly mocked or fragile | Coherent working MVP with limited safeguards | Stable end-to-end system, clear boundaries, cloud usage, observability, and recovery |
| **IB** | Impact & Business Feasibility | Vague user/value | Credible buyer and directional metric | Urgent evidenced pain, measurable value, and plausible adoption path |
| **PD** | Pitch & Demo Delivery | Static or hard to follow | Working but ordinary flow | Short, legible transformation with visible stakes, failure handling, and outcome |

Rubric wording and official evidence expectations: [Evaluation Criteria & Rubric](aibuildathon.imssa.lk.md#evaluation-criteria--rubric) and [Rubric-to-Evidence Checklist](aibuildathon.imssa.lk.md#rubric-to-evidence-checklist).

### Time and deadline policy

- The kickoff deck says cloud credits arrive **August 24**, the build period is **August 24-30**, and submission is **August 31, 2026**.
- The public website says submission is **August 27, 2026** and elsewhere says the build lasts "two weeks."
- Treat **August 27** as the controlling operational deadline unless coordinators confirm August 31 in writing; this leaves four calendar days from the August 24 credit release.
- The deck separately defines a seven-day August 24-30 build period followed by its August 31 submission date. Use August 28-30 only if that later schedule is confirmed, and only for reliability, polish, evaluation, video, and documentation rather than a second major workflow.

See [submission deadline conflict](aibuildathon.imssa.lk.md#1-submission-deadline-august-27-vs-august-31) and [operational interpretation](aibuildathon.imssa.lk.md#operational-interpretation-pending-confirmation).

## File index

| File | What it answers |
|---|---|
| [Event source](aibuildathon.imssa.lk.md) | What is required, how Track 06 is worded, what judges score, what must be submitted, and which dates/names remain contradictory. |
| [Hacker News dossier](news.ycombinator.com.md) | What practitioners and customers say current support automation gets wrong, which failures create trust or liability, and which product shapes they consider useful. |
| [Techmeme dossier](techmeme.com.md) | Where enterprise-agent and CX investment is moving, which categories are crowded, and why governance, context, observability, and verified outcomes are strategic. |
| [TLDR dossier](tldr.tech.md) | Which recent agent architectures, memory/tool patterns, permission controls, evaluation methods, and product lessons transfer to Track 06. |
| [Startup Battlefield 200 dossier](techcrunch.com.md) | What 200 current startups are building, which support-adjacent mechanics recur, and where the cohort leaves defensible whitespace. |
| `context.md` | The cross-source synthesis, ranked choices, effort model, and final recommendation. |

## Cross-source synthesis

Only themes corroborated by at least three distinct research dossiers are included below. Convergence establishes that a problem is real and strategically relevant; **whitespace or a distinct mechanism**, not convergence alone, is the novelty evidence.

| Theme | Corroboration across distinct dossiers | Decision implication |
|---|---|---|
| **Resolution must produce an outcome, not another answer.** | HN users explicitly distinguish remediation from FAQ deflection ([pain point 1](news.ycombinator.com.md#1-deflection-is-not-resolution)); Techmeme says long-horizon CX capability is moving toward controlled multi-step resolution and verification ([enterprise agents](techmeme.com.md#enterprise-ai-agents)); TLDR recommends act, verify backend state, then report resolution ([adjacent architecture](tldr.tech.md#adjacent-but-useful-architecture-material)); Battlefield patterns separate execution from verification and connect diagnosis to remediation ([Bounty](techcrunch.com.md#6-bounty), [Vitrobot](techcrunch.com.md#156-vitrobot)). | Optimize for verified resolution, repeat-contact reduction, and time to safe resolution, not ticket deflection or answer count. |
| **Cross-channel continuity requires a canonical case, not multiple inboxes.** | HN documents duplicate reports and lost context across Discord, GitHub, forum, and email ([pain point 5](news.ycombinator.com.md#5-cross-channel-duplication-loses-context-and-engineering-time)); Techmeme calls omnichannel table stakes and identifies continuity as an open opportunity ([CX moves](techmeme.com.md#customer-service-and-cx-platform-moves)); TLDR recommends a channel-neutral case schema and durable scoped memory ([direct support signal](tldr.tech.md#direct-support-and-enterprise-workflow-signal)); Battlefield finds Pocodot spans messaging, email, and phone while whitespace remains in auditable omnichannel resolution ([Pocodot](techcrunch.com.md#21-pocodot), [whitespace](techcrunch.com.md#whitespace-in-this-cohort)). | Build only two real/simulated adapters, but make the shared case ID, facts, sentiment trend, and prior actions visibly persist. |
| **Safe autonomy needs deterministic authority boundaries.** | HN incidents show fabricated policy and sensitive support-layer security failures ([pain points 2 and 9](news.ycombinator.com.md#2-hallucinated-policy-is-a-financial-and-reputational-failure)); Techmeme reports agent-containment failures and calls for scoped tools, limits, approval, and immutable traces ([enterprise agents](techmeme.com.md#enterprise-ai-agents)); TLDR recommends short-lived case-scoped capabilities and per-action checks ([safety and permissions](tldr.tech.md#safety-permissions-observability-and-evaluation)); Battlefield includes HODOR, Trinitite, Straiker, Tzun, and Verapath around permission, proof, tests, and audit ([transferable patterns](techcrunch.com.md#transferable-patterns-worth-stealing)). | Let Qwen propose; let deterministic code authorize. Every action needs schema validation, policy evidence, a receipt, and an escalation path. |
| **Human handoff is a designed successful outcome.** | HN repeatedly asks for a low-friction human exit and favors AI-prepared context ([pain point 3](news.ycombinator.com.md#3-customers-need-a-visible-low-friction-human-exit)); Techmeme identifies evidence-complete escalation as whitespace ([opportunity map](techmeme.com.md#what-the-evidence-leaves-open)); TLDR highlights the competence/judgment gap and explicit human approval ([direct support signal](tldr.tech.md#direct-support-and-enterprise-workflow-signal)); Battlefield examples verify uncertainty before alerting people and combine digital guidance with human help ([Care Mojo](techcrunch.com.md#25-care-mojo), [LumenUs](techcrunch.com.md#31-lumenus)). | Do not score every escalation as failure. Score whether it occurred at the right time and whether the human received an actionable packet. |
| **Evaluation and outcome verification are product features.** | HN voice teams and domain experts describe production eval difficulty ([Support Replay Lab evidence](news.ycombinator.com.md#4-support-replay-lab-adversarial-evals-from-real-failure-patterns)); Techmeme reports major funding/acquisition signal for real-world evals and AI observability ([models and infrastructure](techmeme.com.md#models-and-infrastructure-relevant-to-agents)); TLDR specifies replayable trajectory scoring and a minimal support eval suite ([minimal evaluation suite](tldr.tech.md#minimal-evaluation-suite-for-the-prototype)); Battlefield shows simulated users, conversational crash tests, and verified agent output ([transferable patterns](techcrunch.com.md#transferable-patterns-worth-stealing)). | Ship 8-12 deterministic scenarios and expose pass/fail for grounding, policy, action result, escalation, and continuity. Avoid a purely subjective LLM judge. |
| **Sentiment is useful only when combined with operational signals and action.** | HN rejects decorative labels and recommends combining trajectory with repeat contact and failed actions ([Sentiment Delta Router](news.ycombinator.com.md#6-sentiment-delta-router-not-sentiment-labeling)); Techmeme names sentiment-aware priority, SLA, style, and escalation as whitespace ([opportunity map](techmeme.com.md#what-the-evidence-leaves-open)); TLDR says sentiment trend should change behavior and warns not to equate fluency with resolution ([minimal evaluation suite](tldr.tech.md#minimal-evaluation-suite-for-the-prototype)); Battlefield patterns combine voice, recurrence, and event signals while warning against generic sentiment dashboards ([transferable patterns](techcrunch.com.md#transferable-patterns-worth-stealing), [crowded spaces](techcrunch.com.md#crowded-spaces-to-avoid)). | Model frustration/urgency as uncertain evidence. Let trend plus objective failures change queue, SLA, tone, or approval, and show why. |
| **Proactive support can prevent the ticket, but must still close the loop.** | TLDR highlights an always-on customer-watch agent that detects failures before contact ([direct support signal](tldr.tech.md#direct-support-and-enterprise-workflow-signal)); Techmeme says enterprise context and real workflow traces are becoming funded layers ([enterprise agents](techmeme.com.md#enterprise-ai-agents)); Battlefield's GuideAI, ChargeMate, Airs ML, and Motion Sync detect friction or failure early ([transferable patterns](techcrunch.com.md#transferable-patterns-worth-stealing)); HN's knowledge-freshness and root-cause guidance supports feeding unresolved clusters back into reviewed fixes ([pain point 4](news.ycombinator.com.md#4-knowledge-freshness-and-retrieval-quality-dominate-model-fluency)). | Proactive detection is a strong differentiator, but in eight days it should be one seeded event source feeding the same resolution engine, not a general telemetry platform. |
| **The model is not the moat; the support-specific harness is.** | HN calls out the need for case graph, permissions, evidence, adapters, and evaluation beyond RAG ([defensible architecture](news.ycombinator.com.md#a-defensible-support-agent-architecture)); Techmeme says model quality and price are perishable while systems quality compounds ([models cluster](techmeme.com.md#why-this-cluster-matters-2)); TLDR says completed work comes from integrations, persistence, orchestration, oversight, and evals ([founder lessons](tldr.tech.md#founders-and-product-lessons)); Battlefield marks generic copilots, autonomous agents, RAG, and generic governance as crowded ([crowded spaces](techcrunch.com.md#crowded-spaces-to-avoid)). | Use Qwen centrally and visibly, but spend build time on case state, policy, action receipts, evaluation, and demo reliability. |

## Evidence-backed problem candidates

| Candidate problem | Evidence of pain | Buyer and measurable outcome | Eight-day boundary |
|---|---|---|---|
| **Unsupported policy claims cause financial and trust damage.** | Cursor's bot invented account policy and Air Canada's wrong chatbot policy created liability ([HN pain point 2](news.ycombinator.com.md#2-hallucinated-policy-is-a-financial-and-reputational-failure)); Techmeme separately argues for deterministic policy around actions ([architecture opportunity](techmeme.com.md#why-this-cluster-matters-2)). | Support operations/compliance lead; unsupported-claim rate, policy-citation coverage, prevented unsafe actions, and approval time. | One small versioned policy corpus, two conflicting versions, and two action types. |
| **Customers repeat context when a case crosses channels.** | Cross-channel duplicates increase engineering work on HN ([pain point 5](news.ycombinator.com.md#5-cross-channel-duplication-loses-context-and-engineering-time)); Omilia and Meta show channel reach is already commoditizing ([Techmeme CX moves](techmeme.com.md#customer-service-and-cx-platform-moves)); Battlefield still finds auditable continuity absent ([whitespace](techcrunch.com.md#whitespace-in-this-cohort)). | Support operations lead; duplicate-case rate, repeated-question rate, handling time, and time to route. | Web chat plus simulated WhatsApp/email; no production telecom integration. |
| **AI escalations arrive too late or without usable evidence.** | HN users fear being trapped and favor context preparation ([pain point 3](news.ycombinator.com.md#3-customers-need-a-visible-low-friction-human-exit)); Techmeme and Battlefield both identify evidence-complete/uncertainty-aware handoff as whitespace ([Techmeme opportunity map](techmeme.com.md#what-the-evidence-leaves-open), [Battlefield whitespace](techcrunch.com.md#whitespace-in-this-cohort)). | Contact-center manager; escalation precision, human review time, customer repetition, and SLA breaches. | One queue, three escalation reasons, one editable handoff card. |
| **Teams cannot tell whether a fluent agent is safe or effective.** | HN reports production voice-eval complexity ([idea seed](news.ycombinator.com.md#4-support-replay-lab-adversarial-evals-from-real-failure-patterns)); Techmeme reports Vals funding and Dynatrace/Arize convergence ([models and infrastructure](techmeme.com.md#models-and-infrastructure-relevant-to-agents)); Battlefield shows direct simulation and crash-test patterns ([transferable patterns](techcrunch.com.md#transferable-patterns-worth-stealing)). | AI/CX product owner; scenario pass rate, policy violations, correct escalation, latency, and cost per successful resolution. | Eight to twelve seeded scenarios; deterministic checks plus limited evidence entailment. |
| **Support reacts after a known operational failure instead of before frustration peaks.** | TLDR's Customer Watch monitors usage and payment failures ([direct signal](tldr.tech.md#direct-support-and-enterprise-workflow-signal)); Battlefield's GuideAI and ChargeMate link intervention with issue prevention/root cause ([transferable patterns](techcrunch.com.md#transferable-patterns-worth-stealing)); Techmeme validates workflow context as a funded enterprise layer ([enterprise agents](techmeme.com.md#enterprise-ai-agents)). | E-commerce/CX operations lead; prevented contacts, time from failure to intervention, recovery acceptance, and sentiment recovery. | One mock fulfillment event stream and one remedy workflow. |
| **Sentiment labels do not identify high-effort or churn-risk cases reliably.** | HN notes repeat failures and polite repeated contacts can be higher risk than angry first contacts ([Sentiment Delta Router](news.ycombinator.com.md#6-sentiment-delta-router-not-sentiment-labeling)); Techmeme and TLDR require sentiment to change operations ([Techmeme opportunity map](techmeme.com.md#what-the-evidence-leaves-open), [TLDR eval suite](tldr.tech.md#minimal-evaluation-suite-for-the-prototype)). | Queue manager; correct priority, avoidable escalation, SLA compliance, and sentiment recovery. | English plus a few curated Sinhala/English code-switched cases; no broad fairness claim. |
| **Support knowledge drifts as products and policy change.** | HN cites DocCharm's reviewed update loop and Air Canada comments about stale policy ([pain point 4](news.ycombinator.com.md#4-knowledge-freshness-and-retrieval-quality-dominate-model-fluency)); TLDR recommends versioned procedures and policy versions in traces ([agent architecture](tldr.tech.md#agent-architecture-memory-tools-coordination-and-long-horizon-work)); Battlefield identifies expert knowledge with provenance as a reusable pattern ([transferable patterns](techcrunch.com.md#transferable-patterns-worth-stealing)). | Knowledge/compliance owner; stale-answer rate, update lead time, affected-case coverage, and regression pass rate. | One mock product-change event, one draft update, human approval, and replay. |

## Ranked idea shortlist

### Ranking summary

Scores are equal-weight and reflect the **scoped MVP described here**, not an unconstrained product vision. Ties are broken first by direct coverage of all four Track 06 capabilities, then by delivery confidence before the August 27 operational deadline.

| Rank | Idea | IO | AI | TA | IB | PD | Total / 25 | Delivery view |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| **1** | **ResolveGuard: policy-gated omnichannel resolution supervisor** | 5 | 5 | 4 | 5 | 5 | **24** | Best rubric coverage if held to one domain, two channels, and two actions. |
| **2** | **Policy Circuit Breaker: runtime proof layer for support AI** | 5 | 5 | 5 | 4 | 5 | **24** | Narrower and safest high-quality build; ranked second because it covers omnichannel and sentiment less naturally. |
| **3** | **Support Replay Lab: outcome-level agent evaluation** | 5 | 5 | 4 | 4 | 5 | **23** | Strong technical demonstration and reliable fallback; buyer story is one layer removed from frontline support. |
| **4** | **HandoffOS: evidence-complete AI-to-human escalation** | 4 | 4 | 5 | 4 | 4 | **21** | Very feasible and valuable, but easier for judges to view as an incremental agent-assist feature. |
| **5** | **Recovery Radar: proactive service-failure resolution** | 5 | 4 | 3 | 5 | 4 | **21** | Strong business wedge and novelty; event ingestion plus action workflow increases integration risk. |
| **6** | **ChannelTwin: reversible cross-channel case and duplicate resolver** | 4 | 4 | 4 | 4 | 4 | **20** | Clear pain and demo, but narrower AI depth and crowded omnichannel framing require careful positioning. |

### Build-cost scale

Cost is **prototype implementation effort**, not cloud spend. Estimates are team-person-days and include integration, minimal UI, seeded data, tests, deployment, and demo hardening. They do not include discovery already completed here.

| Cost score | Estimated effort | Meaning before the safe August 27 target |
|---:|---:|---|
| **1** | 1-4 person-days | Comfortable for one builder; substantial polish time remains. |
| **2** | 5-7 person-days | Feasible for two contributors, or one experienced builder only if August 31 is confirmed. |
| **3** | 6-11 risk-adjusted person-days | Needs two to three contributors, aggressive reuse, or carries meaningful platform/integration uncertainty. |
| **4** | 12-16 person-days | Not safe for August 27 without cutting scope; possible only with three contributors and a confirmed extension. |
| **5** | 17+ person-days | Not realistic for this event without removing core functionality. |

Path assumptions:

- **Full-stack web:** custom customer and operator surfaces, API/backend, database, workflow logic, and Alibaba/Qwen API integration.
- **Python light UI:** Python service with Streamlit/Gradio-style operator UI, SQLite or a small managed store, and Qwen integration; customer channels are simple forms or simulators.
- **MuleRun/Qwen-led:** a confirmed Alibaba-hosted Qwen endpoint performs central model steps; MuleRun may own triggers/workflow orchestration if its real path is proven. Only a thin custom operator/evidence UI is built.

### 1. ResolveGuard: policy-gated omnichannel resolution supervisor

**Product.** A narrow e-commerce service-recovery agent maintains one case across web chat and a simulated WhatsApp-style channel. Alibaba-hosted Qwen extracts intent and risk, retrieves versioned policy and live mock-order facts, and proposes a replacement or recovery credit. Deterministic code permits an eligible replacement and requires approval for every recovery credit. A verifier checks the mock order system before closure. Sentiment **trajectory plus repeat contact and failed delivery events** changes priority and escalation.

**Rubric justification**

| Criterion | Score | Why |
|---|---:|---|
| IO | **5** | The differentiator is not chat or omnichannel reach; it is the combination of a channel-independent case, evidence-bound authority, outcome verification, and a complete resolution ledger in support-specific whitespace. |
| AI | **5** | Qwen is necessary for intent/risk extraction, evidence synthesis, policy-aware planning, multilingual handling, response generation, and handoff composition; deterministic read-back verifies backend outcomes. Replayed evaluations test these components. |
| TA | **4** | Canonical state, typed tool calls, a deterministic policy gateway, action receipts, and an append-only trace are architecturally strong, but two channels plus an operator UI create delivery risk. |
| IB | **5** | It targets repeat contact, unsupported remedy promises, slow handoffs, and incomplete resolution with metrics a support leader can evaluate. It overlays an existing help desk rather than requiring replacement. |
| PD | **5** | A frustrated cross-channel customer, an approval-gated recovery credit, parameter-bound human approval, and downstream verification form a complete, high-stakes story in minutes. |

**Novelty evidence.** The Battlefield cohort found no company centered on channel-independent memory plus evidence-backed answers, safe execution, and a resolution ledger ([auditable omnichannel whitespace](techcrunch.com.md#whitespace-in-this-cohort)); Techmeme says generic agents and channel reach are crowded while policy-gated action and verified resolution remain open ([opportunity map](techmeme.com.md#track-06-opportunity-map)). HN likewise defines the novelty boundary as a control plane rather than another help desk ([ResolveGraph](news.ycombinator.com.md#1-resolvegraph-evidence-bound-resolution-control-plane)).

**Impact evidence.** Customers seek remediation, not FAQ repetition ([HN deflection evidence](news.ycombinator.com.md#1-deflection-is-not-resolution)); wrong policy has caused liability and cancellations ([HN policy failures](news.ycombinator.com.md#2-hallucinated-policy-is-a-financial-and-reputational-failure)); major CX funding and acquisitions validate category attention and make a focused overlay more credible than a new suite, but do not prove willingness to pay for ResolveGuard ([Techmeme funding and M&A](techmeme.com.md#funding-ma-and-adjacent-agent-infrastructure)).

**Demo moment.** A customer reports a delayed order in web chat, then reports damage and requests compensation through a simulated WhatsApp-style channel. The same case continues without repeated questions; Qwen cites policy, the gateway has already allowed one replacement, and it routes a proposed recovery credit for role-bound approval. A supervisor reduces the amount to the LKR 1,500 limit, creating a new proposal and policy decision before one-time approval; the verifier confirms both mock backend states before customer-confirmed closure.

| Build path | Cost | Person-days | Scope and tradeoff |
|---|---:|---:|---|
| Full-stack web | **4** | 13-16 | Best visual polish and architecture story; viable for three contributors, risky for one. |
| Python light UI | **3** | 9-11 | Fastest custom-code route; use two tabbed views and simulated channels rather than production messaging APIs. |
| MuleRun/Qwen-led | **3** | 6-8 | Preferred only with at least two contributors and immediate access: MuleRun may orchestrate workflow triggers and tools, but central reasoning must use a confirmed Alibaba-hosted Qwen endpoint. |

**MVP cut line.** One retailer, one seeded policy corpus, one mock order API, web plus one simulated channel, replacement as the eligible auto-action, recovery credit as the approval action, and eight P0 release scenarios. No real money, payment, voice, full CRM, or production identity resolution.

### 2. Policy Circuit Breaker: runtime proof layer for support AI

**Product.** A Qwen-based middleware layer intercepts a drafted support answer or proposed action, extracts checkable claims, retrieves current policy, validates effective dates and customer prerequisites, and returns `allow`, `block`, or `human_review`. It stores the draft, evidence, policy version, decision, tool result, and approval in an inspectable trace.

**Rubric justification**

| Criterion | Score | Why |
|---|---:|---|
| IO | **5** | The demo product is a support-specific runtime safety mechanism tied to concrete policy harm, not generic governance or another answering agent. |
| AI | **5** | Claim extraction, retrieval/query reformulation, evidence entailment, contradiction detection, and risk classification make AI deep and testable. |
| TA | **5** | Its narrow request/gate/trace boundary is realistic to implement robustly, deploy, test, and explain within eight days. |
| IB | **4** | Liability, policy freshness, and auditability have clear enterprise value, though adoption requires integration into an existing agent or help desk and ROI is partly risk avoidance. |
| PD | **5** | A confident but false answer being stopped and corrected is immediate, visual, and resilient as a live demo. |

**Novelty evidence.** Generic AI governance is crowded in Battlefield, so differentiation must apply governance to a concrete support harm ([crowded governance](techcrunch.com.md#crowded-spaces-to-avoid)); no cohort product centers the support resolution ledger ([whitespace](techcrunch.com.md#whitespace-in-this-cohort)). HN's seed specifically frames the circuit breaker as a narrower, safer wrapper around a Qwen agent ([Policy Circuit Breaker](news.ycombinator.com.md#2-policy-circuit-breaker-for-support-agents)).

**Impact evidence.** Cursor and Air Canada show unsupported or stale policy can cause cancellation, financial liability, and reputational harm ([HN policy evidence](news.ycombinator.com.md#2-hallucinated-policy-is-a-financial-and-reputational-failure)). Techmeme's containment reporting and TLDR's case-scoped permission model show that runtime enforcement, not prompt-only restraint, is an enterprise need ([Techmeme agent failures](techmeme.com.md#enterprise-ai-agents), [TLDR safety controls](tldr.tech.md#safety-permissions-observability-and-evaluation)).

**Demo moment.** The underlying Qwen support agent confidently claims that a 30-day refund is available. The gate highlights the unsupported sentence, opens the current seven-day policy and customer purchase date, blocks the outbound answer and refund tool, and emits an auditable human-review card.

| Build path | Cost | Person-days | Scope and tradeoff |
|---|---:|---:|---|
| Full-stack web | **3** | 8-10 | Custom trace diff and policy evidence UI make the demo excellent without broad workflow work. |
| Python light UI | **2** | 5-7 | Strong one-builder choice; a side-by-side draft/evidence/decision interface is sufficient. |
| MuleRun/QwenWork-led | **1** | 3-4 | Qwen draft and verification steps plus deterministic gate and thin trace UI; lowest delivery risk. |

**MVP cut line.** Three policy classes, two versions, one account/order lookup, one blocked text claim, one blocked action, and ten replay cases. Do not attempt a universal policy language or production cryptographic signing.

### 3. Support Replay Lab: outcome-level agent evaluation

**Product.** A replay harness turns anonymized-style seeded support cases into tests, mutates channel, language, sentiment, stale policy, tool failure, and prompt-injection conditions, then compares two Qwen prompts/workflows. It scores evidence citation, expected action, prohibited action, correct escalation, case continuity, latency, and estimated cost.

**Rubric justification**

| Criterion | Score | Why |
|---|---:|---|
| IO | **5** | It evaluates complete support trajectories and resolution outcomes, not generic benchmark answers or a model-as-judge leaderboard. |
| AI | **5** | Scenario mutation, agent execution, entailment checks, intent/sentiment perturbation, and comparative analysis expose meaningful model behavior. |
| TA | **4** | A deterministic scenario runner and result store are achievable; reliable parallel runs and trace visualization need discipline. |
| IB | **4** | AI/CX teams have an evident deployment-quality problem, but the product sells to the platform team rather than directly resolving a customer's case. |
| PD | **5** | Showing the more fluent agent fail policy while the concise agent safely escalates creates a surprising, credible result. |

**Novelty evidence.** Battlefield finds support-agent digital twins and outcome grading absent despite strong simulation and red-team analogues ([support-agent digital-twin whitespace](techcrunch.com.md#whitespace-in-this-cohort)); HN defines the boundary as cross-channel, end-to-end support outcomes rather than generic LLM scores ([Support Replay Lab](news.ycombinator.com.md#4-support-replay-lab-adversarial-evals-from-real-failure-patterns)).

**Impact evidence.** Voice-agent builders report production reliability work and domain-authored edge cases as substantial bottlenecks ([HN evidence](news.ycombinator.com.md#4-support-replay-lab-adversarial-evals-from-real-failure-patterns)). Techmeme reports a $40M Vals round and a planned $915M Dynatrace/Arize acquisition as market evidence for real-world evaluation and observability ([models and infrastructure](techmeme.com.md#models-and-infrastructure-relevant-to-agents)); TLDR recommends release-gating prompts with replayable support scenarios ([safety and evaluation](tldr.tech.md#safety-permissions-observability-and-evaluation)).

**Demo moment.** Run the same refund case against two agent configurations. The polished, verbose configuration scores higher on tone but attempts a prohibited refund; the shorter configuration cites policy and escalates correctly, so the dashboard blocks the first configuration from release.

| Build path | Cost | Person-days | Scope and tradeoff |
|---|---:|---:|---|
| Full-stack web | **3** | 9-11 | Rich comparison and traces improve the pitch but add non-core UI work. |
| Python light UI | **2** | 6-7 | Natural fit for Python scenario fixtures, deterministic scorers, and a simple dashboard. |
| MuleRun/QwenWork-led | **2** | 5-7 | Good for workflow variants and runs; custom scoring/result visualization is still required. |

**MVP cut line.** Eight to twelve curated cases, two agent variants, five deterministic metrics, one narrow evidence-entailment check, and saved traces. No synthetic data platform or generalized benchmark authoring suite.

### 4. HandoffOS: evidence-complete AI-to-human escalation

**Product.** Qwen detects loops, insufficient evidence, deteriorating sentiment, requested human contact, or authority limits and compiles an editable packet with verified identity, goal, chronology, prior attempts, policy citations, sentiment trend, unresolved question, and recommended action. Deterministic routing assigns the case by skill and SLA.

**Rubric justification**

| Criterion | Score | Why |
|---|---:|---|
| IO | **4** | Uncertainty-aware escalation as a first-class output is differentiated, but incumbents can plausibly add summarization and routing. |
| AI | **4** | Loop/risk detection, evidence extraction, summarization, sentiment trajectory, and skill routing are meaningful but less agentically deep than controlled resolution. |
| TA | **5** | A compact event model, trigger rules, editable packet, and queue are highly deliverable and can be hardened well. |
| IB | **4** | Reduced customer repetition and handling time are credible, but value depends on fitting the buyer's current queue and escalation policy. |
| PD | **4** | The handoff is clear and relatable, though less visually dramatic than a blocked harmful action or verified resolution. |

**Novelty evidence.** Both Techmeme and Battlefield identify evidence-complete or uncertainty-aware escalation packets as open space ([Techmeme opportunity map](techmeme.com.md#what-the-evidence-leaves-open), [Battlefield whitespace](techcrunch.com.md#whitespace-in-this-cohort)); HN's specific context-compiler seed distinguishes it from ordinary ticket summaries ([HandoffOS](news.ycombinator.com.md#3-handoffos-a-context-compiler-from-ai-to-human)).

**Impact evidence.** HN users explicitly fear automation that hides a human and favor AI that prepares the account and issue before transfer ([human exit evidence](news.ycombinator.com.md#3-customers-need-a-visible-low-friction-human-exit)). TLDR's judgment-gap evidence and Battlefield's hybrid-service patterns support supervised automation as the credible enterprise model ([TLDR direct signal](tldr.tech.md#direct-support-and-enterprise-workflow-signal), [Battlefield escalation pattern](techcrunch.com.md#transferable-patterns-worth-stealing)).

**Demo moment.** After two failed remedies and a shift from neutral to frustrated language, the agent stops itself. The supervisor sees exactly what is verified, what failed, why the case escalated, and one proposed action, then resolves it without asking the customer to repeat anything.

| Build path | Cost | Person-days | Scope and tradeoff |
|---|---:|---:|---|
| Full-stack web | **2** | 6-7 | Custom timeline and supervisor queue fit comfortably if channel inputs remain simulated. |
| Python light UI | **1** | 3-4 | Lowest-risk complete prototype; Streamlit-style packet and queue are enough. |
| MuleRun/QwenWork-led | **1** | 2-4 | Trigger, compile, and route are workflow-native; only the editable approval surface needs custom work. |

**MVP cut line.** Three escalation triggers, one skill queue, two channels mapped to one timeline, and before/after handling-time measurement on five cases. No workforce management or production SLA integration.

### 5. Recovery Radar: proactive service-failure resolution

**Product.** A mock fulfillment/payment event triggers Qwen to assemble customer and policy context before a ticket exists, estimate likely impact, propose a permitted remedy, and notify the customer in their preferred channel. If the customer responds negatively or the remedy fails, the same case escalates with the entire proactive history.

**Rubric justification**

| Criterion | Score | Why |
|---|---:|---|
| IO | **5** | It changes the support trigger from inbound complaint to evidence-backed operational event and joins prevention with verified recovery. |
| AI | **4** | Qwen correlates events, assesses impact, selects a playbook, personalizes outreach, and interprets response, though seeded telemetry limits depth. |
| TA | **3** | Event ingestion, customer matching, outbound workflow, action execution, and verification create more integration points than the other ideas. |
| IB | **5** | Prevented contacts, reduced churn, faster recovery, and root-cause visibility create a strong buyer and ROI story. |
| PD | **4** | The before-the-customer-complains reveal is memorable, but a staged event can look overly scripted unless the trace is transparent. |

**Novelty evidence.** TLDR identifies proactive background support as stronger than waiting for tickets ([Customer Watch](tldr.tech.md#direct-support-and-enterprise-workflow-signal)); Battlefield says prevent-the-ticket is transferable but still finds root-cause repair and post-resolution trust repair open ([patterns](techcrunch.com.md#transferable-patterns-worth-stealing), [whitespace](techcrunch.com.md#whitespace-in-this-cohort)). Techmeme's crowded map suggests proactive recovery is a sharper claim than generic support automation ([crowded spaces](techmeme.com.md#what-is-crowded)).

**Impact evidence.** Battlefield's ChargeMate explicitly combines driver support, lower support cost, and visibility into what breaks ([ChargeMate](techcrunch.com.md#104-chargemate)); TLDR ties adoption to resolution, repeat-contact, and sentiment-recovery metrics ([direct support signal](tldr.tech.md#direct-support-and-enterprise-workflow-signal)); HN frames support quality as trust and revenue rather than only cost ([pain point 7](news.ycombinator.com.md#7-support-is-a-trust-and-revenue-function-not-merely-a-cost-center)).

**Demo moment.** A delayed-delivery event arrives before the customer contacts support. The agent opens a case, checks policy and inventory, offers a replacement delivery slot, then notices the customer's negative reply and failed prior promise, raises priority, and hands a recovery credit proposal to a human.

| Build path | Cost | Person-days | Scope and tradeoff |
|---|---:|---:|---|
| Full-stack web | **4** | 12-15 | Event console, customer view, operator view, and action backend are too broad for a solo build. |
| Python light UI | **3** | 8-10 | Feasible with a seeded event generator and simulated outbound channel. |
| MuleRun/QwenWork-led | **3** | 6-8 | Trigger/action orchestration is a good fit, but connector uncertainty pushes the range into cost 3; avoid real commerce and messaging integrations. |

**MVP cut line.** One delayed-order event, one inventory lookup, one remedy, one outbound simulator, and one escalation. No general anomaly detection or live merchant connector.

### 6. ChannelTwin: reversible cross-channel case and duplicate resolver

**Product.** Qwen embeds and compares reports from web chat, email, WhatsApp, GitHub, or Discord; structured identity and account evidence adjust the match confidence. The system suggests a merge into one canonical case, never silently merges, preserves source provenance, and posts resolution updates back to each simulated origin.

**Rubric justification**

| Criterion | Score | Why |
|---|---:|---|
| IO | **4** | Confidence-aware reversible merges plus synchronized resolution are stronger than a shared inbox, but cross-channel deduplication already has adjacent entrants. |
| AI | **4** | Semantic matching, entity extraction, identity confidence, issue clustering, and summary generation are central and evaluable. |
| TA | **4** | A canonical event model and reversible merge ledger are credible; authentic channel connectors would increase risk, so the MVP must simulate most transports. |
| IB | **4** | Duplicate workload and fragmented customer history are evidenced, though buyer value depends on volume and channel mix. |
| PD | **4** | Three differently worded reports becoming one incident is clear, but it has lower emotional stakes than unsafe action prevention. |

**Novelty evidence.** HN documents a recent cross-channel duplicate problem and SeaTicket response, so basic linking is not novel; the defensible boundary is explicit identity confidence, reversible merges, source provenance, and synchronized closure ([ChannelTwin](news.ycombinator.com.md#5-channeltwin-duplicate-case-and-identity-resolver)). Battlefield still identifies the broader auditable resolution ledger as absent ([whitespace](techcrunch.com.md#whitespace-in-this-cohort)).

**Impact evidence.** HN's July 2026 Ask HN says the same bug arriving through Discord, GitHub, forum, and email increases developer workload ([cross-channel pain](news.ycombinator.com.md#5-cross-channel-duplication-loses-context-and-engineering-time)). Techmeme says omnichannel continuity is expected and repeated context is a key exposed failure ([CX moves](techmeme.com.md#customer-service-and-cx-platform-moves)); TLDR recommends a canonical case as the source of truth ([direct support signal](tldr.tech.md#direct-support-and-enterprise-workflow-signal)).

**Demo moment.** A chat complaint, an email, and a GitHub issue use different wording and identities. ChannelTwin proposes one merge with evidence and confidence, an operator approves it, engineering marks one fix, and all three sources receive the update while the complete provenance remains visible.

| Build path | Cost | Person-days | Scope and tradeoff |
|---|---:|---:|---|
| Full-stack web | **3** | 9-11 | A merge review UI and three channel views are manageable for two contributors. |
| Python light UI | **2** | 5-7 | Seed channel events and focus on matching, merge review, and provenance. |
| MuleRun/QwenWork-led | **2** | 5-7 | Good for ingestion and fan-out, but merge-review state still needs a small custom store/UI. |

**MVP cut line.** Three simulated channels, six seeded reports, suggested merges only, one approval action, and one outbound update. No production identity provider or real bidirectional integrations.

## Recommendation

### Choose ResolveGuard

Build **ResolveGuard** with a confirmed **Alibaba-hosted Qwen endpoint** and thin custom case/approval dashboard; use MuleRun for orchestration only if its real workflow path is proven on August 24. It is the only locked concept that naturally demonstrates all four Track 06 phrases in one coherent scenario while also creating evidence for every rubric criterion.

The recommendation is conditional on ruthless scope:

- **Domain:** Sri Lankan e-commerce delayed/damaged-order recovery.
- **Channels:** web chat plus one explicitly simulated WhatsApp-style adapter.
- **Actions:** an eligible replacement can auto-execute; every recovery credit requires approval, with supervisor authority capped at LKR 1,500 and larger amounts routed to the policy owner.
- **AI:** Qwen performs case understanding, language-aware sentiment/urgency, retrieval and synthesis, resolution planning, and handoff composition. Keep authorization deterministic.
- **State:** one canonical `CaseState` and append-only event/action log.
- **Proof:** every policy claim cites a versioned source; every action returns a mock backend receipt; a verifier closes only after confirmed state.
- **Evaluation:** eight P0 release scenarios covering happy path, identity mismatch, cross-channel follow-up, effort-aware routing, role-bound approval, unknown tool outcome, prompt injection, and Sinhala/English code-switching, plus deterministic integration tests for the remaining state transitions.
- **Business metrics:** verified resolution rate, repeat-contact rate, safe automation rate, handoff completeness/review time, policy violations prevented, latency, and estimated cost per successful resolution.

This scope is realistic by August 27 at **6-8 team-person-days only with at least two contributors and immediate Alibaba-hosted Qwen access**. A solo team must explicitly re-scope ResolveGuard before implementation; Policy Circuit Breaker is not automatically a compliant Track 06 substitute. At the end of day 1, if MuleRun remains uncertain, switch to the Python light-UI path while preserving the real Alibaba-hosted Qwen integration and product contract. Do not spend day 2 debugging a nonessential connector.

### Deadline-safe delivery guardrail

| Date | Exit condition |
|---|---|
| **Aug 24** | A real Alibaba-hosted Qwen call drives one allowed mock action and independent read-back; policy, orders, and demo fixtures are fixed. Use MuleRun only if its workflow path also works; otherwise select Python orchestration. |
| **Aug 25** | One web request reaches a cited plan and executes a mock replacement with a receipt. |
| **Aug 26** | Second simulated channel rejoins the case; sentiment/effort trend changes routing; approval gate works. |
| **Aug 27** | Submittable vertical slice deployed, documented, and recorded once because this may be the real deadline. |
| **Aug 28** | Only if the extension is confirmed: verifier, escalation packet, and core 8-12-case evaluation set are improved. |
| **Aug 29** | Only if confirmed: harden failure handling, trace/eval dashboard, and business metrics. |
| **Aug 30** | Only if confirmed: final demo rehearsal, video, README/architecture, and feature freeze. |
| **Aug 31** | Submission only if the deck deadline is confirmed and the portal remains open. |

### Runner-up: Policy Circuit Breaker, not the locked build

**Policy Circuit Breaker remains the research runner-up, not a pre-approved implementation fallback.** Switching products requires a new scope review proving all four Track 06 capabilities and Alibaba-hosted Qwen compliance. If the full ResolveGuard scope is too large, reduce nonessential UI and P1 evaluation surfaces first while preserving canonical continuity, service-risk routing, one bounded action, approval, and verification.

## Open questions and risks

| Risk or question | Why it matters | Action / mitigation |
|---|---|---|
| **Is the deadline Aug 27 or Aug 31?** | Missing the controlling portal date is fatal. | Ask coordinators immediately; maintain a complete Aug 27 submission package. See the [draft coordinator message](aibuildathon.imssa.lk.md#coordinator-message-draft---do-not-send-automatically). |
| **Where is the submission portal?** | No reviewed source publishes its URL. | Request URL, account requirements, and update policy now; do not leave upload discovery to deadline day. |
| **Do QoderWork, QwenWork, and Qwenwork refer to the same tool?** | The website and two deck slides use different naming/capitalization, and ecosystem usage may be an eligibility gate. | Ask which product must be shown; document every actual Qwen/Alibaba component used. See [naming conflict](aibuildathon.imssa.lk.md#3-qoderwork-vs-qwenwork). |
| **When and how much cloud credit is available?** | Credit delay or limits can block the preferred architecture. | Validate access on Aug 24; keep fixtures and Python fallback runnable locally; cache demo outputs only as a fallback, not as the presented live path. |
| **Are rubric criteria equally weighted?** | This ranking assumes equal planning weight because none is published. | Keep evidence for all five and ask for weights/tie-breaks; avoid optimizing only for technical novelty. |
| **What are the video and finale rules?** | Unknown duration, hosting, visibility, pitch time, Q&A, and fallback policy affect presentation design. | Request limits; produce a concise 3-5 minute cut that stands alone and retain a longer walkthrough. |
| **Can work start before Aug 24?** | The deck labels Aug 24-30 as the ideate/build period, but the website says two weeks. | Clarify existing-code and start-date rules; preserve commit history and disclose reused scaffolding. |
| **MuleRun/QwenWork integration uncertainty** | The estimated cost advantage disappears if connectors, APIs, or credentials are immature. | Time-box platform validation to day 1; use simulated webhooks and a thin Python service if needed while keeping Qwen central. |
| **Over-scope** | A help desk, live WhatsApp, voice, payment, multilingual production quality, and analytics cannot all be built safely before August 27. | Enforce the recommendation's cut line; production channels, voice, and real refunds are explicitly post-event. |
| **Demo data looks fake** | Seeded orders and policy are necessary but can undermine credibility. | Use coherent fixtures, show the source records and action receipts, and clearly label simulated systems rather than implying production integration. |
| **Sentiment overclaim or bias** | Sarcasm, dialect, and code-switching make emotion labels uncertain. | Call it service-risk/effort evidence, show highlighted cues and confidence, combine with objective events, permit correction, and avoid psychological inference. |
| **Policy verifier becomes another hallucinating model** | An LLM judging an LLM is not deterministic safety. | Use code for dates, amounts, eligibility, permissions, and tool schemas; use Qwen for extraction/entailment with citations and abstain on ambiguity. |
| **Unsafe or irreversible actions** | Refunds, account changes, and disclosures can create real harm. | Use mock systems only in the demo, least privilege, limits, human approval, idempotency keys, immutable traces, and post-action verification. |
| **No credible ROI baseline** | Funding figures prove category interest, not this prototype's economics. | Present measurable pilot hypotheses, not invented savings. Compare the demo against retrieval-only behavior on fixed cases. |
| **Battlefield evidence limits** | Four startup sites remained unresolved after browser-render fallback, and public descriptions/claims were not independently validated. | Treat cohort whitespace as directional novelty evidence, not proof that no product exists globally. See [uncertainty register](techcrunch.com.md#unreachable-and-uncertainty-register). |

## Sources

All five dossiers and their embedded primary sources were accessed or verified **2026-08-23**. Financial figures, vendor benchmarks, product performance claims, and HN comments remain attributed evidence rather than audited facts.

- [AI Buildathon official-site and kickoff-deck dossier](aibuildathon.imssa.lk.md), including the official website at <https://aibuildathon.imssa.lk/> and five local deck screenshots. Accessed 2026-08-23.
- [Hacker News support-AI dossier](news.ycombinator.com.md), based on HN Algolia, official Firebase endpoints, linked reports, and mined discussion threads. Accessed 2026-08-23.
- [Techmeme enterprise-AI/CX dossier](techmeme.com.md), based on the [Techmeme front page](https://www.techmeme.com/), [River](https://www.techmeme.com/river), dated snapshots, clusters, and linked publishers. Accessed 2026-08-23.
- [TLDR AI/Tech/Founders/Product dossier](tldr.tech.md), exhaustively checking 120 newsletter/date combinations from 2026-07-13 through 2026-08-21 and retaining relevant evidence from all 90 published issues. Accessed 2026-08-23.
- [TechCrunch Startup Battlefield 200 dossier](techcrunch.com.md), based on the [canonical 2026 cohort article](https://techcrunch.com/2026/08/20/the-2026-startup-battlefield-200-is-here-see-who-made-the-cut/), its WordPress API record, and all 200 listed company sites. Accessed or attempted 2026-08-23.

Research method, caveats, and full primary URL lists remain in each dossier's `Sources` and evidence-limits sections. The shortlist scores and cost estimates are this hub's planning judgments, not claims made by those sources or by the organizers.
