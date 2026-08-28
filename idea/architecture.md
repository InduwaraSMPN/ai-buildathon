# ResolveMesh Architecture

**Document role:** Canonical architecture and data-contract context  
**Status:** P0 architecture contract  
**Decision date:** 2026-08-28  
**Product:** ResolveMesh for Track 06, Enterprise Customer Support

This document defines how ResolveMesh is structured, where authority lives, and how records bind across the proof-carrying resolution loop. Product purpose and claim boundaries are in [idea.md](idea.md). Build order, fixtures, acceptance tests, and release gates are in [implementation.md](implementation.md).

If documents conflict, [idea.md](idea.md) controls product intent and scope, this document controls architecture and data semantics, and [implementation.md](implementation.md) controls P0 execution and acceptance. A conflict must be resolved deliberately rather than hidden behind compatibility behavior.

## Architecture Goals

1. Turn an ambiguous request into inspectable, cross-domain evidence before assigning an owning route.
2. Keep model reasoning useful while placing consent, authorization, side effects, verification, and closure under deterministic control.
3. Make each consequential transition reproducible from immutable records, canonical digests, and explicit versions.
4. Test the smallest proposed change in an isolated sandbox before asking a human to approve it.
5. Bind approval to the exact case, evidence, proposal, target, action state, sandbox run, checks, role, and validity window.
6. Guarantee at-most-one mock backend effect per approved action despite retries and unknown outcomes.
7. Require independent technical evidence and current-version employee confirmation rather than equating a tool receipt with resolution.
8. Keep incident closure independent from the proposal-first CMDB correction lifecycle.
9. Preserve a verified incident as an immutable executable regression artifact, with each execution stored separately.
10. Keep all P0 enterprise systems visibly fictional, mock, resettable, and replaceable behind typed adapters.

## Invariants

- One Qwen supervisor may invoke exactly five bounded, typed, read-only specialist skills. The skills are not autonomous principals and do not vote.
- Model output is untrusted proposed data. It cannot create consent, expand scope, grant a role, approve an operation, perform a write, mark a check successful, verify a result, update CMDB, close a case, or pass a release gate.
- Every material diagnostic claim cites immutable evidence IDs, including supporting and contradicting evidence where present.
- An actionable hypothesis has fresh support from at least two independent source classes and no unresolved decisive contradiction.
- Every consequential write is sandboxed first, explicitly approved for an exact immutable snapshot, idempotent, receipted, and independently read back.
- A new relevant event or state change invalidates stale approval and stale closure bases. Nothing silently refreshes an approval or verification.
- `RESOLVED` requires a passing technical verification and employee confirmation for the current case version and current action-state digest.
- An incident may be resolved while its CMDB proposal remains proposed, rejected, expired, or rolled back. CMDB status cannot directly reopen or close the incident.
- A CMDB proposal is immutable. Reconciliation, approval, apply, verification, rollback, lifecycle events, and projection are separate records.
- A regression definition is immutable and content-addressed. A run never mutates the artifact.
- Logical ledger records are append-only. Mutable case and lifecycle projections are disposable and rebuildable.
- Tenant, case, employee, device, role, field, and time scope are enforced by application code before a model or adapter call.
- P0 performs no real endpoint, DNS, VPN, route, application, server, cloud, Teams, ITSM, change-system, or authoritative CMDB mutation.
- Recorded model contracts never impersonate a live call and are never an automatic fallback on a real runtime path.

## System Context

ResolveMesh is an assurance overlay, not a replacement system of record. P0 uses a thin web client, one backend application, a relational store, in-process or local mock adapters, and a real server-side call to Alibaba-hosted Qwen.

```text
 Employee portal                 SIMULATED TEAMS
       |                               |
       +---------- support events -----+
                       |
                       v
              API and identity boundary
                       |
              event normalizer/deduper
                       |
          +------------+-------------+
          |                          |
          v                          v
 append-only ledger          case projections/read API
          |
          v
 diagnosis orchestrator ---------> Alibaba-hosted Qwen
          ^                              supervisor
          |                         /   /   |   \   \
          |                       APP EUX  SRV  NET CLOUD
          |                         bounded typed reads
          +---------- evidence <----------+
                       |
                       v
             deterministic policy core
             /          |             \
            v           v              v
      sandbox runner  action gateway  verification service
            |           |              |
       mock fixture  mock action      independent mock reads
            |         adapter           + employee event
            +-----------+--------------+
                        |
                        v
                 resolution records
                    /         \
                   v           v
      CMDB drift workflow     regression compiler
      proposal -> reconcile   artifact -> run
      -> owner grant -> mock
      apply -> verify/rollback
```

### Components And Responsibilities

| Component | Responsibility | Authority boundary |
|---|---|---|
| Web client | Portal, simulated Teams, incident workspace, approval, evidence, CMDB, regression, and trace views | Displays commands and records; never decides state or authority |
| API boundary | Authentication context, role context, request validation, redaction, expected-version and idempotency inputs | Rejects malformed, stale, cross-tenant, or unauthorized requests |
| Event normalizer | Deduplicates external events, links channels, creates immutable `SupportEvent` records, advances case projection | Initial intake uses external ID; existing-case events also use expected case version |
| Ledger/store | Immutable domain records, ordered lifecycle events, idempotency indexes, rebuildable projections | Database constraints enforce uniqueness and append-only semantics |
| Diagnosis orchestrator | Runs bounded planning rounds, dispatches allowlisted skills, validates Qwen output, records evidence and hypotheses | No write-capable enterprise tool is registered |
| Qwen adapter | Calls Alibaba-hosted Qwen, validates structured output, records a redacted `ModelTrace` | Credentials and raw provider responses remain server-side |
| Specialist skill registry | Five typed adapters for Application, EUX, Server, Network, and Cloud reads | Fixed tool names, schemas, tenant/case scope, timeout, and call budget |
| Evidence policy | Computes freshness and evidence-class independence; checks contradictions and actionability | Deterministic calculations override model confidence |
| Sandbox runner | Applies proposal only to pinned fixture snapshot and runs an ordered, versioned check set | No route to the mock production-state writer |
| Approval service | Creates and decides exact, role-bound, expiring, one-time grants | Model cannot nominate or impersonate approver authority |
| Action gateway | Atomically rechecks bindings, consumes approval, dispatches idempotently, and handles unknown outcomes | The only P0 incident-remediation write path |
| Verification service | Reads backend state independently and records technical and employee verification | Action response is never accepted as verification |
| CMDB workflow | Proposal, reconciliation, owner grant, mock apply, independent read-back, rollback, and projection | Separate role, grant, state machine, and adapter from incident action |
| Regression compiler/runner | Creates content-addressed executable artifact and append-only run records | Assertions are deterministic; model output cannot determine pass/fail |
| Mock adapters | Resettable fictional enterprise state and stable source records | Permanently labeled `MOCK` or `SIMULATED`; no production connector claim |
| Optional MuleRun adapter | Optional orchestration/trace transport after the direct path works | Cannot become an authority or substitute for Qwen or the ledger |

## Runtime Deployment

The minimal P0 deployment is one web application/backend process plus one relational database. Mock systems can be in-process modules or local HTTP services. A server-side Qwen adapter is the only mandatory external integration. Secrets never enter browser bundles, persisted model traces, fixtures, or logs.

Recommended trust zones:

```text
 Browser
   | HTTPS, authenticated demo identity
   v
 ResolveMesh server
   |-- policy/state/action transaction boundary
   |-- relational ledger and projections
   |-- in-process/local mock adapters
   |
   +-- outbound HTTPS --> Alibaba-hosted Qwen endpoint
   |
   +-- optional outbound HTTPS --> MuleRun
```

The direct application-to-Qwen path is the reference implementation. MuleRun may wrap orchestration or add observability only after parity is demonstrated. If unavailable, behaviorally uncertain, or difficult to audit, it is omitted without changing any domain contract.

## Alibaba-Hosted Qwen Integration

### Live Path

Every real runtime and represented live demo path calls an Alibaba-hosted Qwen model. The adapter is configured server-side with an organizer- and account-appropriate endpoint, model ID, API credential, region, timeout, and retention setting. These values are deployment configuration, not hard-coded assumptions. `/health` reports only observed provider readiness, endpoint host, and model identity, never credentials or authorization headers.

The adapter follows this sequence:

1. Build a minimized prompt envelope from the current case, allowed evidence IDs, policy summary, tool schemas, prompt version, and output schema version.
2. Mark employee text, CMDB fields, telemetry labels, change descriptions, and tool output as untrusted quoted data.
3. Expose only the five registered read skills and their scoped JSON schemas.
4. Validate each requested skill call before execution, then return typed observations rather than arbitrary text.
5. Enforce at most ten skill calls and two planning rounds for one diagnosis run.
6. Validate the final structured response against the application schema and referential-integrity rules.
7. Permit one schema-repair request containing validation errors but no additional authority or tools.
8. On another invalid response, append a failed trace, transition to `ESCALATED`, add `MODEL_SCHEMA_INVALID`, and perform no side effect.
9. Persist a redacted `ModelTrace` containing observed host/model metadata, versions, tool calls, evidence references, latency, and output digest.

Provider errors, quota exhaustion, timeout, unsupported model identity, or authentication failure fail closed. There is no transparent fallback to a recorded response. The UI reports live integration unavailable and offers human escalation.

### Model Output Contract

The final model response may contain:

- normalized intent and entities;
- service-risk cues with exact quoted spans;
- requested allowlisted reads;
- candidate hypotheses with evidence links and uncertainty;
- a proposed route from the fixed route enum;
- missing facts and the smallest discriminating test;
- a bounded remediation proposal draft;
- a concise employee-facing explanation and specialist handoff summary.

The application rejects unknown IDs, unknown routes, unknown action types, missing support, parameters outside fixture scope, writes disguised as reads, and any request to change tools, policy, roles, credentials, or system instructions.

### Optional MuleRun

MuleRun is an optional orchestration adapter, not a required dependency. If used, it may transport the same versioned prompt/tool envelopes, persist correlation IDs, and expose orchestration traces. It must not:

- replace the direct Alibaba-hosted Qwen call;
- add tools beyond the application registry;
- hold approval, consent, closure, CMDB, or release authority;
- become the source of truth for case state;
- receive secrets or personal data not already permitted for Qwen;
- alter retries in a way that can duplicate a write;
- obscure provider host/model metadata or simulation labels.

The application ledger remains canonical. MuleRun failure falls back only to the direct live-Qwen path if that path is healthy; it never falls back to recorded output.

## Supervisor And Specialist Skills

There is one Qwen supervisor and five bounded read skills. Domain names describe evidence boundaries, not independent personas or security principals.

| Skill | Permitted reads | Required typed result | Explicitly forbidden |
|---|---|---|---|
| `probe_application` | ExpenseHub health, deployment version, errors, synthetic status | Source IDs, observed/retrieved timestamps, typed values, provenance | Deploy, restart, configuration write, arbitrary service lookup |
| `probe_eux` | Fields included in the exact granted simulated-capsule manifest | VPN state, DNS result, device time, resolver, reachability, capsule reference | Command execution, undeclared field, privilege request, real endpoint access |
| `probe_server` | Auth service, database, server health and error counters | Typed status/counters with source identity and age | Process control, database write, shell, broad log export |
| `probe_network` | Mock DNS answer, route target, gateway and reachability | Typed endpoint/path observations and age | DNS, route, VPN, firewall, or gateway mutation |
| `probe_cloud` | Active ExpenseHub endpoint, deployment/change reference, cloud health | Endpoint and `CHG-481` linkage with provenance | Cloud mutation, credential enumeration, arbitrary resource traversal |

All skill arguments include `tenantId`, `caseId`, and an allowed resource identifier. `probe_eux` additionally requires `capsuleId`, `consentDecisionId`, and `manifestDigest`. The registry rejects cross-tenant references, unscoped identifiers, unknown fields, shell-like input, oversized values, and calls outside the current diagnosis run.

Skills emit observations; they do not emit state transitions or approvals. The orchestrator converts successful typed reads into immutable `EvidenceObservation` records after source, time, schema, and scope validation.

## Authority Matrix

| Decision | Qwen | Deterministic application | Human role | Mock/backend adapter |
|---|---:|---:|---:|---:|
| Extract intent and service-risk cues | Proposes | Validates and limits effects | May correct | No |
| Select/order read skills | Proposes | Allowlist and budget enforcement | May stop | Executes reads only |
| Create evidence record | No | Yes, from validated source result | No | Supplies source observation |
| Rank hypothesis and draft route | Proposes | Enforces evidence and route rules | May review/escalate | No |
| Determine freshness/actionability | No | Yes | No | No |
| Draft remediation | Proposes | Normalizes, scopes, digests | Reviews exact snapshot | No |
| Pass sandbox check | No | Yes | No | Supplies sandbox observations |
| Grant diagnostic consent | No | Records exact actor decision | Employee | No |
| Approve incident action | No | Validates role and bindings | `NETWORK_OWNER` | No |
| Apply incident action | No | Action gateway only | Cannot bypass gateway | Idempotent mock effect |
| Verify technical state | No | Independent verifier | No | Supplies read-back state |
| Confirm employee outcome | No | Validates binding | Exact employee actor | No |
| Close incident | No | Only from valid records | Cannot set directly | No |
| Propose CMDB drift | May explain | Creates immutable candidate | Reviews | No |
| Reconcile/apply CMDB | No | Deterministic separate workflow | `CMDB_OWNER` approves | Mock effect/read-back |
| Pass regression/run/release | No | Deterministic assertions | May review | Supplies fixture observations |

## Mock And Simulation Boundaries

P0 uses real Qwen but fictional enterprise data and mock enterprise systems.

| Boundary | P0 behavior | Production implication |
|---|---|---|
| Portal | Real local web interaction against fictional identity | Requires enterprise SSO, account lifecycle, and channel authentication |
| Teams | Browser simulation with permanent `SIMULATED TEAMS` label | No Microsoft tenant, bot, Graph, webhook, or message-integrity claim |
| Diagnostic capsule | Browser-generated fixed observations after explicit consent | No installed client, hardware identity, privilege, command execution, or attestation |
| Application/EUX/Server/Network/Cloud | Typed fixture reads | No production telemetry, discovery, or control-plane integration |
| Action | One mock dependency-state mutation | No real DNS, VPN, route, endpoint, server, or cloud mutation |
| CMDB | Versioned mock relation store | No ServiceNow or other authoritative CMDB connector or compatibility claim |
| Identity/roles | Seeded demo users and roles | No production IAM, separation-of-duties, or role-governance claim |
| Change | Fixed `CHG-481` record | No production change-system read or authorization inheritance |
| Regression | Deterministic local fixture execution | No CI/CD promotion, scheduled monitoring, or production gate |

Mock adapters must expose fixture version and checksum, return stable source record IDs, support clean reset, and prevent any outbound mutation. Simulation status is stored in records and rendered wherever the data appears.

## Canonical Records

### Shared Primitives

```ts
type Digest = `sha256:${string}`;
type IsoTimestamp = string;

type Canonicalization = {
  algorithm: "CANONICAL-JSON-1+SHA-256";
  schemaVersion: string;
};

type Provenance = {
  sourceSystem: string;
  sourceRecordId: string;
  sourceKind:
    | "EMPLOYEE" | "ENDPOINT" | "TELEMETRY" | "CMDB"
    | "CHANGE" | "TOOL" | "MODEL";
  observedAt: IsoTimestamp;
  retrievedAt: IsoTimestamp;
  contentDigest: Digest;
};

type Validity = {
  validFrom: IsoTimestamp;
  validUntil?: IsoTimestamp;
  freshnessSeconds: number;
  freshnessClass: "FRESH" | "AGING" | "STALE" | "UNKNOWN";
};

type TargetRef = {
  tenantId: string;
  resourceType: "MOCK_NETWORK_DEPENDENCY";
  resourceId: string;
};
```

All timestamps are UTC ISO-8601 values. Confidence is a finite number from `0` through `1`; it is descriptive and never authorization. Canonical JSON uses sorted object keys, preserved array order, UTF-8, normalized number rules, and omitted absent optional fields. Each digest definition below includes the record schema version and canonicalization algorithm.

### Event, Consent, And Capsule

```ts
type SupportEvent = {
  schemaVersion: string;
  eventId: string;
  eventDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  channel: "PORTAL" | "SIMULATED_TEAMS";
  externalEventId: string;
  actorId: string;
  actorType: "EMPLOYEE" | "OPERATOR";
  contactOrdinal: number;
  text: string;
  occurredAt: IsoTimestamp;
  receivedAt: IsoTimestamp;
  simulation: boolean;
};

type ConsentDecision = {
  schemaVersion: string;
  consentDecisionId: string;
  decisionDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  actorId: string;
  deviceId: string;
  manifestDigest: Digest;
  decision: "GRANTED" | "DECLINED";
  decidedAt: IsoTimestamp;
  expiresAt?: IsoTimestamp;
  reasonCode?: "DIAGNOSTIC_CONSENT_DECLINED";
};

type CapsuleField = {
  field: "VPN_STATE" | "DNS_RESULT" | "DEVICE_TIME" | "RESOLVER_CONFIG" | "REACHABILITY";
  purpose: string;
};

type CapsuleObservation = {
  field: CapsuleField["field"];
  value: unknown;
  observedAt: IsoTimestamp;
};

type DiagnosticCapsule = {
  schemaVersion: string;
  capsuleId: string;
  capsuleDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  deviceId: string;
  manifest: CapsuleField[];
  manifestDigest: Digest;
  consentDecisionId: string;
  consentDecisionDigest: Digest;
  observations: CapsuleObservation[];
  simulation: true;
  provenance: Provenance;
  validity: Validity;
  createdAt: IsoTimestamp;
};
```

Uniqueness is `(tenantId, channel, externalEventId)` for events. An accepted event stores the resulting `caseVersion`; duplicates return the original event without another increment. The initial portal request is assigned a `caseId` server-side before persistence. Consent binds the exact device and manifest. A capsule is valid only if the grant is unexpired, belongs to the same tenant/case/actor/device, and has the same manifest digest. A declined consent can never be referenced by a capsule.

`eventDigest`, `decisionDigest`, and `capsuleDigest` cover all fields except their own digest fields. Capsule observations must be a subset of the manifest, and no raw data outside that list is collected.

### Evidence And Hypothesis

```ts
type EvidenceObservation = {
  schemaVersion: string;
  evidenceId: string;
  evidenceDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  domain: "APPLICATION" | "EUX" | "SERVER" | "NETWORK" | "CLOUD" | "CMDB" | "CHANGE";
  sourceClass: "EMPLOYEE" | "ENDPOINT" | "TELEMETRY" | "CMDB" | "CHANGE" | "TOOL";
  claimCode: string;
  claim: string;
  value: unknown;
  unit?: string;
  confidence: number;
  provenance: Provenance;
  validity: Validity;
  contradictsEvidenceIds: string[];
  createdAt: IsoTimestamp;
};

type DiscriminatingTest = {
  testType: "SANDBOX_DEPENDENCY_PATCH" | "READ_ONLY_REVALIDATION" | "HUMAN_REVIEW";
  parameters: unknown;
  expectedObservations: string[];
};

type Hypothesis = {
  schemaVersion: string;
  hypothesisId: string;
  hypothesisDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  code: string;
  proposedRoute: "APPLICATION" | "EUX" | "SERVER" | "NETWORK" | "CLOUD" | "HUMAN_TRIAGE";
  statement: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  evidenceSnapshotDigest: Digest;
  confidence: number;
  freshnessAssessment: string;
  missingFacts: string[];
  smallestDiscriminatingTest: DiscriminatingTest;
  traceId: string;
  status: "CANDIDATE" | "ACTIONABLE" | "REJECTED" | "SUPERSEDED";
  createdAt: IsoTimestamp;
};
```

`evidenceDigest` covers the complete observation except itself. `evidenceSnapshotDigest` covers the sorted evidence ID/digest pairs, their validity data, and the snapshot time. Hypothesis references must resolve to the same tenant and case. Deterministic policy, not the model, assigns `ACTIONABLE` after checking current freshness, source-class independence, contradictions, allowed route, and required evidence.

### Remediation And Sandbox

```ts
type RemediationProposal = {
  schemaVersion: string;
  proposalId: string;
  proposalDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  hypothesisId: string;
  hypothesisDigest: Digest;
  actionType: "MOCK_PROMOTE_EXPENSEHUB_DEPENDENCY";
  targetRef: TargetRef;
  before: unknown;
  beforeDigest: Digest;
  after: unknown;
  afterDigest: Digest;
  inversePatch: unknown;
  inverseDigest: Digest;
  evidenceSnapshotIds: string[];
  evidenceSnapshotDigest: Digest;
  normalizedParameters: unknown;
  parameterDigest: Digest;
  actionSnapshotDigest: Digest;
  requiredRole: "NETWORK_OWNER";
  policyVersion: string;
  createdAt: IsoTimestamp;
};

type SandboxCheckResult = {
  schemaVersion: string;
  checkResultDigest: Digest;
  ordinal: number;
  code: "EXPENSEHUB_CONNECTIVITY" | "IDENTITY_FLOW" | "CONTROL_PEOPLEHUB";
  implementationVersion: string;
  expected: unknown;
  expectedDigest: Digest;
  observed: unknown;
  observedDigest: Digest;
  passed: boolean;
  evidenceId: string;
};

type SandboxRun = {
  schemaVersion: string;
  sandboxRunId: string;
  sandboxRunDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  proposalId: string;
  proposalDigest: Digest;
  actionSnapshotDigest: Digest;
  fixtureVersion: string;
  fixtureChecksum: Digest;
  sandboxSnapshotDigest: Digest;
  checkSetVersion: string;
  checkSetDigest: Digest;
  checks: SandboxCheckResult[];
  status: "PASSED" | "FAILED";
  startedAt: IsoTimestamp;
  completedAt: IsoTimestamp;
};
```

`proposalDigest` covers every proposal field except itself. Component digests cover canonical `before`, `after`, inverse, parameters, and evidence snapshot values. `actionSnapshotDigest` covers action type, target, normalized parameters, before/after/inverse digests, evidence snapshot digest, policy version, and proposal schema version.

`checkResultDigest` covers its complete check result except itself. `checkSetDigest` covers check-set version and the ordered check codes, implementation versions, and expected digests. `sandboxSnapshotDigest` covers fixture identity/checksum plus the pre-run sandbox state. `sandboxRunDigest` covers the entire completed run except itself. Changing order, implementation, expectation, fixture, proposal, or action snapshot creates a different run and requires a new approval.

### Action Approval, Attempts, And Receipts

```ts
type ApprovalGrant = {
  schemaVersion: string;
  approvalId: string;
  approvalDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  proposalId: string;
  proposalDigest: Digest;
  sandboxRunId: string;
  sandboxRunDigest: Digest;
  checkSetDigest: Digest;
  actionType: "MOCK_PROMOTE_EXPENSEHUB_DEPENDENCY";
  targetRef: TargetRef;
  actionSnapshotDigest: Digest;
  parameterDigest: Digest;
  beforeDigest: Digest;
  afterDigest: Digest;
  inverseDigest: Digest;
  evidenceSnapshotDigest: Digest;
  sandboxSnapshotDigest: Digest;
  requiredRole: "NETWORK_OWNER";
  approverId?: string;
  roleAssignmentDigest?: Digest;
  roleObservedAt?: IsoTimestamp;
  nonce: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUPERSEDED" | "EXPIRED" | "CONSUMED";
  requestedAt: IsoTimestamp;
  decidedAt?: IsoTimestamp;
  expiresAt: IsoTimestamp;
  consumedAt?: IsoTimestamp;
};

type ActionAttempt = {
  schemaVersion: string;
  attemptId: string;
  attemptDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  proposalId: string;
  proposalDigest: Digest;
  approvalId: string;
  approvalDigest: Digest;
  actionSnapshotDigest: Digest;
  idempotencyKey: string;
  requestDigest: Digest;
  ordinal: number;
  status:
    | "PENDING" | "SUCCEEDED" | "FAILED" | "TIMED_OUT_UNKNOWN"
    | "RECONCILED_SUCCEEDED" | "RECONCILED_NOT_APPLIED";
  startedAt: IsoTimestamp;
  completedAt?: IsoTimestamp;
  supersedesAttemptId?: string;
};

type ActionReceipt = {
  schemaVersion: string;
  receiptId: string;
  receiptDigest: Digest;
  tenantId: string;
  caseId: string;
  attemptId: string;
  backendRecordId: string;
  idempotencyKey: string;
  actionSnapshotDigest: Digest;
  appliedParameterDigest: Digest;
  beforeStateDigest: Digest;
  afterStateDigest: Digest;
  backendCommittedAt: IsoTimestamp;
  responseDigest: Digest;
  reconciled: boolean;
};
```

An approval request may be `PENDING` without an approver. Approval decision atomically records the authenticated approver, current role-assignment digest, decision time, and status. `approvalDigest` covers all immutable request bindings and the resulting decision fields except itself; the mutable interpretation of expiry or supersession is also represented by append-only approval lifecycle events, not by overwriting history in storage.

There is a unique backend-effect key `(tenantId, idempotencyKey)` and at most one accepted action for an active proposal. `requestDigest` covers approval, proposal, action snapshot, target, and normalized parameters. A repeated identical request returns the prior attempt/receipt. Reuse with a different digest is a conflict. `ActionReceipt` proves adapter commitment, not successful restoration.

### Technical Revalidation And Employee Confirmation

```ts
type TechnicalVerificationRecord = {
  schemaVersion: string;
  verificationId: string;
  verificationDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  actionReceiptId: string;
  actionReceiptDigest: Digest;
  actionStateDigest: Digest;
  verificationType: "INITIAL" | "CURRENT_VERSION_REVALIDATION";
  sourceEventIds: string[];
  checkSetVersion: string;
  checkSetDigest: Digest;
  checks: Array<{
    ordinal: number;
    code: "EXPENSEHUB_CONNECTIVITY" | "IDENTITY_FLOW" | "CONTROL_PEOPLEHUB";
    implementationVersion: string;
    expected: unknown;
    expectedDigest: Digest;
    observed: unknown;
    observedDigest: Digest;
    evidenceId: string;
    passed: boolean;
  }>;
  passed: boolean;
  reasonCode: "TECHNICAL_VERIFICATION_PASSED" | "TECHNICAL_REVALIDATION_PASSED" | "TECHNICAL_VERIFICATION_FAILED";
  verifiedAt: IsoTimestamp;
};

type EmployeeConfirmationRecord = {
  schemaVersion: string;
  confirmationId: string;
  confirmationDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  actionStateDigest: Digest;
  technicalVerificationId: string;
  technicalVerificationDigest: Digest;
  confirmationEventId: string;
  confirmationEventDigest: Digest;
  confirmedBy: string;
  outcome: "WORKING" | "NOT_WORKING" | "UNCERTAIN";
  passed: boolean;
  reasonCode: "EMPLOYEE_CONFIRMED" | "EMPLOYEE_NOT_CONFIRMED";
  confirmedAt: IsoTimestamp;
};
```

Technical verification uses fresh read-only adapter calls and creates new evidence. It cannot reuse the action response. Its check-set digest binds the versioned ordered checks and expected digests, and each record digest also binds the observed digests. All three checks must pass. An employee record passes only for `outcome=WORKING`, an authenticated actor matching the case employee, an exact confirmation event, and a passing technical record with the same tenant, case version, and action-state digest.

Any accepted event after technical verification increments the case version and invalidates that closure basis. A new `CURRENT_VERSION_REVALIDATION` must bind the new version and unchanged current action-state digest before employee confirmation. Confirmation itself is represented by the already accepted event; creating its bound confirmation record does not increment the case version again.

### CMDB Proposal And Reconciliation

```ts
type CMDBDriftProposal = {
  schemaVersion: string;
  driftProposalId: string;
  proposalDigest: Digest;
  tenantId: string;
  caseId: string;
  sourceCaseVersion: number;
  incidentVerificationIds: string[];
  incidentVerificationDigest: Digest;
  linkedChangeIds: string[];
  ciId: string;
  relationKey: string;
  provenance: Provenance[];
  confidence: number;
  validity: Validity;
  before: unknown;
  beforeDigest: Digest;
  after: unknown;
  afterDigest: Digest;
  inversePatch: unknown;
  inverseDigest: Digest;
  requiredRole: "CMDB_OWNER";
  createdAt: IsoTimestamp;
};

type CMDBReconciliationCheck = {
  code:
    | "CI_IDENTITY" | "RELATION_KEY" | "SOURCE_PRECEDENCE"
    | "DUPLICATE_RELATION" | "PROTECTED_ATTRIBUTE" | "CONCURRENT_VERSION"
    | "CONFLICTING_ENDPOINT";
  passed: boolean;
  detailsDigest: Digest;
};

type CMDBReconciliationRun = {
  schemaVersion: string;
  reconciliationRunId: string;
  reconciliationDigest: Digest;
  tenantId: string;
  operation: "APPLY" | "ROLLBACK";
  driftProposalId: string;
  proposalDigest: Digest;
  cmdbSnapshotVersion: string;
  cmdbSnapshotDigest: Digest;
  ruleVersion: string;
  checks: CMDBReconciliationCheck[];
  conflicts: string[];
  status: "PASS" | "CONFLICT";
  completedAt: IsoTimestamp;
};

type CMDBApprovalGrant = {
  schemaVersion: string;
  cmdbApprovalId: string;
  approvalDigest: Digest;
  tenantId: string;
  operation: "APPLY" | "ROLLBACK";
  driftProposalId: string;
  proposalDigest: Digest;
  applyReceiptId?: string;
  applyReceiptDigest?: Digest;
  inverseDigest: Digest;
  reconciliationRunId: string;
  reconciliationDigest: Digest;
  cmdbSnapshotVersion: string;
  cmdbSnapshotDigest: Digest;
  approverId?: string;
  requiredRole: "CMDB_OWNER";
  roleAssignmentDigest?: Digest;
  roleObservedAt?: IsoTimestamp;
  nonce: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUPERSEDED" | "EXPIRED" | "CONSUMED";
  requestedAt: IsoTimestamp;
  decidedAt?: IsoTimestamp;
  expiresAt: IsoTimestamp;
  consumedAt?: IsoTimestamp;
};

type CMDBApplyReceipt = {
  schemaVersion: string;
  applyReceiptId: string;
  receiptDigest: Digest;
  tenantId: string;
  driftProposalId: string;
  proposalDigest: Digest;
  cmdbApprovalId: string;
  cmdbApprovalDigest: Digest;
  beforeVersion: string;
  beforeDigest: Digest;
  afterVersion: string;
  afterDigest: Digest;
  appliedPatchDigest: Digest;
  backendRecordId: string;
  idempotencyKey: string;
  appliedAt: IsoTimestamp;
};

type CMDBVerificationRecord = {
  schemaVersion: string;
  cmdbVerificationId: string;
  verificationDigest: Digest;
  tenantId: string;
  driftProposalId: string;
  operation: "APPLY" | "ROLLBACK";
  sourceReceiptId: string;
  sourceReceiptDigest: Digest;
  expectedVersion: string;
  observedVersion: string;
  expectedDigest: Digest;
  observedDigest: Digest;
  evidenceId: string;
  passed: boolean;
  verifiedAt: IsoTimestamp;
};

type CMDBRollbackReceipt = {
  schemaVersion: string;
  rollbackReceiptId: string;
  receiptDigest: Digest;
  tenantId: string;
  driftProposalId: string;
  applyReceiptId: string;
  applyReceiptDigest: Digest;
  cmdbApprovalId: string;
  cmdbApprovalDigest: Digest;
  beforeVersion: string;
  beforeDigest: Digest;
  restoredVersion: string;
  restoredDigest: Digest;
  inverseDigest: Digest;
  backendRecordId: string;
  idempotencyKey: string;
  rolledBackAt: IsoTimestamp;
};

type CMDBLifecycleEvent = {
  schemaVersion: string;
  lifecycleEventId: string;
  eventDigest: Digest;
  tenantId: string;
  driftProposalId: string;
  sequence: number;
  type:
    | "PROPOSED" | "RECONCILED" | "CONFLICT" | "APPROVED" | "REJECTED"
    | "APPLIED" | "VERIFIED" | "ROLLBACK_APPROVED" | "ROLLED_BACK"
    | "ROLLBACK_VERIFIED" | "SUPERSEDED" | "EXPIRED";
  recordId: string;
  recordDigest: Digest;
  occurredAt: IsoTimestamp;
};

type CMDBLifecycleProjection = {
  tenantId: string;
  driftProposalId: string;
  version: number;
  status:
    | "PROPOSED" | "RECONCILED" | "CONFLICT" | "APPROVED" | "REJECTED"
    | "APPLIED" | "VERIFIED" | "ROLLBACK_APPROVED" | "ROLLED_BACK"
    | "ROLLBACK_VERIFIED" | "SUPERSEDED" | "EXPIRED";
  latestEventId: string;
  updatedAt: IsoTimestamp;
};
```

The proposal contains no mutable status or reconciliation result. A rollback grant references the original apply receipt and a new `operation=ROLLBACK` reconciliation run against the current CMDB snapshot. Apply and rollback each have independent idempotency keys, receipts, and read-back records. `CMDBLifecycleProjection` is derived only from ordered lifecycle events and can be rebuilt.

### Regression Artifact, Run, Model Trace, And Case Projection

```ts
type RegressionArtifact = {
  schemaVersion: string;
  artifactId: string;
  artifactDigest: Digest;
  tenantId: string;
  sourceCaseId: string;
  sourceCaseVersion: number;
  sourceProposalId: string;
  sourceActionReceiptId: string;
  sourceActionReceiptDigest: Digest;
  sourceTechnicalVerificationIds: string[];
  sourceEmployeeConfirmationId: string;
  sourceEmployeeConfirmationDigest: Digest;
  actionType: "MOCK_PROMOTE_EXPENSEHUB_DEPENDENCY";
  normalizedParameters: unknown;
  parameterDigest: Digest;
  evidenceSnapshotDigest: Digest;
  fixtureVersion: string;
  fixtureChecksum: Digest;
  policyVersion: string;
  promptVersion: string;
  schemaVersions: Record<string, string>;
  toolVersions: Record<string, string>;
  checkSetVersion: string;
  checkSetDigest: Digest;
  preconditions: Array<{ code: string; implementationVersion: string; expected: unknown }>;
  checks: Array<{ ordinal: number; code: string; implementationVersion: string; expected: unknown }>;
  prohibitedEffects: Array<{ code: string; implementationVersion: string }>;
  createdAt: IsoTimestamp;
};

type RegressionRun = {
  schemaVersion: string;
  runId: string;
  runDigest: Digest;
  tenantId: string;
  artifactId: string;
  artifactDigest: Digest;
  fixtureVersion: string;
  fixtureChecksum: Digest;
  preconditionResults: Array<{ code: string; passed: boolean; observed: unknown }>;
  assertionResults: Array<{ ordinal: number; checkCode: string; passed: boolean; observed: unknown }>;
  prohibitedEffectResults: Array<{ effectCode: string; observed: boolean; passed: boolean }>;
  passed: boolean;
  startedAt: IsoTimestamp;
  completedAt: IsoTimestamp;
};

type ModelTrace = {
  schemaVersion: string;
  traceId: string;
  traceDigest: Digest;
  tenantId: string;
  caseId: string;
  caseVersion: number;
  mode: "LIVE_INTEGRATION" | "RECORDED_CONTRACT";
  provider: "ALIBABA_CLOUD";
  endpointHost: string;
  modelId: string;
  promptVersion: string;
  outputSchemaVersion: string;
  toolRegistryVersion: string;
  inputDigest: Digest;
  inputEvidenceIds: string[];
  requestedSkillCalls: Array<{
    ordinal: number;
    skill: "probe_application" | "probe_eux" | "probe_server" | "probe_network" | "probe_cloud";
    argumentDigest: Digest;
    resultEvidenceIds: string[];
  }>;
  planningRounds: number;
  repairAttempts: number;
  schemaValid: boolean;
  outputDigest: Digest;
  rawConfidence?: number;
  latencyMs: number;
  providerRequestId?: string;
  recordedSourceTraceDigest?: Digest;
  createdAt: IsoTimestamp;
};

type IncidentStatus =
  | "OPEN" | "AWAITING_CONSENT" | "AWAITING_EVIDENCE" | "DIAGNOSING"
  | "AWAITING_APPROVAL" | "ACTION_IN_PROGRESS" | "RECONCILING"
  | "TECHNICALLY_VERIFIED" | "AWAITING_EMPLOYEE_CONFIRMATION"
  | "RESOLVED" | "ESCALATED" | "FAILED_SAFE" | "CLOSED_UNRESOLVED";

type IncidentCase = {
  projectionSchemaVersion: string;
  caseId: string;
  tenantId: string;
  projectionRevision: number;
  version: number;
  status: IncidentStatus;
  employeeId: string;
  contactCount: number;
  channels: Array<"PORTAL" | "SIMULATED_TEAMS">;
  priority: "NORMAL" | "HIGH" | "URGENT";
  slaDueAt: IsoTimestamp;
  assignedRoute: "UNASSIGNED" | "APPLICATION" | "EUX" | "SERVER" | "NETWORK" | "CLOUD" | "HUMAN_TRIAGE";
  serviceRisk: {
    cueEvidenceIds: string[];
    objectiveSignalIds: string[];
    level: "NORMAL" | "ELEVATED" | "HIGH";
    humanRequested: boolean;
  };
  activeHypothesisId?: string;
  activeProposalId?: string;
  activeApprovalId?: string;
  latestActionReceiptId?: string;
  technicalVerificationId?: string;
  employeeConfirmationId?: string;
  cmdbDriftProposalId?: string;
  regressionArtifactId?: string;
  actionStateDigest?: Digest;
  reasonCodes: string[];
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};
```

The executable regression artifact contains normalized data and deterministic check references, not generated source code, raw endpoint payload, or unnecessary employee text. `artifactDigest` covers all artifact fields except itself. A run verifies the supplied artifact digest and fixture checksum before execution; `passed` is computed from all preconditions, assertions, and prohibited-effect results.

`ModelTrace` stores structured decisions and concise rationales only. It does not store hidden chain-of-thought, credentials, authorization headers, or unredacted unnecessary personal data. `RECORDED_CONTRACT` requires `recordedSourceTraceDigest` and is visibly labeled. It cannot satisfy live readiness.

`IncidentCase` is a materialized projection, not evidence. `projectionRevision` is the optimistic-concurrency counter and increments on every projection write. `version` is the authorization and closure context version: it increments only when a relevant support event, evidence snapshot, target/pre-state change, or policy-defined case-context mutation changes the facts on which an approval or verification can rely. Pure lifecycle projection updates do not change it. Records created by a command bind the context version checked at command acceptance. Rebuilding the projection from the ordered ledger must produce the same revision, context version, state, and links.

## Digest And Immutability Rules

- Every immutable record has a schema version and a content digest.
- A record type with a lifecycle `status`, such as an approval or action attempt, is stored as immutable logical versions in the ledger. A transition appends the next version under the stable entity ID and binds the preceding record digest; no payload is overwritten.
- Digests use `CANONICAL-JSON-1+SHA-256`; the algorithm identifier is included in signed content even though P0 does not claim signatures or cryptographic non-repudiation.
- A parent record binds child records by stable ID and digest whenever the child affects authorization or reproducibility.
- Arrays whose order has meaning, including checks and tool calls, preserve order. Sets such as evidence snapshots are sorted by stable ID before digesting.
- Stored JSON and recomputed canonical bytes must agree on read; mismatch is data corruption and fails closed.
- Corrections create a new record that supersedes the prior ID. They do not update immutable content in place.
- Projections may be updated transactionally but are never used as the sole proof of an action or state transition.
- Retried commands return their existing immutable result when idempotency and request digests match.

## Incident State Machine

```text
 OPEN
   | diagnostics useful
   v
 AWAITING_CONSENT --declined/unavailable--> bounded diagnosis or ESCALATED
   | granted
   v
 AWAITING_EVIDENCE <--> DIAGNOSING
   | actionable hypothesis + immutable proposal + passing sandbox
   v
 AWAITING_APPROVAL --rejected/expired/superseded--> DIAGNOSING or ESCALATED
   | exact grant accepted and consumed
   v
 ACTION_IN_PROGRESS --timeout after dispatch--> RECONCILING
   | receipt                                  | read-back result
   +------------------------+-----------------+
                            v
                 independent technical verify
                            |
              +-------------+-------------+
              | fail                      | pass
              v                           v
          FAILED_SAFE             TECHNICALLY_VERIFIED
                                          |
                               AWAITING_EMPLOYEE_CONFIRMATION
                                   |               |
                          new event invalidates    | bound confirmation
                          and requires revalidate  v
                                               RESOLVED

 Any nonterminal state --manual stop/policy failure--> ESCALATED or FAILED_SAFE
```

### Transition Guards

1. Only a validated, deduplicated event changes contact count or channel continuity.
2. Consent refusal invokes no capsule and no endpoint action. Server-side bounded diagnosis may continue.
3. Diagnosis is limited to ten reads and two planning rounds. A second invalid schema response escalates.
4. An actionable hypothesis requires current support from two independent source classes and no unresolved decisive contradiction.
5. Approval may be requested only for a complete immutable proposal and a passing sandbox run over the exact action snapshot and ordered check set.
6. Execution atomically checks every approval binding, current role assignment, unused nonce, expiry, current case version, and backend pre-state.
7. Approval is consumed when execution is accepted, before dispatch, in the same transaction that creates the attempt and reserves the idempotency key.
8. A timeout after dispatch enters `RECONCILING`; read-back by idempotency key occurs before retry. Continued ambiguity ends `FAILED_SAFE`.
9. Technical verification reads current state independently of the action response and binds the current case version and action-state digest.
10. A later support event invalidates the old closure basis. A new technical revalidation must pass at the new case version.
11. Employee confirmation must bind the event, actor, current case version, current action state, and the same-version technical record.
12. Human-request and service-risk signals may alter priority, SLA, response style, and collaboration, but not hypothesis truth, route, approval, or action.

## Approval Invalidation

An incident action grant becomes `SUPERSEDED`, or `EXPIRED` when time is the cause, before execution if any of these values no longer match:

- tenant or case;
- case version due to a relevant event or command;
- hypothesis or evidence snapshot;
- proposal ID or digest;
- action type or target;
- normalized parameters or parameter digest;
- before, after, or inverse state/digest;
- action snapshot digest;
- sandbox run, run digest, fixture snapshot, or fixture checksum;
- check-set version/digest, order, implementation version, or expected value;
- approver identity, role assignment, required role, or role observation;
- nonce usage or expiry;
- current mock backend pre-state.

A new passing sandbox run does not revive a grant. A new grant is required. Invalidation is append-only and visible in the ledger.

Technical verification is invalid for closure after a case-version change, action-state change, failed current read-back, or acceptance of a new relevant event. Employee confirmation is invalid if its event/actor differs from the case employee, its technical record is stale or failing, or its action-state digest differs.

## Action Execution And Reconciliation

The action gateway performs one serializable transaction to:

1. lock the case, approval, active proposal, and idempotency reservation;
2. compare every current value to the grant;
3. confirm the grant is approved, unexpired, unused, and held by a current `NETWORK_OWNER`;
4. confirm sandbox status and current backend pre-state;
5. mark the grant consumed, reserve `(tenantId, idempotencyKey)`, and append `ActionAttempt(PENDING)`;
6. commit before calling the mock adapter.

The adapter applies the normalized operation under the same idempotency key. Success appends a receipt and advances to technical verification. A known failure appends a failed attempt with no receipt. A timeout or transport loss after dispatch appends `TIMED_OUT_UNKNOWN` and enters reconciliation.

Reconciliation queries the backend by idempotency key and expected action-state digest. If committed, it appends the receipt or reconciled result and never replays the write. If definitely absent, policy may authorize a retry represented by a new attempt ordinal that references the prior attempt and retains the original idempotency key. If ambiguous, no retry or success message is permitted.

## CMDB Drift State Machine And Mechanism

```text
 immutable PROPOSED
         |
         v
 operation-bound reconciliation against exact CMDB snapshot
     | PASS                         | CONFLICT
     v                              v
 RECONCILED                      CONFLICT -> owner review / REJECTED
     |
 exact CMDB_OWNER grant
     v
 APPROVED --snapshot changed--> SUPERSEDED, reconcile again
     |
 idempotent mock apply
     v
 APPLIED --independent read-back passes--> VERIFIED
     |                                      |
     +---- fresh rollback reconciliation ---+
                       |
              exact ROLLBACK grant
                       v
               ROLLBACK_APPROVED
                       |
                inverse applied
                       v
                  ROLLED_BACK
                       |
             independent read-back
                       v
              ROLLBACK_VERIFIED
```

The mechanism is deliberately proposal-first:

1. Verified incident evidence identifies a candidate relation mismatch, such as `ExpenseHub depends_on 10.20.4.17` versus verified `10.20.8.42` linked to `CHG-481`.
2. ResolveMesh creates the immutable proposal with before, after, inverse, provenance, validity, verification links, component digests, and proposal digest.
3. A separate operation-bound reconciliation run reads one named CMDB snapshot and evaluates CI identity, relation key, source precedence, duplicates, protected attributes, concurrent version, and conflicting endpoint claims.
4. `CONFLICT` cannot apply. `PASS` only makes the exact proposal/snapshot pair eligible for owner review.
5. A separate `CMDB_OWNER` grant binds operation, proposal, reconciliation, snapshot, inverse, nonce, role, and expiry. Rollback also binds the original apply receipt.
6. Any CMDB snapshot version/digest change, proposal/reconciliation change, role loss, nonce use, or expiry invalidates the grant.
7. Apply writes one versioned mock relation under an idempotency key and appends `CMDBApplyReceipt`.
8. A distinct read adapter appends `CMDBVerificationRecord`; the apply response is insufficient.
9. Rollback requires a fresh reconciliation against current state and a fresh `operation=ROLLBACK` owner grant. It appends `CMDBRollbackReceipt` and then another independent verification.
10. Each step appends a lifecycle event. Only the projection is mutable.

Incident action approval conveys no CMDB authority. Reconciliation is not approval. Confidence is not source authority. No source, scanner, service map, change, or incident observation silently becomes authoritative truth.

## Regression Lifecycle

Regression generation is allowed only after a passing current-version technical verification and a bound passing employee confirmation for the same action-state digest. The compiler reads immutable source records and emits a normalized content-addressed artifact containing:

- source case version, proposal, action receipt, technical-verification links, and the required employee-confirmation ID/digest;
- normalized action parameters and evidence snapshot digest;
- fixture, policy, prompt, schema, tool, and check-set versions;
- deterministic preconditions;
- ordered executable checks and implementation versions;
- prohibited effects.

The runner rejects an artifact-digest or fixture-checksum mismatch before execution. It creates a separate immutable `RegressionRun` for every attempt. A run cannot alter the artifact or incident, and model output cannot determine an assertion result. Raw employee text and raw endpoint payload are excluded.

## API Contracts And Concurrency

All command endpoints authenticate server-side, derive tenant and roles from the session, validate JSON schemas, and append records transactionally. `expectedCaseVersion` protects the authorization/verification context; `expectedProjectionRevision` protects command write concurrency. Endpoints that update a case projection require both unless the table states otherwise. A stale expected value returns `409 Conflict` with current values and no mutation. An idempotency-key reuse with a different request digest also returns `409`. Authorization failures return `403`; missing records return `404`; schema failures return `422`.

| Method and path | Required concurrency/idempotency contract | Result |
|---|---|---|
| `POST /api/events/portal` | `externalEventId`; unique by tenant/channel/external ID; no client case version | Idempotently creates or returns initial event and server-assigned case |
| `POST /api/events/simulated-teams` | `caseId`, `externalEventId`, `expectedCaseVersion`, `expectedProjectionRevision`; forced `simulation=true` | Appends one existing-case event and increments context version/revision once |
| `POST /api/cases/{caseId}/capsules/consent` | expected case version/revision, `deviceId`, exact `manifestDigest`, client command ID | Appends decision; grant may create exactly one matching simulated capsule |
| `POST /api/cases/{caseId}/diagnose` | expected case version/revision, diagnosis run ID | Runs/resumes bounded live-Qwen supervisor; duplicate run ID returns prior result |
| `GET /api/cases/{caseId}` | Optional `If-None-Match` projection version | Returns role-filtered materialized case |
| `GET /api/cases/{caseId}/evidence-board` | Read-only; tenant/case authorization | Returns observations, validity, contradictions, hypotheses, and snapshots |
| `GET /api/cases/{caseId}/ledger` | Cursor and role-based redaction | Returns ordered immutable records and simulation labels |
| `POST /api/cases/{caseId}/sandbox-runs` | expected case version/revision, proposal ID/digest, fixture checksum, check-set digest, run ID | Appends one immutable run; stale or changed inputs fail |
| `POST /api/proposals/{proposalId}/approval-requests` | expected case version/revision, proposal and sandbox digests, client command ID | Creates exact pending `NETWORK_OWNER` grant |
| `POST /api/approvals/{approvalId}/decisions` | expected case version/revision, approval digest, decision command ID | Records authenticated approve/reject decision once |
| `POST /api/proposals/{proposalId}/execute` | expected case version/revision, approval ID/digest, proposal digest, `idempotencyKey` | Atomically validates/consumes grant and creates or returns action attempt |
| `POST /api/actions/{attemptId}/reconcile` | expected case version/revision, original `idempotencyKey`, expected request digest | Reads back unknown outcome; no new effect |
| `POST /api/cases/{caseId}/verify-technical` | expected case version/revision, action receipt ID/digest, expected action-state digest, verification run ID | Appends independent initial or current-version technical record |
| `POST /api/cases/{caseId}/employee-confirmations` | expected case version/revision, confirmation event ID/digest, technical verification ID/digest, command ID | Appends a bound employee record; it does not ingest or increment the already-recorded event |
| `POST /api/cases/{caseId}/cmdb-drift-proposals` | expected case version/revision, source verification digests, client command ID | Creates immutable proposal before reconciliation |
| `POST /api/cmdb-drift/{id}/reconciliation-runs` | operation, expected CMDB version/digest, proposal digest, run ID | Appends operation-bound reconciliation against exact snapshot |
| `POST /api/cmdb-drift/{id}/approval-requests` | expected CMDB version/digest, reconciliation/proposal/inverse digests, operation, command ID | Creates exact pending `CMDB_OWNER` grant |
| `POST /api/cmdb-approvals/{id}/decisions` | expected CMDB version/digest, approval digest, decision command ID | Records authenticated CMDB owner decision once |
| `POST /api/cmdb-drift/{id}/apply` | expected CMDB version/digest, exact APPLY grant/digest, `idempotencyKey` | Applies once and appends apply receipt/lifecycle event |
| `POST /api/cmdb-drift/{id}/read-back` | expected CMDB version, operation, exact apply/rollback receipt ID/digest, run ID | Appends independent CMDB verification |
| `POST /api/cmdb-drift/{id}/rollback` | current CMDB version/digest, exact ROLLBACK grant/digest, apply receipt/digest, inverse digest, `idempotencyKey` | Applies inverse once and appends rollback receipt |
| `POST /api/cases/{caseId}/regression-artifacts` | expected case version/revision, source action/verification digests, compiler version, command ID | Creates or returns immutable artifact by content digest |
| `POST /api/regressions/{artifactId}/runs` | artifact ID/digest, fixture version/checksum, run ID | Appends separate deterministic run |
| `POST /api/cases/{caseId}/stop` | expected case version/revision, command ID | Blocks new steps, reconciles in-flight attempt, and escalates with `MANUAL_STOP` |
| `POST /api/demo/reset` | demo mode, fixture version, expected fixture checksum, reset ID | Replaces demo state only and returns resulting checksum |
| `POST /api/evals/run` | client `evalRunId`, explicit mode, artifact manifest digest | Runs labeled recorded contracts or required live integration path without mode fallback |
| `GET /health` | No authentication secret in response | App/store/Qwen readiness and optional MuleRun status |

### Endpoint-Specific Notes

- Portal intake cannot trust a client-provided `caseId`, `caseVersion`, actor role, contact ordinal, tenant, or simulation flag.
- Existing-channel events require external-event deduplication plus expected context version and projection revision. Deduplication wins when an exact retry arrives after success.
- Case commands use both expected counters even when the referenced artifact is immutable. Context version prevents stale authorization or closure; projection revision prevents concurrent commands from overwriting state.
- Action and CMDB mutations require both optimistic version checks and backend idempotency. One does not replace the other.
- CMDB endpoints use CMDB snapshot version/digest rather than incident case version, except proposal creation, which reads the incident.
- Approval decisions bind the current authenticated role assignment. Role names in request bodies are ignored.
- Read endpoints apply field-level redaction and do not expose model credentials, tokens, raw provider prompts, hidden reasoning, or unnecessary employee text.
- Demo reset and role simulation are unavailable outside explicit demo mode.

## Persistence And Transactions

Use a relational database with these logical groups:

- `ledger_records`: immutable envelope with tenant, record type, record ID, schema version, digest, sequence, timestamp, and canonical payload;
- `incident_cases`: rebuildable projection with integer version;
- `cmdb_lifecycle_projections`: rebuildable projection with integer version;
- `external_event_keys`: unique tenant/channel/external-event index;
- `command_keys`: unique tenant/command ID plus request digest;
- `action_idempotency`: unique tenant/idempotency key plus request digest and resulting attempt;
- `cmdb_idempotency`: unique tenant/operation/idempotency key plus request digest and receipt;
- `mock_backend_state`: versioned fictional system state;
- `outbox`: durable adapter dispatch and trace events where asynchronous delivery is used.

Use serializable transactions or explicit row locks for grant consumption and backend-effect reservation. If dispatch occurs after commit, use an outbox worker and preserve the same idempotency key. Never keep a database transaction open across a Qwen or external adapter call.

## Security And Privacy Architecture

### Security Controls

- Authenticate every non-public endpoint; derive tenant, employee, operator, and role context server-side.
- Authorize every object reference against tenant and case before loading payload details.
- Keep Alibaba and optional MuleRun credentials in server-side secret storage and scrub headers from logs and traces.
- Permit outbound network access only to configured Qwen and optional MuleRun hosts. Mock adapters cannot make outbound mutations.
- Treat all external text and adapter fields as data. Delimit and label them in prompts and never concatenate them into system instructions or tool definitions.
- Validate model output and tool arguments with closed schemas, enums, size limits, and referential integrity.
- Apply read-call budgets, planning-round limits, request timeouts, body limits, rate limits, and manual stop.
- Recheck roles and exact state immediately before mutation; use short expiry, nonces, one-time grants, expected versions, and idempotency keys.
- Separate action, verification, and CMDB adapters so a successful write response cannot masquerade as independent proof.
- Redact and minimize data before provider calls. Persist structured traces instead of chain-of-thought.
- Audit consent, tool calls, approval decisions, invalidations, dispatch, receipts, reconciliation, verification, reset, and export access.
- Disable demo reset, seeded roles, and simulated identity in any production profile.

### Privacy Controls

- P0 fixtures contain fictional people, devices, addresses, incidents, and enterprise systems only.
- The consent surface presents the exact capsule field/purpose manifest before decision.
- Refusal is accessible, immutable, and produces no capsule or endpoint action.
- Capsule data is restricted to the manifest, bound to a case/device/expiry, and labeled simulated.
- Employee text is excluded from action receipts, CMDB records, and regression artifacts unless a minimized reference is strictly required.
- Trace views redact personal fields, credentials, tokens, headers, and internal errors.
- Demo reset deletes transient demo state according to a documented prototype retention policy; immutable means logical behavior within a run, not indefinite retention.
- Production retention, deletion, legal basis, residency, and provider-training settings remain unresolved deployment requirements, not P0 claims.

## Threat Model

| Threat | Boundary at risk | P0 mitigation | Residual/production work |
|---|---|---|---|
| Prompt injection in ticket, CMDB, telemetry, change, or tool output | Supervisor/tool use | Untrusted-data delimiters, fixed system policy, closed tool registry, schema validation, no model authority | Provider-specific adversarial testing and monitoring |
| Cross-tenant or insecure direct object access | API/store | Server-derived tenant, scoped queries, object authorization, opaque IDs | Production IAM review and penetration test |
| Model requests shell, write tool, secret, or self-approval | Orchestrator | Exactly five reads, unknown tool rejection, no credentials in prompt, deterministic authority | Continuous policy regression tests |
| Stale or replayed approval | Action/CMDB gateways | Exact digests, expected versions, nonce, expiry, role recheck, one-time consumption | Strong authentication and production role governance |
| Confused deputy action | Action gateway | Target and tenant binding, normalized parameters, allowlisted action type, backend pre-state check | Connector-specific delegated authorization |
| Duplicate write after timeout | Adapter boundary | Idempotency reservation, durable attempt, reconcile-before-retry, at-most-one backend key | Connector support for idempotent operations or compensating design |
| Forged action success | Verification | Receipt separated from independent read-only checks | Independent credentials/data paths in production |
| False closure from stale verification | Case state | Case-version and action-state binding; new event requires revalidation | Define production event relevance and observation windows |
| Silent CMDB corruption | CMDB workflow | Immutable proposal, reconciliation, separate owner grant, snapshot compare, read-back, rollback | Vendor IRE/reconciliation semantics and source-owner policy |
| Ledger tampering | Store | Canonical digests, append-only application permissions, rebuildable projections | Signed records, WORM storage, key management, external audit anchoring |
| Data exfiltration to model/provider | Qwen adapter | Fictional P0 data, minimization, redaction, host allowlist, trace scrubbing | Contractual retention, residency, DLP, provider account controls |
| Denial of service or runaway agent loop | Runtime | Rate limits, ten reads, two rounds, timeout, stop, no recursive agents | Capacity controls, circuit breakers, queue isolation |
| Malicious or compromised browser | API | No browser-held provider secret or authority; server validation; CSRF/session controls | Production device/session risk controls |
| Unsafe reset or role simulation | Demo controls | Explicit demo profile and disabled production routes | Environment isolation and deployment policy |
| Regression artifact injection | Runner | Content digest, closed assertion registry, fixture checksum, no generated arbitrary code | Sandboxed runner and signed artifact promotion |

P0 does not claim cryptographic non-repudiation, production zero trust, regulatory compliance, security certification, or safe remote endpoint execution.

## Future Action-Bound Endpoint Capsule: P1

A real endpoint capsule must not be implemented as a partial P0 extension. Before any production endpoint read or write, P1 requires all of these controls:

- an employee-visible canonical action manifest listing every data read, write, process, network destination, duration, required privilege, expected postcondition, and rollback;
- exact consent over the manifest digest, accessible refusal, and no scope expansion after consent;
- a tenant-, user-, device-, case-, proposal-, and action-bound token with short expiry and replay protection;
- device identity and posture checks plus server-side and local authorization independent of the model;
- least privilege obtained only for the exact operation and removed immediately afterward;
- allowlisted binaries and effect constraints for files, registry/settings, processes, services, network targets, CPU, memory, disk, time, and output size;
- captured pre-state sufficient to detect races and reverse the bounded operation;
- atomic or explicitly staged execution with a clear partial-failure model;
- independently evaluated postconditions, not script exit status alone;
- a tested inverse operation or an explicit declaration of non-reversibility that raises approval requirements;
- a local watcher that terminates on scope, resource, duration, connectivity, integrity, or policy violation;
- server and local revoke/kill controls that do not require model cooperation;
- signed client and update verification, secure storage, hardware-backed identity where appropriate, anti-downgrade, and rollback protection;
- authenticated encrypted transport, destination allowlisting, egress minimization, audit events, and privacy-preserving collection;
- recovery behavior for client crash, server failure, network partition, power loss, stale approval, and rollback failure;
- threat tests for malicious tickets, compromised orchestration, confused deputy use, local privilege escalation, TOCTOU races, token theft, replay, data exfiltration, persistence, and supply-chain compromise.

Until all controls are implemented and independently tested, the product must say `simulated consented diagnostic capsule`, not `zero-trust tunnel`, real endpoint remediation, or production-safe action.

## Production Boundaries

The P0 architecture demonstrates contracts and governance semantics. Production adoption additionally requires:

- enterprise SSO, MFA, service identities, role lifecycle, separation of duties, and privileged-access review;
- production-grade secret management, key rotation, encryption, backup, restore, disaster recovery, and audit retention;
- connector-specific authentication, authorization, quotas, pagination, rate limiting, webhooks, failure semantics, and idempotency behavior;
- an explicit source-authority model for each CMDB class/relation and tested vendor reconciliation behavior;
- data classification, residency, retention, deletion, legal basis, employee notice, provider terms, and regional Qwen configuration;
- high availability, capacity planning, queue isolation, observability, alerting, incident response, and operational runbooks;
- schema migration, digest migration, model/prompt change control, canarying, rollback, and evaluation governance;
- production sandbox isolation and safe test data rather than a shared fixture process;
- independent security review, threat modeling, abuse testing, and connector penetration testing;
- validated event-relevance rules, freshness thresholds, verification windows, SLA policies, and human escalation ownership;
- measured model quality and operational safety on representative, consented enterprise data before broader autonomy.

No P0 interface should imply that these controls already exist. Production connectors replace adapters but do not weaken domain records, approval bindings, independent verification, or lifecycle separation.

## Unresolved Assumptions

1. The exact Alibaba-hosted Qwen endpoint, supported model ID, region, quota, latency, structured-output/tool-call behavior, and retention configuration must be verified through a real call.
2. Event eligibility may require a particular Qwen ecosystem surface beyond direct Alibaba-hosted Qwen use; organizer clarification is required.
3. MuleRun access, APIs, tracing semantics, data handling, and value are unverified. It remains optional.
4. Production enterprises may define evidence freshness and independent source classes differently; P0 policy values are fixture-specific.
5. Real target systems may not support native idempotency or read-back by key. Each connector needs a proven at-most-once or compensation strategy.
6. Real CMDB products differ in identification, reconciliation, source precedence, versioning, and rollback. P0 semantics do not claim vendor compatibility.
7. The definition of a relevant event that invalidates closure must be configured and audited in production; P0 conservatively treats accepted support events as relevant.
8. A confirmation event that both reports restoration and requests a human is accepted as employee confirmation only after same-version technical revalidation and actor validation.
9. Production employee identity, device ownership, consent capacity, accessibility, and delegated support flows are not specified.
10. Canonical JSON and digest rules need executable cross-language test vectors before multiple services or clients produce records.
11. P0 append-only controls are application/database semantics, not tamper-proof storage or cryptographic attestation.
12. Provider outage behavior is fail-closed human escalation; no approved alternative live model provider is currently defined.

## Architectural Acceptance

The architecture is conformant only when:

- a live path records an actual Alibaba-hosted Qwen trace and exposes only five read skills;
- no model output or model confidence is used as an authorization or deterministic test oracle;
- every material immutable record has a schema version and reproducible digest;
- event deduplication, expected-version conflicts, approval invalidation, and idempotency are enforced transactionally;
- a passing sandbox and exact `NETWORK_OWNER` grant precede the one mock incident action;
- timeout reconciliation proves no duplicate backend effect;
- independent current-version technical verification and bound employee confirmation are both necessary for `RESOLVED`;
- immutable CMDB proposal, reconciliation, `CMDB_OWNER` grant, apply, independent verify, and rollback records remain separate from incident closure;
- an immutable executable regression artifact and separate run/model trace/case projection are preserved as distinct records;
- all mock and simulation boundaries are persistent in data and visible in the UI;
- no excluded production capability is implied by the P0 deployment.
