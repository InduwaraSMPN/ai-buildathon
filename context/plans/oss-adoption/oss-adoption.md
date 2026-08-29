# Axiōma — adopting from four open-source ITSM systems

**Document role:** Gap analysis and adoption plan, spanning all five components
**Related:** [api.md](api.md), [agent.md](agent.md), [cli.md](cli.md), [dashboard.md](dashboard.md), [portal.md](portal.md)

The five component plans describe the MVP: three scenarios and one autonomous loop. This document
describes growing that into a full ITSM platform by adopting what four mature open-source systems have
already settled. It does not modify the five; it says which of their milestones gain scope.

---

## 1. What these projects are, and what "adopt" can mean

| Project | Path | Stack | Licence | What that permits |
|---|---|---|---|---|
| **FreeITSM** | `context/oss/freeitsm-main` | PHP 7.4–8.4, MySQL 8, vanilla JS | **MIT** | **Lift.** Schema, algorithms and logic may be transcribed directly, with attribution. 264 tables, 22 modules. |
| **iTop** (Combodo) | `context/oss/iTop-develop` | PHP | **AGPL-3.0** | **Reference only.** Read the model, reimplement. |
| **GLPI** | `context/oss/glpi-11.0-bugfixes` | PHP | **GPL-3.0** | **Reference only.** |
| **Znuny** (OTRS fork) | `context/oss/Znuny-dev` | Perl | **GPL-3.0** | **Reference only.** |

**Read this before the table.** All four are PHP or Perl; Axiōma is TypeScript, Python and Go. No line
of code transfers regardless of licence — what transfers is the *model*: table shapes, state machines,
field sets, algorithms and workflows. The licence still governs how closely we may follow. From
FreeITSM we may transcribe DDL and logic as-is. From iTop, GLPI and Znuny we may read the design and
build our own; copying their code into Axiōma would put a copyleft obligation on the whole system.

Every row in the gap table is tagged accordingly:

- **`lift`** — FreeITSM, MIT. Transcribe the schema and the logic.
- **`ref`** — iTop / GLPI / Znuny. Read the model, write our own.

Where a capability exists in more than one project, the row names the best one and says why.

---

## 2. The gap table

Grouped by tier. "Axiōma today" reflects the current code **plus** what the five MVP plans already
commit to — nothing is listed as missing that those plans deliver.

### Tier 0 — Prerequisite

| # | Capability | Axiōma today | Source and shape | Mode | Owner |
|---|---|---|---|---|---|
| 0.1 | **Roles and capabilities** | Nothing. `architecture.md`: "any authenticated user can call any procedure" | FreeITSM `rbac_roles` → `rbac_role_capabilities` (capability keys) → `rbac_analyst_roles` / `rbac_team_roles`. Znuny `acl` for field-level rules is the richer model but only needed later | `lift` | `api` |
| 0.2 | **Staff vs end-user identity split** | One Better Auth `user` table for everyone | FreeITSM separates `analysts` (staff) from `users` (requesters), with `teams`, `departments`, `analyst_teams`, `department_teams` | `lift` | `api` |

### Tier 1 — ITIL core the schema already implies

| # | Capability | Axiōma today | Source and shape | Mode | Owner |
|---|---|---|---|---|---|
| 1.1 | **Status as data, with a behavioural meta-type** | Six statuses hardcoded in `TICKET_STATUSES` (`api/src/shared/index.ts`) | Znuny `ticket_state_type` — seven meta-types (`new`, `open`, `closed`, `pending reminder`, `pending auto`, `removed`, `merged`) with configurable `ticket_state` rows beneath. FreeITSM's `ticket_statuses` carries the same idea as flags: `is_closed`, `pauses_sla`, `is_default`, `colour`, `display_order` | `ref` (Znuny shape) + `lift` (FreeITSM flags) | `api` |
| 1.2 | **Business-hours calendars** | Nothing. All timing is wall-clock | FreeITSM `sla_calendars` + `sla_calendar_hours` (weekday, start_time, end_time) + `sla_calendar_holidays`. GLPI `Calendar` + `CalendarSegment` + `Calendar_Holiday` is the same model as objects | `lift` | `api` |
| 1.3 | **SLA as TTO/TTR stopwatches** | Nothing | iTop `tto` / `ttr` `AttributeStopWatch` with `cumulatedpending`, and sub-items `sla_tto_passed`, `sla_ttr_over`, `ttr_escalation_deadline`. GLPI `LevelAgreement` with `SLM::TTO` ("time to own") and `SLM::TTR` ("time to resolve") | `ref` | `api` |
| 1.4 | **OLA distinct from SLA** | Nothing | GLPI `OLA` / `OlaLevel` / `OlaLevel_Ticket` alongside `SLA` / `SlaLevel` — internal targets separate from customer-facing ones | `ref` | `api` |
| 1.5 | **SLA targets attached to something** | Nothing | FreeITSM hangs them on priority (`ticket_priorities.sla_response_minutes`, `sla_resolution_minutes`, `sla_calendar_id`). Znuny hangs them on `queue` **and** on `sla`, so a team can have its own targets | `lift` + `ref` | `api` |
| 1.6 | **Escalation ladders on breach** | Nothing | GLPI `SlaLevel` / `OlaLevel` with `LevelAgreementLevel` criteria and actions at each rung. FreeITSM `sla_notification_rules` (`trigger_type` warning/breach × `target_type` response/resolution/both) is the simpler version | `lift` (start) → `ref` (ladder) | `api`, `dashboard` |
| 1.7 | **Escalated-state flags on the ticket** | Only `escalated` as a status | iTop `escalation_flag`, `escalation_reason`, and dedicated states `escalated_tto` / `escalated_ttr`. Znuny `escalation_time`, `escalation_response_time`, `escalation_update_time`, `escalation_solution_time` on `ticket` | `ref` | `api` |
| 1.8 | **Pending with a reason and a clock** | Nothing. A ticket cannot be paused | iTop `pending_reason`, `last_pending_date`, `cumulatedpending`. GLPI `PendingReason` with `followup_frequency` and `followups_before_resolution` — pending that chases itself instead of rotting | `ref` | `api`, `portal` |
| 1.9 | **Resolution code and solution text** | `tickets.resolution` free text only | iTop `resolution_code` (`AttributeEnum`) + `solution` (`AttributeText`). GLPI `ITILSolution` + `SolutionType` | `ref` | `api`, `dashboard` |
| 1.10 | **Ticket-to-ticket linkage** | Nothing | FreeITSM `ticket_links` (`relation_type`). iTop `parent_incident_id`, `parent_request_id`, `parent_problem_id`, `parent_change_id` plus `child_incidents_list`. Znuny `link_object` / `link_relation` / `link_type` is the generic any-to-any version | `lift` (start) → `ref` (generic) | `api`, `dashboard` |
| 1.11 | **Merge and split, with undo** | Nothing | FreeITSM `ticket_merges` (with `undone_datetime`, `source_prev_status_id`, `reference_mode`) and `ticket_splits`; `tickets.merged_into_id` as the live/merged discriminator, deliberately not a status | `lift` | `api`, `dashboard` |
| 1.12 | **Field-level audit trail** | `agent_steps` only — Axel's transcript, nothing for human edits | FreeITSM `ticket_audit` (`field_name`, `old_value`, `new_value`, `analyst_id`). Znuny `ticket_history` with typed `history_type_id` | `lift` | `api`, `dashboard` |
| 1.13 | **Case log: public vs private conversation** | Nothing. There is no human conversation model at all | iTop `public_log` / `private_log` as `AttributeCaseLog` — append-only, timestamped, attributed. Znuny `article` + `article_sender_type` + `communication_channel` is the richer multi-channel version | `ref` | `api`, `dashboard`, `portal` |
| 1.14 | **Time recording** | Nothing | FreeITSM `ticket_time_entries` (`time_spent_minutes`, `notes`, `analyst_id`). iTop `time_spent` `AttributeDuration` | `lift` | `api`, `dashboard` |
| 1.15 | **Human-readable ticket references** | Raw UUID shown as `#{id.slice(0,8)}` in the portal | FreeITSM `ticket_number_counters` + `ticket_number_history` + `ticket_prefixes` — configurable format, per-type or per-year sequences, old numbers retained for ever so replies still match | `lift` | `api`, `portal`, `dashboard` |
| 1.16 | **Assignment: owner, assignee, team** | `tickets.route` free text | iTop `team_id` + `agent_id` on base `Ticket`. FreeITSM `assigned_analyst_id` + `owner_id` + `department_id`. Znuny `user_id` + `responsible_user_id` + `queue_id` — all three separate owner from assignee | `lift` | `api`, `dashboard` |
| 1.17 | **Reopen and satisfaction** | Portal can escalate from resolved; nothing measures the outcome | FreeITSM `ticket_csat_responses` (token, rating, comment). GLPI `TicketSatisfaction`. iTop `ev_reopen` stimulus with a reopen count | `lift` | `api`, `portal` |
| 1.18 | **Concurrent-edit detection** | Nothing | FreeITSM `ticket_presence` — who else has this ticket open right now | `lift` | `api`, `dashboard` |

### Tier 2 — The missing ITIL practices

| # | Capability | Axiōma today | Source and shape | Mode | Owner |
|---|---|---|---|---|---|
| 2.1 | **Problem Management** | Nothing. `idea.md` puts it out of scope for the MVP | FreeITSM `problems` (`root_cause`, `workaround`, `is_known_error`), `problem_tickets`, `problem_notes`, `problem_statuses`, `problem_audit`. iTop `itop-problem-mgmt` + `itop-knownerror-mgmt` | `lift` | `api`, `dashboard` |
| 2.2 | **Known-error database** | Nothing | iTop `KnownError` linked to Problem and to Service; FreeITSM folds it into `problems.is_known_error` | `lift` (simple) / `ref` (separate class) | `api` |
| 2.3 | **Change Enablement with CAB** | Nothing, and `api.md` honestly notes that `cluster.patch_image` *is* a change | FreeITSM `changes` (`reason_for_change`, `test_plan`, `rollback_plan`, `risk_likelihood`, `risk_impact_score`, `risk_score`, `risk_level`, `cab_required`, `cab_approval_type`) + `change_cab_members` (`vote`, `is_required`, `vote_comment`, `vote_datetime`) + `change_tickets` + `change_templates`. iTop `itop-change-mgmt-itil` for the ITIL state machine | `lift` | `api`, `dashboard` |
| 2.4 | **Post-implementation review** | Nothing | FreeITSM `changes.pir_was_successful`, `pir_actual_start`, `pir_actual_end`, `pir_lessons_learned`, `pir_follow_up` | `lift` | `api`, `dashboard` |
| 2.5 | **Service catalogue** | `TICKET_ROUTES` string enum | iTop `ServiceFamily → Service → ServiceSubcategory`, with `service_id` and `servicesubcategory_id` on every ticket. GLPI `ITILCategory` as a self-referencing tree | `ref` | `api` |
| 2.6 | **Approval workflow** | Nothing | iTop `UserRequest` states `waiting_for_approval` / `approved` / `rejected` with `approver_id`. GLPI `TicketValidation` / `ChangeValidation` / `ChangeValidationStep`. FreeITSM `forms.requires_approval` + `approver_id` | `ref` | `api`, `dashboard`, `portal` |
| 2.7 | **Knowledge base** | Nothing | FreeITSM `knowledge_articles` (`body`, `embedding`, `audience`, `folder_id`, `version`, `next_review_date`, `is_restricted`) + `knowledge_folders` + `knowledge_acl` + `knowledge_article_versions` + `knowledge_tags`. Already has vector search and a review workflow | `lift` | `api`, `dashboard`, `portal` |
| 2.8 | **Knowledge linked to tickets, and gap detection** | Nothing | FreeITSM `knowledge_gap_tickets` / `knowledge_gap_clusters` — clusters tickets with no matching article, so the KB grows from what people actually ask. GLPI `KnowbaseItem_Item` | `lift` | `api`, `agent` |
| 2.9 | **Request catalogue** | One free-text form | FreeITSM `forms` + `form_fields` + `form_submissions` with conditional questions and versioning. GLPI `TicketTemplate` families with mandatory/hidden/predefined/readonly fields | `lift` | `api`, `portal` |

### Tier 3 — Extensible platform mechanics

| # | Capability | Axiōma today | Source and shape | Mode | Owner |
|---|---|---|---|---|---|
| 3.1 | **User-definable CMDB classes** | `cmdb_items` with a five-value `kind` string | FreeITSM `cmdb_classes` → `cmdb_class_properties` (`property_type`, `target_class_id`, `is_required`, **`spreads_impact`**) → `cmdb_objects` → `cmdb_object_properties`. Extensible with no migration | `lift` | `api` |
| 3.2 | **Typed, directional relationships** | `relates_to_id` + `relation_kind` free text | FreeITSM `cmdb_relationship_types` (`verb`, `inverse_verb`, `impact_direction`) + `cmdb_object_relationships` | `lift` | `api` |
| 3.3 | **Impact analysis** | Nothing | FreeITSM: walk relationships where `impact_direction` and `spreads_impact` allow, answering "what breaks if this breaks". iTop `itop-flow-map` renders the same traversal | `lift` | `api`, `dashboard` |
| 3.4 | **A real CI taxonomy to seed with** | Five `kind` values | iTop `itop-config-mgmt`: `FunctionalCI → PhysicalDevice / ConnectableCI → Server, NetworkDevice, PC`, plus `ApplicationSolution`, `BusinessProcess`, `Software`, `SoftwareInstance`, `DBServer`, `Subnet`, `VLAN`, `IPInterface`, `Location`, `OSVersion` | `ref` | `api` |
| 3.5 | **Ticket ↔ CI linkage** | Nothing | FreeITSM `ticket_cmdb_objects` and `ticket_assets`. iTop `itop-bridge-cmdb-ticket` | `lift` | `api`, `agent` |
| 3.6 | **Custom fields on any record** | Nothing; every field needs a migration | Znuny `dynamic_field` (`field_type`, `object_type`, `config`) + `dynamic_field_value` — the cleanest of the three. FreeITSM `asset_fields` / `asset_field_values` / `asset_field_sets` is the same idea scoped to assets, and is liftable | `ref` (Znuny) + `lift` (FreeITSM) | `api`, `dashboard`, `portal` |
| 3.7 | **Business-rules engine** | Nothing — every routing decision costs a model call | GLPI `RuleTicket` / `RuleTicketCollection`: criteria (requester, category, urgency, impact, location, mail source, subject, sender) → actions (assign group/user, set category, urgency, impact, priority, SLA/OLA, TTO/TTR, type, location). Runs on create and on update | `ref` | `api`, `agent` |
| 3.8 | **Workflow automation** | Nothing | FreeITSM `workflows` (`trigger_event`, `conditions`, `actions`, `last_run_status`) + `workflow_executions` + `workflow_scheduled_emissions`. Znuny `generic_agent_jobs` is the scheduled-search-plus-action variant | `lift` | `api` |
| 3.9 | **Outbound webhooks** | Nothing | FreeITSM `webhook_deliveries` + `webhook_message_formats` — HMAC signing, retries, a delivery dashboard | `lift` | `api`, `dashboard` |
| 3.10 | **Notification engine** | Toasts only | FreeITSM `notifications` with **`event_count`** so repeat changes to one ticket collapse into a single entry, and a rule never to notify someone about their own action. Znuny `notification_event` / `notification_event_item` / `notification_event_message` is the templated version | `lift` | `api`, `dashboard` |
| 3.11 | **Saved searches and queue views** | Four hardcoded presets planned in `dashboard.md` | Znuny `personal_queues` / `personal_services`. FreeITSM `watchtower_items` / `watchtower_item_members` — a per-analyst attention dashboard counting every status by its own name and colour | `lift` | `api`, `dashboard` |
| 3.12 | **Search across every record type** | Nothing | FreeITSM `search_documents` + `attachment_text` + `document_text` — one index over tickets, changes, problems, knowledge, contracts, assets and CMDB, with PDF/Office text extraction | `lift` | `api`, `dashboard` |
| 3.13 | **REST API for third parties** | oRPC for our own frontends only | FreeITSM `api_keys` + `api_key_rate_limits` + `api_rate_limits`, 200+ endpoints with per-key permissions and a generated OpenAPI spec. Axiōma already mounts an `OpenAPIHandler` at `/api-reference`; what is missing is key auth and rate limiting | `lift` | `api` |

### Tier 4 — Operational surface

| # | Capability | Axiōma today | Source and shape | Mode | Owner |
|---|---|---|---|---|---|
| 4.1 | **Email in, ticket out** | Nothing; every ticket starts in the portal | FreeITSM `target_mailboxes` + `emails` + `email_attachments` + `mailbox_activity_log` + `freemail_domains`, with threading by ticket number rather than by subject. Znuny `mail_account` + `article` | `lift` | `api` |
| 4.2 | **Email out, with a log** | Nothing | FreeITSM `email_send_log` (recipient, which subsystem sent it, provider's own words on failure) + `ticket_email_templates` + `ticket_email_template_rules` (most-specific-match, never list order) + `analyst_signatures`, and `mail_queue` in Znuny | `lift` | `api` |
| 4.3 | **Other channels** | Nothing | FreeITSM `messaging_channels`, `webchat_conversations` / `webchat_messages` / `webchat_widgets`, `tickets.last_inbound_at` for the provider 24h service window | `lift` | `api`, `portal` |
| 4.4 | **Ticket origin** | Nothing | FreeITSM `ticket_origins` with a per-mailbox default, so an alerting address and a helpdesk address are distinguishable. iTop `origin` enum | `lift` | `api` |
| 4.5 | **Asset register** | `devices` only, and only machines running axel-cli | FreeITSM `assets` + `asset_types` + `asset_locations` + `asset_status_types` + `asset_checkout_log` (custody) + `asset_history` + `users_assets`, with QR labels and CSV import (`asset_import_*`) | `lift` | `api`, `dashboard` |
| 4.6 | **Richer device inventory** | Four facets returning console prose; `cli.md` plans structured parsing | GLPI `Agent` (`deviceid`, `tag`, `last_contact`, `useragent`, `remote_addr`, polymorphic `itemtype`) plus its inventory schema. FreeITSM `asset_devices` / `asset_disks` / `asset_network_adapters` / `software_inventory_apps` show the shape a device report should take | `ref` (GLPI) + `lift` (FreeITSM tables) | `cli`, `api` |
| 4.7 | **Software inventory and licences** | Nothing | FreeITSM `software_inventory_apps` / `software_inventory_detail` / `software_licences` | `lift` | `api`, `cli` |
| 4.8 | **Reporting and dashboards** | Four browser-computed tiles | FreeITSM `analyst_ticket_dashboard_widgets` / `asset_dashboard_widgets` / `software_dashboard_widgets` — per-analyst configurable widgets | `lift` | `api`, `dashboard` |
| 4.9 | **Service status page** | Nothing | FreeITSM `status_services` + `status_incidents` + `status_incident_updates` + `service_impact_levels`, deriving availability from incidents already recorded rather than from a separate monitor | `lift` | `api`, `portal` |
| 4.10 | **Suppliers and contracts** | Nothing | FreeITSM `suppliers` + `contracts` + `contract_term_values` + `payment_schedules`. iTop `CustomerContract` / `ProviderContract` with coverage windows tied to SLAs | `lift` | `api` |
| 4.11 | **Scheduled and recurring tickets** | Nothing | FreeITSM `tickets.work_start_datetime` / `work_end_datetime` / `work_all_day` and `ticket_rota_shifts` / `ticket_rota_entries`. GLPI `TicketRecurrent` | `lift` | `api`, `dashboard` |
| 4.12 | **Snooze** | Nothing | FreeITSM `tickets.snoozed_until` — "asleep" is a computed comparison, never a status | `lift` | `api`, `dashboard` |
| 4.13 | **Attachments** | Nothing | FreeITSM `documents` + `document_links` + `attachment_text`, with an extension allow-list, server-chosen filenames, and visibility inherited from whatever the document is attached to | `lift` | `api`, `dashboard`, `portal` |
| 4.14 | **SSO and directory sync** | Better Auth email/password only | FreeITSM `auth_providers` + `analyst_sso_identities` + `user_sso_identities`, and `directory_sync_runs` / `directory_sync_entries` with a preview that writes nothing and a safety brake on a sudden drop in head count | `lift` | `api` |
| 4.15 | **Multi-tenancy** | Out of scope by decision (`idea.md`) | FreeITSM `tenants` + `tenant_id` on nearly every table, plus `analyst_tenant_access` / `team_tenant_access` / `tenant_domains` | `lift` | `api` — **deferred, see §6** |

**Totals: 2 prerequisite, 18 Tier 1, 9 Tier 2, 13 Tier 3, 15 Tier 4 — 57 adoptable capabilities.**
39 are pure `lift` (FreeITSM, MIT), 13 are pure `ref`, and 5 combine both — a liftable FreeITSM
schema with a better model read from one of the other three.

---

## 3. Tier 0 — the RBAC prerequisite

`architecture.md` states: *"Nothing checks authorization. Any authenticated user can call any
procedure."* It lists this as deliberate, and names it as one of the two things to fix first if the
system moves past a demo.

**This document reverses that decision**, and the reason is specific rather than general. It is not
that authorization is good practice. It is that a large share of Tier 2 and Tier 4 is *unimplementable*
without it, and implementing those features without enforcement produces something worse than not
having them:

- CAB voting (2.3) where anyone can cast anyone's vote is not an approval, it is a form.
- Approval workflow (2.6) with no notion of who may approve does not gate anything.
- Knowledge audience and `is_restricted` (2.7) where every reader sees every article is a field that
  lies.
- The staff/end-user split (0.2) is the thing that stops a requester reading the private case log.

A feature that records a decision nobody is authorised to make is theatre, and shipping theatre is
worse than shipping a gap, because a gap is visible.

**What gets adopted.** FreeITSM's model is MIT and is the right size: `rbac_roles` →
`rbac_role_capabilities` (a role holds a set of string capability keys) → `rbac_analyst_roles` and
`rbac_team_roles` (a person gets roles directly and through their team). Capability keys are checked
in one oRPC middleware beside the existing `requireAuth` in `api/src/server/orpc.ts`, so the check sits
exactly where the session already resolves.

Znuny's `acl` / `acl_ticket_attribute_relations` gives field-level control — which fields are editable
in which state, by whom. Richer, and deferred until something needs it.

**What does not change.** Axel still holds no credentials and still asks the API for every side effect.
RBAC governs humans calling oRPC procedures. The gRPC gateways are a separate boundary and this
document does not touch them.

---

## 4. Milestones

Dependency-ordered across tiers. Each names the component that owns the work; nothing here plans edits
inside another component's directory. Milestones map onto the five plans as noted in §5.

### T0.1 — Identity split and roles

**Component:** `api` · **Files:** `src/db/schema/auth.ts`, new `src/db/schema/rbac.ts`,
`src/server/orpc.ts`, `src/contracts/index.ts`

Split staff from requesters, following FreeITSM's `analysts` / `users` separation — as a `kind`
discriminator on the Better Auth `user` table rather than two tables, because Better Auth owns that
table and forking it costs more than it returns. Add `teams`, `departments`, and the membership links.

Add `roles`, `role_capabilities`, `user_roles`, `team_roles`, transcribed from FreeITSM's
`rbac_*` schema. Capability keys are namespaced strings (`ticket.close`, `change.approve`,
`knowledge.publish`). Add a `requireCapability(key)` middleware beside `requireAuth` in
`src/server/orpc.ts` and apply it to every procedure.

**Done when:** a user without `ticket.close` receives `FORBIDDEN` from `updateTicket` with
`action: "close"`, and every procedure in the contract names the capability it requires.

### T1.1 — Status as data

**Component:** `api` · **Files:** `src/db/schema/tickets.ts`, new `src/db/schema/vocabulary.ts`,
`src/shared/index.ts`, `src/contracts/index.ts`

`TICKET_STATUSES` in `api/src/shared/index.ts` becomes a `ticket_statuses` table whose rows carry
`state_type` (Znuny's seven meta-types), `is_closed`, `pauses_sla`, `is_default`, `colour`,
`display_order`, `is_active`. Behaviour keys off `state_type`, never off a name, because names become
user-configurable the moment they are rows.

The six current statuses seed it. The transition table from [api.md](api.md) milestone C moves into
`ticket_status_transitions` rows so the state machine is data too.

This is the highest-leverage change in the document: SLA pausing (T1.3), escalation (T1.5), the queue
(dashboard) and every report key off status behaviour, and all of them are wrong if status is a string.

**Done when:** renaming a status in the database changes every UI label with no code change, and
setting `pauses_sla` on it visibly stops the TTR clock.

### T1.2 — Business-hours calendars

**Component:** `api` · **Files:** new `src/db/schema/calendars.ts`, new `src/server/sla/calendar.ts`

Transcribe FreeITSM's `sla_calendars` + `sla_calendar_hours` (weekday, start, end) +
`sla_calendar_holidays`. Implement `elapsedWorkingMinutes(from, to, calendarId)` and
`addWorkingMinutes(from, minutes, calendarId)` — the two functions everything else in Tier 1 calls.

**Done when:** a ticket opened 16:00 Friday under a 09:00–17:00 Mon–Fri calendar has one working hour
elapsed by 10:00 Monday, and a seeded holiday shifts it correctly.

### T1.3 — SLA and OLA stopwatches

**Component:** `api` · **Files:** new `src/db/schema/sla.ts`, new `src/server/sla/stopwatch.ts`,
`src/server/tickets.ts`

Model TTO and TTR as **stopwatches**, following iTop: each stores accumulated working time, a running
flag, and a start point; a status whose `pauses_sla` is set stops it; the deadline is derived, never
stored. A stored deadline cannot express a pause, which is why this shape rather than a timestamp
column.

Both SLA (customer-facing) and OLA (internal) per GLPI, each with a TTO and a TTR target, resolved
from priority first and overridable per team. Targets live in `slas` / `olas` / `slts`.

**Done when:** a ticket moved to a pending status and back shows TTR elapsed excluding the pause and
excluding non-working hours, and its OLA and SLA deadlines differ.

### T1.4 — Breach detection and escalation

**Component:** `api`, `dashboard` · **Files:** new `src/server/sla/sweep.ts`, `src/db/schema/sla.ts`

A periodic sweep — reusing the interval pattern already in `Gateway.sweep()` in
`api/src/server/grpc.ts` — marks warning and breach thresholds, writes `escalation_flag` and
`escalation_reason` onto the ticket (iTop's fields), and fires notification rules transcribed from
FreeITSM's `sla_notification_rules`. GLPI's `SlaLevel` ladder — several rungs, each with criteria and
actions — is the second increment.

**Done when:** a ticket left untouched past its TTO shows as escalated in the dashboard queue without
anyone touching it, and the reason names which target was missed.

### T1.5 — Pending, resolution codes, linkage, merge

**Component:** `api`, `dashboard`, `portal` · **Files:** `src/db/schema/tickets.ts`,
`src/server/tickets.ts`, `src/contracts/index.ts`

Four related additions, grouped because they all extend the ticket record and the transition table:

- **Pending** — a `pending` status backed by `pending_reasons` rows carrying `followup_frequency` and
  `followups_before_resolution` (GLPI). Pending chases itself and auto-resolves rather than rotting.
- **Resolution** — `resolution_code` enum plus the existing free-text `resolution` as `solution`.
  Adopt iTop's codes: `fixed`, `workaround`, `not_reproducible`, `duplicate`, `no_action_required`,
  `rejected`.
- **Linkage** — `ticket_links` with `relation_type` (`duplicate_of`, `related_to`, `caused_by`,
  `parent_of`), transcribed from FreeITSM.
- **Merge** — `ticket_merges` with `merged_into_id` on the ticket, and undo. Note FreeITSM's decision,
  worth copying exactly: merged-ness is its own column, never a status, because statuses are
  user-configurable and behaviour must not depend on one existing.

**Done when:** a ticket can be paused with a reason and comes back on its own; a resolution carries a
code; two tickets can be linked and one merged into the other and un-merged.

### T1.6 — Audit, case log, time, references

**Component:** `api`, `dashboard`, `portal` · **Files:** new `src/db/schema/journal.ts`,
`src/server/tickets.ts`

- **`ticket_audit`** — field, old value, new value, actor, timestamp. Transcribed from FreeITSM.
  Distinct from `agent_steps`, which is Axel's reasoning; this is who changed what.
- **Case log** — `ticket_messages` with `visibility` (`public` | `private`), following iTop's
  `public_log` / `private_log` split. This is the human conversation Axiōma has no model for at all,
  and its public/private boundary is exactly the plain-language boundary
  [portal.md](portal.md) already draws: the portal reads public only.
- **`ticket_time_entries`** — minutes and a note per analyst.
- **Reference numbers** — `ticket_number_counters` + `ticket_number_history` + `ticket_prefixes`.
  Old numbers are retained for ever so a reply quoting one still lands correctly.

**Done when:** every human edit appears in the audit trail; a private note is invisible to the portal
in the network response, not merely in the UI; and a ticket displays `INC-2026-00042` rather than a
UUID fragment.

### T2.1 — Service catalogue and categories

**Component:** `api` · **Files:** new `src/db/schema/catalogue.ts`, `src/contracts/index.ts`

`service_families` → `services` → `service_subcategories` (iTop's shape), with `service_id` and
`service_subcategory_id` on every ticket. This supersedes the two-level `category`/`subcategory`
planned in [api.md](api.md) milestone A — that plan's shallow tree was the right MVP call and this is
its grown-up form; the migration is a widening, not a rewrite.

**Done when:** a ticket carries a service and subcategory drawn from the catalogue, and the SLA
resolved for it can differ per service.

### T2.2 — Problem Management and known errors

**Component:** `api`, `dashboard` · **Files:** new `src/db/schema/problems.ts`

Transcribe FreeITSM's `problems` (`root_cause`, `workaround`, `is_known_error`, `problem_number`),
`problem_tickets`, `problem_notes`, `problem_statuses`, `problem_audit`. A problem groups incidents; a
known error carries a workaround that can be offered before anyone diagnoses anything.

This is where Axel becomes materially better rather than merely faster: a known error with a workaround
is a resolution Axel can apply on evidence alone, with no model reasoning about what to try.

**Done when:** three incidents can be grouped under one problem, and closing the problem with a
resolution offers it against every linked incident.

### T2.3 — Change Enablement

**Component:** `api`, `dashboard` · **Files:** new `src/db/schema/changes.ts`

Transcribe FreeITSM's `changes` with the full risk block (`risk_likelihood`, `risk_impact_score`,
`risk_score`, `risk_level`), `test_plan`, `rollback_plan`, the PIR fields, and `change_cab_members`
with per-member votes. iTop's `itop-change-mgmt-itil` supplies the state machine.

**This closes the honest gap [api.md](api.md) names**: `cluster.patch_image` is a standard change in
ITIL terms, and that plan says so while explicitly not governing it. With change records present, an
Axel patch can create one — recorded as a standard pre-approved change, so autonomy is preserved and
the change is auditable. That is the correct ITIL answer, not a contradiction of it.

**Done when:** an Axel-applied image patch produces a change record with a rollback plan naming the
previous image, and a CAB-required change cannot proceed until its required members have voted.

### T2.4 — Knowledge base

**Component:** `api`, `dashboard`, `portal` · **Files:** new `src/db/schema/knowledge.ts`

Transcribe `knowledge_articles`, `knowledge_folders`, `knowledge_acl`, `knowledge_article_versions`,
`knowledge_tags`. Keep the `embedding` column: FreeITSM already does vector search over articles, and
Axel reading the KB before diagnosing is the cheapest accuracy improvement available anywhere in this
document.

Also adopt `knowledge_gap_clusters` — tickets with no matching article are clustered, so the KB grows
from what people actually ask rather than from what someone imagined they would.

**Done when:** Axel retrieves a relevant article before its first tool call, the portal can show an
article to a requester, and a week of tickets produces at least one gap cluster.

### T2.5 — Request catalogue and approvals

**Component:** `api`, `portal`, `dashboard` · **Files:** new `src/db/schema/forms.ts`,
new `src/db/schema/approvals.ts`

`forms` + `form_fields` + `form_submissions` (FreeITSM) give a request catalogue with typed,
conditional, versioned fields — the structured counterpart to the free-text ticket the portal opens
today. `approvals` follows iTop's `waiting_for_approval` / `approved` / `rejected` states with an
`approver_id`, gated by the Tier 0 capability keys.

**Done when:** a "new laptop" request renders as a typed form, routes to an approver, and cannot
proceed while rejected.

### T3.1 — CMDB metamodel and impact analysis

**Component:** `api`, `dashboard` · **Files:** `src/db/schema/cmdb.ts`, new
`src/server/cmdb/impact.ts`

Replace the five-value `kind` string on `cmdb_items` with FreeITSM's metamodel: `cmdb_classes` →
`cmdb_class_properties` (including `spreads_impact`) → `cmdb_objects` → `cmdb_object_properties`, and
`cmdb_relationship_types` (`verb`, `inverse_verb`, `impact_direction`) →
`cmdb_object_relationships`.

Seed the classes from iTop's taxonomy — `FunctionalCI`, `Server`, `PC`, `NetworkDevice`,
`ApplicationSolution`, `BusinessProcess`, `Software`, `Subnet` — reimplemented as seed rows, not
copied code.

Keep the four provenance columns exactly as they are. They are the part `architecture.md` correctly
identifies as expensive to add later, they already exist, and nothing in this milestone touches them.

Impact analysis is a traversal over relationships where `impact_direction` and `spreads_impact` permit
it, answering "what else breaks if this breaks". Link tickets to CIs via `ticket_cmdb_objects`.

**Done when:** a new CI class can be defined through the API with no migration; a deployment CI linked
to a business process reports that process as impacted; and a ticket can name the CI it is about.

### T3.2 — Business rules before the model

**Component:** `api`, `agent` · **Files:** new `src/db/schema/rules.ts`, new `src/server/rules/`

A criteria/action engine following GLPI's `RuleTicket`: ordered rules, each with criteria (service,
category, urgency, impact, requester, requester's department, origin, keyword) and actions (set
category, urgency, impact, team, assignee, SLA, OLA, record type).

Rules run on ticket create, **before** dispatch to Axel. Whatever they settle, Axel does not have to
reason about. This is not a replacement for the agent and is not framed as one: it is the deterministic
floor beneath it. A rule is cheaper, instantaneous, auditable and explicable, and every classification
it makes is one the model does not spend tokens guessing.

The measurable effect is a drop in tokens per ticket with no drop in correctness. That number is worth
reporting, because it is the honest way to show what the agent is actually being used for.

**Done when:** a seeded rule set classifies a ticket without a model call, and a ticket the rules cannot
classify still reaches Axel with everything the rules did settle already filled in.

### T3.3 — Custom fields, workflows, webhooks, notifications

**Component:** `api`, `dashboard` · **Files:** new `src/db/schema/dynamic-fields.ts`,
`src/db/schema/workflows.ts`, `src/db/schema/notifications.ts`

- **Custom fields** — Znuny's `dynamic_field` / `dynamic_field_value` shape, reimplemented: a typed
  field definition bound to an object type, with values in a side table. No migration to add a field.
- **Workflows** — transcribe FreeITSM's `workflows` (`trigger_event`, `conditions`, `actions`) +
  `workflow_executions` + `workflow_scheduled_emissions`.
- **Webhooks** — `webhook_deliveries` + `webhook_message_formats` with HMAC signing and retries.
- **Notifications** — `notifications` with FreeITSM's `event_count` grouping, and its two rules worth
  copying verbatim: never notify someone of their own action, and collapse repeat changes to one record
  into a single entry. Those two rules are the difference between a notification feature people leave on
  and one they turn off.

**Done when:** a custom field added through the API appears on the ticket form with no deploy; a
workflow fires a webhook on ticket escalation and the delivery is visible with its response.

### T3.4 — Cross-record search and the public API

**Component:** `api`, `dashboard` · **Files:** new `src/db/schema/search.ts`, `src/server/search/`

FreeITSM's `search_documents` pattern — one index row per searchable record, refreshed on write — over
tickets, problems, changes, knowledge, CIs and assets, backing the ⌘K palette already planned in
[dashboard.md](dashboard.md) milestone C. Postgres full-text is sufficient; the `embedding` column on
knowledge articles handles semantic search where it matters.

Add `api_keys` + per-key capability grants + rate limits, reusing the Tier 0 capability vocabulary so
there is one permission model rather than two. The `OpenAPIHandler` at `/api-reference` already exists
in `api/src/index.ts`; this gives it authentication.

**Done when:** ⌘K finds a knowledge article, a CI and a ticket in one result set, and an API key scoped
to `ticket.read` cannot create a ticket.

### T4.1 — Email in and out

**Component:** `api` · **Files:** new `src/db/schema/mail.ts`, new `src/server/mail/`

Transcribe FreeITSM's inbound model — `target_mailboxes`, `emails`, `email_attachments`,
`mailbox_activity_log`, `freemail_domains` — including two decisions worth copying exactly: threading
matches on the ticket reference rather than the subject line, and each mailbox carries its own
`ticket_origin` so an alerting address and a helpdesk address are distinguishable.

Outbound: `email_send_log` recording every attempt with the provider's own failure text,
`ticket_email_templates` with `[ticket_url]` merge codes, and `ticket_email_template_rules` resolved by
**specificity, never by list order** — so there is no ordering to get wrong.

**Done when:** a reply to a notification lands on the right ticket as a public case-log entry, and a
failed send is visible in the log with the provider's reason.

### T4.2 — Assets, richer inventory, service status

**Component:** `api`, `cli`, `dashboard`, `portal` · **Files:** new `src/db/schema/assets.ts`,
`src/db/schema/status.ts`; in `cli`, `internal/device/facets_windows.go`

- **Assets** — `assets`, `asset_types`, `asset_locations`, `asset_status_types`, `asset_checkout_log`,
  `asset_history`, `users_assets`. A `device` running axel-cli becomes one kind of asset rather than
  the only thing Axiōma knows about.
- **Inventory** — extend the facet set [cli.md](cli.md) milestone B defines, using FreeITSM's
  `asset_devices` / `asset_disks` / `asset_network_adapters` / `software_inventory_apps` as the target
  shape, and GLPI's `Agent` fields (`deviceid`, `tag`, `last_contact`, `useragent`, `remote_addr`) as
  the reference for what a mature agent reports. This widens `cli.md` milestone B rather than replacing
  it.
- **Service status** — `status_services` + `status_incidents` + `status_incident_updates`, deriving
  availability from incidents already recorded rather than from a separate monitor. Fits Axiōma exactly,
  because `idea.md` puts proactive monitoring out of scope and this needs none.

**Done when:** a laptop appears as an asset with custody history; a device reports structured disk,
adapter and software inventory; and the portal shows a service availability strip computed from real
incidents.

### T4.3 — Remaining operational surface

**Component:** `api`, `dashboard`, `portal`

Grouped because each is small and independent: attachments with an extension allow-list and
inherited visibility (4.13); scheduled work and rotas (4.11); snooze as a computed comparison, never a
status (4.12); CSAT (1.17); suppliers and contracts (4.10); dashboard widgets (4.8); SSO and directory
sync (4.14).

**Done when:** each is reachable from the UI that owns it and covered by the capability model.

---

## 5. Cross-component impact

### What this document adds to each of the five plans

| Plan | Milestones that gain scope | What changes |
|---|---|---|
| [api.md](api.md) | A (schema), B (contract), C (lifecycle) | Statuses become tables (T1.1). Category becomes the service catalogue (T2.1). `cmdb_items.kind` becomes the metamodel (T3.1). The transition table becomes rows. Every procedure gains a capability key (T0.1). The contract grows by roughly the same amount again. |
| [agent.md](agent.md) | D (prompt construction), C (verification) | The prompt gains service, known errors and retrieved knowledge (T2.2, T2.4). Rules run before Axel and pre-fill classification (T3.2). Axel gains a `knowledge.search` read tool and a `change.record` write tool whose verifying read is `change.read`. |
| [cli.md](cli.md) | B (action and facet set) | The facet set widens toward a real inventory report (T4.2). No change to the tiering or the daemon. |
| [dashboard.md](dashboard.md) | D (queue), E (detail), F (transcript), H (overview) | The queue gains SLA countdown, breach state and service columns. Detail gains the case log, audit trail, links, time entries and CI linkage. Four new record types get their own surfaces: problems, changes, knowledge, assets. |
| [portal.md](portal.md) | C (request form), D (progress), E (confirmation) | The form becomes a request catalogue (T2.5). Progress gains an SLA-aware expectation. The public case log gives the employee a reply channel — the biggest single addition, and it stays inside the plain-language rule because private entries never reach this client. |

### New shared vocabulary

`api/src/shared/index.ts` currently holds const arrays. Most become database rows (T1.1, T2.1) and what
remains are the meta-types that carry behaviour: `STATE_TYPES`, `RESOLUTION_CODES`, `RELATION_TYPES`,
`CAPABILITY_KEYS`. The contract's own duplicated enums — forced by the `@orpc/contract` + `zod`-only
import rule, as [api.md](api.md) explains — shrink correspondingly, because a value that is a row is
fetched, not enumerated.

### What deliberately does not change

- Axel still holds no credentials. Every new capability is a new tool request the API executes.
- `api/proto/axioma.proto` needs no change for any milestone here. The agent and device boundaries are
  unaffected by everything in Tiers 1–4 except T4.2, which extends existing device parameters rather
  than the message shapes.
- The contract still imports only `@orpc/contract` and `zod`.
- `src/sdk/contracts/` in either frontend is still generated and never edited.

---

## 6. Decisions taken

**Lift only from FreeITSM.** MIT permits transcription with attribution. iTop is AGPL-3.0 and GLPI and
Znuny are GPL-3.0; copying their code into Axiōma would place a copyleft obligation on the whole
system. Reading their design and writing our own does not. Every row in §2 is tagged, and every `lift`
row is FreeITSM. Where we transcribe, the source file is credited in a comment on the schema module.

**Status becomes data with a behavioural meta-type.** Znuny's `ticket_state_type` is the better half of
the idea: names are configurable, behaviour hangs off a fixed set of seven types. FreeITSM's flags
(`is_closed`, `pauses_sla`) are the liftable half. Combined, behaviour never keys off a name — which is
the mistake every ITSM system makes once and then spends years unwinding. FreeITSM's own `merged_into_id`
comment makes this point explicitly, and is worth following exactly.

**SLA is a stopwatch, not a deadline.** iTop and GLPI independently arrived at accumulated-elapsed-time
with a pause. A stored deadline column cannot express "paused for two days awaiting the customer", and
every attempt to patch one into doing so ends up recomputing it on every read anyway.

**OLA alongside SLA.** GLPI keeps internal targets separate from customer-facing ones. For Axiōma this
is not bookkeeping: the OLA is the target Axel is measured against, the SLA is what the employee was
promised, and the gap between them is the only honest measure of what autonomous resolution is worth.

**RBAC is a prerequisite, reversing `architecture.md`.** Argued in full in §3. Short form: several
adopted features record decisions that nobody is authorised to make, and a feature like that is theatre.

**The CMDB metamodel comes from FreeITSM, the taxonomy from iTop.** FreeITSM's `cmdb_classes` is
liftable and user-extensible; iTop's `FunctionalCI` hierarchy is a better-designed taxonomy than either
of us would write from scratch. Take the schema from the one we may copy and the class list from the
one we may only read — the class list is seed data, which is a model, not code.

**Rules run before the model, not instead of it.** GLPI's `RuleTicket` handles the deterministic
majority — this requester's department always routes here, this keyword is always that category. Axel
handles what rules cannot express. Framing this as competition would be wrong: the rules engine makes
the agent's contribution *measurable*, because what remains after the rules is exactly the work that
needed judgement.

**Change records make Axel's patches auditable without gating them.** [api.md](api.md) admits that
`cluster.patch_image` is a change in ITIL terms and that Axiōma governs no changes. Rather than adding
an approval gate that would destroy autonomy, Axel's patch creates a **standard pre-approved change**
record with a rollback plan naming the previous image. That is what ITIL actually prescribes for a
low-risk repeatable change, and it converts an admitted gap into a correct answer.

**Adopt the case log, and keep its public/private split as the portal boundary.** Axiōma has an agent
transcript and no human conversation model at all. iTop's `public_log` / `private_log` distinction maps
exactly onto the boundary [portal.md](portal.md) already draws — and shaping the data, rather than
filtering in the client, is the same argument that plan already makes for `getMyTicket`.

**Do not adopt Znuny's process management (`pm_process` / `pm_activity` / `pm_transition`).**
Process-driven tickets and an autonomous agent are two answers to the same question — "what happens
next on this ticket" — and Axiōma has chosen one. Adopting both would produce a system where a
human-authored flowchart and a reasoning agent both believe they own the next step.

**Do not adopt multi-tenancy yet, and say what that costs.** FreeITSM carries `tenant_id` on nearly
every table plus `analyst_tenant_access`, `team_tenant_access` and `tenant_domains`. `idea.md` puts
multi-tenancy out of scope and that stands. The cost of deferring is real and is stated here rather
than discovered later: retrofitting it is a column on every table, a predicate on every query, and a
review of every index. If there is any chance of an MSP deployment, adding the column now — nullable,
unused, indexed — is far cheaper than adding it later, and that is the one hedge worth considering.

**Do not adopt the LMS, War Room, Process Mapper, RFP Builder or System Wiki.** They are real modules in
FreeITSM and they are not IT service management. Listing them here as consciously declined is more
useful than omitting them and leaving someone to wonder.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| The scope in this document is several times the MVP, and starting it before the three scenarios work would sink both. | Tier 0 and Tier 1 are sequenced to begin **after** the five component plans reach their definition of done. The one exception is T1.1 (status as data), which should land during [api.md](api.md) milestone A, because converting statuses to rows after the contract and both frontends are built costs several times more than doing it once. |
| Transcribing FreeITSM's schema imports its assumptions — MySQL types, its own conventions, decisions we might not share. | Transcribe the *model* — column meanings, flags, relationships — not the DDL verbatim. Types map to Postgres and Drizzle conventions. Every schema module names the FreeITSM table it came from in a comment, so a later reader can check the original and the attribution is discharged in the same stroke. |
| RBAC reverses a stated architecture decision, and reversing decisions mid-build is how systems acquire two half-models. | `architecture.md` is updated in the same change, not contradicted silently. One middleware beside the existing `requireAuth` in `api/src/server/orpc.ts`, one capability vocabulary shared with API keys. If it is not done in one pass it should not be started. |
| Four new record types (problem, change, knowledge, asset) multiply the contract, the schema and both frontends, and the contract is mirrored verbatim into two projects with no database. | Each record type lands complete across schema → contract → publish → both frontends before the next begins. A half-landed record type breaks three components' gates at once. |
| The business-rules engine and Axel can disagree, and a ticket classified twice is worse than one classified once. | Rules run once, on create, before dispatch. Axel receives what the rules decided as context it may override with a reason recorded in the transcript. One writer at a time, and the disagreement is visible when it happens. |
| The gap table is a shopping list, and shopping lists get worked top to bottom rather than by value. | The tiers are dependency-ordered, not preference-ordered: Tier 1 is what the existing schema already implies, and T1.1, T1.2 and T1.3 unblock most of the rest. Anything in Tier 4 can be dropped entirely without invalidating Tiers 0–3. |

---

## 8. Definition of done

**Tier 0**

1. Every oRPC procedure declares a capability key, and a user lacking it receives `FORBIDDEN`.
2. Staff and requesters are distinguishable, and a requester cannot read a private case-log entry — in
   the network response, not merely in the UI.

**Tier 1**

3. Renaming a status in the database changes every label with no code change; behaviour keys only off
   `state_type`.
4. A ticket opened outside working hours accrues no elapsed SLA time until the calendar opens.
5. TTO and TTR are stopwatches that pause on a pausing status; SLA and OLA deadlines are both derived
   and can differ.
6. A ticket past its target escalates on its own, with the missed target named.
7. Pending, resolution codes, ticket linkage, merge with undo, audit trail, public/private case log,
   time entries and human-readable references are all reachable from the dashboard.

**Tier 2**

8. Incidents group under a problem; a known error's workaround is offered against linked incidents.
9. An Axel-applied patch produces a standard pre-approved change record with a rollback plan.
10. A CAB-required change cannot proceed until required members have voted.
11. Axel retrieves a relevant knowledge article before its first tool call.
12. A catalogue request routes to an approver and cannot proceed while rejected.

**Tier 3**

13. A new CI class is definable through the API with no migration, and impact traversal names what
    else breaks.
14. A rule set classifies a ticket with no model call; tokens per ticket measurably fall with no drop
    in correctness.
15. A custom field appears on a form with no deploy; a workflow fires a webhook and its delivery is
    visible.
16. ⌘K returns a ticket, a knowledge article and a CI in one result set; an API key scoped to read
    cannot write.

**Tier 4**

17. A reply to a notification email lands on the right ticket as a public case-log entry, and a failed
    send is visible with the provider's reason.
18. A laptop appears as an asset with custody history and structured inventory.
19. The portal shows service availability derived from recorded incidents.

**Throughout**

20. All five projects still pass their own lint and type gates.
21. No file copied from iTop, GLPI or Znuny exists anywhere in the repository; every transcribed
    FreeITSM schema module names its source table in a comment.
