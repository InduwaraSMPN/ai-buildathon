# PROJECT BRIEF

### AI-Driven ITSM Triage and CMDB Synchronization Agent
**Team Groknetic** | **Intra-University AI Build-athon** | **IMSSA** | **Technical Specification**

---

## 1. Background and Context

Large enterprises operate IT support as five specialist queues: Application Support, End-User Experience (EUX), Server Support, Network Support, and Cloud Support. Each queue holds different escalation paths, different runbooks, and different acceptable-risk thresholds for automation. This structure is grounded in direct exposure to enterprise ITSM operations, including SAP-BASIS and Run-Apps style support environments, where two operational failures recur regardless of tooling: tickets that cannot be classified from surface text alone, and a Configuration Management Database (CMDB) that no longer reflects the live infrastructure it is meant to describe.

---

## 2. Problem Statement

The problem decomposes into three measurable failure modes, each with a distinct root cause and a distinct engineering requirement.

### 2.1 Routing ambiguity
Industry data places first-assignment misrouting at 23 to 30 percent of enterprise tickets, with manual classification accuracy plateauing at 60 to 70 percent. Category structure is a direct driver of this: routing accuracy falls to roughly 78 percent once a taxonomy exceeds 20 overlapping categories, versus roughly 92 percent for a well-defined 8 to 15 category structure. This is why the five-queue structure is treated as a fixed design constraint in this project rather than something to collapse or expand arbitrarily.

### 2.2 Non-uniform resolution risk
Auto-resolution safety is not uniform across queues. An EUX password reset has near-zero blast radius. A Server or Network configuration change can have organization-wide blast radius. A single confidence threshold applied uniformly across all five queues is therefore a design defect, not a simplification, because it either under-automates low-risk queues or over-automates high-risk ones.

### 2.3 CMDB decay
Gartner-cited industry reporting attributes 75 percent of CMDB failures to inaccurate or stale data, with organizations spending up to 60 hours per week manually reconciling records across sources. Because routing and resolution decisions in this system query the CMDB directly, decay in the CMDB propagates as silent, undetected error in every downstream decision, regardless of how accurate the classification model is in isolation.

---

## 3. System Architecture

The system is composed of four services communicating through a message bus, plus a persistent state store. Architecture is designed for the MuleRun orchestration runtime, calling Alibaba Cloud Model Studio (DashScope) endpoints for inference, with Qoder as the development environment for all service code.

### 3.1 Component overview

| Component | Responsibility | Implementation |
| :--- | :--- | :--- |
| **Intake Service** | Accepts ticket payload, normalizes fields, assigns `ticket_id` | REST endpoint built in Qoder, JSON schema validated |
| **Routing Agent** | 5-way queue classification with confidence and rationale | MuleRun workflow, Qwen3-Max via DashScope API |
| **Resolution Agent** | Per-queue auto-resolve or escalate decision | MuleRun workflow, Qwen3-Max, queue-specific policy config |
| **CMDB Sync Service** | Extracts CI signals from ticket text, proposes CMDB deltas | MuleRun workflow, Qwen3-Max structured extraction |
| **State Store** | Ticket records, CI records, decision logs, audit trail | Relational schema, append-only decision log |

### 3.2 Data flow

```text
Ticket In -> Intake Service -> Routing Agent -> [confidence >= T_r?]
  yes -> Resolution Agent (queue-specific policy)
  no  -> Human Triage Queue (top-3 candidates + rationale shown)

Resolution Agent -> [risk_class == LOW and confidence >= T_a?]
  yes -> Draft auto-resolution, log decision, notify requester
  no  -> Escalate to queue owner with structured context

Every ticket (regardless of path) -> CMDB Sync Service -> proposed CI delta -> human-approved merge
```

### 3.3 Why routing and resolution are separated

Coupling routing and resolution into a single classification pass was rejected. A ticket can be routed with high confidence to a queue while still being unsafe to auto-resolve within that queue, and the reverse also holds. Separating the two stages allows each to be evaluated, tuned, and audited independently, which is also consistent with the two-tier classification pattern shown to outperform flat single-stage classification in prior ITSM research (Section 6).

---

## 4. Model Selection and Prompting Strategy

### 4.1 Model

Qwen3-Max is used as the primary reasoning model for all three agent stages, accessed through Alibaba Cloud Model Studio's OpenAI-compatible DashScope endpoint. Qwen3-Max was selected over a smaller Qwen3 variant because routing and resolution both require multi-step reasoning over ambiguous, partially-specified text, which benefits from the model's larger reasoning capacity; latency budget for this use case (ticket triage, not real-time chat) tolerates the larger model's response time.

### 4.2 Structured output contract

All three agents are constrained to return a fixed JSON schema rather than free text, so downstream services can consume output deterministically.

```json
{
  "ticket_id": "string",
  "predicted_queue": "app_support | eux | server | network | cloud",
  "confidence": 0.0,
  "ruled_out": [{"queue": "string", "reason": "string"}],
  "rationale": "string"
}
```

### 4.3 Prompting approach

* **System prompt** fixes the five-queue taxonomy and instructs the model to explicitly rule competing queues in or out before committing to a final label, rather than emitting a single label directly.
* **Few-shot examples** are drawn from the synthetic ticket dataset (Section 5), weighted toward the ambiguous cases the taxonomy is most likely to fail on, based on the category-overlap findings in Section 6.
* **Temperature** is fixed low (0.1 to 0.2) for the routing and resolution agents to favor determinism over creative variance, since these are classification and policy decisions, not generative writing tasks.

---

## 5. Data Design

### 5.1 Ticket schema

| Field | Type | Notes |
| :--- | :--- | :--- |
| `ticket_id` | string | Generated at intake |
| `subject` | string | Free text |
| `description` | string | Free text, primary classification signal |
| `reported_ci` | string, nullable | Configuration item referenced by user, if any |
| `timestamp` | datetime | ISO 8601 |
| `predicted_queue` | enum | Set by Routing Agent |
| `routing_confidence` | float 0 to 1 | Set by Routing Agent |
| `resolution_path` | enum: auto \| escalate | Set by Resolution Agent |
| `cmdb_delta_proposed` | object, nullable | Set by CMDB Sync Service |

### 5.2 Synthetic dataset

A dataset of 150 to 200 synthetic tickets is constructed to cover all five queues, weighted deliberately toward genuinely ambiguous cases (for example, shared-drive access failures that could plausibly be Network, Server, or App Support in origin), because published research shows classification accuracy degrades specifically on low-frequency and ambiguous categories, not on the clean majority cases. No data used in this dataset is drawn from any employer's proprietary systems; category structure and symptom patterns reflect general, publicly documented ITSM practice.

### 5.3 CMDB schema (minimal viable)

| Field | Type | Notes |
| :--- | :--- | :--- |
| `ci_id` | string | Configuration item identifier |
| `ci_type` | enum | server, app, network_device, cloud_resource, endpoint |
| `owning_queue` | enum | One of the five support queues |
| `relationships` | array | Dependency edges to other `ci_id` values |
| `last_verified` | datetime | Last confirmed accurate, human or automated |

---

## 6. Alignment with Prior Research

Design decisions in this brief are each traceable to a specific finding in published ITSM and CMDB research, rather than to intuition alone.

* **Almarzooqi (2025)**, reviewed in *arXiv:2507.19846*, proposes hybrid rule-based and machine learning systems for IT ticket prioritization and routing using TF-IDF vectorization and real-time feedback loops, motivating this project's confidence-threshold fallback to human triage rather than forced classification.
* **A Rochester Institute of Technology thesis** on automated prioritization and routing of IT support tickets evaluates SVM, Random Forest, and ensemble models against a Kaggle IT ticket dataset, and reports that hybrid combinations specifically improve classification of low-frequency and ambiguous categories, which directly motivates the ambiguity-weighted synthetic dataset in Section 5.2.
* **A two-tier classification study on 7,278 helpdesk tickets from Universiti Teknologi Malaysia** found SVM achieved 89.7 percent routing accuracy against 82.4 percent for Naive Bayes, and showed a first-tier department split followed by second-tier subcategory classification improves accuracy, which is the direct precedent for separating the Routing Agent from the Resolution Agent in Section 3.3.
* **Pereira et al. (2023)** trained and evaluated ticket classification models on 1.6 million real support tickets across 32 categories, and found feature quality was the primary driver of accuracy, more than model architecture choice, which motivates this project's emphasis on ticket schema design (Section 5.1) over model selection alone.
* **Kubiak and Rass (2018)** examined hierarchical multi-label classification for capturing parent-child relationships between ticket categories, supporting the `ruled_out` reasoning field in the structured output contract (Section 4.2), which requires the model to reason about competing categories rather than emit a flat label.
* **Peer-reviewed research on AI integration with CMDB systems** (*International Journal of Management, IT and Engineering, 2024*) documents automated discovery and proactive reconciliation as the primary levers against CMDB decay, which the CMDB Sync Service in Section 3.1 implements as a continuous, ticket-driven process rather than a periodic manual audit.
* **Industry reporting citing Gartner** places CMDB failure attribution at 75 percent due to inaccurate data, and reports up to 60 hours per week spent on manual reconciliation, which is the quantified baseline this project's CMDB Sync Service is designed to reduce.

---

## 7. Evaluation Plan

### 7.1 Metrics

| Metric | Definition | Target for demo |
| :--- | :--- | :--- |
| **Routing accuracy** | Correct queue / total tickets, against labeled synthetic set | $\ge 85\%$ |
| **Ambiguous-case accuracy** | Routing accuracy restricted to the ambiguous subset | $\ge 70\%$ |
| **Escalation precision** | Of tickets escalated, % that a human reviewer agrees required escalation | $\ge 90\%$ |
| **Auto-resolve safety** | Of auto-resolved tickets, % with no reviewer-flagged risk | 100% (zero tolerance) |
| **CMDB delta acceptance rate** | % of proposed CI updates a human accepts unmodified | $\ge 60\%$ |

### 7.2 Confidence threshold calibration

$T_r$ (routing confidence threshold) and $T_a$ (auto-resolve confidence threshold) are not fixed constants. They are calibrated against the labeled synthetic dataset using a held-out validation split, selecting the threshold that maximizes escalation precision without pushing ambiguous-case accuracy below its target. $T_a$ is set independently per queue rather than globally, reflecting the differentiated risk profile established in Section 2.2: EUX and Application Support use a lower $T_a$ than Server, Network, and Cloud, which are configured to escalate by default regardless of confidence unless the ticket matches a small, explicitly enumerated safe-pattern list.

---

## 8. Expected Impact

* **Reduced reassignment overhead:** correct first-assignment routing against a baseline misrouting rate of 23 to 30 percent, using confidence-gated decisions rather than forced classification.
* **Differentiated automation risk:** team-calibrated auto-resolve thresholds instead of one policy applied uniformly across queues with very different blast radii.
* **CMDB that improves under load:** every processed ticket becomes a source of configuration signal, directly targeting the 75 percent stale-data failure rate cited in Section 6.
* **Auditable decisions:** every routing and escalation decision is logged with its rationale and ruled-out alternatives, addressing the accountability gap in keyword-based systems.

---

## 9. Roadmap

### Week 1
* Finalize five-queue taxonomy, ticket schema, and CMDB schema (Section 5).
* Build Intake Service and synthetic ticket dataset, weighted toward ambiguous cases.
* Implement Routing Agent with structured output contract and confidence scoring.
* Establish baseline routing accuracy against the labeled validation split.

### Week 2
* Implement Resolution Agent with per-queue policy configuration and calibrated thresholds.
* Implement CMDB Sync Service and human-approval merge flow.
* Run full evaluation against Section 7 metrics, build the dashboard, rehearse the live demo.

---

## 10. AI Usage Summary

Qoder was used as the primary development environment for all service code across the Intake Service, Routing Agent, Resolution Agent, and CMDB Sync Service, including schema definition, API integration with the DashScope endpoint, and dashboard construction. Full detail is provided in the accompanying AI Usage Statement document.
