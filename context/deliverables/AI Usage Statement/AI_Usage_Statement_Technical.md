# AI USAGE STATEMENT

**Team Groknetic** | **Intra-University AI Build-athon** | **IMSSA** | **Technical Detail**

---

## 1. Tools and Scope

Qoder was used as the primary development environment for all four services in the system: Intake Service, Routing Agent, Resolution Agent, and CMDB Sync Service, plus the evaluation dashboard. MuleRun was used as the orchestration runtime executing the Routing Agent, Resolution Agent, and CMDB Sync Service workflows in production. Model inference for all three agents runs against Qwen3-Max through Alibaba Cloud Model Studio's DashScope endpoint.

---

## 2. Qoder Usage by Component

### 2.1 Intake Service
- Qoder generated the initial REST endpoint scaffold and JSON schema validation logic for the incoming ticket payload (fields: `ticket_id`, `subject`, `description`, `reported_ci`, `timestamp`).
- Qoder was used to iterate on input sanitization and error handling for malformed ticket submissions, verified against a set of intentionally malformed test payloads written by the team.

### 2.2 Routing Agent
- Qoder was used to draft the DashScope API integration, including request construction against a fixed JSON output contract (`predicted_queue`, `confidence`, `ruled_out reasons`, `rationale`) and response parsing for that structured output.
- Qoder assisted in drafting the initial system prompt enforcing the five-queue taxonomy; the team then iterated the prompt manually against the ambiguous-case subset of the synthetic dataset, since prompt correctness on ambiguous cases was verified by team review, not generated.
- Qoder generated the confidence-threshold routing logic that decides between automated routing and escalation to a human triage queue, which the team then parameterized and calibrated using a held-out validation split of the synthetic ticket dataset.

### 2.3 Resolution Agent
- Qoder was used to implement the per-queue policy configuration structure, allowing T_a and the safe-pattern list to be set independently for each of the five queues.
- Qoder generated the escalation payload structure sent to queue owners, which the team reviewed for completeness against real ITSM escalation conventions.

### 2.4 CMDB Sync Service
- Qoder was used to implement the structured extraction call against Qwen3-Max for pulling configuration item signals from ticket text, and the human-approval merge workflow for proposed CMDB deltas.
- Qoder assisted in writing the CMDB schema migration scripts for the minimal viable schema (fields: `ci_id`, `ci_type`, `owning_queue`, `relationships`, `last_verified`).

### 2.5 Dashboard
- Qoder generated the dashboard views for the evaluation metrics tracked during testing (routing accuracy, ambiguous-case accuracy, escalation precision, auto-resolve safety, CMDB delta acceptance rate), including the per-queue breakdown views used in the live demo.

---

## 3. Division Between Team-Directed Design and Tool-Assisted Implementation

| Decision | Origin |
| :--- | :--- |
| Five-queue taxonomy and its treatment as a fixed constraint | Team, based on direct ITSM operational exposure |
| Separation of routing and resolution into two independent agents | Team, informed by published two-tier ITSM classification research |
| Per-queue differentiated auto-resolve risk policy | Team, based on real blast-radius differences across queues |
| Structured JSON output contract and ruled_out reasoning field | Team specification, implemented with Qoder |
| Confidence threshold calibration method | Team specification, implemented with Qoder |
| API integration code, schema scaffolding, dashboard UI | Generated primarily with Qoder, reviewed by team |

The problem framing, the taxonomy, the risk-differentiated escalation policy, and the choice to separate routing from resolution are team decisions grounded in ITSM domain experience. Qoder's role was accelerating implementation of that design and handling boilerplate integration work, not originating the architecture.

---

## 4. Verification

- All Qoder-generated code was reviewed by at least one team member before merge, and tested against a synthetic ticket dataset of 150 to 200 tickets covering all five queues, weighted toward genuinely ambiguous cases.
- Model outputs from the Routing Agent and Resolution Agent were spot-checked against the evaluation metrics above before any confidence threshold was finalized.
- No ticket data used in development, testing, or the live demo originates from any employer's proprietary systems. All ticket content is synthetic, constructed to reflect general, publicly documented ITSM patterns.
