# Tier 2 — The missing ITIL practices

**Document role:** Adoption plan for the record types Axiōma has no model for
**Parent:** [oss-adoption.md](../oss-adoption.md) · **Requires:** [tier-0.md](tier-0.md), [tier-1.md](tier-1.md) · **Next:** [tier-3.md](tier-3.md)

Four whole record types and one taxonomy: Problem, Change, Knowledge, the request catalogue with
approvals, and the service catalogue that everything else hangs off. This is where Axiōma stops being a
ticket system with an agent and becomes a service management system.

---

> ### Where the current truth lives
>
> **The current-state section below is a snapshot taken before this tier was built.** It is kept as
> written because the milestones, decisions and definition of done are argued from it. It no longer
> describes the tree.
>
> The 2026-08-29 close-out audit found **4 of 7 milestones complete**. Forms, catalogue-backed ticket
> classification, change transitions and the principal human surfaces are wired; three milestones remain
> partial against their full tier definitions.
>
> Section 7 remains the definition of done; [../execution/chat-c-tier2.md](../execution/chat-c-tier2.md)
> is retained as execution history.

## Lexical knowledge-search decision

Tier 2 deliberately ships lexical PostgreSQL full-text search. The `embedding` column remains reserved for a future provider-backed migration; no embedding provider or vector index is introduced until its operational and privacy requirements are defined. The API reports `mode: lexical` so callers can distinguish this behavior.

## 1. Current state

### What exists

The MVP delivers **Incident Management** and, nominally, **Service Request Management** — `tickets`
carries `record_type` as `incident | service_request` and the value flows through the contract, the
queue facets and `ticketStats`. What it does not have is anything that makes a service request behave
differently from an incident: no catalogue, no approval, no fulfilment workflow. The discriminator
exists and nothing keys off it.

`idea.md` puts Problem Management and Change Enablement out of scope for the MVP, and
[api.md](../../completed/api.md) states plainly that `cluster_patch_image` is a change in ITIL terms while
Axiōma governs no changes. Both statements were correct for the MVP and are what this tier answers.

Related surfaces that already exist and get reused rather than rebuilt:

- **`cmdb_items`** — with its four provenance columns (`sourceTicketId`, `sourceRunId`, `sourceStepId`,
  `observedAt`) already populated by `cmdb_record_observation`. Knowledge articles and changes both need
  to point at CIs, and this is what they point at until [tier-3.md](tier-3.md) widens it.
- **`tickets.category` / `subcategory`** — three categories with one subcategory each
  (`infrastructure/deployment`, `device/network`, `access/account`), seeded from the three scenarios.
  Deliberately shallow, and the service catalogue is its grown-up form.
- **The tool registry** — `api/src/server/tools/index.ts` with seven tools, each carrying an input
  schema and an optional `verifiedBy`. Every new capability Axel gains in this tier is a row here.
- **`ticket_transitions`** and the state machine in `api/src/server/tickets.ts`, which the new record
  types reuse rather than duplicate.

### Gap rows this tier owns

| # | Capability | Axiōma today | Source model |
|---|---|---|---|
| 2.1 | Problem Management | Nothing | FreeITSM `problems` (`root_cause`, `workaround`, `is_known_error`, `problem_number`), `problem_tickets`, `problem_notes`, `problem_statuses`, `problem_audit`. iTop `itop-problem-mgmt` |
| 2.2 | Known-error database | Nothing | iTop `itop-knownerror-mgmt` as a separate class; FreeITSM folds it into `problems.is_known_error` |
| 2.3 | Change Enablement with CAB | Nothing | FreeITSM `changes` (`reason_for_change`, `test_plan`, `rollback_plan`, `risk_likelihood`, `risk_impact_score`, `risk_score`, `risk_level`, `cab_required`, `cab_approval_type`) + `change_cab_members` (`vote`, `is_required`, `vote_comment`, `vote_datetime`) + `change_tickets`. iTop `itop-change-mgmt-itil` for the state machine |
| 2.4 | Post-implementation review | Nothing | FreeITSM `changes.pir_was_successful`, `pir_actual_start`, `pir_actual_end`, `pir_lessons_learned`, `pir_follow_up` |
| 2.5 | Service catalogue | `category`/`subcategory`, three values | iTop `ServiceFamily → Service → ServiceSubcategory`, with `service_id` and `servicesubcategory_id` on every ticket. GLPI `ITILCategory` as a self-referencing tree |
| 2.6 | Approval workflow | Nothing | iTop `UserRequest` states `waiting_for_approval` / `approved` / `rejected` with `approver_id`. GLPI `TicketValidation`, `ChangeValidation`, `ChangeValidationStep` |
| 2.7 | Knowledge base | Nothing | FreeITSM `knowledge_articles` (`body`, `embedding`, `audience`, `folder_id`, `version`, `next_review_date`, `is_restricted`) + `knowledge_folders` + `knowledge_acl` + `knowledge_article_versions` + `knowledge_tags` |
| 2.8 | Knowledge linked to tickets, gap detection | Nothing | FreeITSM `knowledge_gap_tickets` / `knowledge_gap_clusters`. GLPI `KnowbaseItem_Item` |
| 2.9 | Request catalogue | One free-text form | FreeITSM `forms` + `form_fields` + `form_submissions`. GLPI `TicketTemplate` with mandatory/hidden/predefined/readonly field families |

---

## 2. Gaps

1. Recurring incidents cannot be grouped, so the same fault is diagnosed from scratch every time.
2. There is no place to record a known workaround, which is the cheapest resolution that exists.
3. Axel patches production with no change record, which [api.md](../../completed/api.md) admits.
4. Nothing captures whether a change worked.
5. Categorisation is three values seeded from three scenarios and cannot describe a real estate.
6. `record_type` distinguishes a service request and nothing behaves differently.
7. No knowledge base — so every resolution is discovered rather than recalled.
8. Axel has no memory across tickets beyond CMDB observations.
9. A request is a free-text box, so fulfilment cannot be structured or approved.

---

## 3. Milestones

### T2.A — Service catalogue

**Files:** new `api/src/db/schema/catalogue.ts`, `api/src/db/schema/tickets.ts`,
`api/src/shared/index.ts`, `api/src/contracts/index.ts`, migration.

`service_families → services → service_subcategories`, following iTop's three-level shape, with
`service_id` and `service_subcategory_id` on `tickets`.

This supersedes `category` / `subcategory`. That pair was the right MVP call — [api.md](../../completed/api.md)
argued for a shallow real tree over an invented deep one — and this is its grown-up form. Migrate the
three existing categories to seed services so no ticket loses its classification, then retire the
columns from the contract in the same publish.

**This is where SLA resolution gets its first input.** [tier-1.md](tier-1.md) T1.C resolves targets from
priority because nothing better exists; with a catalogue, a service carries its own SLA and OLA and the
resolution order becomes service → priority → default.

**Done when:** every ticket carries a service and subcategory drawn from the catalogue; a service with
its own SLA produces a different deadline from the default; and the queue can be faceted by service.

### T2.B — Problem Management

**Files:** new `api/src/db/schema/problems.ts`, `api/src/contracts/index.ts`,
new `dashboard/src/features/problems/`, migration.

`problems` with `problem_number`, `title`, `description`, `status`, `priority`, `assignee_id`,
`root_cause`, `workaround`, `is_known_error`, `service_id`, and `problem_tickets` linking incidents.
Transcribed from FreeITSM, which folds the known-error database into a flag rather than a separate
class — iTop separates them, and the flag is right at this scale because a known error is a problem
whose workaround is published, not a different kind of thing.

Reuse rather than rebuild: the numbering scheme from [tier-1.md](tier-1.md) T1.K (`PRB-` prefix), the
case log from T1.I, and the audit from T1.J. A problem is a record with a lifecycle, and the lifecycle
machinery already exists.

The dashboard gets a problems list and detail, sourced from the same `table` composition the ticket
queue uses in `queue-columns.tsx`.

**Done when:** three incidents can be grouped under one problem; publishing a workaround on the problem
makes it visible on every linked incident; and closing the problem offers its resolution against them.

### T2.C — Known errors reach Axel

**Files:** `api/src/server/tools/index.ts`, new `api/src/server/tools/knowledge.ts`,
`agent/axel/tools.py`, `agent/axel/prompt.py`.

A `knowledge_search` read tool in both registries — `api/src/server/tools/index.ts` and
`agent/axel/tools.py` — returning known errors and, once T2.E lands, articles. `prompt.py` gains the
results as context before the first tool call.

**This is where Axel becomes materially better rather than merely faster.** A known error with a
published workaround is a resolution available on evidence alone, with no reasoning about what to try.
It is also the cheapest accuracy improvement anywhere in this plan: one read tool, and the agent stops
rediscovering what the team already wrote down.

**Done when:** a ticket matching a known error is resolved by Axel citing that error in its transcript,
without exploratory tool calls.

### T2.D — Change Enablement

**Files:** new `api/src/db/schema/changes.ts`, `api/src/contracts/index.ts`,
new `dashboard/src/features/changes/`, `api/src/server/tools/cluster.ts`, migration.

`changes` with the full FreeITSM field set: `reason_for_change`, `test_plan`, `rollback_plan`,
`risk_likelihood`, `risk_impact_score`, `risk_score`, `risk_level`, `cab_required`,
`cab_approval_type`, `work_start_datetime` / `work_end_datetime`, `outage_start_datetime` /
`outage_end_datetime`, plus `change_cab_members` with per-member `vote`, `is_required`, `vote_comment`
and `vote_datetime`. `change_tickets` links the incidents a change addresses. iTop's
`itop-change-mgmt-itil` supplies the state machine, which reuses the table-driven transitions from
[tier-1.md](tier-1.md) T1.A.

**Change types** follow ITIL: `standard` (pre-approved, low risk, repeatable), `normal` (assessed and
approved), `emergency` (expedited). Only `standard` skips the CAB.

**Closing the gap [api.md](../../completed/api.md) names.** `cluster_patch_image` creates a **standard
pre-approved change** with a rollback plan naming the previous image — which the tool already knows,
because it reads the deployment before patching and returns both the dry-run and real results.
Autonomy is preserved: a standard change does not wait for a vote. That is what ITIL actually prescribes
for a low-risk repeatable change, so this converts an admitted gap into the correct answer rather than
bolting an approval gate onto an autonomous agent.

CAB voting requires [tier-0.md](tier-0.md): `change.approve` gates who may vote, and a vote nobody is
authorised to cast is the exact failure §5 of that document describes.

**Done when:** an Axel-applied image patch produces a change record whose rollback plan names the
previous image; a normal change cannot proceed until its required CAB members have voted; and only
holders of `change.approve` can vote.

### T2.E — Post-implementation review

**Files:** `api/src/db/schema/changes.ts`, `dashboard/src/features/changes/`.

FreeITSM's PIR block: `pir_was_successful`, `pir_actual_start`, `pir_actual_end`,
`pir_lessons_learned`, `pir_follow_up`. For an autonomous change the PIR writes itself — Axel already
verifies through the read tool named by `verifiedBy` in the registry, and rollout polling already
produces the observation sequence. The PIR is that evidence, recorded on the change.

**Done when:** every completed change carries a PIR; Axel's changes have theirs filled from the
verification it already performs.

### T2.F — Knowledge base

**Files:** new `api/src/db/schema/knowledge.ts`, `api/src/contracts/index.ts`,
new `dashboard/src/features/knowledge/`, `portal/src/features/knowledge/`, migration.

Transcribe `knowledge_articles`, `knowledge_folders`, `knowledge_article_versions`, `knowledge_tags`
and `knowledge_acl` from FreeITSM. Keep the `embedding` column and the vector search — the agent path
depends on it, and adding it later means backfilling embeddings for every article.

Audience and `is_restricted` are enforced through [tier-0.md](tier-0.md) capabilities, not by the
component choosing not to render. The portal sees published, public articles only, and by query rather
than by filter — the same shape argument as `getMyTicket`.

`knowledge_gap_clusters` and `knowledge_gap_tickets` cluster tickets with no matching article, so the
base grows from what people actually ask rather than from what someone imagined they would. It is a
periodic job over resolved tickets, and it can reuse the sweep pattern from
[tier-1.md](tier-1.md) T1.D.

**Done when:** Axel retrieves a relevant article before its first tool call; the portal can show an
article to a reporter; a restricted article is absent from the portal's network response; and a week of
resolved tickets produces at least one gap cluster.

### T2.G — Request catalogue and approvals

**Files:** new `api/src/db/schema/forms.ts`, new `api/src/db/schema/approvals.ts`,
`api/src/contracts/index.ts`, `portal/src/features/tickets/components/request-form.tsx`,
`portal/src/features/tickets/copy.ts`, migration.

`forms` + `form_fields` + `form_submissions` from FreeITSM, with conditional questions and versioning.
GLPI's `TicketTemplate` family — mandatory, hidden, predefined and readonly fields per template — is the
reference for how a template constrains a form.

`approvals` follows iTop's `UserRequest` states: `waiting_for_approval`, `approved`, `rejected`, with an
`approver_id`. The approver resolves from the requester's `manager_id` ([tier-0.md](tier-0.md) T0.A) or
from the catalogue item. GLPI's `ChangeValidationStep` is the multi-step version and is not needed yet.

The portal's `request-form.tsx` already asks three plain-language questions mapping to record type,
impact and urgency, with every visible string in `copy.ts`. A catalogue item extends that with its own
typed fields. **The rule holds unchanged:** the employee never sees ITSM vocabulary, and no approval
state name reaches them raw — `waiting_for_approval` renders as "Waiting for your manager".

**Done when:** a "new laptop" request renders as a typed form, routes to the requester's manager, cannot
proceed while rejected, and shows the reporter a plain-language status throughout.

---

## 4. Cross-component impact

| Component | Impact |
|---|---|
| `api` | Six new schema modules; the contract roughly doubles — problems, changes, knowledge, forms and approvals each need list/get/create/update. The tool registry gains `knowledge_search` and change-record writes. |
| `agent` | `knowledge_search` in `agent/axel/tools.py`; `prompt.py` gains retrieved articles and known errors. `cluster_patch_image` gains a change-record side effect executed by the API — Axel's schema is unchanged, which is the point of the boundary. |
| `dashboard` | Four new feature folders: problems, changes, knowledge, approvals. Each reuses the `table` composition and `PageContainer` already in place. Ticket detail gains linked problem and change. |
| `portal` | Catalogue-driven request form; knowledge articles; approval status in plain language. |
| `cli` | **None.** |

**Requires:** [tier-0.md](tier-0.md) for CAB voting, approvals and knowledge audience;
[tier-1.md](tier-1.md) for numbering (T1.K), case log (T1.I), linkage (T1.H) and SLA (T1.C).
**Required by:** [tier-3.md](tier-3.md) — the rules engine sets service and category from T2.A, and the
CMDB metamodel links CIs to services.

---

## 5. Decisions taken

**Change records make Axel's patches auditable without gating them.** [api.md](../../completed/api.md) admits the
gap; the ITIL answer is a standard pre-approved change, not an approval gate. A gate would destroy the
one property `idea.md` says the system is for. A record with a rollback plan gives the audit trail
without touching autonomy.

**Known errors are a flag on a problem, not a separate class.** iTop separates them; FreeITSM does not.
A known error is a problem whose workaround has been published — a state, not a different entity. At
this scale the flag is right, and iTop's separation can be adopted later without data loss.

**The service catalogue supersedes `category`/`subcategory` rather than sitting beside it.** Two
taxonomies answering the same question is how classification data rots. The three MVP categories seed
the catalogue so nothing is lost.

**Knowledge retrieval is a read tool, not a prompt injection.** Axel selects `knowledge_search` and
supplies validated parameters like any other tool, so the retrieval appears in the transcript and the
run stays replayable from it. Silently stuffing articles into the system prompt would break the
property `architecture.md` calls out: tool name plus validated input is the whole record of what
happened.

**Axel reads knowledge and does not author it.** An agent writing its own knowledge base creates a
feedback loop with no human in it. `knowledge_gap_clusters` surfaces what is missing; a person writes
the article.

**Approvals resolve through `manager_id` by default.** [tier-0.md](tier-0.md) adds it for exactly this.
A per-catalogue-item override covers the cases where the manager is not the right approver.

**The PIR writes itself for autonomous changes.** Axel already verifies through the read named by
`verifiedBy`, and rollout polling already produces an observation sequence. Asking a human to record
what the agent already proved would be ceremony.

**No `ChangeValidationStep`-style multi-step approval yet.** GLPI supports approval chains. One approver
plus a CAB covers everything in scope, and a chain is a schema change rather than a redesign when it is
needed.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Four new record types multiply the contract, the schema and the dashboard; a half-landed record type breaks three components' gates at once. | Each record type lands complete — schema → contract → `pnpm contracts:publish` → both frontends — before the next begins. Order: catalogue, problems, changes, knowledge, forms. Each is independently useful, so stopping after any one leaves a working system. |
| Migrating `category`/`subcategory` to the catalogue risks losing classification on existing tickets. | The three MVP categories seed services with the same keys and the migration maps every row before the columns are dropped. The columns stay in the contract for one publish cycle so a frontend lag cannot break. |
| Vector search over knowledge needs an embedding pipeline, and a broken one silently returns nothing rather than failing. | `knowledge_search` returns lexical results when the vector index is empty or unavailable, and reports which mode answered. A retrieval tool that silently returns nothing would teach Axel there is no knowledge. |
| A standard pre-approved change could be used to wave through something that is not routine. | Only `cluster_patch_image` is registered as standard, and only when the patch is a tag change on an existing container — the tool already reads the deployment first, so the check is available where the decision is made. Anything else Axel proposes is a normal change and escalates. |
| CAB voting is meaningless without [tier-0.md](tier-0.md), and tier ordering could slip. | T2.D declares the `change.approve` capability as a hard prerequisite; the voting endpoint is not built before it exists. Building the change record without voting is a valid partial landing; building voting without authorization is not. |
| Knowledge audience and restriction could leak an internal article to the portal. | Same two mechanisms as the case log: the portal's query selects published public articles only, and it is a separate procedure shape rather than a filter. Tested by asserting the network response. |

---

## 7. Definition of done

1. All five components' gates pass.
2. Every ticket carries a service and subcategory from the catalogue; `category`/`subcategory` are gone
   from the contract; a service-specific SLA produces a different deadline from the default.
3. Incidents group under a problem; a published workaround is visible on every linked incident.
4. A ticket matching a known error is resolved by Axel citing it, with no exploratory tool calls.
5. An Axel image patch produces a standard change record whose rollback plan names the previous image.
6. A normal change cannot proceed until required CAB members holding `change.approve` have voted.
7. Every completed change carries a PIR; autonomous ones are filled from Axel's own verification.
8. Axel retrieves a relevant knowledge article before its first tool call, and the retrieval appears in
   the transcript as a tool call.
9. A restricted article is absent from the portal's network response, not merely hidden.
10. A week of resolved tickets produces at least one knowledge gap cluster.
11. A catalogue request renders as a typed form, routes to the requester's manager, and blocks while
    rejected.
12. No ITSM vocabulary and no raw state name reaches the portal — every visible string still originates
    in `portal/src/features/tickets/copy.ts`.
