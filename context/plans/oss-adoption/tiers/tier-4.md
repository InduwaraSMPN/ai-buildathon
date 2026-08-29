# Tier 4 — Operational surface

**Document role:** Adoption plan for the channels, registers and reporting a service desk runs on
**Parent:** [oss-adoption.md](../oss-adoption.md) · **Requires:** [tier-0.md](tier-0.md) – [tier-3.md](tier-3.md)

The widest tier and the furthest from Axiōma's autonomous-agent thesis. Everything here is what a
service desk needs to be usable by an organisation rather than demonstrable to a room: tickets that
arrive by email, an asset register, a status page, attachments, directory sync. Any single milestone
can be dropped without invalidating Tiers 0–3.

---

## 1. Current state

### What the MVP already delivered against this tier

| Row | Status now | Evidence |
|---|---|---|
| 4.8 Reporting and dashboards | **Mostly done** | `ticketStats` returns counts by status, priority and record type; open-by-priority; awaiting confirmation; escalated in 24h; closed total; autonomous closed and rate; a daily series of incidents, service requests, resolved and escalated; and median time to resolution. `dashboard/src/features/overview/` renders it. Only per-analyst configurable widgets are missing. |
| 4.6 Richer device inventory | **Partial** | `cli/internal/device/facets_windows.go` ships six structured facets — `resolver`, `adapters`, `reachability`, `proxy`, `identity`, `processes` — with an `_other.go` fallback per platform. Five typed actions ship. What is missing is *inventory*: disks, installed software, hardware. |
| 4.12 Snooze | **Unchanged** | Not present. [tier-1.md](tier-1.md) T1.E adds pending, which is adjacent but not the same thing. |

Everything else in this tier is unchanged: no email, no assets, no status page, no attachments, no
SSO, no directory sync, no multi-tenancy.

### What exists that this tier builds on

- **`devices`** with `enrolmentCode`, `enrolmentCodeExpiresAt`, `ownerId`, `hostname`, `username`,
  `platform`, `release`, `agentVersion`, `connected`, `lastSeenAt`, `enrolledAt`, and
  `device_commands` with a per-device monotonic sequence.
- **`enrollDevice` / `listMyDevices` / `listDeviceCommands`** in the contract, and
  `cli/internal/tui/enroll.go`.
- **`tickets.progressMarker`** — the closed six-value enum the portal renders. A status page and an
  email template both need surface-safe vocabulary, and this is the precedent for it.
- **The notification and webhook engines** from [tier-3.md](tier-3.md) T3.E, which outbound email
  becomes another delivery channel for rather than a parallel system.

### Gap rows this tier owns

4.1–4.15 in the parent table.

---

## 2. Gaps

1. Every ticket starts in the portal; email is not a channel.
2. No record of outbound mail, so "they never got a reply" is unanswerable.
3. No ticket origin, so an alerting address and a helpdesk address are indistinguishable.
4. The only things Axiōma knows about are machines running axel-cli.
5. No hardware or software inventory beyond six network-oriented facets.
6. Reporting is fixed; an IT lead cannot build a view.
7. No status page, so an outage is communicated by someone typing it somewhere else.
8. No suppliers or contracts.
9. No scheduled or recurring work, and no snooze.
10. Nothing can be attached to anything.
11. Local passwords only; no SSO, no directory import.
12. One organisation, with no path to a second.

---

## 3. Milestones

Ordered by value, and each is independently droppable.

### T4.A — Inbound email

**Files:** new `api/src/db/schema/mail.ts`, new `api/src/server/mail/`, `api/src/db/schema/tickets.ts`,
migration.

`mailboxes`, `inbound_emails`, `email_attachments`, `mailbox_activity_log`, from FreeITSM's
`target_mailboxes` / `emails` / `email_attachments` / `mailbox_activity_log`. Znuny models the same
inbound path as `mail_account` feeding `article`.

Two of FreeITSM's decisions are worth copying exactly:

- **Threading matches on the ticket reference, not the subject line.** [tier-1.md](tier-1.md) T1.K adds
  the reference and retains superseded numbers for ever precisely so this works after a merge or a
  renumber. Subject-line matching breaks on every "Re: Fwd:" and on every localised mail client.
- **Each mailbox carries its own default `ticket_origin`.** A helpdesk address and a monitoring alert
  address both arrive as email and are not the same source. `ticket_origins` (row 4.4) lands here
  rather than as a separate milestone.

An inbound message on an existing ticket becomes a **public** case-log entry ([tier-1.md](tier-1.md)
T1.I). A message with no matching reference creates a ticket, and the rules engine from
[tier-3.md](tier-3.md) T3.C classifies it before Axel sees it — which is exactly the case rules are best
at, since sender and subject are strong signals a model should not be paying to interpret.

**Done when:** a reply to a notification lands on the right ticket as a public case-log entry; an
unmatched message opens a ticket classified by rules; and the ticket records which mailbox and origin it
came from.

### T4.B — Outbound email

**Files:** `api/src/db/schema/mail.ts`, `api/src/server/mail/send.ts`, new
`api/src/db/schema/templates.ts`.

`email_send_log` recording every attempt — recipient, which subsystem sent it, and **the provider's own
words on failure**. FreeITSM's reasoning is worth repeating: a failed automated email is otherwise
visible only in a server log, so the first sign of one is someone saying they never got a reply.

`email_templates` with merge codes including a `[ticket_url]` that resolves to the reporter's own view,
and `email_template_rules` resolved **by specificity, never by list order** — an address beats a domain,
a domain beats the catch-all. There is then no ordering to get wrong and no drag-to-reorder that can
silently change what gets sent.

Outbound email is a delivery channel for the notification engine from [tier-3.md](tier-3.md) T3.E, not a
second notification system.

**Done when:** every send attempt is logged with its outcome; a failed send shows the provider's reason;
and a template scoped to a domain is chosen over the catch-all regardless of row order.

### T4.C — Asset register

**Files:** new `api/src/db/schema/assets.ts`, `api/src/contracts/index.ts`,
new `dashboard/src/features/assets/`, migration.

`assets`, `asset_types`, `asset_locations`, `asset_statuses`, `asset_checkout_log` (custody),
`asset_history`, from FreeITSM. A `device` running axel-cli becomes one kind of asset rather than the
only thing Axiōma knows about — the `devices` table stays as the connection record and gains an
`asset_id`.

Custom fields come from [tier-3.md](tier-3.md) T3.D rather than FreeITSM's asset-specific
`asset_fields`: one mechanism for every record type, not two.

CSV import with a preview that writes nothing, declared identity columns so re-importing updates rather
than duplicates, and rejected rows kept with the reason. All three are FreeITSM behaviours and all three
are the difference between an import people trust and one they run once.

**Done when:** a laptop appears as an asset with custody history; the same CSV imported twice updates
rather than duplicates; and rejected rows are inspectable with their reason.

### T4.D — Hardware and software inventory

**Files:** `cli/internal/device/facets_windows.go`, new `cli/internal/device/inventory_windows.go`,
`api/src/server/tools/device.ts`, new `api/src/db/schema/inventory.ts`, `agent/axel/tools.py`.

Extend the shipped six facets with `disks`, `hardware` and `software`, keeping the existing structure:
parsed named fields plus a bounded `raw`, per-platform files with an `_other.go` fallback. That shape is
already proven in `facets_windows.go` and is not being changed.

Landing tables follow FreeITSM's `asset_devices` / `asset_disks` / `asset_network_adapters` /
`software_inventory_apps`. GLPI's `Agent` is the reference for what a mature device agent records —
`deviceid`, `tag`, `last_contact`, `useragent`, `remote_addr`, and a polymorphic link to whatever item
it describes.

Inventory is reported on a schedule, not per ticket. A full software list on every `device_read_state`
would flood the transcript and the model context, and the facets exist to answer diagnostic questions
rather than to maintain a register.

**Done when:** a device reports disks, hardware and installed software on a schedule; the data lands on
the asset from T4.C; and no diagnostic `device_read_state` call returns a software list.

### T4.E — Service status

**Files:** new `api/src/db/schema/status.ts`, `api/src/contracts/index.ts`,
new `portal/src/features/status/`, migration.

`status_services`, `status_incidents`, `status_incident_updates`, `service_impact_levels`, from
FreeITSM. Availability is **derived from incidents already recorded**, not from a separate monitor —
which fits Axiōma exactly, because `idea.md` puts proactive detection out of scope and this needs none.

Which impact levels count as downtime is configurable; planned maintenance from
[tier-2.md](tier-2.md)'s changes is excluded by default.

The portal renders a day-by-day availability strip and uptime over 7/30/90 days. Employee-facing, so
every string goes through `portal/src/features/tickets/copy.ts` or a sibling module following the same
rule.

**Done when:** the portal shows availability computed from real incidents; a change window is excluded;
and an impact level's downtime setting visibly changes the strip.

### T4.F — Attachments

**Files:** new `api/src/db/schema/documents.ts`, `api/src/server/documents/`, both frontends.

`documents` + `document_links`, from FreeITSM. Three of its rules are the design:

- An **extension allow-list**, with a server-chosen stored filename, so an uploaded file can never be
  executed. The list can be narrowed but never widened to something executable.
- **Visibility is inherited from whatever the document is attached to**, evaluated at read time rather
  than recorded at upload. If you can see the ticket you can read its attachments; if you cannot, it
  does not appear in search, in ⌘K, or at its own URL.
- **A link is a first-class document.** A pasted SharePoint or Drive URL is stored as a document, so
  there is no pressure to move anything.

Attachments on ticket messages must respect the case-log visibility split from
[tier-1.md](tier-1.md) T1.I: an attachment on a private note is private.

**Done when:** a file attached to a private note is unreachable by the reporter, including at its direct
URL; an executable extension is refused; and the same document attached to two records is stored once.

### T4.G — Scheduled work, recurrence, snooze

**Files:** `api/src/db/schema/tickets.ts`, new `api/src/db/schema/scheduling.ts`, dashboard.

`work_start_datetime`, `work_end_datetime`, `work_all_day` on `tickets`, from FreeITSM — note its
schema comment that the UI asks for a **duration** and stores the computed end, so an end preceding its
start is not expressible and there is no such error to validate.

`recurring_tickets` from GLPI's `TicketRecurrent`. `snoozed_until` as a **computed comparison, never a
status** — the same reasoning as merged-ness in [tier-1.md](tier-1.md) T1.H, and it matters more after
T1.A makes status names editable.

**Done when:** scheduled work appears on a calendar view; a recurring ticket generates on schedule; a
snoozed ticket leaves the default queue and returns on time without its status changing.

### T4.H — Suppliers, contracts, configurable dashboards

**Files:** new `api/src/db/schema/suppliers.ts`, `api/src/db/schema/dashboards.ts`, dashboard.

`suppliers`, `contracts`, `contract_terms`, `payment_schedules` from FreeITSM; iTop's
`CustomerContract` / `ProviderContract` with coverage windows is the reference for tying a contract to
an SLA from [tier-1.md](tier-1.md) T1.C.

Dashboard widgets become rows (`dashboard_widgets` per analyst), completing row 4.8. `ticketStats`
already supplies the data; only the arrangement is missing.

**Done when:** a contract links a supplier to a service with a coverage window that resolves an SLA; an
analyst arranges their own overview and it persists.

### T4.I — SSO and directory sync

**Files:** new `api/src/db/schema/identity-providers.ts`, `api/src/auth/index.ts`,
new `api/src/server/directory/`, migration.

OIDC providers alongside Better Auth's existing email/password, which stays as break-glass.
`auth_providers` + `sso_identities`, from FreeITSM.

Directory sync with the three safeguards FreeITSM ships, all of which exist because of real failures:
**preview runs the same job and writes nothing**; **nobody is ever deleted**, only marked a leaver; and
**a safety brake stops an import that suddenly finds far fewer people than last time**, because a
mistyped search base looks exactly like everybody leaving at once.

This feeds [tier-0.md](tier-0.md)'s person model: `job_title`, `department`, `manager_id` all come from
the directory, and `manager_id` is what [tier-2.md](tier-2.md)'s approvals resolve through.

**Done when:** a user signs in through an OIDC provider and lands on their existing account; a preview
import writes nothing; a run finding 40% fewer people is refused with the count.

### T4.J — Multi-tenancy · **deferred, not planned here**

`idea.md` puts multi-tenancy out of scope and that stands. The cost of deferring is stated so it is a
decision rather than a discovery: FreeITSM carries `tenant_id` on nearly every table plus
`analyst_tenant_access`, `team_tenant_access` and `tenant_domains`. Retrofitting means a column on every
table, a predicate on every query, a review of every index, and a re-audit of every capability check
from [tier-0.md](tier-0.md).

**The one hedge worth considering:** add a nullable, indexed, unused `tenant_id` to the core tables
during [tier-1.md](tier-1.md)'s migrations. It costs almost nothing then and saves a schema-wide
migration later. Recommended only if an MSP deployment is plausible; otherwise skip it, since an unused
column invites confusion of its own.

---

## 4. Cross-component impact

| Component | Impact |
|---|---|
| `api` | Nine new schema modules; a mail poller as a second background task beside the SLA sweep and the gRPC heartbeat; document storage; an OIDC integration in `src/auth/index.ts`. |
| `cli` | Three new facets and a scheduled inventory report. The daemon, tiering, replay and enrolment are untouched. |
| `agent` | Ticket origin becomes prompt context — an alert-sourced ticket reads differently from an employee's. No new tools; inventory is a register, not diagnostic evidence. |
| `dashboard` | Assets, suppliers and contracts features; mail send log; configurable widgets; calendar view; attachments throughout. |
| `portal` | Status page; attachments on requests; SSO sign-in. |

**Requires:** [tier-1.md](tier-1.md) T1.K (references, for email threading) and T1.I (case log, for
inbound replies); [tier-2.md](tier-2.md) changes (for maintenance windows); [tier-3.md](tier-3.md) T3.C
rules (to classify inbound mail), T3.D custom fields (for assets), T3.E notifications (which outbound
email delivers), T3.F search (which indexes documents).

---

## 5. Decisions taken

**Email threading matches on the ticket reference, never the subject.** [tier-1.md](tier-1.md) T1.K
retains superseded numbers for ever specifically so this survives merges and renumbering. Subject
matching fails on reply prefixes, on localisation, and on anyone editing the subject.

**Ticket origin is per mailbox, not global.** A monitoring address and a helpdesk address both arrive as
email. Recording them identically loses the one signal that distinguishes an alert from a person.

**Template selection is by specificity, never by list order.** Order-dependent rules are reordered by
accident and there is no way to see that it happened.

**Every send attempt is logged with the provider's own words.** The alternative is a server log nobody
reads until a customer complains.

**Assets use the custom-field mechanism from [tier-3.md](tier-3.md), not a second one.** FreeITSM has
asset-specific `asset_fields` because it grew that way. One mechanism across every record type is
strictly better for us.

**Inventory is scheduled; facets stay diagnostic.** A software list on every `device_read_state` would
flood the model's context, and [cli.md](../../completed/cli.md) already established that facets bound their output
at the layer that knows how large it is. Inventory is a register that happens to be collected by the
same agent.

**Service status is derived from incidents, not from a monitor.** `idea.md` puts proactive detection out
of scope by decision. Availability computed from incidents already recorded needs no monitor and
covers outages that already happened.

**Attachment visibility is inherited and evaluated at read time.** Recording permissions at upload means
they are wrong the moment the parent record's visibility changes. Asking the question when it is asked
is the only version that stays correct.

**Directory sync never deletes, always previews, and brakes on a large drop.** Three safeguards, all of
which exist in FreeITSM because of real incidents. Copy all three; each is cheap and each prevents a
class of disaster.

**Multi-tenancy stays deferred, with its cost stated and one hedge offered.** Silently deferring it is
how it becomes impossible.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| This tier is wide enough that partial completion is likely, and a half-built operational surface can look complete from the outside. | Milestones are independently droppable and ordered by value. T4.A/T4.B (email) alone is the largest single change in how the system is used; everything after is additive. Each has its own done-condition. |
| Email ingestion is the most common attack surface in any ticket system — attachments, spoofed senders, auto-reply loops. | The attachment allow-list from T4.F applies to mail; auto-replies are suppressed for known auto-responder headers and for addresses that have received one recently; `freemail_domains`-style handling avoids treating a mailing list as a reporter. Every inbound decision is recorded in `mailbox_activity_log`. |
| A mail poller is a third background task beside the gRPC heartbeat and the SLA sweep. | All three follow `Gateway.sweep()`'s pattern and register in the same shutdown path in `api/src/index.ts`. Three tasks with one lifecycle, not three lifecycles. |
| Scheduled inventory on a fleet produces steady write load and can flood `device_commands`. | Inventory reports over its own message path with its own cadence, not through the command outbox, and lands in `inventory` tables rather than in `device_commands.output`. |
| SSO changes the authentication path that everything already depends on. | Email/password stays as break-glass, always. OIDC is additive, gated behind a provider row, and testable per provider before it is made default. |
| Deferring multi-tenancy could become permanent by accident. | The hedge is named concretely and placed at a specific point — nullable `tenant_id` during [tier-1.md](tier-1.md)'s migrations — so it is a decision taken once rather than a question re-asked at every tier. |

---

## 7. Definition of done

Per milestone, since this tier is explicitly droppable:

1. **T4.A** — a reply to a notification lands on the right ticket as a public case-log entry; an
   unmatched message opens a ticket classified by rules; origin and mailbox are recorded.
2. **T4.B** — every send attempt is logged with its outcome and the provider's reason on failure; a
   domain-scoped template beats the catch-all regardless of row order.
3. **T4.C** — a laptop appears as an asset with custody history; the same CSV imported twice updates
   rather than duplicates; rejected rows are inspectable.
4. **T4.D** — devices report disks, hardware and software on a schedule; no diagnostic
   `device_read_state` returns a software list.
5. **T4.E** — the portal shows availability derived from real incidents, excluding change windows.
6. **T4.F** — an attachment on a private note is unreachable by the reporter at its direct URL; an
   executable extension is refused; a shared document is stored once.
7. **T4.G** — scheduled work appears on a calendar; a recurring ticket generates; a snoozed ticket
   leaves and returns to the queue without its status changing.
8. **T4.H** — a contract's coverage window resolves an SLA; an analyst's overview arrangement persists.
9. **T4.I** — OIDC sign-in reaches an existing account; a preview import writes nothing; a run finding
   40% fewer people is refused with the count.
10. **Throughout** — all five components' gates pass, and every employee-facing string added in T4.E and
    T4.I still originates in the portal's copy module.
