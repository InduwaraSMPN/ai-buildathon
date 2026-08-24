# Recovery Radar

**Status:** SCOPE-LOCKED ALTERNATIVE, NOT SELECTED  
**Decision date:** 2026-08-23  
**Shortlist position:** #5  
**Track:** [06 - Enterprise Customer Support](../context/aibuildathon.imssa.lk.md#problem-tracks---choose-your-problem-space)  
**Operational deadline:** [August 27, 2026 unless August 31 is confirmed in writing](../context/aibuildathon.imssa.lk.md#1-submission-deadline-august-27-vs-august-31)  
**Evidence access date:** 2026-08-23

This scope lock supersedes the earlier shortlist sketch for **candidate #5 only**. It does not supersede the portfolio decision: **ResolveGuard remains the selected build and Recovery Radar is not an implementation fallback without a new selection and Track 06 review.**

## One-Line Pitch

**Recovery Radar is a real Alibaba-hosted Qwen agent that investigates one seeded delayed-order fulfillment event before the customer opens a ticket, carries one proactive recovery case across web and a simulated WhatsApp channel, executes one policy-bounded mock delivery reschedule, verifies the backend state, and changes escalation when the customer's reply raises service risk.**

## Locked Decisions

Changing any locked choice requires an explicit scope, deadline, and Track 06 compliance review. These are Recovery Radar's locked choices only if this alternative is later selected; they do not change ResolveGuard's selected status.

| Decision | Locked choice | Why |
|---|---|---|
| Selection | **Alternative candidate only; ResolveGuard remains selected** | This document makes candidate #5 reviewable but does not authorize a product switch. |
| Product | **Recovery Radar only if separately selected** | The proactive trigger is the differentiator and must not collapse into a reactive chatbot. |
| Domain | One fictional Sri Lankan e-commerce merchant and one delayed-order event | A single legible service failure is buildable and testable in four days. |
| Primary operator | CX recovery supervisor | Owns the exception queue, contact policy, and escalated action review. |
| Customer | One seeded customer with an existing order and transactional-contact consent | No fuzzy identity or population-scale matching is needed. |
| Economic buyer hypothesis | Head of e-commerce operations or CX operations | This is a hypothesis for validation, not evidence of willingness to pay. |
| Trigger | One typed `DELIVERY_DELAY_CONFIRMED` event from a mock fulfillment source | No anomaly detector, event mining platform, or predictive model is in scope. |
| Case timing | The event creates a proactive support case before any inbound complaint or ticket | This is the core product claim and must be timestamp-visible. |
| Channels | Customer web case page plus one **simulated WhatsApp-style** adapter | Both surfaces use one `caseId`; only simulated WhatsApp is the preferred outbound channel. |
| Contact | Transactional recovery only, consent- and quiet-hours-gated | No marketing, channel spraying, or unsupported implied consent. |
| Remedy | One mock `RESCHEDULE_DELIVERY` action that replaces an at-risk original commitment with one distinct customer-accepted seeded slot | The source's uncertain ETA is evidence of delay, not an already-applied reschedule. No refund, credit, replacement item, cancellation, or real logistics call. |
| Authority | Qwen proposes; deterministic policy authorizes; high service risk pauses auto-action for supervisor approval | Model confidence never grants business authority. |
| Verification | Independent mock-order read-back is required before a remedy is reported as applied | Generated text and tool-call success are not proof of backend state. |
| Resolution | Verified reschedule plus customer acknowledgement yields `RESOLVED`; timeout yields an unresolved state | A proactive notification alone is not ticket resolution. |
| Sentiment | Qwen extracts quoted service-risk cues; deterministic code combines them with operational signals | The reply visibly changes priority, queue, SLA, and approval behavior. |
| AI | Real Alibaba-hosted Qwen centrally performs investigation, evidence synthesis, plan generation, reply understanding, and handoff composition | A local model, cached response, or mock Qwen is not a compliant primary path. |
| MuleRun | Optional orchestration only, adopted if a real run is proven quickly | MuleRun cannot substitute for real Alibaba-hosted Qwen reasoning. |
| State | One persisted case projection derived from immutable event/action records | Browser sessions and model conversations are not systems of record. |
| Evaluation | Exactly 8 deterministic P0 scenarios | The set is small enough to run twice and broad enough to prove safe failure. |
| Delivery capacity | Minimum two contributors with the ownership split below | If two contributors are not assigned, this alternative is not viable for August 27 and must not displace ResolveGuard. |

## Problem, Users, Buyer, And Value

### Problem

Commerce support normally starts after the customer notices a failed promise and opens a ticket. Yet a fulfillment system may already know that an order will miss its committed window. The gap is not merely notification: a useful system must investigate whether the signal applies to a real customer and order, decide whether proactive contact is permitted, offer a bounded remedy, preserve the case when the customer moves between channels, react to the reply, and verify that the remedy was actually recorded.

Recovery Radar targets this exact gap. It does not claim to discover unknown failures. It consumes one explicit seeded delay event and demonstrates a controlled service-recovery trajectory before an inbound ticket exists.

### Users And Buyer

| Role | Need | P0 value hypothesis |
|---|---|---|
| Customer | Learn about a known delay early and obtain a concrete recovery without repeating context | Earlier notice, one visible case, one selectable replacement delivery slot, and a clear human path. |
| CX recovery supervisor | See high-risk proactive cases and approve or stop the bounded remedy with full evidence | Less reconstruction, deterministic routing, one-click review, and verifiable action state. |
| E-commerce/CX operations lead | Reduce avoidable inbound contacts while protecting trust and policy compliance | Pilot metrics for contact prevention, time to intervention, remedy completion, repeat contact, escalation precision, and cost per verified resolution. |

No prevented-ticket rate, churn reduction, cost saving, customer preference, or production demand is asserted. The prototype establishes technical behavior and a measurement plan, not impact.

## Evidence And Differentiation

The evidence is directional and retains its limitations:

- The decision hub identifies proactive support as a cross-source opportunity, but explicitly recommends one seeded event rather than a general telemetry platform ([proactive support synthesis](../context/context.md#cross-source-synthesis), [bounded problem candidate](../context/context.md#evidence-backed-problem-candidates)).
- TLDR's reviewed material describes an always-on customer-watch pattern and deduces a proactive, memory-preserving agent with controlled action and evidence-complete handoff ([direct support signal](../context/tldr.tech.md#direct-support-and-enterprise-workflow-signal), [Track 06 deduction](../context/tldr.tech.md#track-06-deduction)).
- The Battlefield review transfers the pattern "prevent the ticket, not just answer it" from GuideAI and ChargeMate, while identifying room for root-cause recovery, customer-controlled consent, and post-resolution trust repair ([transferable patterns](../context/techcrunch.com.md#transferable-patterns-worth-stealing), [cohort whitespace](../context/techcrunch.com.md#whitespace-in-this-cohort)). Its 196 researched companies and 4 unresolved stubs make this directional cohort evidence, not proof of global novelty ([uncertainty register](../context/techcrunch.com.md#unreachable-and-uncertainty-register)).
- Techmeme shows generic customer-facing agents and channel reach are crowded; the open surface is sentiment-driven control, policy-gated action, evidence-complete escalation, and verified resolution ([crowded market](../context/techmeme.com.md#customer-service-and-cx-platform-moves), [opportunity map](../context/techmeme.com.md#track-06-opportunity-map)).
- HN practitioners distinguish remediation from FAQ deflection, require low-friction human exits, and warn that support quality is a trust and revenue function ([resolution evidence](../context/news.ycombinator.com.md#1-deflection-is-not-resolution), [human exit](../context/news.ycombinator.com.md#3-customers-need-a-visible-low-friction-human-exit), [trust and revenue](../context/news.ycombinator.com.md#7-support-is-a-trust-and-revenue-function-not-merely-a-cost-center)).

### Differentiation Boundary

Recovery Radar is not differentiated by chat, WhatsApp styling, a sentiment badge, or generic agent autonomy. Its narrow differentiated mechanism is:

```text
known fulfillment failure
  -> proactive case before inbound ticket
  -> Qwen investigation with cited evidence
  -> consent-gated preferred-channel outreach
  -> reply-driven service-risk change
  -> policy-bounded mock remedy
  -> independent backend verification
  -> customer-confirmed closure or evidence-complete escalation
```

It complements a help desk or commerce system rather than pretending to replace one. Competitor funding and company claims in the dossiers establish category activity, not Recovery Radar adoption or performance.

## Exact Track 06 Mapping

The official wording is **"Autonomous AI agents, omnichannel workflow automation, ticket resolution, and sentiment analysis"** ([official Track 06 transcription](../context/aibuildathon.imssa.lk.md#problem-tracks---choose-your-problem-space)). All four phrases must be visible in one main case.

| Track 06 phrase | Locked P0 behavior | Judge-visible evidence |
|---|---|---|
| **Autonomous AI agents** | Real Alibaba-hosted Qwen receives the seeded fulfillment event, requests scoped order/fulfillment/policy/contact evidence, explains the likely customer impact, proposes the single allowlisted recovery plan, and drafts outreach without waiting for an inbound ticket. | Trace shows provider `ALIBABA_CLOUD`, exact observed endpoint host and model ID, prompt version, event/evidence IDs, structured investigation, tool requests, and proposal. |
| **Omnichannel workflow automation** | A simulated WhatsApp outbound message, a secure customer web case page, and the WhatsApp reply all append to `CASE-RR-5001`. | The same case ID, order facts, contact count, consent basis, proposal, risk history, and channel provenance appear on web and in the simulator. |
| **Ticket resolution** | A deterministic gate permits or pauses one mock delivery reschedule; the action is idempotent; a separate read verifies the new slot; customer acknowledgement closes the proactively created case. | Action receipt plus independent observed backend state precede `RESOLVED`; blocked and uncertain paths never claim success. |
| **Sentiment analysis** | Qwen extracts a quoted frustration/human-request cue from the reply. Deterministic service-risk logic combines it with missed promise and channel-switch signals. | The exact main reply changes score `20 -> 70`, priority `NORMAL -> HIGH`, queue `PROACTIVE_AUTO -> RECOVERY_SUPERVISOR`, SLA to 15 minutes, and action mode from auto-eligible to approval-required. |

## Deterministic 3-4 Minute Demo

The demo uses fixture `RR-MAIN-v2`, a real live Alibaba-hosted Qwen call, and resettable mock systems. Every simulated or mock surface is permanently labeled. The delay is confirmed, but the fulfillment source reports only a broad, low-certainty ETA; the offered remedy is a separate exact commitment that is not present in the backend before action.

1. **0:00-0:25, prove "before the ticket."** Reset only when the supplied `expectedFixtureChecksum` matches `RR-MAIN-v2`. Inject external event `FUL-DEL-5001` at `2026-08-24T09:02:00+05:30`. Before case creation, `TicketLookupEvidence TKT-LOOK-5001` observes ticket count `0` at `09:02:01`; the case is created at `09:02:02`, and the projection later derives `firstInboundAt=09:05:00` from the web preference rather than storing a trusted boolean. Show the backend before state: original commitment `SLOT-0824-AFT`, while fulfillment reports confirmed delay and only a low-certainty `2026-08-25 16:00-22:00` ETA.
2. **0:25-0:55, Qwen investigates autonomously.** The event creates `CASE-RR-5001`. Real Alibaba-hosted Qwen requests `get_order`, `get_fulfillment`, `get_recovery_policy`, and `get_contact_preference`; it cites their evidence IDs, identifies `DELAY_CONFIRMED`, distinguishes uncertain ETA from committed slot, and creates initial proposal `PRP-6001` plus decision `PDC-6001` for `RESCHEDULE_DELIVERY` to exact slot `SLOT-0825-EVE` (`18:00-20:00`). That slot is an offer, not current backend state.
3. **0:55-1:20, gate proactive contact.** Deterministic rules confirm exact order/customer mapping, active policy, transactional consent, preferred simulated WhatsApp, allowed local contact time, and zero prior proactive contacts. The initial service-risk score is exactly `20` from the missed promise, level `LOW`, queue `PROACTIVE_AUTO`. The simulated WhatsApp adapter sends one message with a permanent **SIMULATED WHATSAPP - NO META API - NOT DELIVERED EXTERNALLY** banner.
4. **1:20-1:45, show web continuity without acceptance.** Open the signed demo link. It displays the same `CASE-RR-5001`, uncertain ETA, proposed exact `18:00-20:00` slot, and consent/opt-out controls. A `Prefer this slot` control may append `WEB-PREF-5001`, explicitly labeled **NON-BINDING PREFERENCE**. It neither sets `acceptedSlotId` nor authorizes or mutates the mock order.
5. **1:45-2:20, make the first acceptance alter escalation.** In simulated WhatsApp, send `Yes, commit 6-8 PM. But this is the second promise. I am frustrated and I want a person involved now.` This `WA-IN-5001` event is the first actual slot acceptance; the earlier web inbound was only a non-binding preference. Qwen retains its raw label/confidence and quote, while the adapter emits normalized semantic bucket `FRUSTRATION_PRESENT`; it also emits `SLOT_ACCEPTED` and `HUMAN_REQUEST_PRESENT`. Deterministic signals produce `20 missed promise + 15 channel switch + 15 accepted frustration bucket + 20 human request = 70 HIGH`. Automation pauses, priority becomes `HIGH`, queue becomes `RECOVERY_SUPERVISOR`, SLA becomes reply time plus 15 minutes, and reasons `SERVICE_RISK_HIGH` and `HUMAN_REQUESTED` are shown.
6. **2:20-2:50, re-propose at the current version and act.** The reply and risk route change the case version, so `PRP-6001/PDC-6001` are marked `SUPERSEDED_VERSION` and can never be approved. At the post-reply current version, create `PRP-6002` plus `PDC-6002=REQUIRE_APPROVAL`, carrying the accepted slot and current risk evidence. The supervisor approves only `PRP-6002`. The gateway checks the bound proposal, decision, expected case version, policy version, slot, and parameter digest. `reschedule_delivery` writes one mock receipt `RSC-7001` under idempotency key `rr:CASE-RR-5001:PRP-6002:SLOT-0825-EVE`.
7. **2:50-3:20, verify rather than trust.** `get_delivery_commitment` independently observes `SLOT-0825-EVE`, producing verification `VRF-7001`. Only then does the case become `RESOLVED_PENDING_CUSTOMER`, and the simulated WhatsApp adapter sends the verified update.
8. **3:20-3:45, close and prove the trace.** Click `This works for me` on the web case page. The case becomes `RESOLVED` with `CUSTOMER_ACKNOWLEDGED`. Show one timeline from source event through Qwen trace, contact gate, reply risk change, approval, action receipt, verifier, and closure. Show the exact Alibaba endpoint host/model metadata without exposing credentials.

The live path requires network access to the confirmed Alibaba-hosted Qwen endpoint. It validates schema, grounded semantics, and the normalized cue route without asserting an exact raw confidence. A prerecorded run may protect pitch continuity, but it is not a substitute for a functional prototype or the required real integration.

## Scope

### P0 Judge-Visible Spine

- One fictional merchant, customer, order, active policy, fulfillment source, and `DELIVERY_DELAY_CONFIRMED` event whose revised ETA is uncertain and distinct from the offered commitment.
- One proactively created canonical case before any inbound ticket.
- Real Alibaba-hosted Qwen for investigation, evidence synthesis, plan generation, outreach drafting, reply understanding, service-risk cue extraction, and handoff composition.
- One read-mostly customer web case page for proposal/non-binding preference/acknowledgement and one preferred simulated WhatsApp-style channel whose main reply supplies the first binding slot acceptance.
- Deterministic trigger, identity/order match, consent, quiet-hours, contact cap, policy, risk score, authority, idempotency, verification, and transitions.
- One mock `RESCHEDULE_DELIVERY` remedy to one seeded slot.
- One supervisor queue and evidence-complete approval packet when the reply raises service risk.
- Append-only linked records, health/trace view, demo reset, manual stop, and exactly eight release scenarios.
- GitHub repository, functional prototype, demo video, documentation, architecture, setup, limitations, and test results required by the event ([deliverables](../context/aibuildathon.imssa.lk.md#solution-guidelines--deliverables)).

### Deferred Beyond August 27

These items are cut from the August 27 alternative scope, not merely waiting behind a P0 flag: supervisor cue correction, a dashboard beyond machine-readable/terminal reports, reminder execution or preview, cost/latency charts, MuleRun unless its day-one path already works, and visual polish beyond P0 keyboard/contrast/responsive checks.

### Contributor Lock And Ownership

Activation requires two assigned contributors; role aliases below become named people in the repository ownership file before work starts. An unfilled role is a no-go, not work silently transferred to one person.

| Contributor | Locked component ownership | August 27 acceptance responsibility |
|---|---|---|
| **Contributor A - Agent/Backend owner** | Fulfillment intake, ticket lookup evidence, event/case ledger, Qwen integration and schemas, deterministic policy/risk gateway, versioned proposals, action idempotency, mock backend, read-back, APIs | Live Alibaba Qwen smoke/e2e, backend transition, API concurrency tests, scenarios `RR-02` through `RR-05` |
| **Contributor B - Experience/Verification owner** | Customer web proposal surface, simulated WhatsApp, supervisor/trace surface, consent/contact UX, scenario artifacts and runner, responsive/accessibility baseline, demo/video/docs | Main cross-channel demo, simulation labels, fixture checksum/reset, scenarios `RR-01` and `RR-06` through `RR-08`, twice-clean evaluation report |

Both contributors review the main trace and release evidence. No third workstream is assumed; optional MuleRun, reminder UI, dashboards, and additional visual surfaces stay cut for August 27.

### Explicit Non-Goals

- No broad anomaly detection, event correlation platform, predictive ETA model, root-cause mining, incident clustering, or multi-order monitoring.
- No real commerce, courier, inventory, CRM, ticketing, payment, refund, replacement, or fulfillment integration.
- No real WhatsApp/Meta API, SMS, email, voice, social, push notification, or external message delivery.
- No second preferred outbound channel, channel fan-out, marketing campaign, cold outreach, or inferred consent.
- No refund, credit, replacement item, cancellation, cash movement, discount, legal entitlement decision, or remedy other than the one mock delivery reschedule.
- No fuzzy customer/order matching, identity inference from message content, production authentication, general help desk, or customer-data platform.
- No production Sinhala quality, emotion diagnosis, churn prediction, protected-trait inference, or claim that sentiment is psychological truth.
- No invented impact, benchmark, merchant policy, market size, automation rate, savings percentage, or prevented-ticket result.

## P0 Requirements

| ID | Requirement | Acceptance evidence |
|---|---|---|
| RR-FR-01 | Accept only the typed seeded fulfillment event and deduplicate its source `externalEventId` | Duplicate delivery returns the existing case and creates no second contact or action. |
| RR-FR-02 | Create the proactive case before any inbound customer ticket | Trigger-time `TicketLookupEvidence` has observed timestamp and count `0`; `firstInboundAt` is derived from inbound records; the view proves lookup observed before case creation and `case.createdAt < firstInboundAt` when inbound later exists. No trusted `createdBeforeInboundTicket` boolean is stored. |
| RR-FR-03 | Invoke real Alibaba-hosted Qwen centrally on the submission path | Trace and health expose observed provider, endpoint host, model ID, prompt version, schema status, and latency; secrets are absent. |
| RR-FR-04 | Let Qwen investigate through scoped read tools and produce schema-valid cited output | Every finding and candidate action links to event/order/fulfillment/policy/contact evidence; malformed output retries once then escalates. |
| RR-FR-05 | Enforce exact seeded customer/order mapping before disclosure or contact | A mismatch creates `FAILED_SAFE` with no outbound message or action. |
| RR-FR-06 | Enforce consent, purpose, preferred channel, quiet hours, contact cap, and opt-out before every outbound message | The contact decision persists rule results and reason codes; disallowed contact produces no simulated send. |
| RR-FR-07 | Carry one case across simulated WhatsApp and customer web | Both channel events use `CASE-RR-5001`; facts, non-binding preference, and later accepted slot remain distinct and are not re-entered. |
| RR-FR-08 | Compute service risk from normalized Qwen semantic cues plus deterministic operational signals | The deterministic main artifact produces `FRUSTRATION_PRESENT` and exactly score `70`, `HIGH`, `RECOVERY_SUPERVISOR`, SLA +15 minutes, and approval-required mode; tests retain but do not equality-check raw confidence. |
| RR-FR-09 | Permit only `RESCHEDULE_DELIVERY` with the seeded slot and active fictional policy | Unknown actions/slots or stale policy are blocked with exact reasons. |
| RR-FR-10 | Bind supervisor approval to one current proposal and immutable parameters | The main reply/version change supersedes the initial proposal; a new proposal/decision is created at the current version. Changed slot, intervening command, or stale version invalidates approval and requires another proposal/decision. |
| RR-FR-11 | Execute the mock action idempotently and reconcile unknown outcomes | Replays create at most one reschedule; timeout triggers read-back before retry. |
| RR-FR-12 | Verify mock backend state independently before claiming application | `RESOLVED_PENDING_CUSTOMER` requires a passing `VerificationRecord`; model text or action response alone cannot transition it. |
| RR-FR-13 | Require customer acknowledgement for successful closure | Only a verified remedy plus `CUSTOMER_ACKNOWLEDGED` yields `RESOLVED`; timeout closes as `CLOSED_UNRESOLVED`. |
| RR-FR-14 | Preserve an evidence-complete linked timeline and allow manual stop | Event, Qwen trace, evidence, contact decision, messages, risk decision, proposal, approval, action, receipt, verifier, and closure are inspectable. |
| RR-FR-15 | Pass all eight deterministic recorded/stubbed-artifact scenarios from checksum-verified clean reset twice | Expected states, actions, reasons, backend state, contact count, and prohibited-action count match exactly per `evalRunId`; separate live Alibaba smoke/e2e checks assert semantic contracts without deterministic raw text/confidence equality. |
| RR-FR-16 | Label every simulation and mock | UI, video, README, and docs never imply a live merchant, Meta/WhatsApp, courier, or monetary operation. |

## Qwen And Deterministic Control Boundary

### Real Alibaba-Hosted Qwen Responsibilities

| Qwen task | Required structured result | Safe failure |
|---|---|---|
| Investigate the fulfillment event | Event interpretation, customer impact, missing facts, requested read tools, evidence IDs, confidence | Contradictory or missing evidence causes `ABSTAIN` and escalation, not outreach. |
| Synthesize a recovery plan | `RESCHEDULE_DELIVERY`, allowed seeded slot, evidence IDs, rationale, customer questions | Any other action is schema-invalid or deterministically blocked. |
| Draft proactive and follow-up messages | Concise factual text grounded in verified event/remedy state with channel style and opt-out language | Unsupported delivery claims are withheld. |
| Understand reply | Slot acceptance/rejection, human request, quoted service-risk cues, raw labels/confidence/uncertainty, and normalized semantic buckets | A cue that cannot be normalized is `MODEL_CUE_UNCERTAIN`, contributes no linguistic points, and routes for review if intent is unclear. |
| Compose handoff | Verified facts, chronology, cue quote, unresolved decision, proposed action, citations | Missing mandatory fields block automated continuation. |

The exact endpoint host and model ID are not invented in this brief. They must be populated from a successful August 24 call to an Alibaba-hosted Qwen service and then shown in runtime metadata. Model output is stored with a digest and schema status; raw secrets and unnecessary personal data are not.

### Model Test Separation

| Test class | Model source | Assertions |
|---|---|---|
| Deterministic eight-scenario regression | Versioned recorded, schema-valid artifacts for stable paths and explicit stubs for malformed/uncertain paths; artifact IDs and digests are pinned in each fixture | Exact final projection, normalized semantic buckets, actions, reason codes, contact count, and backend state. Raw prose and raw confidence are retained but never exact-match acceptance criteria. |
| Live Alibaba Qwen smoke | Fresh Alibaba-hosted call against investigation and reply schemas | Observed provider/host/model, schema validity, citations, allowed tool requests, raw output retention, latency, and either accepted semantic bucket or explicit safe uncertainty. No exact wording or confidence requirement. |
| Live Alibaba Qwen end-to-end | Fresh calls in the main resettable workflow | Central model participation, grounded proposal, first reply acceptance extraction, semantic normalization, deterministic policy route, and safe failure. Recorded/stubbed artifacts cannot satisfy this check. |

Recorded output is test input, not proof of a live integration. Live output is never substituted into deterministic regression snapshots.

### Deterministic Responsibilities

Code, not Qwen, owns:

- event type allowlist, signature fixture, deduplication, order/customer association, and timestamps;
- active-policy selection, permitted slot, consent purpose/scope/status, channel preference, quiet hours, contact cap, and opt-out;
- service-risk arithmetic, thresholds, priority, SLA, queue, and whether approval is required;
- action allowlist, schema validation, case versioning, approval binding, idempotency, retries, and step/time limits;
- mock backend mutation, reconciliation, independent verification, legal state transitions, and closure;
- redaction, access control, audit retention, rate limits, and manual stop.

**Invariant:** Qwen can investigate, recommend, explain, and draft. It cannot create consent, send to an unapproved channel, authorize itself, select an unknown remedy, alter the mock backend directly, verify its own action, or mark a case resolved.

## Data Contracts

All timestamps are ISO 8601 with offsets. IDs are stable. Records below are illustrative TypeScript contracts and are implementation requirements, not production claims.

```ts
type FulfillmentEvent = {
  eventId: "EVT-RR-5001" | string;
  externalEventId: "FUL-DEL-5001" | string;
  tenantId: string;
  eventType: "DELIVERY_DELAY_CONFIRMED";
  source: "MOCK_FULFILLMENT";
  orderId: string;
  customerId: string;
  previousWindow: { start: string; end: string };
  revisedEta: {
    earliest: string;
    latest: string;
    certainty: "LOW";
    commitmentStatus: "DELAYED_UNCERTAIN";
  };
  reasonCode: "HUB_CAPACITY";
  occurredAt: string;
  receivedAt: string;
  sourceSignatureStatus: "VALID" | "INVALID";
};

type ChannelEvent = {
  channelEventId: string;
  caseId: string;
  channel: "web" | "simulated_whatsapp";
  direction: "INBOUND" | "OUTBOUND";
  actor: "CUSTOMER" | "QWEN_AGENT" | "SUPERVISOR" | "SYSTEM";
  externalEventId: string;
  message?: string;
  structuredIntent?: { slotId?: string; acknowledged?: boolean; optedOut?: boolean };
  occurredAt: string;
  receivedAt: string;
  simulation: boolean;
};

type CaseStatus =
  | "INVESTIGATING"
  | "CONTACT_BLOCKED"
  | "AWAITING_CUSTOMER"
  | "AWAITING_SUPERVISOR"
  | "ACTION_IN_PROGRESS"
  | "RESOLVED_PENDING_CUSTOMER"
  | "RESOLVED"
  | "ESCALATED"
  | "FAILED_SAFE"
  | "CLOSED_UNRESOLVED";

type RecoveryCase = {
  caseId: string;
  tenantId: string;
  version: number;
  triggerEventId: string;
  triggerKind: "FULFILLMENT_EVENT";
  triggerTicketLookupEvidenceId: string;
  firstInboundAt?: string;
  orderId: string;
  customerId: string;
  status: CaseStatus;
  preferredChannel: "simulated_whatsapp";
  consentId: string;
  contactCount: number;
  priority: "NORMAL" | "HIGH" | "URGENT";
  queue: "PROACTIVE_AUTO" | "RECOVERY_SUPERVISOR" | "PRIVACY_REVIEW";
  slaDueAt?: string;
  serviceRisk: ServiceRiskDecision;
  activeProposalId?: string;
  approvalId?: string;
  latestActionId?: string;
  latestVerificationId?: string;
  closureReason?: "CUSTOMER_ACKNOWLEDGED" | "CUSTOMER_TIMEOUT_UNRESOLVED";
  createdAt: string;
  updatedAt: string;
};

type ServiceRiskDecision = {
  decisionId: string;
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  qwenCueIds: string[];
  objectiveSignalIds: string[];
  reasonCodes: string[];
  resultingPriority: "NORMAL" | "HIGH" | "URGENT";
  resultingQueue: "PROACTIVE_AUTO" | "RECOVERY_SUPERVISOR" | "PRIVACY_REVIEW";
  actionMode: "AUTO_ELIGIBLE" | "APPROVAL_REQUIRED" | "STOPPED";
  evaluatedAt: string;
};

type RiskCue = {
  cueId: string;
  channelEventId: string;
  exactQuote: string;
  rawLabel: string;
  rawConfidence?: number;
  rawUncertainty?: string;
  semanticBucket: "FRUSTRATION_PRESENT" | "URGENCY_PRESENT" | "HUMAN_REQUEST_PRESENT" | "IMPROVING" | "MODEL_CUE_UNCERTAIN";
  artifactOrTraceId: string;
};

type RecoveryAction = {
  actionId: string;
  caseId: string;
  proposalId: string;
  decisionId: string;
  approvalId?: string;
  actionType: "RESCHEDULE_DELIVERY";
  parameters: { orderId: string; slotId: "SLOT-0825-EVE" };
  parameterDigest: string;
  idempotencyKey: string;
  status: "PROPOSED" | "BLOCKED" | "AWAITING_APPROVAL" | "RUNNING" | "SUCCEEDED" | "TIMED_OUT_UNKNOWN" | "FAILED";
  receiptId?: string;
  createdAt: string;
};
```

### Linked Ledger Records

| Record | Required fields and links |
|---|---|
| `EvidenceRef` | `evidenceId`, `caseId`, `sourceType`, `sourceId`, exact value/excerpt, observed time, trust type |
| `TicketLookupEvidence` | `evidenceId`, trigger external event/order IDs, lookup source, `observedAt`, `ticketCount`, observed earliest inbound timestamp or `null`; captured before proactive case creation |
| `QwenTrace` | `traceId`, `caseId`, input event/evidence IDs, provider, observed endpoint host/model, prompt/schema version, tool requests, latency, output digest, schema result |
| `ContactDecision` | `contactDecisionId`, case/consent IDs, purpose, channel, local time, quiet-hours result, contact count/cap, decision, reasons |
| `RiskCue` | `cueId`, `channelEventId`, exact quote, raw Qwen label/confidence/uncertainty, normalized semantic bucket, prompt/model or artifact version |
| `RecoveryProposal` | `proposalId`, `traceId`, action type, exact slot, evidence IDs, parameter digest, basis case version, `ACTIVE` or `SUPERSEDED_VERSION` status |
| `PolicyDecision` | `decisionId`, `proposalId`, policy version, one of `ALLOW`, `REQUIRE_APPROVAL`, or `BLOCK`, reason codes, evaluated digest/time |
| `Approval` | `approvalId`, proposal/decision/case version/digest, required role, status, reviewer, decision time, consumed time |
| `ToolAttempt` | `attemptId`, action ID, ordinal, request digest, start/end, status, receipt/error, superseded attempt ID |
| `VerificationRecord` | `verificationId`, action/receipt IDs, expected slot, observed slot, evidence ID, pass/fail, verified time |

Events and ledger records are append-only. `RecoveryCase` is a materialized projection rebuilt from those records. The "before ticket" claim is derived only when trigger-time ticket lookup observed count `0` before `case.createdAt`, and the derived `firstInboundAt` is absent or later than `case.createdAt`.

## Trigger, Consent, And Contact Rules

### Proactive Trigger

The system does not infer a delay. It accepts exactly one event type and applies these rules in order:

1. `source == MOCK_FULFILLMENT`, signature fixture is `VALID`, and `eventType == DELIVERY_DELAY_CONFIRMED`.
2. Intake `externalEventId` has not been processed for this source/tenant; duplicate delivery returns the existing result. Internal `eventId` is assigned only to the first accepted append.
3. `orderId` and `customerId` exactly match one seeded active order.
4. The delay is confirmed, the broad low-certainty revised ETA extends beyond the prior promised window, and policy `REC-2026-08-v1` is active. The ETA is not treated as a committed reschedule.
5. Before case creation, query the mock ticket/inbound index and append `TicketLookupEvidence` with `observedAt`, exact count, and earliest inbound timestamp or `null`. Count `0` permits proactive creation; otherwise attach to the existing flow and do not claim "before ticket."
6. A valid transactional service-recovery consent record exists before any personalized disclosure or outbound send.
7. Only after these checks may Qwen investigate and a contact decision be evaluated.

### Consent And Contact

| Rule | Locked behavior |
|---|---|
| Consent basis | Seeded explicit checkout choice `CONSENT-2001`: transactional order and disruption updates allowed; marketing disallowed. This is a fictional demo record, not a legal conclusion. |
| Preferred channel | `simulated_whatsapp` only. The web page is a customer-accessed case surface, not an additional unsolicited outbound channel. |
| Quiet hours | No proactive send outside `08:00-20:00 Asia/Colombo`; queue until the next allowed time. Main event at 09:02 is allowed. |
| Contact cap | Maximum one initial proactive message and one reminder per delay event. P0 main run sends the initial message and later verified update; transactional replies to customer input do not count as reminders. |
| Minimum disclosure | Initial message names fictional merchant, order suffix `8421`, confirmed delay, uncertain source ETA, distinct proposed committed slot, simulation status, human option, and opt-out; it omits address and full order details. |
| Web access | Seeded expiring demo token is bound to case/customer. It is a prototype mechanism, not a production authentication claim. |
| Opt-out | `STOP` or web opt-out immediately sets consent status `OPTED_OUT`, cancels pending outbound contact and autonomous action, and routes to `PRIVACY_REVIEW`; no confirmation beyond one minimal opt-out acknowledgement. |
| No response | One reminder may occur only after 24 hours and only if still consented; after 48 hours the case becomes `CLOSED_UNRESOLVED`, never `RESOLVED`. |
| Human request | Always routes to `RECOVERY_SUPERVISOR`; it may coexist with a customer-accepted remedy, but automation pauses until review. |

## Policy, Risk, Action, And State Rules

All policies and thresholds are fictional prototype fixtures, not a real merchant policy or Sri Lankan legal advice.

### Recovery Policy

| Rule | Result |
|---|---|
| `RR-POL-01` | Missing/inactive policy: `BLOCK`, `POLICY_MISSING_OR_INACTIVE`, `ESCALATED`. |
| `RR-POL-02` | Invalid source or customer/order mismatch: `BLOCK`, `SOURCE_OR_IDENTITY_MISMATCH`, `FAILED_SAFE`; no contact/disclosure/action. |
| `RR-POL-03` | Missing/withdrawn consent, wrong purpose/channel, contact cap, or quiet hours: block or defer contact with exact reason; never channel-hop. |
| `RR-POL-04` | Confirmed delay, active policy, distinct offered seeded slot, valid consent, and risk below 50 makes one reschedule `AUTO_ELIGIBLE`, but binding customer slot acceptance remains required. A web preference is never acceptance. |
| `RR-POL-05` | `HIGH` service risk or explicit human request supersedes any pre-reply proposal and requires a new current-version proposal/decision with `REQUIRE_APPROVAL` in `RECOVERY_SUPERVISOR`. |
| `RR-POL-06` | `CRITICAL`, ambiguous reply, contradictory evidence, unknown slot, changed parameters, or stale approval blocks execution until human review/new decision. |
| `RR-POL-07` | Existing successful reschedule blocks a second action with `DUPLICATE_REMEDY`. |
| `RR-POL-08` | Tool timeout yields `TOOL_OUTCOME_UNKNOWN`; read-back using the same idempotency key must precede retry. |
| `RR-POL-09` | Maximum four Qwen/tool investigation steps, one safe retry, and 30 seconds per external/model call; exhaustion escalates. |
| `RR-POL-10` | Message/retrieved instructions cannot expand tools, alter consent/policy, expose secrets, or select another remedy; record `PROMPT_INJECTION_SIGNAL`. |

### Service-Risk Formula

```text
+20  confirmed missed delivery promise
+15  web <-> simulated WhatsApp switch within the same active case
+15  normalized FRUSTRATION_PRESENT or URGENCY_PRESENT semantic bucket
+20  explicit human request extracted by Qwen and confirmed by phrase match
+30  one failed or unreconciled remedy
-15  verified remedy plus normalized IMPROVING semantic bucket
```

Clamp to 0-100: `LOW 0-24`, `MEDIUM 25-49`, `HIGH 50-79`, `CRITICAL 80-100`.

- `LOW`: `NORMAL`, `PROACTIVE_AUTO`, standard 4-hour demo SLA, action may remain auto-eligible.
- `MEDIUM`: `NORMAL`, `PROACTIVE_AUTO`, 1-hour demo SLA, action may remain auto-eligible.
- `HIGH`: `HIGH`, `RECOVERY_SUPERVISOR`, 15-minute demo SLA, automation pauses and approval is required.
- `CRITICAL`: `URGENT`, `RECOVERY_SUPERVISOR`, immediate SLA, all autonomous actions stop.
- Any explicit human request routes to the supervisor even if the arithmetic is lower than `HIGH`.

For `RR-MAIN-v2`, initial risk is `20`. The exact reply adds channel switch `15`, normalized `FRUSTRATION_PRESENT` `15`, and explicit human request `20`, producing exactly `70 HIGH`. Qwen supplies raw language evidence; the adapter validates quote support and maps accepted semantics to a bucket; code supplies the score and operational consequences. Raw confidence is retained for inspection but no exact value is required. An unaccepted cue contributes zero, records `MODEL_CUE_UNCERTAIN`, and cannot increase risk.

### State Invariants

- A source event can create at most one proactive case.
- Personalized contact cannot precede source, identity, consent, and contact-policy checks.
- Web proposal views/non-binding preferences and simulated WhatsApp replies append to the same case and increment its version; only an explicit accepted-slot inbound event sets `acceptedSlotId`.
- A proposal/decision whose basis version predates the accepting reply or risk route is `SUPERSEDED_VERSION`; the post-reply current version must produce a new proposal and policy decision before approval.
- `ACTION_IN_PROGRESS` requires accepted slot plus `ALLOW`, or accepted slot plus a matching unconsumed approval for `REQUIRE_APPROVAL`.
- Approval binds proposal ID, policy decision ID, case version, action type, slot ID, and parameter digest. Editing any field creates a new proposal and decision.
- `RESOLVED_PENDING_CUSTOMER` requires passing independent read-back. `RESOLVED` additionally requires customer acknowledgement.
- Manual stop or opt-out prevents new autonomous steps. In-flight unknown action outcomes are reconciled before final status.
- Operators cannot directly set `RESOLVED`. Unverified or timed-out work closes only as `CLOSED_UNRESOLVED` or escalates.

## Architecture

```text
Seeded fulfillment-event button / API
                |
                v
Event validator + deduplicator -----> immutable event ledger
                |
                v
Trigger-time ticket lookup --------> TicketLookupEvidence
                |
                v
Canonical RecoveryCase store <------ web case page
                |
                v
Real Alibaba-hosted Qwen investigator
      | scoped read-tool requests | cited plan | reply cues |
                v
Deterministic trigger/contact/policy/risk gateway
          | contact       | approve/block       | stop
          v               v                     v
Simulated WhatsApp   Supervisor web queue   Escalation packet
          \               /
           v             v
       Idempotent mock reschedule tool
                    |
                    v
       Independent commitment read-back
                    |
                    v
        Verified status + customer acknowledgement
```

### Alibaba Integration Gate

| Runtime path | Required evidence | Status rule |
|---|---|---|
| Thin Python service plus web UI | A real call to an Alibaba-hosted Qwen endpoint, observed host/model metadata, structured result, and stored trace | Preferred fallback if MuleRun is uncertain; fully compliant when real Qwen is central. |
| MuleRun-led orchestration | Confirmed MuleRun trigger/workflow plus explicit real Alibaba-hosted Qwen steps in trace, README, architecture, and video | Optional and compliant only after a real end-to-end run. |
| Local model, mock Qwen, cached-only output, or MuleRun without real Qwen | No qualifying central Alibaba-hosted Qwen execution | **Not submission-compliant.** May be a resilience artifact only, never the presented primary path. |

On August 24, the go/no-go spike must inject the seeded event, complete a live Alibaba-hosted Qwen investigation, pass the deterministic contact/policy gates, execute the mock reschedule, and independently read it back. If Qwen access fails, escalate platform access immediately; do not disguise local output as compliance.

## API Contracts

| Method and path | Contract |
|---|---|
| `POST /api/fulfillment-events` | Validate/deduplicate `FulfillmentEvent` by tenant/source `externalEventId`; create or return the proactive case. No case version exists at intake. Demo source only. |
| `POST /api/cases/{caseId}/investigate` | Run the bounded Qwen investigation at expected case version; persist trace and cited proposal. |
| `POST /api/cases/{caseId}/contact-decisions` | Evaluate consent, purpose, preference, quiet hours, cap, and disclosure before send. |
| `POST /api/channels/simulated-whatsapp/messages` | Append simulated inbound/outbound event; never calls Meta or an external transport. |
| `GET /case/{demoToken}` | Render customer web case state and proposed/preferred/accepted slot fields distinctly, with a permanent demo label. |
| `POST /api/cases/{caseId}/web-events` | Record proposal view, non-binding slot preference, acknowledgement, opt-out, or human request. It cannot record binding slot acceptance. |
| `POST /api/cases/{caseId}/analyze-reply` | Invoke Qwen for reply intent/cues, then calculate deterministic risk and route. |
| `GET /api/queues/recovery-supervisor` | Return high-risk cases ordered by priority and SLA due time. |
| `POST /api/approvals/{approvalId}/decision` | Approve/reject exact bound proposal at expected case version. |
| `POST /api/mock/orders/{orderId}/reschedule` | Internal mock action requiring policy capability, accepted slot, approval if required, and idempotency key. |
| `GET /api/mock/orders/{orderId}/delivery-commitment` | Independent read-back and timeout reconciliation source. |
| `POST /api/cases/{caseId}/stop` | Halt new automation and append `MANUAL_STOP`; reconcile in-flight action. |
| `GET /api/cases/{caseId}` | Role-scoped materialized case. |
| `GET /api/cases/{caseId}/timeline` | Ordered source, model, consent/contact, channel, risk, approval, action, and verification records. |
| `GET /api/cases/{caseId}/trace` | Redacted Qwen/tool/gateway metadata including exact observed Alibaba host/model. |
| `POST /api/demo/reset` | Reset one named fixture only when `expectedFixtureChecksum` matches its canonical manifest; return the same checksum and a unique reset ID. |
| `POST /api/evals/run` | Execute the exact eight deterministic scenarios under caller-supplied unique `evalRunId`; duplicate run IDs return the existing report. |
| `GET /health` | App/store, Alibaba-hosted Qwen, and optional MuleRun readiness without secrets. |

Concurrency is endpoint-specific rather than a blanket header rule:

| Endpoint class | Required concurrency/deduplication contract |
|---|---|
| Fulfillment and channel intake | Stable source-scoped `externalEventId`; duplicates return the original append/result. No expected case version is required for an event arriving independently. |
| Case commands (`investigate`, contact decision, web preference/ack/opt-out, analyze reply, approval decision, stop) | `expectedCaseVersion`; a mismatch returns `409 STALE_CASE_VERSION` and performs no append. Command IDs deduplicate client retries. |
| Mock reschedule action | Action-scoped `Idempotency-Key` bound to tenant/order/proposal/parameter digest; the same key cannot execute different parameters. Timeout reconciliation reuses that key. |
| Demo reset | Fixture ID plus `expectedFixtureChecksum`; mismatch refuses reset so tests cannot silently run against changed data. |
| Evaluation run | Unique `evalRunId` plus pinned fixture/artifact manifest digest; retry returns the prior immutable report. |

Demo reset is disabled outside demo mode.

## Minimal UI

P0 uses three compact surfaces in one responsive web application; operations, supervisor, and trace are one view to fit the two-contributor August 27 scope:

1. **Operations, supervisor, and trace view:** inject the one delayed-order fixture; show trigger-time ticket lookup, `firstInboundAt`, current case/queue/SLA, proposal supersession, approval, mock backend before/after, verifier, Qwen metadata, and stop control.
2. **Customer web case:** show verified delay facts, uncertain ETA, one proposed committed slot, explicitly non-binding preference plus acknowledge/human/opt-out controls, and the shared case ID. It cannot accept the slot and has no unsolicited push.
3. **Simulated WhatsApp console:** permanent simulation banner, one outbound thread, seeded reply button, and shared case timeline. It must never resemble evidence of a real Meta integration.

## Exact Seeded Fixtures

Every name, record, policy, event, message, action, and transaction below is fictional and resettable.

| Fixture | Exact value |
|---|---|
| Tenant/merchant | `TENANT-LC-RR`, `LankaCart Recovery Demo` |
| Customer | `CUS-2001`, `Amaya Fernando`, locale `en-LK`, no prior support ticket for this order |
| Consent | `CONSENT-2001`, captured `2026-08-20T11:08:00+05:30`, purpose `ORDER_TRANSACTIONAL_UPDATES`, preferred `simulated_whatsapp`, status `GRANTED`, marketing `false` |
| Simulated address | `sim-wa:+94-77-000-2001`; never sent externally |
| Customer web token | `DEMO-TOKEN-RR-5001`, fixture-only, case/customer-bound, expires after demo |
| Order | `LC-8421`, item `Kettle K-17`, LKR 12,400 display value only, status `IN_TRANSIT`, customer/order mapping exact |
| Original/backend-before commitment | `SLOT-0824-AFT`, `2026-08-24T14:00:00+05:30` to `2026-08-24T16:00:00+05:30`, `rescheduleCount=0`, no reschedule receipt |
| Fulfillment event | Internal `eventId=EVT-RR-5001`, source `externalEventId=FUL-DEL-5001`, `DELIVERY_DELAY_CONFIRMED`, source `MOCK_FULFILLMENT`, reason `HUB_CAPACITY`, occurred `2026-08-24T08:57:00+05:30`, received `09:02:00+05:30` |
| Trigger-time ticket proof | `TKT-LOOK-5001`, mock ticket index, observed `2026-08-24T09:02:01+05:30`, `ticketCount=0`, observed earliest inbound `null`; case created `09:02:02`; derived `firstInboundAt=09:05:00` after the non-binding web preference arrives |
| Revised source ETA | Delay is confirmed; broad ETA `2026-08-25T16:00:00+05:30` to `2026-08-25T22:00:00+05:30`, certainty `LOW`, status `DELAYED_UNCERTAIN`; this is not a delivery-slot commitment |
| Offered remedy | Action `RESCHEDULE_DELIVERY`; distinct exact slot `SLOT-0825-EVE`, `2026-08-25T18:00:00+05:30` to `20:00:00+05:30`; not set in backend before action; no other slots/actions |
| Active policy | `REC-2026-08-v1`, active Aug 1-31; permits one delay reschedule after consent and slot acceptance; high risk requires supervisor approval |
| Stale policy | `REC-2026-07-v0`, inactive; cannot authorize contact or action |
| Main case | Generated `CASE-RR-5001` at `2026-08-24T09:02:02+05:30`, trigger kind `FULFILLMENT_EVENT`, initial risk `20 LOW` |
| Initial message | `LankaCart Recovery Demo: order ...8421 will miss today's 2-4 PM window and the source ETA is uncertain. We can commit delivery tomorrow, 6-8 PM if you accept. Review this simulated case or ask for a person. Reply STOP to opt out.` |
| Web event | `WEB-PREF-5001` at `2026-08-24T09:05:00+05:30`, preference `SLOT-0825-EVE`, binding `false`; `acceptedSlotId` remains absent |
| Main reply / first acceptance | `WA-IN-5001` at `09:06:00+05:30`: `Yes, commit 6-8 PM. But this is the second promise. I am frustrated and I want a person involved now.`; sets accepted slot only after schema validation |
| Qwen cue artifact expectation | Exact supported quote, normalized buckets `FRUSTRATION_PRESENT` and `HUMAN_REQUEST_PRESENT`, intent `SLOT_ACCEPTED`; raw label/confidence/uncertainty retained but raw confidence is not equality-tested |
| Main risk | `20 + 15 + 15 + 20 = 70`, `HIGH`, `RECOVERY_SUPERVISOR`, SLA `2026-08-24T09:21:00+05:30`, approval required |
| Supervisor | `USR-SUP-01`, role `RECOVERY_SUPERVISOR` |
| Generated main records | Initial `PRP-6001/PDC-6001` then `SUPERSEDED_VERSION`; current post-reply `PRP-6002/PDC-6002`, approval `APR-6002`, action `ACT-7001`, receipt `RSC-7001`, verification `VRF-7001` |
| Mock backend after action | Order `LC-8421`, `deliverySlotId=SLOT-0825-EVE`, `rescheduleCount=1`, receipt `RSC-7001` |
| Customer acknowledgement | `WEB-ACK-5001`, `This works for me`, after passing verification |

The deterministic main regression uses recorded artifacts `QART-RR-INV-v2` and `QART-RR-REPLY-HIGH-v2`; malformed and uncertain paths use named stubs. The adapter maps schema-valid, quote-supported semantics to buckets while preserving raw output. No test or live gate requires exact raw wording or confidence. If live output cannot be normalized after one retry, the run records `MODEL_CUE_UNCERTAIN` and takes the safe route rather than forcing the deterministic artifact result.

## Eight Deterministic Release Scenarios

Each scenario starts from the exact named fixture variant below, whose canonical JSON checksum and model artifact/stub digest are pinned in the eval manifest. Reset requires that checksum, and each twice-clean execution has a unique `evalRunId`. `Actions` counts successful mock `RESCHEDULE_DELIVERY` side effects. Read tools and simulated messages are not actions. Every variant starts with backend commitment `SLOT-0824-AFT`, `rescheduleCount=0`, and the broad uncertain source ETA unless its exact delta says otherwise.

| ID / exact fixture | Exact input delta and deterministic model source | Expected final state | Actions | Exact final actions/reasons | Expected backend/contact result |
|---|---|---|---:|---|---|
| `RR-01` / `RR-MAIN-v2` | Base event; `WEB-PREF-5001` non-binding; first acceptance/human request `WA-IN-5001`; recorded artifacts `QART-RR-INV-v2` and `QART-RR-REPLY-HIGH-v2`; approve only `PRP-6002`; verify; web acknowledge | `RESOLVED` | 1 | `PROACTIVE_CASE_CREATED`, `CONTACT_ALLOWED`, `NON_BINDING_PREFERENCE`, `SLOT_ACCEPTED`, `SERVICE_RISK_HIGH`, `HUMAN_REQUESTED`, `PROPOSAL_SUPERSEDED_VERSION`, `SUPERVISOR_APPROVED`, `VERIFIED`, `CUSTOMER_ACKNOWLEDGED` | Commitment `SLOT-0825-EVE`; `rescheduleCount=1`; receipt `RSC-7001`; contact count `1` |
| `RR-02` / `RR-DUP-EVENT-v2` | Base event submitted twice with the same `externalEventId=FUL-DEL-5001`; recorded artifact `QART-RR-INV-v2` runs once; no inbound | `AWAITING_CUSTOMER` | 0 | `PROACTIVE_CASE_CREATED`, `CONTACT_ALLOWED`, `DUPLICATE_EVENT`; exactly one case, lookup, investigation, and initial send | Commitment `SLOT-0824-AFT`; `rescheduleCount=0`; no receipt; contact count `1` |
| `RR-03` / `RR-NO-CONSENT-v2` | Base with `CONSENT-2001.status=WITHDRAWN` before intake; no model artifact may be consumed because consent fails before Qwen investigation | `CONTACT_BLOCKED` | 0 | `PROACTIVE_CASE_CREATED`, `CONSENT_NOT_GRANTED`; no personalized send and no executable proposal | Commitment `SLOT-0824-AFT`; `rescheduleCount=0`; no receipt; contact count `0` |
| `RR-04` / `RR-ID-MISMATCH-v2` | Base event changes only `customerId=CUS-OTHER`; no model artifact may be consumed | `FAILED_SAFE` | 0 | `SOURCE_OR_IDENTITY_MISMATCH`; no personalized disclosure, contact, proposal, or action | Commitment `SLOT-0824-AFT`; `rescheduleCount=0`; no receipt; contact count `0` |
| `RR-05` / `RR-MODEL-SCHEMA-v2` | Base identity/consent; stubs `QSTUB-RR-MALFORMED-1-v2` and `QSTUB-RR-MALFORMED-2-v2` fail the two investigation attempts | `ESCALATED` | 0 | `MODEL_SCHEMA_INVALID`, `INVESTIGATION_RETRY_EXHAUSTED`; queue `RECOVERY_SUPERVISOR`; no outreach presented as investigated fact | Commitment `SLOT-0824-AFT`; `rescheduleCount=0`; no receipt; contact count `0` |
| `RR-06` / `RR-REJECT-v2` | Base plus `QART-RR-INV-v2`, non-binding web preference, and first acceptance/human request through `QART-RR-REPLY-HIGH-v2`; create current `PRP-6002/PDC-6002`; supervisor rejects `APR-6002` | `ESCALATED` | 0 | `SLOT_ACCEPTED`, exact `SERVICE_RISK_HIGH`, `HUMAN_REQUESTED`, `PROPOSAL_SUPERSEDED_VERSION`, `APPROVAL_REJECTED`, `HANDOFF_COMPLETE` | Commitment `SLOT-0824-AFT`; `rescheduleCount=0`; no receipt; contact count `1` |
| `RR-07` / `RR-TIMEOUT-APPLIED-v2` | Base plus web preference and neutral first acceptance `Yes, commit 6-8 PM`; artifacts `QART-RR-INV-v2` and `QART-RR-REPLY-NEUTRAL-v2`; supersede initial proposal, create current `PRP-6102/PDC-6102=ALLOW`; mock action applies then times out; reconcile with the same idempotency key; no acknowledgement | `RESOLVED_PENDING_CUSTOMER` | 1 | `SLOT_ACCEPTED`, `PROPOSAL_SUPERSEDED_VERSION`, `AUTO_ELIGIBLE`, `TOOL_OUTCOME_UNKNOWN`, `RECONCILED_SUCCEEDED`, `VERIFIED`; no retry side effect | Commitment `SLOT-0825-EVE`; `rescheduleCount=1`; one receipt under original key; contact count `1` |
| `RR-08` / `RR-OPT-OUT-v2` | Base initial send through `QART-RR-INV-v2`, then first inbound `WA-STOP-5001: STOP` before acceptance/action; stub `QSTUB-RR-STOP-v2` | `CONTACT_BLOCKED` | 0 | `CONSENT_WITHDRAWN`, `OPT_OUT`, `PENDING_AUTOMATION_CANCELED`; queue `PRIVACY_REVIEW`; only minimal opt-out acknowledgement may follow | Commitment `SLOT-0824-AFT`; `rescheduleCount=0`; no receipt; contact count `1` |

### Required Cross-Cutting Assertions

- Run all eight scenarios twice from checksum-matched clean reset, with distinct `evalRunId` values and identical expected states and reason codes.
- P0 prohibited actions = 0; duplicate mock backend side effects = 0; external messages and commerce calls = 0.
- Every consequential claim and proposal has evidence links. Every successful action has a receipt and passing independent verifier.
- Contact never occurs after missing consent, mismatch, quiet-hours block, contact cap, or opt-out.
- The deterministic main artifact produces the exact normalized risk delta and escalation behavior; raw confidence is retained but not equality-checked, and an uncertain cue never increases the score.
- Run separate live Alibaba Qwen smoke and end-to-end suites; they cannot use recorded/stubbed outputs and do not assert exact raw prose or confidence.
- A stale approval, changed slot, direct operator `RESOLVED`, second reschedule, and non-allowlisted action fail deterministic integration tests outside the eight scenario slots.

## Security, Privacy, And Safety

- Use fictional data only. Never place Alibaba credentials in source, browser code, prompts, fixtures, traces, screenshots, or video.
- Keep Qwen calls server-side. Redact and minimize prompts; send order suffix and operational facts rather than unnecessary address/contact data.
- Treat the event, customer messages, web inputs, retrieved text, and model output as untrusted. Validate signatures, schemas, enums, lengths, timestamps, slot IDs, URLs, and digests server-side.
- Separate customer claims, Qwen inference, policy facts, source events, and verified backend observations in the UI and ledger.
- Enforce purpose-limited transactional consent before outreach. Provide visible opt-out and human controls. Never infer consent from order ownership or message sentiment.
- Scope every read and action capability to one tenant/case/order. Qwen receives no raw credential and no unrestricted HTTP or database access.
- Apply role checks, optimistic locking, one-time approvals, idempotency, timeouts, reconciliation, rate limits, four-step limit, manual stop, and audit records.
- Do not expose personalized order data on the web page without the bound demo token; do not claim the token is production-grade authentication.
- Retain demo records only for the configured fixture lifecycle; reset removes generated case data. Document that real retention, deletion, cross-border processing, and legal basis require production review.
- Do not claim legal compliance, production privacy/security, fairness, accessibility, tamper-proof logs, or emotion accuracy beyond what is implemented and tested.

## ROI And Pilot Hypotheses

Recovery Radar makes no impact claim. A real pilot would first establish the eligible event volume and a comparable baseline.

```text
eligible_delays =
  count(confirmed_delay_events
        with exact order/customer match
        and valid transactional consent)

contact_prevention_rate =
  eligible_delays_without_inbound_ticket_within_measurement_window
  / eligible_delays

verified_recovery_rate =
  cases_with_verified_reschedule_and_customer_acknowledgement
  / contacted_eligible_cases

monthly_value_hypothesis =
  prevented_inbound_contacts * validated_cost_per_contact
  + reduced_handling_minutes * validated_loaded_cost_per_minute
  + measured_retention_or_recovery_value
  - qwen_inference_cost
  - supervisor_review_cost
  - messaging_and_integration_cost
  - incident_and_compliance_cost
```

Pilot measurements: event-to-first-contact time, consent-eligible rate, contact success, customer response, verified remedy rate, inbound-ticket rate within a fixed window, repeat-contact rate, supervisor review time, escalation precision, opt-out rate, policy violation count, duplicate-action count, Qwen latency/tokens/cost, and cost per verified resolution. Sentiment cannot be converted into revenue or retention without observed outcome data.

## Rubric Evidence Plan

The five published criteria and lack of disclosed weights are documented in the [official rubric](../context/aibuildathon.imssa.lk.md#evaluation-criteria--rubric).

| Criterion | P0 evidence to show | Honest boundary |
|---|---|---|
| Innovation & Originality | A support case starts from a known operational failure before an inbound ticket, then closes through consent-aware proactive recovery and verification. | Directional whitespace, not a global novelty claim. |
| AI Integration & Depth | Real Alibaba-hosted Qwen investigates with tools/citations, creates the plan/message, interprets the cross-channel reply, extracts cues, and composes the handoff; malformed output fails safely. | Deterministic code, not Qwen, authorizes and verifies. |
| Technical Execution & Architecture | Typed contracts, canonical case, two channel surfaces, policy/contact gates, append-only links, idempotent action, reconciliation, read-back, eight repeatable scenarios, health and trace. | Mock commerce and messaging are labeled; scalability is architectural, not load-tested unless measured. |
| Impact & Business Feasibility | Named buyer/users, narrow overlay workflow, consent rules, pilot funnel, cost equation, and measurable outcomes. | No invented savings, demand, prevented contacts, or production readiness. |
| Pitch & Demo Delivery | In under four minutes: event before ticket, live Qwen investigation, proactive simulated message, web continuity, reply-driven escalation, supervisor-approved remedy, backend verification, and closure. | Recorded fallback supports presentation only; the working live path remains required. |

## August 24-27 Delivery Plan

### August 24: Selection, Staffing, Compliance, And Vertical-Slice Gate

- Do not start unless a product-switch review selects this alternative over ResolveGuard and both contributor roles are assigned by name.
- Freeze `RR-MAIN-v2`, contracts, policy rules, consent/contact rules, UI labels, fixture/artifact manifest, and eight expected outcomes.
- Confirm credentials, region, quota, retention behavior, exact endpoint host/model, and one real Alibaba-hosted Qwen structured call.
- Complete event -> Qwen investigation -> deterministic gate -> mock reschedule -> independent read-back from reset.
- Time-box MuleRun validation. Use it only if a real trigger/Qwen/tool trace works; otherwise lock thin Python orchestration with real Alibaba-hosted Qwen.
- Exit only with a saved compliant trace and no invented platform identifier.

### August 25: Case, Contact, And Channels

- Contributor A implements intake deduplication, trigger-time ticket lookup, case projection, evidence reads, Qwen schema/trace, and contact/policy APIs.
- Contributor B implements the non-binding web proposal, simulated WhatsApp, combined operations/supervisor/trace surface, labels, and fixture runner.
- Jointly pass `RR-02`, `RR-03`, `RR-04`, and `RR-05`.

### August 26: Risk, Action, And Verification

- Implement first-acceptance reply fixture, semantic cue normalization with raw retention, deterministic risk score, post-reply proposal/decision replacement, supervisor approval, action idempotency, timeout reconciliation, and verifier.
- Implement opt-out, manual stop, closure invariants, trace view, and all cross-cutting integration assertions.
- Pass all eight scenarios once; rehearse the 3-4 minute main run.

### August 27: Freeze And Submit

- Freeze features. Run all eight recorded/stubbed-artifact scenarios twice from checksum-matched reset with unique run IDs, then run separate live Alibaba smoke/e2e and save machine-readable results.
- Verify deployment/startup, responsive web/simulator views, mock/simulation labels, reset, health, stop, and real Alibaba-hosted Qwen path.
- Record the working demo and fallback video; finish README, setup, architecture, API/data contracts, exact Alibaba usage, tests, limitations, security/privacy, ROI hypotheses, and Q&A notes.
- Prepare GitHub repository, working demo video, and project documentation; submit by August 27 unless organizers have confirmed August 31 in writing.

August 28-31, if formally confirmed, are for deferred work and reliability polish only. They are not permission to add live integrations, broad detection, another remedy, or a new product.

## Definition Of Done

Recovery Radar is done only when all conditions are true:

- `RR-MAIN-v2` completes from checksum-verified reset in 3-4 minutes with a real Alibaba-hosted Qwen call and the exact visible Track 06 sequence.
- Trigger-time `TicketLookupEvidence`, its observed count/time, and derived `firstInboundAt` prove the proactive case predates inbound contact without a stored assertion boolean.
- Web and simulated WhatsApp display one case; web preference remains non-binding and the simulated WhatsApp reply is the first accepted slot.
- The exact reply changes risk `20 -> 70`, queue, priority, SLA, and authority mode for deterministic reasons.
- The uncertain source ETA and original backend commitment are visibly different from the offered exact slot; one and only one mock reschedule creates the real before/after backend transition after valid customer acceptance and required approval.
- The pre-reply proposal is superseded; only a new proposal/decision bound to the post-reply current version can be approved and executed.
- Independent read-back passes before any success claim, and customer acknowledgement is required before `RESOLVED`.
- All eight deterministic artifact scenarios pass twice under checksum/run-ID controls, and separate live Alibaba smoke/e2e passes without exact raw-confidence assertions; prohibited actions, duplicate side effects, real sends, and unsupported successful closures are zero.
- UI, docs, trace, and video identify the exact observed Alibaba-hosted Qwen integration and label MuleRun as used or not used without ambiguity.
- UI, docs, and video permanently label fictional, simulated, and mock components and make no impact or production-readiness claim.
- Repository setup, health, reset, tests, architecture, data/API contracts, security notes, limitations, demo script, and required submission artifacts are complete by the operational deadline.

## Risks And Open Assumptions

| Risk or assumption | Consequence | Resolution or mitigation |
|---|---|---|
| Exact Alibaba-hosted Qwen endpoint, model, quota, region, and retention are unknown until access | Core eligibility and demo may fail | Prove a real call August 24; record observed metadata only; escalate access issues immediately. |
| MuleRun trigger, pause/approval, connector, and trace behavior are unproven | Workflow debugging could consume the build | Time-box on day one; use local orchestration plus real Alibaba-hosted Qwen if unproven. |
| QoderWork/QwenWork/Qwenwork naming is inconsistent | Submission may mislabel required tooling | Ask organizers and document only actual components; see [naming conflict](../context/aibuildathon.imssa.lk.md#3-qoderwork-vs-qwenwork). |
| August 27 versus August 31, portal, video limit, repo visibility, and rubric weights are unresolved | Late or malformed submission risk | Maintain a complete August 27 package and seek written confirmation ([open questions](../context/aibuildathon.imssa.lk.md#conflicts--open-questions)). |
| Proactive outreach can feel intrusive or unlawful without consent | Trust/privacy harm | Use explicit fictional transactional consent, preferred-channel and quiet-hours gates, minimal disclosure, contact cap, opt-out, and no real send. |
| A seeded event can make the demo look scripted | Judges may discount technical depth | Show source payload, live Qwen trace, deterministic gates, failure scenarios, reset checksum, and backend read-back. |
| Sentiment and code-switching can be misread | Incorrect escalation or biased treatment | Use quoted cues and uncertainty, combine objective signals, route low confidence safely, and avoid psychological/churn claims. |
| Model variability can break the exact demo result | Non-deterministic presentation | Use schema constraints, temperature/configuration appropriate to structured extraction, one retry, deterministic normalization contract, saved test trace, and honest safe failure. |
| Verification against the same mock service may be mistaken for independence | Weak proof of outcome | Separate action response from a fresh read endpoint/store query and link observed state; describe it as independent read-back within a mock backend, not external verification. |
| Two named contributors may not be available | This alternative cannot safely meet August 27 | Treat staffing as an activation gate; ownership is fixed above and optional MuleRun, reminders, dashboards, and extra polish are already cut. Do not silently assign both workstreams to one person or displace selected ResolveGuard. |
| Merchant policy, identity, legal basis, economics, and customer acceptance are fictional | Prototype cannot support production or ROI claims | Require merchant, legal/privacy, security, and customer validation before any real pilot. |

## Sources

All dossiers and embedded sources were accessed or verified 2026-08-23. Vendor claims, HN comments, funding figures, and shortlist scores remain attributed directional evidence rather than audited facts.

- **Planning brief:** [`../plan.md`](../plan.md), especially hard Track 06, Alibaba/Qwen, prototype, rubric, deadline, and deliverable constraints.
- **Official event dossier:** [`../context/aibuildathon.imssa.lk.md`](../context/aibuildathon.imssa.lk.md), including [at-a-glance rules](../context/aibuildathon.imssa.lk.md#at-a-glance-rules), [Track 06 deep-read](../context/aibuildathon.imssa.lk.md#track-06-deep-read), [rubric checklist](../context/aibuildathon.imssa.lk.md#rubric-to-evidence-checklist), and [operational interpretation](../context/aibuildathon.imssa.lk.md#operational-interpretation-pending-confirmation).
- **Decision hub:** [`../context/context.md`](../context/context.md), including [Recovery Radar shortlist #5](../context/context.md#5-recovery-radar-proactive-service-failure-resolution), [cross-source synthesis](../context/context.md#cross-source-synthesis), and [deadline guardrail](../context/context.md#deadline-safe-delivery-guardrail).
- **Hacker News dossier:** [`../context/news.ycombinator.com.md`](../context/news.ycombinator.com.md), including [evidence limits](../context/news.ycombinator.com.md#evidence-limits), [anti-patterns](../context/news.ycombinator.com.md#anti-patterns-to-avoid), and [defensible architecture](../context/news.ycombinator.com.md#a-defensible-support-agent-architecture).
- **Techmeme dossier:** [`../context/techmeme.com.md`](../context/techmeme.com.md), including [method](../context/techmeme.com.md#method-and-reading-notes), [enterprise agents](../context/techmeme.com.md#enterprise-ai-agents), and [Track 06 opportunity map](../context/techmeme.com.md#track-06-opportunity-map).
- **TLDR dossier:** [`../context/tldr.tech.md`](../context/tldr.tech.md), including [method](../context/tldr.tech.md#method), [direct support signal](../context/tldr.tech.md#direct-support-and-enterprise-workflow-signal), [safety and evaluation](../context/tldr.tech.md#safety-permissions-observability-and-evaluation), and [rubric ammunition](../context/tldr.tech.md#rubric-ammunition).
- **Startup Battlefield dossier:** [`../context/techcrunch.com.md`](../context/techcrunch.com.md), including [method and caveat](../context/techcrunch.com.md#method-labels-and-count-caveat), [ChargeMate](../context/techcrunch.com.md#104-chargemate), [transferable patterns](../context/techcrunch.com.md#transferable-patterns-worth-stealing), and [whitespace](../context/techcrunch.com.md#whitespace-in-this-cohort).
- **Rigor reference and selected build:** [`idea-1.md`](idea-1.md), used for implementation-brief structure, explicit AI/control boundaries, exact scenarios, verification semantics, and honest mock labeling; ResolveGuard remains selected while Recovery Radar is only a separately scope-locked alternative.

## Final Lock

Keep **Recovery Radar** as a scope-locked alternative only; **ResolveGuard remains selected** unless a new review explicitly changes that decision and assigns both contributor roles. If activated, build one proactive delayed-order recovery case: real Alibaba-hosted Qwen investigates after trigger-time no-ticket evidence; web shows only a proposal/non-binding preference; the simulated WhatsApp reply supplies the first acceptance and human request; a new post-reply proposal/decision receives approval; one mock reschedule changes the original commitment to a distinct exact slot; and independent read-back plus customer acknowledgement proves resolution. MuleRun is optional. Real commerce, real messaging, broad anomaly detection, additional remedies, and invented impact are outside the lock.
