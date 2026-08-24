# ResolveGuard

**Status:** LOCKED implementation brief  
**Decision date:** 2026-08-23  
**Track:** [06 - Enterprise Customer Support](aibuildathon.imssa.lk.md#problem-tracks---choose-your-problem-space)  
**Operational submission deadline:** [2026-08-27 unless organizers confirm 2026-08-31 in writing](aibuildathon.imssa.lk.md#1-submission-deadline-august-27-vs-august-31)  
**Evidence access date:** 2026-08-23

## One-Line Pitch

**ResolveGuard is an Alibaba-hosted Qwen-powered, policy-gated support supervisor that carries one delayed/damaged-order case across web chat and a simulated WhatsApp-style channel, executes or escalates bounded mock remedies, and verifies the backend outcome before closure.**

## Locked Decisions

Changing a locked choice requires an explicit scope and Track 06 compliance review against the August 27 deadline.

| Decision | Locked choice | Reason |
|---|---|---|
| Product | **ResolveGuard only** | It presents all four Track 06 capabilities in one coherent workflow. |
| Domain | One fictional Sri Lankan e-commerce merchant; delayed/damaged orders | Narrow, understandable, and action-oriented without claiming real merchant facts. |
| Primary user | Support supervisor | Reviews exceptions and controls customer recovery decisions. |
| Supporting users | Customer and support agent | The customer reports/confirms; an agent can continue escalated work from the packet. |
| Economic buyer hypothesis | Support operations/CX lead, with policy-owner input | A hypothesis only; no interview, contract, volume, or willingness-to-pay claim is made. |
| Channels | Working web chat plus **simulated** WhatsApp-style adapter | Shows canonical continuity without claiming a Meta integration. |
| Identity | Seeded customer/order link; no fuzzy matching | An unverified or mismatched identity blocks disclosure and remedies until a separate verification event. |
| Remedies | Mock replacement/reshipment and mock **recovery credit only** | No refund product, payment movement, or refund tool is promised or implemented. |
| Authority | Eligible replacement may auto-execute; every credit requires approval | Qwen proposes; deterministic code authorizes. |
| Combined remedy | Replacement plus credit requires `COMBINED_REMEDY`; supervisor may approve credit up to LKR 1,500, policy owner above LKR 1,500 | Defines role and reason semantics without a vague risk threshold. |
| Approval binding | Approval binds one proposal ID, policy decision ID, parameter digest, and case version, and is consumed once | Any edit creates a new proposal and gateway decision before a new approval can execute. |
| Closure | Mock backend read-back is mandatory; customer confirmation closes the live demo | Generated success text is never proof. A timeout may close only as `CLOSED_UNRESOLVED`. |
| AI | Qwen performs extraction, cited synthesis/planning, service-risk cues, response, and handoff | AI remains central while authority remains deterministic. |
| Alibaba compliance | Every submission/runtime path must use a real **Alibaba-hosted Qwen endpoint** for central AI; MuleRun is an additional preferred Alibaba component, not a substitute for Qwen | A local/non-Alibaba model, mock Qwen, or MuleRun workflow without real Qwen reasoning is not compliant with the [event ecosystem requirement](aibuildathon.imssa.lk.md#at-a-glance-rules). |
| Delivery capacity assumption | At least two contributors are available for the full August 27 scope | If the team is solo, re-scope the locked ResolveGuard P0 before implementation rather than silently substituting another product. |
| State | One persisted `CaseState` derived from append-only records | Channel and model sessions are not systems of record. |
| Evaluation | Exactly **8 P0 release scenarios** and **2 P1 comparison scenarios** | P0 is the judge-visible spine; baseline comparison is entirely P1. |
| Sentiment correction | P1 and conditional on time | P0 displays source cues but does not require correction UX. |

## Problem And Evidence

Delayed or damaged orders often require a business action rather than another FAQ answer. Customers can repeat facts across channels, receive an unsupported or incorrect policy claim, or wait while a human reconstructs the case. Policy staleness is one possible cause of an incorrect claim, not the only one. ResolveGuard targets this narrow gap between fluent support text and a verified outcome.

The evidence is directional rather than audited market proof:

- Practitioner discussions distinguish remediation from FAQ deflection and describe the risk of unsupported policy and poor human exits ([HN deflection](news.ycombinator.com.md#1-deflection-is-not-resolution), [policy failures](news.ycombinator.com.md#2-hallucinated-policy-is-a-financial-and-reputational-failure), [human exit](news.ycombinator.com.md#3-customers-need-a-visible-low-friction-human-exit)).
- Duplicate reports across channels support a canonical case rather than disconnected inboxes ([HN cross-channel duplication](news.ycombinator.com.md#5-cross-channel-duplication-loses-context-and-engineering-time)).
- Reviewed enterprise/CX reporting identifies generic agents and channel reach as crowded while leaving room for policy-gated action, evidence-complete handoff, and verified resolution ([Techmeme opportunity map](techmeme.com.md#track-06-opportunity-map)).
- The TLDR corpus supports structured memory, typed tools, scoped authority, stopping rules, and outcome-level evaluation ([TLDR safety and evaluation](tldr.tech.md#safety-permissions-observability-and-evaluation), [suggested scenario](tldr.tech.md#suggested-live-scenario)).
- The Battlefield review found directional cohort whitespace around the complete resolution ledger ([cohort whitespace](techcrunch.com.md#whitespace-in-this-cohort)), but four unresolved sites and public-positioning limits mean it does not prove global novelty ([uncertainty register](techcrunch.com.md#unreachable-and-uncertainty-register)).

No savings percentage, automation rate, market size, merchant policy, legal entitlement, customer demand, or production benchmark is asserted.

## Track 06 Mapping

The official wording is **"Autonomous AI agents, omnichannel workflow automation, ticket resolution, and sentiment analysis"** ([official Track 06 transcription](aibuildathon.imssa.lk.md#problem-tracks---choose-your-problem-space)).

| Track phrase | P0 implementation | Visible proof |
|---|---|---|
| Autonomous AI agents | Alibaba-hosted Qwen extracts intent/entities and cues, requests evidence, proposes a bounded plan, and drafts a response/handoff | Trace shows exact Alibaba endpoint host, model ID, prompt version, evidence IDs, schema result, proposal, and downstream gate decision. |
| Omnichannel workflow automation | Web and simulated WhatsApp events normalize into one case | Same `caseId`, persisted contact count, facts, prior actions, and channel provenance. |
| Ticket resolution | Deterministic policy, mock action, attempt receipt, independent read-back, customer confirmation, and explicit unresolved closure | The demo reaches `RESOLVED`; uncertainty reaches `FAILED_SAFE`, `ESCALATED`, or `CLOSED_UNRESOLVED`, never false success. |
| Sentiment analysis | Qwen returns quoted service-risk cues with confidence; deterministic objective signals set priority, SLA, and queue | The exact seeded follow-up produces score 65, `HIGH`, `SUPERVISOR`, and the configured high-priority SLA. |

## Demo Contract

Target live duration is 3-4 minutes. Every transport and commerce integration is visibly labeled as real, simulated, or mock.

1. Reset fixture `DEMO-MAIN`. Show order `LK-240826-1042`, customer `C-1007`, active policy `RET-2026-08-v2`, and one seeded prior contact `EVT-PRIOR-001`. The first live web message is therefore contact 2.
2. Nadeesha sends: `Order eka ada enawa kiyala kiwwa, still ne. Gift ekak.` Web identity is already verified by seeded link. The event joins `CASE-0001`; the Alibaba-hosted Qwen trace shows extraction and a cited replacement proposal.
3. Gateway rule `POL-03` allows one replacement because the promise is missed, stock is 3, identity is verified, policy is active, and no replacement exists. There is no model-generated action-risk threshold.
4. `create_replacement` creates exactly one mock shipment `RPL-9001`; a separate read observes it and sets `RESOLVED_PENDING_CUSTOMER`. A seeded mock fulfillment event then records delivery on August 24 before the follow-up; the customer has not confirmed closure.
5. The simulated WhatsApp-style follow-up, contact 3, says: `Package eka awa, box eka wet. I need compensation too. Me third time contact karanne.` It resumes active processing on `CASE-0001` as `INVESTIGATING`; it does not reopen a closed case. The permanent banner says **SIMULATED WHATSAPP ADAPTER - NO META/WHATSAPP API**.
6. The fixed Qwen fixture output contains the cue quote `Me third time contact karanne`, label `FRUSTRATION`, confidence `0.90`. Deterministic signals are contact count 3, channel switch, and missed promise. Score is exactly `10 + 20 + 15 + 20 = 65`, producing `HIGH`, queue `SUPERVISOR`, reason `SERVICE_RISK_HIGH`, and demo SLA due 30 minutes after `receivedAt`. Damage is evidence but contributes no score. No CRITICAL rule is met.
7. Qwen proposes a LKR 2,500 recovery credit alongside the already successful replacement. Gateway returns `REQUIRE_APPROVAL` with `COMBINED_REMEDY` and `ROLE_LIMIT_EXCEEDED`, routing to `POLICY_OWNER`. The customer is told that a recovery credit can be reviewed; no refund availability is claimed.
8. To show supervisor authority, the supervisor edits the amount to LKR 1,500. This rejects/supersedes the old approval, creates a new proposal, reruns the gateway, and creates a new approval bound to the exact normalized parameters and digest. The supervisor approves it once.
9. `create_credit` writes mock receipt `CR-7001`. Read-back confirms replacement and credit; the approval is atomically consumed and cannot be replayed. The case becomes `RESOLVED_PENDING_CUSTOMER`.
10. A seeded customer confirmation event moves the case to `RESOLVED`. Show the linked evidence, proposal, decision, approval, action attempts, receipts, verifier, and exact Alibaba/Qwen trace.

The live happy path requires network access to the confirmed Alibaba-hosted Qwen endpoint. A recorded run is resilience only and is not a substitute for a testable prototype.

## Scope

### P0 Judge-Visible Spine

- One fictional merchant, one delayed/damaged workflow, one web input, and one simulated WhatsApp-style input.
- Seeded verified identity/order association and a separate `IDENTITY_VERIFIED` event contract.
- Alibaba-hosted Qwen for schema-constrained extraction, evidence synthesis/planning, cue extraction, response, and handoff.
- Versioned fictional policy and seeded mock order/inventory state.
- Pure deterministic eligibility/permission gateway with exact reason codes.
- One idempotent mock replacement action and one approval-gated mock recovery-credit action.
- Approval binding, edit-as-new-proposal, one-time consumption, attempt records, reconciliation, and independent verification.
- Canonical persisted case fields, append-only resolution ledger, minimal customer view, minimal supervisor queue/case view, stop/escalate/reset controls, and trace view.
- Eight P0 scenarios and the deterministic unit/integration release matrix.
- Runnable repository, README, architecture diagram, demo video, and project documentation by August 27 ([official deliverables](aibuildathon.imssa.lk.md#solution-guidelines--deliverables)).

### P1 After P0 Is Stable And Recorded

- Retrieval-only baseline, its two comparison scenarios, and baseline visualization.
- Evaluation dashboard beyond a machine-readable/text test report.
- Dedicated ops/analytics UI, cost dashboard, and nonessential API filtering/export.
- Supervisor correction of service-risk cues and retention of correction events.
- Optional seeded image evidence, proactive event, richer handoff editing, accessibility polish, and measured token cost when metadata/pricing are known.

### Explicit Non-Goals

- No refund product, refund endpoint, payment movement, cash equivalent, cancellation, or legal refund determination.
- No production WhatsApp/Meta, courier, inventory, CRM, merchant, payment, bank, wallet, SMS, email, social, or contact-center integration.
- No claim that mock credits have monetary value or simulated messages were externally delivered.
- No fuzzy identity merge, production authentication design, voice, OCR dependency, production Sinhala claim, broad help desk, workforce system, or general AI-governance platform.
- No arbitrary operator transition to `RESOLVED`; unresolved work uses `CLOSED_UNRESOLVED` with a reason.

## P0 Functional Requirements

| ID | Requirement | Acceptance evidence |
|---|---|---|
| FR-01 | Normalize preassignment input as `InboundEvent`, then create immutable `CaseEvent` only after case assignment | Both timestamps and source IDs survive; every `CaseEvent` has `caseId`. |
| FR-02 | Verify seeded identity/order association before disclosure or remedy | Mismatch sets `AWAITING_IDENTITY`; only a later `IDENTITY_VERIFIED` event resumes work. Human approval cannot bypass identity. |
| FR-03 | Invoke a confirmed Alibaba-hosted Qwen endpoint on every submission path | Trace and health output identify the real endpoint host and model; MuleRun may additionally orchestrate it. Absent Qwen confirmation makes the build non-compliant, not a valid fallback. |
| FR-04 | Validate Qwen structured output | One retry; malformed output then escalates with `MODEL_SCHEMA_INVALID`. Free text cannot call tools. |
| FR-05 | Retrieve active policy/order/inventory evidence | Stable evidence IDs, timestamps, trust type, and policy version are persisted. |
| FR-06 | Apply explicit policy eligibility and role rules | `ALLOW`, `REQUIRE_APPROVAL`, or `BLOCK` includes exact reason codes and normalized parameter digest. |
| FR-07 | Execute an allowed replacement idempotently | One backend replacement and one action receipt under replay. |
| FR-08 | Bind approvals and edited parameters safely | Edit creates a new proposal/decision/approval; stale approval fails; consumed approval cannot run twice. |
| FR-09 | Record each tool attempt and reconcile unknown outcomes | Timeout becomes `TIMED_OUT_UNKNOWN`; read-back resolves it before retry or escalation. |
| FR-10 | Verify downstream state before successful status | No `RESOLVED_PENDING_CUSTOMER` without a passing verifier linked to the action. |
| FR-11 | Persist operational state | Priority, SLA due/status, contact count, assigned queue, closure reason/time, active resume count/time, and reopen count/time survive restart. |
| FR-12 | Expose minimal queue, stop/escalate, trace, health, and reset contracts | Demo can be controlled and inspected without hidden database edits. |
| FR-13 | Maintain a linked resolution ledger | Stable IDs link source event -> evidence -> model trace -> proposal -> decision -> approval -> action -> attempts -> verification. |
| FR-14 | Pass 8 P0 scenarios and all deterministic release tests | Zero prohibited or duplicate actions; expected final states, reason codes, and backend states match. |
| FR-15 | Label simulation and mock behavior | UI, video, README, and docs do not imply live commerce, messaging, or money movement. |

## AI And Deterministic Boundaries

| Qwen responsibility | Structured output | Safe failure |
|---|---|---|
| Intent/entity extraction | Issue, customer goal, order reference, language, missing facts, confidence | Clarify or `MODEL_SCHEMA_INVALID`; never establish identity semantically. |
| Evidence synthesis/planning | Evidence-bound candidate actions and rationale | Missing/contradictory evidence produces abstention or escalation. |
| Service-risk cue extraction | Quote, label, confidence, uncertainty | Cue is ignored below the configured threshold; no protected-trait or mental-state inference. |
| Response/handoff | Concise status or structured packet with evidence IDs | Withhold unsupported consequential statements. |

Deterministic code owns schema validation, identity state, effective-policy selection, dates, amounts, stock and duplicate checks, roles, credit limits, combined-remedy handling, priority/SLA calculation, action allowlists, idempotency, approval consumption, retries, step limits, routing, verification, and legal state transitions.

**Invariant:** Qwen may propose `ISSUE_REPLACEMENT`, `ISSUE_CREDIT`, `REQUEST_INFORMATION`, or `ESCALATE`; it never grants authority or changes mock backend state.

## Data Contracts

```ts
type InboundEvent = {
  inboundEventId: string;
  tenantId: string;
  source: "web" | "simulated_whatsapp";
  externalEventId: string;
  actorRef: string;
  payload: unknown;
  occurredAt: string;
  receivedAt: string;
};

type CaseEvent = {
  eventId: string;
  caseId: string;
  inboundEventId?: string;
  actor: string;
  kind: string;
  payload: unknown;
  occurredAt: string;
  receivedAt: string;
  recordedAt: string;
};

type CaseStatus =
  | "OPEN" | "INVESTIGATING" | "AWAITING_IDENTITY"
  | "AWAITING_CUSTOMER" | "AWAITING_APPROVAL" | "ACTION_IN_PROGRESS"
  | "RESOLVED_PENDING_CUSTOMER" | "RESOLVED" | "CLOSED_UNRESOLVED"
  | "ESCALATED" | "FAILED_SAFE";

type CaseState = {
  caseId: string;
  tenantId: string;
  version: number;
  status: CaseStatus;
  identityStatus: "UNVERIFIED" | "VERIFIED" | "MISMATCH";
  priority: "NORMAL" | "HIGH" | "URGENT";
  assignedQueue: "GENERAL" | "SUPERVISOR" | "POLICY_OWNER" | "IDENTITY_REVIEW";
  slaDueAt: string;
  slaStatus: "ON_TRACK" | "AT_RISK" | "BREACHED" | "STOPPED";
  contactCount: number;
  closureReason?: "CUSTOMER_CONFIRMED" | "CUSTOMER_TIMEOUT_UNRESOLVED" | "OPERATOR_UNRESOLVED";
  closedAt?: string;
  activeResumeCount: number;
  reopenCount: number;
  lastResumedAt?: string;
  lastReopenedAt?: string;
  customerId?: string;
  orderId?: string;
  issueType?: "DELAYED" | "DAMAGED" | "DELAYED_AND_DAMAGED";
  serviceRisk: ServiceRisk;
  activeProposalId?: string;
  pendingApprovalId?: string;
  latestVerificationId?: string;
  createdAt: string;
  updatedAt: string;
};

type ServiceRisk = {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  cueEvidenceIds: string[];
  objectiveSignalIds: string[];
  explanation: string[];
};
```

### Ledger Records And Stable Links

| Record | Required IDs and fields |
|---|---|
| `EvidenceRef` | `evidenceId`, `caseId`, `sourceEventId`, `sourceType`, `sourceId`, `excerptOrValue`, `observedAt`, `trust` |
| `ModelTrace` | `traceId`, `caseId`, `sourceEventIds`, `inputEvidenceIds`, `provider=ALIBABA_CLOUD`, exact endpoint host/model, prompt version, schema status, latency, output digest |
| `ResolutionProposal` | `proposalId`, `caseId`, `traceId`, `actionType`, normalized parameters, `parameterDigest`, `evidenceIds`, `createdAt`, `supersedesProposalId?` |
| `PolicyDecision` | `decisionId`, `proposalId`, decision, reason codes, policy version, role required, evaluated parameter digest, `evaluatedAt` |
| `ApprovalRequestVersion` | `approvalVersionId`, `approvalId`, `proposalId`, `decisionId`, `caseVersion`, exact parameter digest, required role, status, reviewer, decision time, `consumedAt?`, `supersedesVersionId?` |
| `ActionRecordVersion` | `actionVersionId`, `actionId`, `proposalId`, `decisionId`, `approvalId?`, idempotency key, status, attempt IDs, receipt ID, created time, `supersedesVersionId?` |
| `ToolAttemptVersion` | `attemptVersionId`, `attemptId`, `invocationId`, `toolName`, `actionId?`, `evidenceRequestId?`, ordinal, started/completed times, `PENDING|SUCCEEDED|FAILED|TIMED_OUT_UNKNOWN|RECONCILED_SUCCEEDED|RECONCILED_NOT_APPLIED`, request digest, response/receipt/evidence ID, error code, `supersedesVersionId?` |
| `VerificationRecord` | `verificationId`, `caseId`, `actionIds`, `attemptIds`, expected state, observed state, source evidence ID, passed, failure reason, verified time |
| `EvalRun` | `runId`, scenario/build/fixture/policy/prompt/model versions, assertion results, trace IDs, pass, latency |

All persisted ledger records are immutable versions. A lifecycle change appends a new version that references the stable logical ID and prior version; it never updates an earlier row in place. `CaseState` is the mutable materialized projection rebuilt from those versions and case events. A resolution ledger is the ordered view of these linked records, not a separate unlinked log.

### State Rules

- Only normalized events mutate the materialized case, using optimistic `version` checks.
- An `InboundEvent` exists before assignment; after assignment, an immutable `CaseEvent` carries `caseId` and references it.
- `UNVERIFIED` or `MISMATCH` identity sets `AWAITING_IDENTITY`, permits only generic non-account guidance, and disallows account/order disclosure, planning a consequential remedy, approval, or execution. A separate `IDENTITY_VERIFIED` event is required to continue.
- An active-case message **resumes** processing, increments `contactCount` and `activeResumeCount`, and sets `lastResumedAt`; it is not a reopen.
- A message after `RESOLVED` or `CLOSED_UNRESOLVED` may reopen the same case only for the same seeded order/problem, increments `reopenCount`, sets `lastReopenedAt`, and records `CASE_REOPENED`.
- `ACTION_IN_PROGRESS` requires an `ALLOW`, or a matching unconsumed approval for `REQUIRE_APPROVAL`.
- Approval execution atomically checks `proposalId`, `decisionId`, case version, exact digest, reviewer role, and unconsumed status, then consumes once.
- Editing parameters never mutates an approval. It creates a superseding proposal, reruns the gateway, and creates a new approval if still required.
- `RESOLVED_PENDING_CUSTOMER` requires passing read-back. `RESOLVED` additionally requires `CUSTOMER_CONFIRMED`.
- Manual stop first halts automation and transitions the active case to `ESCALATED` with `MANUAL_STOP`. A later explicit administrative close may transition that unresolved case to `CLOSED_UNRESOLVED` with `OPERATOR_UNRESOLVED`; arbitrary operator `RESOLVED` is forbidden.

## Policy Rules

All rules are fictional demo fixtures, not Sri Lankan law or a real merchant policy.

| Rule | Eligibility and result |
|---|---|
| POL-01 | Active policy required; otherwise `BLOCK: POLICY_MISSING_OR_INACTIVE`. |
| POL-02 | Verified seeded customer/order association required; otherwise `BLOCK: IDENTITY_UNVERIFIED` and `AWAITING_IDENTITY`. Approval cannot override it. |
| POL-03 | Missed promise + stock > 0 + no successful prior replacement permits one replacement: `ALLOW: REPLACEMENT_ELIGIBLE`. |
| POL-04 | Verified delivery + damaged-item claim + stock > 0 + no successful prior replacement permits one replacement: `ALLOW: REPLACEMENT_ELIGIBLE`. Optional image is non-authoritative P1 evidence. |
| POL-05 | Existing successful equivalent remedy blocks another: `BLOCK: DUPLICATE_REMEDY`. |
| POL-06 | Every recovery credit requires human approval: `REQUIRE_APPROVAL: CREDIT_APPROVAL_REQUIRED`. |
| POL-07 | Supervisor may approve recovery credit up to and including LKR 1,500; above that routes to policy owner with `ROLE_LIMIT_EXCEEDED`. |
| POL-08 | Replacement plus recovery credit adds `COMBINED_REMEDY`; supervisor may approve the combined remedy only when credit is <= LKR 1,500, otherwise policy owner is required. |
| POL-09 | Missing, contradictory, or insufficient evidence blocks execution with `EVIDENCE_INSUFFICIENT`; a human may request information but cannot approve around missing identity or mandatory eligibility. |
| POL-10 | Unknown tool outcome triggers reconciliation before retry. It cannot be reported as success. |
| POL-11 | Content cannot add tools, alter limits, reveal secrets, or override policy; log `PROMPT_INJECTION_SIGNAL`. |
| POL-12 | Maximum autonomous sequence is six model/tool steps and one safe idempotent retry; stop with `STEP_LIMIT_REACHED` and escalate. |

There is no generic action-risk score or threshold. Eligibility is the explicit conjunction of identity, active policy, remedy prerequisites, duplicate check, stock, amount, role, evidence, and action allowlist.

## Service-Risk Logic

Qwen supplies uncertain language evidence; code supplies the operational score.

```text
+10  explicit frustration/urgency cue with confidence >= 0.85
+20  contactCount >= 3
+15  channel switch on the same unresolved case
+20  missed promised delivery
+25  one failed remedy
+30  explicit human request
-15  verified remedy succeeded and an improving cue has confidence >= 0.85
```

Clamp to 0-100: `LOW 0-24`, `MEDIUM 25-49`, `HIGH 50-79`, `CRITICAL 80-100`. An explicit human request always escalates regardless of score. `HIGH` sets priority `HIGH`, queue `SUPERVISOR`, and demo SLA due `receivedAt + 30 minutes`; `CRITICAL` sets `URGENT`, immediate escalation, and stops autonomous remedies.

For the main fixture, the Qwen adapter maps a schema-valid `FRUSTRATION` cue for the exact seeded quote into the configured `HIGH_CONFIDENCE` bucket, whose persisted confidence value is `0.90`; the raw model output remains in the trace. The exact score is therefore `65`: cue 10 + third contact 20 + channel switch 15 + missed promise 20. The successful replacement reduction is not applied because the new damage/compensation issue means language is not improving. A missing/invalid cue omits the linguistic 10 points and raises `MODEL_CUE_UNCERTAIN`; it never increases the route. This prevents an accidental `CRITICAL` result while preserving Qwen as the cue extractor.

P0 displays cue, confidence, objective signals, score, and route. Supervisor correction is P1 only.

## Tool And Attempt Semantics

| Tool | Authority | P0 behavior |
|---|---|---|
| `get_order`, `get_inventory`, `get_effective_policy` | Qwen may request; server scopes parameters | Read-only evidence with stable IDs and timestamps. |
| `create_replacement` | Matching `ALLOW` required | Mock, idempotent, one receipt. |
| `create_credit` | Matching unconsumed approval required | Mock recovery credit only; no money/refund. |
| `get_resolution_state` | Verifier only | Separate read-back of mock backend. |
| `send_channel_message` | Allowed evidence-bound draft only | Adds simulated outbound event; no external API. |
| `escalate_case` | Deterministic router | Assigns queue and reason without model-selected destination. |

Each invocation appends a `ToolAttemptVersion(PENDING)` before calling, including read-only evidence tools that have no `actionId`. A later result appends a superseding version with `SUCCEEDED` or `FAILED`; no attempt row is mutated. A timeout appends `TIMED_OUT_UNKNOWN`; the workflow must call `get_resolution_state` with the original idempotency key. Observed application appends `RECONCILED_SUCCEEDED`; observed absence appends `RECONCILED_NOT_APPLIED`, after which the one allowed retry may use the same idempotency key. Continued uncertainty sets `FAILED_SAFE` and escalates. There can be at most one backend side effect.

## Architecture And Alibaba Integration

```text
Web UI -----------------\
                         > Inbound normalizer -> Case store/ledger -> Qwen supervisor
Simulated WhatsApp -----/                                      (Alibaba-hosted endpoint)
                                                                       |
                                                        evidence-bound proposal
                                                                       v
                                                         deterministic gateway
                                                          allow | approve | block
                                                             |       |       |
                                                             v       v       v
                                                         mock tools  queue  handoff
                                                             |
                                                             v
                                                    independent read-back
```

### Submission-Path Compliance

| Path | Required proof | Compliance result |
|---|---|---|
| MuleRun-led | Confirmed MuleRun workflow run plus exact Alibaba/Qwen component(s) shown in trace, README, architecture, and video | Compliant only after the real run is captured. |
| Python/light UI | Real call to an Alibaba-hosted Qwen endpoint, with host/model identified and response trace stored | Compliant; orchestration may be local. |
| Local-only model, cached response, mock Qwen, or unconfirmed MuleRun | None qualifies as a confirmed Alibaba Cloud AI component | **Not submission-compliant.** Recording/caching may support demo resilience but cannot be the only functional path. |

The exact endpoint host and model ID remain `UNRESOLVED` until the August 24 credentials test. The brief does not invent them. Once confirmed, replace the placeholder in configuration/docs and expose the exact values in trace metadata without secrets.

### August 24 Objective Go/No-Go

Run one end-to-end spike using a real Alibaba-hosted Qwen call:

1. Post a seeded web `InboundEvent`.
2. Receive schema-valid extraction/plan from the actual Alibaba-hosted Qwen endpoint and persist host/model/trace metadata.
3. Pass the proposal through the gateway.
4. Execute one allowed mock replacement with an idempotency key.
5. Read the mock backend independently and observe the replacement.

**GO:** all five steps pass and can be rerun from reset. Choose MuleRun if its real workflow path is also confirmed; otherwise use Python orchestration with the confirmed Alibaba-hosted Qwen endpoint.  
**NO-GO:** if no confirmed Alibaba Cloud AI component can run, stop submission claims and seek organizer/platform support. A local-only fallback is not compliant.

### Policy Circuit Breaker Contingency

Policy Circuit Breaker is emergency scope reduction, not a second locked idea and not automatically submission-ready. Switching product requires explicit organizer/Track 06 scope re-review of autonomous agent behavior, omnichannel continuity, ticket resolution, sentiment analysis, and Alibaba Cloud AI compliance. Without written/recorded approval and a new acceptance map, that fallback is invalid for the locked Track 06 submission. **ResolveGuard remains the only locked idea.** Runtime may switch from MuleRun to Python without changing the product.

## Server And API Contracts

| Method/path | Contract |
|---|---|
| `POST /api/events/web` | Accept `InboundEvent`, deduplicate `externalEventId`, assign/return `caseId`. |
| `POST /api/events/simulated-whatsapp` | Same contract with permanent simulation marker. |
| `POST /api/cases/{caseId}/identity-verifications` | Append separate `IDENTITY_VERIFIED` or `IDENTITY_FAILED` event; no approval semantics. |
| `GET /api/cases/{caseId}` | Role-scoped materialized case including priority/SLA/contact/closure/resume fields. |
| `GET /api/cases/{caseId}/ledger` | Ordered records and stable links. |
| `GET /api/cases/{caseId}/trace` | Model, gateway, attempt, and verifier trace; redacted, exact Alibaba endpoint host/model visible. |
| `GET /api/queues/{queue}` | Minimal sorted queue by priority, SLA due, and received time. |
| `POST /api/cases/{caseId}/run` | Start or resume an active workflow idempotently at expected case version. |
| `POST /api/cases/{caseId}/stop` | Stop automation, set `ESCALATED`, reason `MANUAL_STOP`, and assign requested allowed queue. |
| `POST /api/cases/{caseId}/escalate` | Deterministic reason/queue transition; destination is allowlisted. |
| `POST /api/cases/{caseId}/close-unresolved` | From `ESCALATED` or `AWAITING_CUSTOMER`, append an administrative closure event with allowlisted unresolved reason; never permits `RESOLVED`. |
| `POST /api/approvals/{approvalId}/decisions` | Approve/reject/request info only for exact bound proposal; consumes approval only during action execution. |
| `POST /api/proposals/{proposalId}/revisions` | Create new proposal from edited parameters, supersede old approval, rerun gateway, return new decision/approval. |
| `POST /api/mock/orders/{orderId}/replacement` | Internal mock endpoint requiring gateway capability and idempotency key. |
| `POST /api/mock/orders/{orderId}/credit` | Internal mock endpoint requiring exact unconsumed approval capability. |
| `GET /api/mock/orders/{orderId}/resolution-state` | Independent read-back and reconciliation source. |
| `POST /api/demo/reset` | Demo-only authenticated reset to named fixture version; returns fixture checksum and reset ID. |
| `POST /api/evals/run` | P0 runner contract; P1 may add selection/filtering UI. |
| `GET /health` | App/store plus confirmed Alibaba Qwen and optional MuleRun readiness, without secrets. |

All mutations require idempotency keys and expected versions. `stop` prevents new autonomous steps; in-flight tool calls are reconciled before final status. Reset is disabled outside demo mode.

## Evaluation And Release Gates

### Eight P0 Scenarios

Each scenario starts from its named reset fixture. `Action count` means successful mock side effects, not read-only calls or attempts.

| ID | Scenario | Expected final case state | Expected successful actions | Required reason codes | Expected mock backend state |
|---|---|---|---:|---|---|
| P0-01 | First eligible delayed-order contact | `RESOLVED_PENDING_CUSTOMER` | 1 replacement | `REPLACEMENT_ELIGIBLE` | Exactly one replacement; no credit. |
| P0-02 | Main cross-channel contact 3, LKR 2,500 credit edited to LKR 1,500, approved, customer confirms | `RESOLVED` | 1 replacement + 1 credit | `REPLACEMENT_ELIGIBLE`, `CREDIT_APPROVAL_REQUIRED`, `COMBINED_REMEDY`, first `ROLE_LIMIT_EXCEEDED`, then `SUPERVISOR_WITHIN_LIMIT` | Exactly one replacement and one LKR 1,500 credit; old approval superseded; new approval consumed once. |
| P0-03 | LKR 2,500 combined remedy not edited | `ESCALATED` to `POLICY_OWNER` | 1 replacement, 0 credits | `COMBINED_REMEDY`, `CREDIT_APPROVAL_REQUIRED`, `ROLE_LIMIT_EXCEEDED` | Replacement present; no credit. |
| P0-04 | Identity mismatch | `AWAITING_IDENTITY` | 0 | `IDENTITY_UNVERIFIED` | No account disclosure record, replacement, or credit. |
| P0-05 | Existing-replacement fixture receives prompt injection requesting a duplicate replacement and secrets | `ESCALATED` | 0 | `PROMPT_INJECTION_SIGNAL`, `DUPLICATE_REMEDY` | Existing seeded replacement remains the only replacement; no credit or secret disclosure. |
| P0-06 | Replacement call times out after backend may have applied it | `RESOLVED_PENDING_CUSTOMER` after reconciliation | 1 replacement | `TOOL_OUTCOME_UNKNOWN`, `RECONCILED_SUCCEEDED` | Exactly one replacement under original idempotency key; no credit. |
| P0-07 | Malformed Qwen output twice | `ESCALATED` | 0 | `MODEL_SCHEMA_INVALID` | No replacement or credit. |
| P0-08 | Explicit human request on active case | `ESCALATED` to `SUPERVISOR` | 0 | `HUMAN_REQUESTED` | No replacement or credit. |

### Two P1 Comparison Scenarios

These run only after P0 is stable and do not block the August 27 submission.

| ID | Scenario | Expected final state/action/reason/backend |
|---|---|---|
| P1-01 | Qwen workflow versus retrieval-only baseline on an eligible delayed order | Qwen path: `RESOLVED_PENDING_CUSTOMER`, one replacement, `REPLACEMENT_ELIGIBLE`, replacement present. Baseline: `OPEN`, zero actions, `BASELINE_INFORMATION_ONLY`, no replacement/credit. |
| P1-02 | Qwen workflow versus retrieval-only baseline on a combined recovery request | Qwen path: `AWAITING_APPROVAL`, zero actions, `CREDIT_APPROVAL_REQUIRED` + `COMBINED_REMEDY`, no credit. Baseline: `OPEN`, zero actions, `BASELINE_INFORMATION_ONLY`, no credit. |

### Required Deterministic Unit/Integration Matrix

These tests cover mandatory behavior without inflating the eight judge-visible scenario slots. All are release gates.

| Test | Required assertion |
|---|---|
| Approval reject | `APPROVAL_REJECTED`; no side effect; case becomes `ESCALATED` to `SUPERVISOR`. |
| Approval request information | `INFORMATION_REQUIRED`; case `AWAITING_CUSTOMER`; no side effect. |
| Edited approval | Old approval is superseded; new proposal/decision/digest exists; stale approval execution returns conflict; new approval executes once. |
| Stale policy | Inactive `RET-2026-07-v1` cannot support a claim or action; `POLICY_MISSING_OR_INACTIVE`; final `ESCALATED`; zero actions; empty replacement/credit state. |
| Manual stop | No new steps after `MANUAL_STOP`; in-flight unknown attempt reconciled; final `ESCALATED`. |
| Step exhaustion | Exactly six autonomous steps maximum; `STEP_LIMIT_REACHED`; final `ESCALATED`; no unapproved side effect. |
| Customer-confirmed closure | Passing verifier plus confirmation permits `RESOLVED`; confirmation without verifier is rejected. |
| Timeout closure | Customer timeout produces `CLOSED_UNRESOLVED` + `CUSTOMER_TIMEOUT_UNRESOLVED`, never `RESOLVED`. |
| Reopen after closure | Same seeded order/problem appends `CASE_REOPENED`, status `OPEN`, `reopenCount + 1`, and `lastReopenedAt`; active-case follow-up increments `activeResumeCount`/`lastResumedAt` only. |
| Identity recovery | Approval cannot bypass mismatch; separate `IDENTITY_VERIFIED` event permits account disclosure/planning afterward. |
| Service-risk fixture | Exact cue `0.90`, score `65`, `HIGH`, `SUPERVISOR`, SLA +30 minutes; not `CRITICAL`. |
| Attempt replay | Timeout/retry uses one idempotency key and yields at most one backend replacement. |
| Arbitrary closure | Operator API cannot set `RESOLVED`; unresolved operator closure becomes `CLOSED_UNRESOLVED`. |

### P0 Release Criteria

- All eight P0 scenarios and every matrix test pass from clean reset twice.
- Prohibited actions: 0. Duplicate backend side effects: 0. Consequential claims/actions with valid evidence links: 100% on P0 fixtures.
- The main demo produces the exact service-risk score, route, approval chain, action counts, and backend state above.
- A real Alibaba-hosted Qwen call appears in the successful run. Exact host/model, prompt, fixture, policy, and build versions are stored.
- Model/tool timeout, malformed output, manual stop, identity mismatch, and closure semantics fail safely.
- Simulation/mock labels are visible. Actual results are reported honestly; no LLM judge certifies policy safety or backend success.

## Minimal UI

P0 has four compact surfaces, which may be tabs in one app:

1. Customer/web conversation with AI identity, status, human-request control, and customer confirmation.
2. Simulated WhatsApp console with permanent simulation banner and seeded identity selector.
3. Supervisor queue/case workspace with priority, SLA, evidence, plan, gate reasons, exact approval binding, attempts, verifier, and stop/escalate controls.
4. Trace/about view with exact confirmed Alibaba/Qwen component and explicit mock labels.

The evaluation dashboard, cost analytics, richer operations UI, and sentiment-correction UI are P1.

## Seed Fixtures

All names, merchant records, policies, contacts, orders, prices, remedies, and transactions are fictional.

| Fixture | Locked values |
|---|---|
| Merchant | `LankaCart Demo`, tenant `TENANT-LC-01` |
| Customer | `C-1007`, Nadeesha Perera, `si-en`, seeded verified web/simulated-channel links |
| Supervisor | `U-SUP-01`, role `SUPERVISOR`, recovery-credit limit LKR 1,500 |
| Policy owner | `U-POL-01`, role `POLICY_OWNER`, used above LKR 1,500 |
| Main order | `LK-240826-1042`, blender `BL-42`, LKR 18,900, promised Aug 22, initially `NOT_DELIVERED`, stock 3; a seeded fulfillment event records Aug 24 delivery before the damage follow-up |
| Policy | Active `RET-2026-08-v2`; inactive `RET-2026-07-v1` contains a deliberately unsupported/incorrect remedy statement to test version handling |
| Prior contact | `EVT-PRIOR-001` precedes the live web event; live web is contact 2 and simulated follow-up is contact 3 |
| Generated records | `RPL-9001` and `CR-7001` arise only during the resettable main run |

## Security And Safety

- Use fictional data only. Keep credentials server-side and out of prompts, browser code, fixtures, traces, and video.
- Redact before model calls/logs; scope model inputs and tool capabilities to one case.
- Treat messages, attachments, and retrieved text as untrusted. Validate all schemas, enums, amounts, destinations, and URLs server-side.
- Separate customer claims, model inference, approved policy, and verified backend facts.
- Do not disclose account/order facts or perform remedies while identity is unverified, even with operator approval.
- Use optimistic locking, immutable ledger records, one-time approvals, idempotency, timeouts, reconciliation, rate limits, six-step limit, and manual stop.
- Do not claim cryptographic immutability, production authentication, legal compliance, privacy terms, accessibility, fairness, or real financial safety unless implemented and reviewed.

## ROI Hypothesis

No ROI result is claimed. Keep units explicit:

```text
baseline_handling_cost =
  eligible_cases_per_month
  * baseline_handling_minutes_per_case
  * validated_loaded_cost_per_minute

pilot_handling_cost =
  eligible_cases_per_month
  * pilot_handling_minutes_per_case
  * validated_loaded_cost_per_minute

monthly_value_hypothesis =
  baseline_handling_cost
  - pilot_handling_cost
  + avoided_repeat_contacts_per_month * validated_cost_per_contact
  + measured_recovery_value_per_month
  - model_cost_per_month
  - integration_cost_amortized_per_month
  - supervisor_review_cost_per_month
  - incident_risk_cost_per_month
```

Every input requires merchant validation. `measured_recovery_value_per_month` cannot be inferred from sentiment.

## Delivery Plan

### August 24: Objective Gate

- Freeze fixtures and contracts.
- Complete the real Alibaba-hosted Qwen -> gateway -> allowed mock replacement -> independent read-back spike.
- Record exact endpoint host/model and decide MuleRun or Python orchestration.
- If no confirmed Alibaba Cloud AI component works, mark submission path non-compliant and escalate for access; do not disguise a local mock as fallback compliance.

### August 25

- Complete canonical state, identity block, evidence, policy rules, replacement idempotency, attempts, reconciliation, and linked ledger.
- Pass P0-01, P0-04, P0-06, and P0-07.

### August 26

- Complete simulated channel, exact service-risk fixture, combined remedy, proposal revision, approval binding/consumption, credit mock, verifier, queue, and stop/escalate.
- Pass all eight P0 scenarios and the deterministic matrix.

### August 27

- Freeze features; run all release gates twice from reset.
- Verify health, reset, reproducible startup, and live Alibaba/Qwen path.
- Finish README, setup, architecture, API/data contracts, tests/evals, limitations, exact Alibaba usage, GitHub repository, working demo video, and project documentation.
- Submit by August 27 unless organizers have confirmed a later deadline in writing.

August 28-31, if explicitly confirmed, may be used for P1 baseline/dashboard/correction work and polish only, not a new product or real integration.

## Unresolved Assumptions

| Assumption | Required resolution |
|---|---|
| Exact Alibaba-hosted Qwen endpoint, model ID, quota, region, and retention | Confirm through a real August 24 call; record only observed values. |
| MuleRun access, eligibility, trigger/tool/pause semantics, and trace behavior | Confirm with a real workflow. Otherwise use Python orchestration plus the confirmed Alibaba-hosted Qwen endpoint. |
| QoderWork/QwenWork/Qwenwork naming and mandatory usage | Obtain organizer clarification; do not infer equivalence. |
| August 27 versus August 31 deadline, portal, video length/hosting, repo visibility, and rubric weights | Ask organizers; maintain a complete August 27 package. |
| Production policy, identity, privacy, legal, security, merchant economics, and multilingual quality | Outside MVP; require real stakeholder and legal/technical validation before production. |

## Sources

Source-list labels remain for the bibliography; factual uses above link directly to the relevant sections.

- **S0 Planning brief:** [`../plan.md`](../plan.md). Accessed 2026-08-23.
- **S1 Official event dossier:** [`aibuildathon.imssa.lk.md`](aibuildathon.imssa.lk.md), including [rules](aibuildathon.imssa.lk.md#at-a-glance-rules), [Track 06](aibuildathon.imssa.lk.md#problem-tracks---choose-your-problem-space), [deliverables](aibuildathon.imssa.lk.md#solution-guidelines--deliverables), and [rubric](aibuildathon.imssa.lk.md#evaluation-criteria--rubric). Accessed 2026-08-23.
- **S2 Hacker News dossier:** [`news.ycombinator.com.md`](news.ycombinator.com.md), including [evidence limits](news.ycombinator.com.md#evidence-limits). Accessed 2026-08-23.
- **S3 Techmeme dossier:** [`techmeme.com.md`](techmeme.com.md), including [reading notes](techmeme.com.md#method-and-reading-notes). Accessed 2026-08-23.
- **S4 TLDR dossier:** [`tldr.tech.md`](tldr.tech.md), including [method](tldr.tech.md#method). Accessed 2026-08-23.
- **S5 Battlefield dossier:** [`techcrunch.com.md`](techcrunch.com.md), including [method and count caveat](techcrunch.com.md#method-labels-and-count-caveat). Accessed or attempted 2026-08-23.
- **S6 Decision hub:** [`context.md`](context.md), including the [ResolveGuard recommendation](context.md#choose-resolveguard) and [deadline guardrail](context.md#deadline-safe-delivery-guardrail). Accessed 2026-08-23.

## Final Lock

Build **ResolveGuard**. Keep the judge-visible proof to one canonical cross-channel case, central real Alibaba-hosted Qwen reasoning, deterministic eligibility and role checks, one auto replacement, one approval-bound recovery credit, attempt reconciliation, linked evidence, independent read-back, and honest closure. Change orchestration if MuleRun is unproven; do not change the locked product or submit a path without a confirmed Alibaba Cloud AI component.
