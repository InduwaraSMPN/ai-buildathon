# Tier 3 — Extensible platform mechanics

**Document role:** Adoption plan for the machinery that lets the platform be changed without a deploy
**Parent:** [oss-adoption.md](../oss-adoption.md) · **Requires:** [tier-0.md](tier-0.md), [tier-1.md](tier-1.md), [tier-2.md](tier-2.md) · **Next:** [tier-4.md](tier-4.md)

Tiers 1 and 2 add records. This tier adds the mechanisms that make those records extensible by the
people running the system rather than by the people building it: a CMDB whose classes are data, fields
that need no migration, deterministic rules that run before the model, automation, search across
everything, and an API other systems can call.

---

## 1. Current state

### What the MVP already delivered against this tier

| Row | Status now | Evidence |
|---|---|---|
| 3.11 Saved searches and queue views | **Mostly done** | `dashboard/src/features/tickets/components/saved-view.tsx`, `queue-facet.tsx` and `queue-search.ts` with URL-synced state, backed by `listTickets`' ten filters and server-computed facets over five dimensions. Only per-analyst persistence is missing — the views are code constants, not rows. |
| 3.12 Cross-record search | **Partial — more than expected** | The ⌘K palette shipped: `components/layout/command-menu.tsx`, 138 lines, ⌘K/Ctrl-K bound, wired into `dashboard-layout.tsx`, with Views / Tickets / Devices groups. It queries `ticketQueries` and `deviceQueries` directly — there is no search index behind it, and it covers only the two record types that exist. |
| 3.1 / 3.2 CMDB | **Unchanged, and provenance is already right** | `cmdb_items` has `kind` (a five-value string), `externalId`, `name`, `attributes` (jsonb), `relatesToId`, `relationKind`, plus the four provenance columns. `architecture.md` calls provenance the only genuinely expensive part to add later, and it is already there. |

Everything else in this tier is unchanged.

### What exists that this tier builds on

- **The tool registry** — `api/src/server/tools/index.ts` maps seven names to `{ input, verifiedBy, run }`
  handlers with server-side zod validation and a `pendingVerification` map. Its shape is the model for
  how a rules engine and workflows should register actions.
- **`ticketStats`** — already reports `autonomousResolutionRate`, `autonomousClosed` and
  `medianTimeToResolutionMs`, computed from `lastHumanTransitionAt`. **This is the baseline the rules
  engine is measured against**, and it exists before the thing it measures, which is the right order.
- **`agent_steps`** with `toolName`, `toolInput`, `toolOutput` and `evidence` — the record of what Axel
  spent its reasoning on, and therefore the evidence for which decisions a rule could have made instead.
- **`Gateway.sweep()`** in `api/src/server/grpc.ts` — the proven periodic-task pattern, reused by
  [tier-1.md](tier-1.md) T1.D and again here.
- **The `OpenAPIHandler`** already mounted at `/api-reference` in `api/src/index.ts` with a reference
  plugin. The public API needs authentication and rate limiting, not a new surface.

### Gap rows this tier owns

| # | Capability | Axiōma today | Source model |
|---|---|---|---|
| 3.1 | User-definable CMDB classes | `cmdb_items.kind`, five values | FreeITSM `cmdb_classes` → `cmdb_class_properties` (`property_type`, `target_class_id`, `is_required`, `spreads_impact`) → `cmdb_objects` → `cmdb_object_properties` |
| 3.2 | Typed, directional relationships | `relatesToId` + `relationKind` free text | FreeITSM `cmdb_relationship_types` (`verb`, `inverse_verb`, `impact_direction`) + `cmdb_object_relationships` |
| 3.3 | Impact analysis | Nothing | Traversal over relationships where `impact_direction` and `spreads_impact` permit. iTop `itop-flow-map` renders the same traversal |
| 3.4 | A real CI taxonomy | Five `kind` values | iTop `itop-config-mgmt`: `FunctionalCI → PhysicalDevice / ConnectableCI → Server, NetworkDevice, PC`, plus `ApplicationSolution`, `BusinessProcess`, `Software`, `SoftwareInstance`, `DBServer`, `Subnet`, `VLAN`, `IPInterface`, `Location`, `OSVersion` |
| 3.5 | Ticket ↔ CI linkage | Nothing | FreeITSM `ticket_cmdb_objects`, `ticket_assets`. iTop `itop-bridge-cmdb-ticket` |
| 3.6 | Custom fields on any record | Nothing; every field needs a migration | Znuny `dynamic_field` (`field_type`, `object_type`, `config`) + `dynamic_field_value`. FreeITSM `asset_fields` / `asset_field_values` / `asset_field_sets` is the asset-scoped version |
| 3.7 | Business-rules engine | Nothing — every routing decision costs a model call | GLPI `RuleTicket` / `RuleTicketCollection`: criteria (requester, category, urgency, impact, location, mail source, subject) → actions (assign group/user, set category, urgency, impact, priority, SLA/OLA, TTO/TTR, type) |
| 3.8 | Workflow automation | Nothing | FreeITSM `workflows` (`trigger_event`, `conditions`, `actions`, `last_run_status`) + `workflow_executions` + `workflow_scheduled_emissions`. Znuny `generic_agent_jobs` |
| 3.9 | Outbound webhooks | Nothing | FreeITSM `webhook_deliveries` + `webhook_message_formats` — HMAC signing, retries, delivery dashboard |
| 3.10 | Notification engine | Toasts only | FreeITSM `notifications` with `event_count` grouping. Znuny `notification_event` / `notification_event_item` / `notification_event_message` |
| 3.11 | Saved searches | Mostly done, not persisted | Znuny `personal_queues` / `personal_services`. FreeITSM `watchtower_items` |
| 3.12 | Cross-record search | ⌘K palette shipped, but backed by two direct queries over tickets and devices — no index, no other record types | FreeITSM `search_documents` + `attachment_text` + `document_text` |
| 3.13 | REST API for third parties | oRPC for our own frontends only | FreeITSM `api_keys` + `api_key_rate_limits` + `api_rate_limits` |

---

## 2. Gaps

1. The CMDB models five kinds of thing and cannot describe a sixth without a migration.
2. Relationships are untyped and undirected, so nothing can answer "what breaks if this breaks".
3. Tickets cannot name the configuration item they are about.
4. Every new field is a schema change, a migration, a contract publish and two frontend edits.
5. Every classification decision costs a model call, including the ones that are pure lookup.
6. Nothing happens automatically on an event, so every follow-up is manual.
7. Nothing outside Axiōma can be told that something happened.
8. Notifications do not exist.
9. Saved views are code, so an analyst cannot keep their own.
10. Search covers tickets only, through one `search` filter on `listTickets`.
11. No third party can call the API.

---

## 3. Milestones

### T3.A — CMDB metamodel

**Files:** `api/src/db/schema/cmdb.ts`, `api/src/server/tools/cmdb.ts`, `api/src/contracts/index.ts`,
migration.

Replace `cmdb_items.kind` with FreeITSM's metamodel: `cmdb_classes` → `cmdb_class_properties`
(`property_key`, `label`, `property_type`, `target_class_id`, `is_required`, `spreads_impact`) →
`cmdb_objects` → `cmdb_object_properties`, and `cmdb_relationship_types` (`verb`, `inverse_verb`,
`impact_direction`) → `cmdb_object_relationships`.

**Keep the four provenance columns exactly as they are.** They already carry ticket, run, step and
observation time on every row, and `architecture.md` identifies that as the one part of a governed CMDB
that is genuinely expensive to add later. Nothing in this milestone touches them; the migration carries
them across.

Seed the classes from iTop's taxonomy — `FunctionalCI`, `Server`, `PC`, `NetworkDevice`,
`ApplicationSolution`, `BusinessProcess`, `Software`, `SoftwareInstance`, `Subnet` — as seed rows. The
five existing `kind` values map onto them so no observation is orphaned.

`cmdb_record_observation` in `api/src/server/tools/cmdb.ts` and its counterpart in `agent/axel/tools.py`
change shape: `kind` becomes `class_key`, and `attributes` are validated against the class's declared
properties rather than accepted as free jsonb. An observation naming an unknown class returns a
structured error the agent treats as an observation, which is the recovery path the loop already has.

**Done when:** a new CI class is definable through the API with no migration; every existing
`cmdb_items` row survives with its provenance intact; and an observation against an undeclared property
is rejected with a message naming the class.

### T3.B — Impact analysis and ticket ↔ CI linkage

**Files:** new `api/src/server/cmdb/impact.ts`, new `api/src/db/schema/cmdb-links.ts`,
`api/src/contracts/index.ts`, `dashboard/src/features/tickets/components/ticket-detail.tsx`.

Impact traversal: from a CI, follow relationships where `impact_direction` and the property's
`spreads_impact` permit, breadth-first with a depth ceiling and cycle detection, answering "what else
breaks if this breaks". iTop renders the same traversal as a flow map.

`ticket_cmdb_objects` links tickets to CIs. Axel populates it — it already records observations against
the deployment it is diagnosing, so the link is a by-product of work it already does.

**Done when:** a deployment CI linked to a business process reports that process as impacted; a cyclic
relationship graph terminates; and a ticket names the CI it is about, set by Axel without a human.

### T3.C — Rules before the model

**Files:** new `api/src/db/schema/rules.ts`, new `api/src/server/rules/`, `api/src/server/routers/index.ts`,
migration.

A criteria/action engine following GLPI's `RuleTicket`: ordered rules, each with criteria (service,
category, requester, requester's department, record type, origin, title/body keyword) and actions (set
service, category, impact, urgency, team, assignee, SLA, OLA, record type, route).

Rules run **on ticket create, before dispatch to Axel**, in `createTicket` where `derivePriority` is
already called. Whatever they settle, Axel does not reason about — and what they settle arrives in
`StartRun` as context.

**This is not a replacement for the agent and must not be framed as one.** It is the deterministic
floor beneath it. A rule is instant, free, auditable and explicable; a model call is none of those. The
agent's job is what rules cannot express, and after this milestone that is exactly what it gets.

**The effect is measurable because the baseline already exists.** `ticketStats` reports
`autonomousResolutionRate` today, and `agent_runs` carries `promptTokens` and `completionTokens`.
Record tokens-per-ticket before and after: the target is a fall in tokens with no fall in the autonomous
rate. Report both numbers honestly, including if the rules turn out to settle less than expected.

Every rule firing writes to the audit from [tier-1.md](tier-1.md) T1.J, so a classification can always
be traced to the rule that made it.

**Done when:** a seeded rule set classifies a ticket with no model call; a ticket the rules cannot
classify reaches Axel with whatever they did settle already filled in; and tokens-per-ticket is
reported before and after against an unchanged autonomous rate.

### T3.D — Custom fields

**Files:** new `api/src/db/schema/dynamic-fields.ts`, `api/src/contracts/index.ts`,
`dashboard/src/features/`, `portal/src/features/`, migration.

Znuny's shape, reimplemented: `dynamic_fields` (`key`, `label`, `field_type`, `object_type`, `config`,
`display_order`, `is_active`) and `dynamic_field_values` (`field_id`, `object_id`, `value`). Field types:
text, textarea, integer, date, datetime, dropdown, multiselect, checkbox, reference.

**A field is retired, never deleted** — FreeITSM's rule, and it is the right one: everything recorded
against a field survives and returns if the field is reinstated.

The contract exposes them as an untyped `customFields: Record<string, unknown>` on each record plus a
`listFieldDefinitions` procedure. This is a deliberate hole in the type safety the rest of the contract
provides, and §5 argues why it is worth it.

**Done when:** a field added through the API appears on the relevant form in both frontends with no
deploy; a retired field's recorded values survive and return on reinstatement.

### T3.E — Workflows, webhooks, notifications

**Files:** new `api/src/db/schema/workflows.ts`, `api/src/db/schema/notifications.ts`,
new `api/src/server/workflows/`, `dashboard/src/features/`, migration.

- **Workflows** — `workflows` (`trigger_event`, `conditions`, `actions`, `is_active`,
  `last_run_status`) + `workflow_executions` + `workflow_scheduled_emissions`, from FreeITSM. Triggers
  are the lifecycle events that already exist as `ticket_transitions` rows plus the SLA events from
  [tier-1.md](tier-1.md) T1.D. Actions reuse the rules engine's action vocabulary from T3.C — one
  action set, two ways of firing it.
- **Webhooks** — `webhook_deliveries` + `webhook_message_formats` with HMAC signing, bounded retries
  with backoff, and a delivery view showing the response.
- **Notifications** — `notifications` with FreeITSM's `event_count`. Two of its rules are worth copying
  verbatim, because they are the difference between a notification feature people leave on and one they
  mute: **never notify someone about their own action**, and **collapse repeat changes to one record
  into a single entry**.

**Done when:** a workflow fires a webhook on SLA breach and the delivery with its response is visible;
a notification for someone's own action is never created; and five edits to one ticket produce one
notification with a count of five.

### T3.F — Persisted views and cross-record search

**Files:** new `api/src/db/schema/views.ts`, new `api/src/db/schema/search.ts`,
new `api/src/server/search/`, `dashboard/src/features/tickets/components/saved-view.tsx`,
`dashboard/src/components/layout/command-menu.tsx`.

Saved views become rows — the search-param combination `saved-view.tsx` already builds, stored per
person and optionally shared with a team. The component keeps its shape; only its source changes.

`search_documents`, from FreeITSM: one index row per searchable record (`object_type`, `object_id`,
`title`, `body`, `tsv`), refreshed on write, covering tickets, problems, changes, knowledge, CIs and —
after [tier-4.md](tier-4.md) — assets. Postgres full-text is sufficient; knowledge keeps its `embedding`
for semantic search where it matters.

**The ⌘K palette already exists and is extended here, not built.**
`dashboard/src/components/layout/command-menu.tsx` shipped with the MVP: 138 lines, bound to ⌘K and
Ctrl-K, wired into `dashboard-layout.tsx`, with three groups — Views, Tickets, Devices — querying
`ticketQueries` and `deviceQueries` directly and navigating on select. What it cannot do is search
anything else, because nothing else exists yet. This milestone swaps its two direct queries for one
`search` procedure over `search_documents` and adds groups for problems, changes, knowledge and CIs as
[tier-2.md](tier-2.md) and T3.A land them. Its keybinding, its shape and its navigation stay.

**Done when:** an analyst saves a view and finds it after signing in elsewhere; ⌘K returns a ticket, a
knowledge article and a CI in one result set from a single query, scoped to what the viewer may see.

### T3.G — Public API

**Files:** new `api/src/db/schema/api-keys.ts`, `api/src/index.ts`, `api/src/server/context.ts`,
migration.

`api_keys` with a hashed secret, an owner, an expiry and **a set of capability keys drawn from
[tier-0.md](tier-0.md)'s vocabulary** — one permission model, not two. Rate limits per key and globally,
following `api_key_rate_limits` / `api_rate_limits`.

`createContext` resolves either a session or an API key into the same capability set, so every procedure's
existing `requireCapability` check works unchanged for both callers. The `OpenAPIHandler` at
`/api-reference` already generates the spec.

**Done when:** a key scoped to `ticket.read.own` cannot create a ticket; rate limits return 429 with a
retry hint; and the generated OpenAPI spec lists every procedure with its required capability.

---

## 4. Cross-component impact

| Component | Impact |
|---|---|
| `api` | Seven new schema modules; `cmdb.ts` is rewritten; `createContext` accepts two credential kinds; `createTicket` gains a rules pass. |
| `agent` | `cmdb_record_observation` changes shape (`kind` → `class_key`, validated properties) in `agent/axel/tools.py`. Axel gains `cmdb_impact` as a read tool — knowing what else a failing CI affects is diagnostic evidence. `StartRun.context_json` carries what the rules already settled. |
| `dashboard` | CMDB browser and impact view; rules and workflow admin; notification centre; the existing ⌘K palette is re-pointed at the search index and gains groups; saved views become server-backed; custom fields render dynamically. |
| `portal` | Custom fields on the request form; notifications. |
| `cli` | **None** in this tier. |

**Requires:** [tier-0.md](tier-0.md) capability vocabulary for T3.G; [tier-1.md](tier-1.md) T1.J audit
for rule attribution and T1.D's sweep pattern; [tier-2.md](tier-2.md) service catalogue as a rule
criterion and knowledge as a search corpus.
**Required by:** [tier-4.md](tier-4.md) — email ingestion fires rules, assets extend the CMDB
metamodel, and inbound mail uses the notification engine.

---

## 5. Decisions taken

**Rules run before the model, never instead of it.** Framing this as competition would be wrong. The
rules engine makes the agent's contribution *measurable*, because what remains after the rules is
exactly the work that needed judgement. The instrumentation to prove it — `ticketStats`'
`autonomousResolutionRate` and `agent_runs`' token counts — already exists, which is why the claim can
be checked rather than asserted.

**Rule firings are audited like human edits.** A classification nobody can explain is worse than one
nobody made. T1.J's audit table takes rule attributions as a third actor type beside `human` and
`agent`.

**The CMDB metamodel replaces `kind`; provenance is untouched.** The four provenance columns are the
part `architecture.md` says is expensive to add later, they are already correct, and this milestone
carries them across without modification.

**Take the taxonomy as seed data, not as structure.** iTop's `FunctionalCI` hierarchy is better than one
we would invent, and seeding it as rows means an installation can diverge from it without a code change.

**Custom fields are deliberately untyped at the contract boundary.** Everything else in
`contracts/index.ts` is precisely typed, and `customFields: Record<string, unknown>` is a hole in that.
It is worth it: the alternative is a migration, a contract publish and two frontend edits for every
field a customer wants, which is the cost this milestone exists to remove. The hole is contained to one
property on each record, and `listFieldDefinitions` gives the frontend enough to render and validate at
runtime.

**One action vocabulary for rules and workflows.** They differ in when they fire, not in what they can
do. Two vocabularies would drift within a release.

**One permission model for sessions and API keys.** Reusing [tier-0.md](tier-0.md)'s capability keys
means an API key cannot acquire a permission a role cannot express, and there is one place to reason
about access.

**Never notify someone about their own action; collapse repeats.** Copied verbatim from FreeITSM's
notification rules. These are not polish — a notification feature that violates either is muted within a
week, and then the SLA breach nobody sees is the one that matters.

**Fields are retired, not deleted.** Recorded values outlive the decision to stop collecting them.

**The ⌘K palette is extended, not rebuilt.** [dashboard.md](../../completed/dashboard.md) milestone C
planned it and it shipped — keybinding, groups, navigation and all. Only its data source changes: two
direct queries become one indexed `search` procedure, which is what lets it cover record types the MVP
had no model for. Replacing a working component to change where it gets its rows would be waste.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Rewriting `cmdb_items` risks the provenance data that `architecture.md` calls the expensive part. | The migration carries `sourceTicketId`, `sourceRunId`, `sourceStepId` and `observedAt` across unchanged and maps all five `kind` values to seeded classes. Verify by row count and by spot-checking that a pre-migration observation still resolves to its run and step. |
| A rules engine that misclassifies is worse than no rules, because it does so silently and at scale. | Rules are ordered, first-match-wins per action, every firing is audited, and Axel may override with a reason recorded in the transcript. Ship with a small seeded set and grow it from evidence in `agent_steps` about what the model was actually spending calls on. |
| Custom fields punch a hole in the contract's type safety, and holes widen. | Contained to one `customFields` property per record and one `listFieldDefinitions` procedure. No other part of the contract loosens. Reviewed as a deliberate exception, documented here. |
| Workflows plus webhooks plus rules is three ways for the system to act on its own; a loop between them is possible. | Workflows cannot trigger workflows. Rules run once, on create. Webhook deliveries are bounded and retried with backoff, and every execution is recorded in `workflow_executions` so a loop is visible immediately. |
| Search indexing on every write adds latency to the hot path and can drift from the records. | Index writes are best-effort and out-of-band; a failed index write logs and does not fail the request. A periodic reconciliation over recently-changed records repairs drift, reusing T1.D's sweep. |
| API keys widen the attack surface on a system that until [tier-0.md](tier-0.md) had no authorization at all. | Keys are hashed at rest, scoped to capabilities rather than roles, expire by default, and are rate limited per key and globally. No key can hold a capability its issuer does not have. |

---

## 7. Definition of done

1. All five components' gates pass.
2. A new CI class is definable through the API with no migration; every pre-existing `cmdb_items` row
   survives with provenance intact.
3. An observation against an undeclared property is rejected with a message naming the class, and Axel
   recovers from it inside its budget.
4. A deployment CI linked to a business process reports that process as impacted; a cyclic graph
   terminates.
5. A ticket names its CI, set by Axel without human action.
6. A seeded rule set classifies a ticket with no model call, and every firing is attributable to a rule
   in the audit trail.
7. Tokens-per-ticket before and after the rules engine are both reported, against an unchanged
   autonomous resolution rate.
8. A custom field added through the API renders in both frontends with no deploy; a retired field's
   values survive and return.
9. A workflow fires a webhook on SLA breach; the delivery and its response are visible.
10. No notification is created for the actor's own action; five edits to one ticket produce one
    notification with a count of five.
11. A saved view persists across sessions and machines.
12. ⌘K returns a ticket, a knowledge article and a CI in one result set, scoped to the viewer's
    capabilities.
13. An API key scoped to read cannot write; rate limits return 429; the OpenAPI spec lists every
    procedure with its capability.
