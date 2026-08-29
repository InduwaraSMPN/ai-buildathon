# Axiōma — the ITSM adoption programme

**Document role:** Gap analysis across four reference systems, and the sequencing that turns it into work
**Related:** [tier-0.md](tiers/tier-0.md) · [tier-1.md](tiers/tier-1.md) · [tier-2.md](tiers/tier-2.md) · [tier-3.md](tiers/tier-3.md) · [tier-4.md](tiers/tier-4.md) · [execution/](execution/README.md)
**Supersedes nothing:** the five component plans in `context/plans/completed/` describe the MVP, which is built.

> ### Where the current truth lives
>
> **This document is the plan, not the status.** Sections 2 and 3 are snapshots taken before the tier work
> began and are kept as written — they are the baseline the programme was argued from, and rewriting them
> would erase the reasoning. They no longer describe the tree.
>
> A close-out audit on **2026-08-29** checked every milestone against the code, the live database and the
> generated API surface. **30 of 40 milestones are complete:** Tier 0 5/5, Tier 1 10/12, Tier 2 4/7,
> Tier 3 2/7, Tier 4 9/9. The migration ledger is parity-checked against disk and the deployed database;
> reference data, SLA reads, settlement metrics, mailbox administration, API-key security metadata and
> the deferred architecture/parity work are now live rather than schema-only.
>
> **[execution/](execution/README.md) carries the remaining work** — six briefs, each with the confirmed
> `file:line` evidence, a reserved migration range and a definition of done. Read those for what is left;
> read the tier documents below for why any of it is shaped the way it is.

The MVP proved the thesis: an employee opens a ticket, Axel resolves it against Kubernetes or against a
laptop, and it closes — or it escalates with its reasoning intact. This programme turns that into a
service management platform, by adopting what four mature systems have already settled rather than
inventing it again.

---

## 1. The four reference systems

| Project | Path | Stack | What it is best at |
|---|---|---|---|
| **FreeITSM** | `context/oss/freeitsm-main` | PHP 7.4–8.4, MySQL 8, vanilla JS | Breadth. 264 tables across 22 modules, and a schema that is unusually easy to read. The default source for anything with no obviously better model. |
| **iTop** (Combodo) | `context/oss/iTop-develop` | PHP | The ITIL datamodel and the CMDB. Its `Incident` and `UserRequest` state machines, stopwatch attributes and CI hierarchy are the most carefully designed of the four. |
| **GLPI** | `context/oss/glpi-11.0-bugfixes` | PHP | SLA and OLA as separate agreements, the business-rules engine, pending reasons that chase themselves, and a mature inventory agent. |
| **Znuny** (OTRS fork) | `context/oss/Znuny-dev` | Perl | Ticket state *types* — behaviour separated from names — dynamic fields, generic-agent automation, and the article/channel model. |

**What "adopt" means here.** All four are PHP or Perl; Axiōma is TypeScript, Python and Go. No code
transfers. What transfers is the *model*: table shapes, field sets, state machines, algorithms and the
decisions embedded in them. Where a project's schema comment explains why something is the way it is,
that reasoning is often more valuable than the columns — several are quoted in the tier documents for
exactly that reason.

Where more than one project solves a capability, the tier document names the one to follow and says
why. Where they disagree — iTop separates known errors into their own class and FreeITSM makes them a
flag — the disagreement is the interesting part, and the choice is argued rather than asserted.

---

## 2. Baseline: the MVP as built

**Historical — this is the state the programme was planned from, not the state today.** The gate counts
below are the MVP's. Current counts are `api` 133, `agent` 41, `cli` 41; see the status block at the top.

The five component plans have been executed. Gates, all run against the tree as it stood when this
document was written:

| Component | Lint | Types | Tests |
|---|---|---|---|
| `api` | `biome check` clean | `tsc --noEmit` clean | **7 pass** — `pnpm test` runs `tsx --test`, not vitest |
| `agent` | `ruff check` clean | — | **36 pass** — `pytest -q` |
| `cli` | `go vet` clean | `go build` clean | **34 pass across 5 packages** |
| `dashboard` | `biome check` clean | `tsc --noEmit` clean | — |
| `portal` | `biome check` clean | `tsc --noEmit` clean | — |

**What shipped**, established by reading the code rather than the plans:

- **Contract** — 15 procedures, 352 lines. `listTickets` carries ten filters, cursor pagination,
  sorting and server-computed facets over five dimensions; `updateTicket` is a discriminated union over
  eight actions; `getMyTicket`, `startRun`, `getRun`, `cancelRun`, `listMyDevices`, `enrollDevice`,
  `listDeviceCommands` and `ticketStats` all exist.
- **Schema** — 8 migrations. `tickets` carries `recordType`, `impact`, `urgency`, derived `priority`,
  `category`, `subcategory`, `route`, `resolution`, `escalationNote`, `reporterNote`, `progressMarker`,
  `resolvedAt`, `closedAt`, `reopenedAt`, `lastHumanTransitionAt`. `ticket_transitions` records
  from/to/action with `actorType` `human | agent`. `agent_steps` has `evidence`. `devices` has
  `enrolmentCode`.
- **`api`** — `src/k8s/client.ts`, a seven-tool registry in `src/server/tools/` with server-side zod
  validation and `verifiedBy` links, a table-driven lifecycle in `src/server/tickets.ts` over eleven
  actions with seven tests, and scenario seeds.
- **`agent`** — `prompt.py` split out; eight test modules including scenarios, verification and
  regressions.
- **`cli`** — five typed actions, six structured facets with per-platform files, cua detection, enrol.
- **`dashboard`** — server-backed queue with facets, saved views, URL-synced search, run selector, step
  cards, device detail, a ⌘K command palette wired into the layout, keyboard shortcuts with their own
  validation, and the full Base UI inventory (44 components including `table`, `sidebar`, `tabs`,
  `sheet`, `chart`, `command`, `combobox`, `field`, `form`).
- **`portal`** — progress timeline, request form, resolution card, and `copy.ts` holding every visible
  string.

---

## 3. The gap table

57 capabilities. **Re-baselined against the shipped MVP** — six rows had moved when this table was
written, and they are marked. Rows are grouped by tier; each tier document expands its own slice
with current state, milestones and a definition of done.

**Historical.** The "Axiōma today" column describes the tree before the tier work began. Most rows that
read *Nothing* now have their schema built and, in many cases, their backend too — what they usually lack
is the last mile. Do not read this column as current state; the per-milestone verdicts in
[execution/](execution/README.md) are what the code was actually checked against.

### Tier 0 — Prerequisite · [tier-0.md](tiers/tier-0.md)

| # | Capability | Axiōma today | Source model | Owner |
|---|---|---|---|---|
| 0.1 | Roles and capabilities | Nothing. `orpc.ts` is 26 lines and holds only `requireAuth` | FreeITSM `rbac_roles` → `rbac_role_capabilities` → `rbac_analyst_roles` / `rbac_team_roles`; Znuny `acl` for the field-level layer | `api` |
| 0.2 | Staff vs end-user identity split | One flat Better Auth `user` table | FreeITSM `analysts` / `users`, `teams`, `departments`, `analyst_teams` | `api` |

### Tier 1 — ITIL core the schema implies · [tier-1.md](tiers/tier-1.md)

| # | Capability | Axiōma today | Source model | Owner |
|---|---|---|---|---|
| 1.1 | Status as data with a behavioural meta-type | Six statuses hardcoded in `TICKET_STATUSES`, consumed by schema, contract, state machine and both frontends | Znuny `ticket_state_type` (seven meta-types) over configurable `ticket_state`; FreeITSM `ticket_statuses` flags `is_closed`, `pauses_sla` | `api` |
| 1.2 | Business-hours calendars | Nothing; all timing is wall-clock | FreeITSM `sla_calendars` + `sla_calendar_hours` + `sla_calendar_holidays`; GLPI `Calendar` + `CalendarSegment` | `api` |
| 1.3 | SLA as TTO/TTR stopwatches | Nothing | iTop `AttributeStopWatch` with `cumulatedpending`; GLPI `SLM::TTO` / `SLM::TTR` | `api` |
| 1.4 | OLA distinct from SLA | Nothing | GLPI `OLA` / `OlaLevel` beside `SLA` / `SlaLevel` | `api` |
| 1.5 | SLA targets attached to something | Nothing | FreeITSM on priority; Znuny on `queue` and on `sla` | `api` |
| 1.6 | Escalation ladders on breach | Nothing | GLPI `SlaLevel` rungs with criteria and actions; FreeITSM `sla_notification_rules` | `api`, `dashboard` |
| 1.7 | Escalated-state flags | Only `escalated` as a status | iTop `escalation_flag` / `escalation_reason`, states `escalated_tto` / `escalated_ttr` | `api` |
| 1.8 | Pending with a reason and a clock | Nothing; a ticket cannot wait | iTop `pending_reason`, `last_pending_date`; GLPI `PendingReason` with `followup_frequency`, `followups_before_resolution` | `api`, `portal` |
| 1.9 | Resolution code | **Partial** — `resolution`, `escalationNote`, `reporterNote` shipped; no code enum | iTop `resolution_code` + `solution`; GLPI `ITILSolution` + `SolutionType` | `api`, `dashboard` |
| 1.10 | Ticket-to-ticket linkage | Nothing | FreeITSM `ticket_links`; iTop `parent_*_id`; Znuny `link_object` / `link_relation` (generic) | `api`, `dashboard` |
| 1.11 | Merge and split, with undo | Nothing | FreeITSM `ticket_merges` + `merged_into_id` as a column, deliberately not a status | `api`, `dashboard` |
| 1.12 | Field-level audit | **Partial** — `ticket_transitions` gives lifecycle audit with actor attribution; field values not captured | FreeITSM `ticket_audit`; Znuny `ticket_history` | `api`, `dashboard` |
| 1.13 | Case log: public vs private conversation | **Nothing — there is no human conversation model at all** | iTop `public_log` / `private_log` `AttributeCaseLog`; Znuny `article` + `article_sender_type` | `api`, both frontends |
| 1.14 | Time recording | Nothing | FreeITSM `ticket_time_entries`; iTop `time_spent` | `api`, `dashboard` |
| 1.15 | Human-readable references | Portal renders a UUID fragment | FreeITSM `ticket_number_counters` + `ticket_number_history` + `ticket_prefixes` | `api`, both frontends |
| 1.16 | Assignment: owner, assignee, team | **Unchanged** — only `route`, a destination enum | iTop `team_id` + `agent_id`; FreeITSM `assigned_analyst_id` + `owner_id`; Znuny `user_id` + `responsible_user_id` | `api`, `dashboard` |
| 1.17 | Reopen and satisfaction | **Partial** — `reopenedAt` and the `reopen` action shipped; no CSAT | FreeITSM `ticket_csat_responses`; GLPI `TicketSatisfaction` | `api`, `portal` |
| 1.18 | Concurrent-edit detection | Nothing | FreeITSM `ticket_presence` | `api`, `dashboard` |

### Tier 2 — The missing ITIL practices · [tier-2.md](tiers/tier-2.md)

| # | Capability | Axiōma today | Source model | Owner |
|---|---|---|---|---|
| 2.1 | Problem Management | Nothing | FreeITSM `problems` (`root_cause`, `workaround`, `is_known_error`) + `problem_tickets`; iTop `itop-problem-mgmt` | `api`, `dashboard` |
| 2.2 | Known-error database | Nothing | iTop separate class; FreeITSM a flag on the problem | `api`, `agent` |
| 2.3 | Change Enablement with CAB | Nothing — and `cluster_patch_image` *is* a change, as [api.md](../completed/api.md) admits | FreeITSM `changes` (risk block, `test_plan`, `rollback_plan`) + `change_cab_members` (per-member votes); iTop `itop-change-mgmt-itil` | `api`, `dashboard` |
| 2.4 | Post-implementation review | Nothing | FreeITSM `changes.pir_*` | `api`, `dashboard` |
| 2.5 | Service catalogue | `category`/`subcategory`, three values seeded from three scenarios | iTop `ServiceFamily → Service → ServiceSubcategory`; GLPI `ITILCategory` tree | `api` |
| 2.6 | Approval workflow | Nothing | iTop `waiting_for_approval` / `approved` / `rejected`; GLPI `TicketValidation` / `ChangeValidationStep` | `api`, both frontends |
| 2.7 | Knowledge base | Nothing | FreeITSM `knowledge_articles` (`embedding`, `audience`, `version`, `next_review_date`) + folders + ACL + versions | `api`, both frontends |
| 2.8 | Knowledge ↔ tickets, gap detection | Nothing | FreeITSM `knowledge_gap_clusters`; GLPI `KnowbaseItem_Item` | `api`, `agent` |
| 2.9 | Request catalogue | One free-text form | FreeITSM `forms` + `form_fields` + `form_submissions`; GLPI `TicketTemplate` field families | `api`, `portal` |

### Tier 3 — Extensible platform mechanics · [tier-3.md](tiers/tier-3.md)

| # | Capability | Axiōma today | Source model | Owner |
|---|---|---|---|---|
| 3.1 | User-definable CMDB classes | `cmdb_items.kind`, five values | FreeITSM `cmdb_classes` → `cmdb_class_properties` (`spreads_impact`) → `cmdb_objects` | `api` |
| 3.2 | Typed, directional relationships | `relatesToId` + free-text `relationKind` | FreeITSM `cmdb_relationship_types` (`verb`, `inverse_verb`, `impact_direction`) | `api` |
| 3.3 | Impact analysis | Nothing | Traversal over `impact_direction` + `spreads_impact`; iTop `itop-flow-map` | `api`, `dashboard` |
| 3.4 | A real CI taxonomy | Five `kind` values | iTop `FunctionalCI → PhysicalDevice / ConnectableCI`, `ApplicationSolution`, `BusinessProcess`, `Subnet`, `VLAN` | `api` |
| 3.5 | Ticket ↔ CI linkage | Nothing | FreeITSM `ticket_cmdb_objects`; iTop `itop-bridge-cmdb-ticket` | `api`, `agent` |
| 3.6 | Custom fields on any record | Nothing; every field is a migration | Znuny `dynamic_field` + `dynamic_field_value`; FreeITSM `asset_fields` | `api`, both frontends |
| 3.7 | Business-rules engine | Nothing — every routing decision costs a model call | GLPI `RuleTicket` criteria → actions | `api`, `agent` |
| 3.8 | Workflow automation | Nothing | FreeITSM `workflows` + `workflow_executions`; Znuny `generic_agent_jobs` | `api` |
| 3.9 | Outbound webhooks | Nothing | FreeITSM `webhook_deliveries` + `webhook_message_formats` | `api`, `dashboard` |
| 3.10 | Notification engine | Toasts only | FreeITSM `notifications` with `event_count` grouping; Znuny `notification_event` | `api`, `dashboard` |
| 3.11 | Saved views | **Mostly done** — `saved-view.tsx` + server facets shipped; not persisted per analyst | Znuny `personal_queues`; FreeITSM `watchtower_items` | `api`, `dashboard` |
| 3.12 | Cross-record search | **Partial** — the ⌘K palette shipped (`components/layout/command-menu.tsx`), but backed by two direct queries over tickets and devices; no index, no other record types | FreeITSM `search_documents` + `attachment_text` | `api`, `dashboard` |
| 3.13 | REST API for third parties | oRPC for our own frontends; `OpenAPIHandler` already mounted, unauthenticated | FreeITSM `api_keys` + rate limits | `api` |

### Tier 4 — Operational surface · [tier-4.md](tiers/tier-4.md)

| # | Capability | Axiōma today | Source model | Owner |
|---|---|---|---|---|
| 4.1 | Email in, ticket out | Nothing; every ticket starts in the portal | FreeITSM `target_mailboxes` + `emails`, threading by reference not subject; Znuny `mail_account` | `api` |
| 4.2 | Email out, with a log | Nothing | FreeITSM `email_send_log` + templates + specificity-ordered rules | `api` |
| 4.3 | Other channels | Nothing | FreeITSM `messaging_channels`, `webchat_*` | `api`, `portal` |
| 4.4 | Ticket origin | Nothing | FreeITSM `ticket_origins`, per-mailbox default; iTop `origin` | `api` |
| 4.5 | Asset register | `devices` only, and only machines running axel-cli | FreeITSM `assets` + `asset_checkout_log` + import profiles | `api`, `dashboard` |
| 4.6 | Richer device inventory | **Partial** — six structured facets shipped; no disks, hardware or software | GLPI `Agent`; FreeITSM `asset_devices` / `asset_disks` / `software_inventory_apps` | `cli`, `api` |
| 4.7 | Software inventory and licences | Nothing | FreeITSM `software_inventory_apps` + `software_licences` | `api`, `cli` |
| 4.8 | Reporting and dashboards | **Mostly done** — `ticketStats` ships autonomous rate and median TTR; widgets not configurable | FreeITSM per-analyst `*_dashboard_widgets` | `api`, `dashboard` |
| 4.9 | Service status page | Nothing | FreeITSM `status_services` + `status_incidents`, availability derived from incidents | `api`, `portal` |
| 4.10 | Suppliers and contracts | Nothing | FreeITSM `suppliers` + `contracts`; iTop `CustomerContract` with coverage | `api` |
| 4.11 | Scheduled and recurring work | Nothing | FreeITSM `work_start_datetime` / `work_end_datetime`; GLPI `TicketRecurrent` | `api`, `dashboard` |
| 4.12 | Snooze | Nothing | FreeITSM `snoozed_until` as a computed comparison, never a status | `api`, `dashboard` |
| 4.13 | Attachments | Nothing | FreeITSM `documents` + `document_links`, inherited visibility, extension allow-list | `api`, both frontends |
| 4.14 | SSO and directory sync | Better Auth email/password only | FreeITSM `auth_providers` + `sso_identities`, `directory_sync_runs` with preview and a safety brake | `api` |
| 4.15 | Multi-tenancy | Out of scope by decision | FreeITSM `tenants` + `tenant_id` almost everywhere | **deferred — see [tier-4.md](tiers/tier-4.md) T4.J** |

**Totals: 2 prerequisite, 18 Tier 1, 9 Tier 2, 13 Tier 3, 15 Tier 4.** Six rows had moved when this was
written: 1.9, 1.12 and 1.17 partial; 3.11 and 4.8 mostly done; 4.6 partial.

Since then the tiers have been built and audited. The milestone-level verdict — which is the useful one,
because milestones are what the tier documents define *done* against — is **30 of 40 complete: Tier 0
5/5, Tier 1 10/12, Tier 2 4/7, Tier 3 2/7, Tier 4 9/9**. [execution/](execution/README.md) has the
breakdown and the remaining work.

---

## 4. Sequencing

Tiers are **dependency-ordered, not preference-ordered**. Within a tier, milestones are ordered the same
way and each tier document says which of its milestones unblock the rest.

```
tier-0  identity + capabilities
   │
   ├──────────────► tier-1  status-as-data ─► calendars ─► SLA/OLA ─► breach
   │                        pending, resolution codes, assignment,
   │                        linkage/merge, case log, audit, references
   │                                    │
   │                                    ▼
   ├──────────────► tier-2  catalogue ─► problems ─► changes ─► knowledge ─► requests
   │                                    │
   │                                    ▼
   └──────────────► tier-3  CMDB metamodel, custom fields, rules,
                            workflows, search, API keys
                                        │
                                        ▼
                            tier-4  email, assets, inventory, status,
                                    attachments, SSO
```

**Three hard dependencies worth stating separately:**

1. **[tier-1.md](tiers/tier-1.md) T1.A (status as data) is first, and it is more expensive now than
   when first proposed.** `TICKET_STATUSES` has five consumers: the schema enums, the contract's
   duplicated `ticketStatus`, the transition table in `src/server/tickets.ts`, **two runtime iterations
   in `src/server/routers/index.ts`** — the status facet in `listTickets` and the `byStatus` record in
   `ticketStats`, both of which enumerate the constant — and both frontends through the published
   contract. Every later milestone that needs `pauses_sla` or `is_closed` — SLA, pending, breach
   reporting — needs this first. Doing it afterwards means doing those twice.
2. **[tier-0.md](tiers/tier-0.md) gates anything that records a human decision.** CAB voting and
   approvals in Tier 2, and API keys in Tier 3, are not built before the capability model exists.
   Building the change record without voting is a valid partial landing; building voting without
   authorization is not.
3. **[tier-2.md](tiers/tier-2.md) T2.A (service catalogue) supersedes `category`/`subcategory`**, and
   is what gives [tier-1.md](tiers/tier-1.md) T1.C's SLA resolution its first real input. Until it
   lands, SLA resolves from priority.

**Tier 4 is droppable.** Every milestone in it is independently useful and independently skippable, and
none of Tiers 0–3 depends on it.

---

## 5. Cross-tier decisions

Decisions that shape more than one tier. Tier-local decisions live in their own documents.

**Behaviour never keys off a name.** Status, once it is data ([tier-1.md](tiers/tier-1.md) T1.A), is
configurable; so `pauses_sla`, `is_closed` and `state_type` carry the behaviour. The same rule produces
`merged_into_id` as a column rather than a status (T1.H) and `snoozed_until` as a computed comparison
rather than a status ([tier-4.md](tiers/tier-4.md) T4.G). FreeITSM's own schema comments make this
argument, and it is the mistake every ITSM system makes exactly once.

**Elapsed working time, never stored deadlines.** iTop and GLPI arrived at the stopwatch independently.
A deadline column cannot express a pause, and the pause is the point.

**One vocabulary per concept, across tiers.** Capability keys from [tier-0.md](tiers/tier-0.md) are
reused by API keys in [tier-3.md](tiers/tier-3.md) rather than a second permission model. The action
vocabulary is shared between the rules engine and workflows (T3.C, T3.E). Custom fields
([tier-3.md](tiers/tier-3.md) T3.D) serve assets in Tier 4 rather than a second asset-specific
mechanism.

**Rules run before the model, never instead of it.** [tier-3.md](tiers/tier-3.md) T3.C. The framing
matters: the rules engine makes the agent's contribution *measurable*, because what remains after the
rules is exactly the work that needed judgement. The instrumentation already exists —
`ticketStats.autonomousResolutionRate` and `agent_runs`' token counts — so the claim is checkable rather
than asserted, including if it turns out the rules settle less than hoped.

**Axel reads more than it writes.** Across the tiers it gains read tools — knowledge search, case-log
read, CMDB impact — and exactly one new write path: creating a change record when it patches. It still
holds no credentials, still asks the API for every side effect, and still does not author knowledge or
post into the human conversation. That boundary is the thing `architecture.md` is built around and
nothing here loosens it.

**The portal's boundary is enforced by data shape, not by client discipline.** `getMyTicket` already
returns no `runs`. The case log ([tier-1.md](tiers/tier-1.md) T1.I), knowledge audience
([tier-2.md](tiers/tier-2.md) T2.F) and attachments ([tier-4.md](tiers/tier-4.md) T4.F) all extend that
same mechanism rather than adding client-side filters. Every employee-facing string continues to
originate in `portal/src/features/tickets/copy.ts`.

**Authorization is adopted, reversing `architecture.md`.** Argued in full in
[tier-0.md](tiers/tier-0.md) §5. Short form: several capabilities in Tiers 2 and 4 record decisions
nobody is authorised to make, and a feature like that is theatre. `architecture.md` is updated in the
same change rather than left contradicting the code.

**Change records make Axel's patches auditable without gating them.** [tier-2.md](tiers/tier-2.md) T2.D.
A standard pre-approved change with a rollback plan is what ITIL prescribes for a low-risk repeatable
change, so this converts the gap [api.md](../completed/api.md) admits into the correct answer rather than bolting
an approval gate onto an autonomous agent.

**Declined, deliberately:**

- **Znuny process management (`pm_process` / `pm_activity` / `pm_transition`).** Process-driven tickets
  and an autonomous agent are two answers to "what happens next on this ticket", and Axiōma has chosen
  one. Adopting both gives a human-authored flowchart and a reasoning agent each believing they own the
  next step.
- **Multi-tenancy**, deferred with its retrofit cost stated and one concrete hedge offered
  ([tier-4.md](tiers/tier-4.md) T4.J).
- **Field-level ACLs** (Znuny `acl_ticket_attribute_relations`), **multi-step approval chains** (GLPI
  `ChangeValidationStep`), and **known errors as a separate class** (iTop). All three are richer than
  what is planned; none is needed by anything in Tiers 0–4, and each can be adopted later without data
  loss.
- **FreeITSM's LMS, War Room, Process Mapper, RFP Builder and System Wiki.** Real modules, and not IT
  service management. Listed so a later reader knows they were seen and declined.

---

## 6. Reading order

| Document | Covers |
|---|---|
| [tier-0.md](tiers/tier-0.md) | Identity split, roles, capability enforcement, administration |
| [tier-1.md](tiers/tier-1.md) | Status as data, calendars, SLA/OLA, breach, pending, resolution codes, assignment, linkage, merge, case log, audit, references, presence, CSAT |
| [tier-2.md](tiers/tier-2.md) | Service catalogue, Problem Management, known errors for Axel, Change Enablement with CAB, PIR, knowledge base, request catalogue and approvals |
| [tier-3.md](tiers/tier-3.md) | CMDB metamodel, impact analysis, rules engine, custom fields, workflows, webhooks, notifications, persisted views, cross-record search, public API |
| [tier-4.md](tiers/tier-4.md) | Inbound and outbound email, assets, hardware and software inventory, service status, attachments, scheduling, suppliers, SSO and directory sync, multi-tenancy deferral |
| [execution/](execution/README.md) | **What is left.** Six briefs dividing the remaining work across parallel sessions, each carrying the audit's confirmed evidence, a reserved migration range and a definition of done |

Each follows the same shape as the five component plans: Current state → Gaps → Milestones →
Cross-component impact → Decisions taken → Risks → Definition of done. No durations, matching those
plans.
