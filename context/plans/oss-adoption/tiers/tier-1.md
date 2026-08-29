# Tier 1 — ITIL core the schema already implies

**Document role:** Adoption plan for the service-desk fundamentals
**Parent:** [oss-adoption.md](../oss-adoption.md) · **Requires:** [tier-0.md](tier-0.md) · **Next:** [tier-2.md](tier-2.md)

The MVP put ITIL classification on the ticket — record type, impact, urgency, derived priority,
category. This tier adds what that classification is *for*: targets that can be missed, a clock that
knows about weekends, a ticket that can wait on someone, a conversation with the reporter, and a record
of who changed what.

---

> ### Where the current truth lives
>
> **The current-state section below is a snapshot taken before this tier was built.** It is kept as
> written because the milestones, decisions and definition of done are argued from it. It no longer
> describes the tree.
>
> A verification audit on 2026-08-29 checked every milestone against the code, the live database and
> the running API. **7 of 12 milestones complete** — T1.B, T1.G, T1.H, T1.I, T1.J, T1.K and T1.L. T1.A is half converted; `grpc.ts` and both frontends still key behaviour off status names. T1.C, T1.D, T1.E and T1.F are complete in the database and invisible in the product.
>
> The remaining work is in [../execution/chat-b-tier1.md](../execution/chat-b-tier1.md), with the confirmed
> `file:line` evidence for each gap. Section 7's definition of done is what that brief verifies
> against and is still current.

## 1. Current state

### What the MVP already delivered against this tier

The gap table was written before the five component plans were executed. Six rows have moved:

| Row | Status now | Evidence in the code |
|---|---|---|
| 1.9 Resolution code | **Partial** | `tickets.resolution`, `escalationNote`, `reporterNote` all exist; `updateTicket` has `resolve` and `escalate` actions with required text. No `resolution_code` enum. |
| 1.12 Audit trail | **Partial** | `ticket_transitions` records `fromStatus`, `toStatus`, `action`, `actorType` (`human`\|`agent`), `actorId`, `createdAt`. That is a real lifecycle audit with actor attribution. No field-level audit — a reclassification from P3 to P1 records the action, not the values. |
| 1.17 Reopen and satisfaction | **Partial** | `tickets.reopenedAt` and the `reopen` action shipped. No CSAT. |
| 1.16 Assignment | **Unchanged** | Still only `tickets.route`, a six-value enum naming a destination. No owner, no assignee, no team. |
| 1.1 Status as data | **Unchanged, and now more expensive** | See below. |
| 1.15 Ticket references | **Unchanged** | The portal renders `Request #{data.id.slice(0, 8)}` — a UUID fragment. |

### What exists that this tier builds on

- **The lifecycle state machine** — `api/src/server/tickets.ts` holds `transitions` as a
  `Record<TicketStatus, Partial<Record<TicketTransition, TicketStatus>>>` over eleven actions
  (`startRun`, `firstTool`, `resolve`, `escalate`, `fail`, `exhaust`, `close`, `reopen`, `reclassify`,
  `assign`, `add_detail`). `nextTicketStatus` throws a named `CONFLICT` on an illegal transition, and
  seven tests cover it. This is the right seam for everything in this tier.
- **Server-side queue** — `listTickets` has ten filters, cursor pagination, sorting and server-computed
  facets over status, priority, record type, category and route. New filters land here, not in the
  browser.
- **`lastHumanTransitionAt`** — already used by `ticketStats` to compute the autonomous resolution rate.
- **`ticketStats`** — status/priority/record-type counts, open-by-priority, awaiting confirmation,
  escalated in 24h, autonomous rate, median time to resolution, and a daily series.
- **The dashboard queue** — `queue-columns.tsx`, `queue-facet.tsx`, `saved-view.tsx`, `queue-search.ts`
  with URL-synced state; `allowed-actions.ts` derives controls from status and is validated by
  `allowed-actions.validation.mjs`.
- **The portal** — `progress-timeline.tsx` and `copy.ts`, where every employee-facing string lives.

### Why 1.1 is now more expensive than when first proposed

`TICKET_STATUSES` in `api/src/shared/index.ts` is consumed by:

- `db/schema/tickets.ts` — three `text(..., { enum: TICKET_STATUSES })` columns, at `tickets.status`
  (:49) and `ticket_transitions.fromStatus` / `toStatus` (:82–83);
- `contracts/index.ts` — a duplicated `ticketStatus` zod enum (:5), on which `listTickets`' `status`
  filter and its facet output are both typed;
- `server/tickets.ts` — the transition table is keyed on it;
- `server/routers/index.ts` — **iterated at runtime in two places**: the status facet in `listTickets`
  (:494) and the `byStatus` record in `ticketStats` (:896–900). Both enumerate the constant to produce
  a value for every status, so both must read the table instead;
- both frontends — through the published contract.

Converting it to rows touches all five. That is the honest cost, and it is still worth paying, for the
reason in §5.

### Gap rows this tier owns

1.1–1.18 in the parent table.

---

## 2. Gaps

1. Status is a compile-time enum, so behaviour cannot hang off it and it cannot be configured.
2. No concept of working hours; every duration is wall-clock.
3. No targets at all — nothing can be late, so nothing can be prioritised by lateness.
4. No internal target distinct from a promised one, so the agent's contribution is measured only as a
   rate, never as time saved.
5. A ticket cannot wait on the reporter without looking stalled.
6. Resolution is free text, so outcomes cannot be counted.
7. Nothing can be assigned to a person or a team.
8. Tickets cannot be related, duplicated or merged.
9. **There is no human conversation on a ticket at all.** The reporter can add one note; staff can add
   none. This is the largest single gap in the tier.
10. Field-level changes are not audited, and time spent is not recorded.
11. Tickets have no human-readable reference.
12. Two analysts can edit the same ticket blind, and nobody is asked whether the fix worked.

---

## 3. Milestones

### T1.A — Status as data

**Files:** `api/src/db/schema/tickets.ts`, new `api/src/db/schema/vocabulary.ts`,
`api/src/shared/index.ts`, `api/src/server/tickets.ts`, `api/src/server/routers/index.ts`,
`api/src/contracts/index.ts`, migration.

Add `ticket_statuses` rows carrying `key`, `label`, `state_type`, `is_closed`, `pauses_sla`,
`is_default`, `colour`, `display_order`, `is_active`. `state_type` is the fixed behavioural set from
Znuny's `ticket_state_type` — `new`, `open`, `pending`, `resolved`, `closed`, `merged`, `cancelled` —
and **behaviour keys off `state_type`, never off a name**, because names become editable the moment they
are rows.

The six current statuses seed it with their existing keys, so no data migrates and no URL breaks.
`STATE_TYPES` replaces `TICKET_STATUSES` in `api/src/shared/index.ts` as the compile-time constant;
status keys stay typed as `string` at the boundary and are validated against the table.

Move `transitions` from `api/src/server/tickets.ts` into `ticket_status_transitions` rows
(`from_status`, `action`, `to_status`). `nextTicketStatus` keeps its signature and its `CONFLICT` error
and reads the table instead of the literal. The existing seven tests keep passing, which is the check
that the conversion was faithful.

**Done when:** renaming a status in the database changes every label in both frontends with no code
change; setting `pauses_sla` on it stops the clock in T1.C; and `api`'s existing lifecycle tests pass
unmodified against the table-driven machine.

### T1.B — Business-hours calendars

**Files:** new `api/src/db/schema/calendars.ts`, new `api/src/server/sla/calendar.ts`, migration.

`calendars` (name, timezone, is_default) + `calendar_hours` (weekday, start_time, end_time) +
`calendar_holidays` (date, name), following FreeITSM's `sla_calendars` / `sla_calendar_hours` /
`sla_calendar_holidays`. GLPI models the same thing as `Calendar` + `CalendarSegment` +
`Calendar_Holiday`.

Two pure functions, and everything else in this tier calls them:

```ts
elapsedWorkingMs(from: Date, to: Date, calendarId: string): Promise<number>
addWorkingMs(from: Date, ms: number, calendarId: string): Promise<Date>
```

Unit-tested with `tsx --test` beside the existing `src/shared/index.test.ts`.

**Done when:** a ticket opened 16:00 Friday under a 09:00–17:00 Mon–Fri calendar has exactly one working
hour elapsed at 10:00 Monday, and inserting a Monday holiday moves that to 10:00 Tuesday.

### T1.C — SLA and OLA stopwatches

**Files:** new `api/src/db/schema/sla.ts`, new `api/src/server/sla/stopwatch.ts`,
`api/src/server/tickets.ts`, migration.

`slas` and `olas` each carry a TTO and a TTR target in working minutes plus a `calendar_id`. Resolution
order: the ticket's service (once [tier-2.md](tier-2.md) lands the catalogue) → its priority → the
default. Until then, priority, which is where FreeITSM puts them
(`ticket_priorities.sla_response_minutes`, `sla_resolution_minutes`, `sla_calendar_id`).

Model TTO and TTR as **stopwatches**, following iTop's `AttributeStopWatch`: each row stores
`accumulated_ms`, `running`, `started_at`, and a `pending_ms` counterpart mirroring iTop's
`cumulatedpending`. A status whose `pauses_sla` is set stops the watch. **The deadline is derived, never
stored** — that is the whole point, because a stored timestamp cannot express "paused four days awaiting
the reporter" and every attempt to make it do so ends up recomputing on read anyway.

Both SLA and OLA run on every ticket. GLPI keeps them separate (`SLA`/`SlaLevel` and `OLA`/`OlaLevel`),
and for Axiōma the distinction is not bookkeeping: the OLA is what Axel is measured against, the SLA is
what the employee was promised.

Hook into the existing `nextTicketStatus` call site so a transition updates the watches in the same
write.

**Done when:** a ticket moved to a pausing status and back reports TTR elapsed that excludes both the
pause and out-of-hours time; its OLA and SLA deadlines differ; and `ticketStats` can report
attainment against both.

### T1.D — Breach detection and escalation

**Files:** new `api/src/server/sla/sweep.ts`, `api/src/db/schema/sla.ts`, `api/src/index.ts`.

A periodic sweep marks warning and breach thresholds, writing `escalation_flag` and `escalation_reason`
onto the ticket — iTop's fields, and its `escalated_tto` / `escalated_ttr` states are the reference for
what the flag should distinguish.

Reuse the interval pattern already proven in `Gateway.sweep()` in `api/src/server/grpc.ts`, which
already runs on a 10s tick with `unref()` and handles its own shutdown. Do not add a second scheduler.

Notification rules follow FreeITSM's `sla_notification_rules`: `trigger_type` (`warning` | `breach`) ×
`target_type` (`response` | `resolution` | `both`), with recipients by assignee, team or explicit
address. GLPI's `SlaLevel` ladder — several rungs, each with its own criteria and actions — is the
second increment and is not in this milestone.

**Done when:** a ticket left past its TTO shows as breached in the queue with no human action, the
reason names which target was missed, and the sweep survives an API restart without double-firing.

### T1.E — Pending

**Files:** `api/src/db/schema/tickets.ts`, new `api/src/db/schema/pending.ts`,
`api/src/server/tickets.ts`, `api/src/contracts/index.ts`, `portal/src/features/tickets/copy.ts`.

A `pending` status whose `state_type` is `pending` and whose `pauses_sla` is set — which is only
expressible because of T1.A. Backed by `pending_reasons` rows carrying `followup_frequency` and
`followups_before_resolution`, from GLPI's `PendingReason`. Pending chases itself: after N follow-ups
with no reply it auto-resolves rather than rotting in the queue.

`updateTicket` gains `pend` (reason, optional until-date) and `unpend`. iTop's `last_pending_date` and
`pending_reason` are the fields to mirror.

The portal gets a stage for it in `copy.ts` — in employee language, "Waiting for your reply", never
"pending". Every visible string still originates in that one file, which is the rule
[portal.md](../../completed/portal.md) established and this tier keeps.

**Done when:** a pending ticket stops its SLA clock, chases the reporter on schedule, auto-resolves
after the configured number of unanswered follow-ups, and reads as waiting-on-you in the portal.

### T1.F — Resolution codes

**Files:** `api/src/db/schema/tickets.ts`, `api/src/shared/index.ts`, `api/src/contracts/index.ts`,
`dashboard/src/features/tickets/components/ticket-actions.tsx`.

`resolution_code` enum alongside the existing free-text `resolution`, adopting iTop's set:
`fixed`, `workaround`, `not_reproducible`, `duplicate`, `no_action_required`, `rejected`.
GLPI models the same thing as `SolutionType` rows; an enum is right at this size.

The `resolve` action in `updateTicket` gains a required code. Axel supplies one too — its terminal
`RunUpdate` already carries an outcome, and mapping that to a code is a small change in
`api/src/server/grpc.ts` where the terminal update is already persisted.

`ticketStats` gains a breakdown by code, which is the first time "what did we actually do about these"
becomes answerable.

**Done when:** every resolution carries a code, Axel's autonomous resolutions carry one without a human
choosing it, and the overview shows the mix.

### T1.G — Assignment to people and teams

**Files:** `api/src/db/schema/tickets.ts`, `api/src/contracts/index.ts`,
`api/src/server/routers/index.ts`, `dashboard/src/features/tickets/components/queue-columns.tsx`.

**Requires [tier-0.md](tier-0.md) T0.A** for `teams` and `team_members`.

Add `assignee_id`, `owner_id` and `team_id` to `tickets`. All three of iTop (`agent_id` + `team_id`),
FreeITSM (`assigned_analyst_id` + `owner_id` + `department_id`) and Znuny (`user_id` +
`responsible_user_id` + `queue_id`) separate the person doing the work from the person accountable for
it — three independent designs reaching the same conclusion.

`tickets.route` stays. It is what Axel sets during routing and it answers a different question: *which
kind of system owns this*, not *which person*. Conflating them would lose the agent's routing signal.

`updateTicket`'s `assign` action widens to take any of assignee, owner or team. `listTickets` gains
`assigneeId` and `teamId` filters and facets, feeding a real "My queue" saved view — which
`saved-view.tsx` already supports as a mechanism and currently has nothing personal to point at.

**Done when:** a ticket can be assigned to a person and to a team independently, "My queue" returns only
the viewer's tickets, and the queue can be faceted by team.

### T1.H — Linkage and merge

**Files:** new `api/src/db/schema/links.ts`, `api/src/db/schema/tickets.ts`,
`api/src/contracts/index.ts`, `dashboard/src/features/tickets/components/ticket-detail.tsx`.

`ticket_links` with `relation_type` — `duplicate_of`, `related_to`, `caused_by`, `parent_of` — from
FreeITSM's table of the same name. Znuny's `link_object` / `link_relation` / `link_type` is the generic
any-record-to-any-record version and is the shape to grow into once [tier-2.md](tier-2.md) adds problems
and changes; the ticket-only version ships first.

Merge follows FreeITSM's `ticket_merges`, including undo (`undone_datetime`, `source_prev_status_id`)
and `tickets.merged_into_id`. **Copy one decision exactly:** merged-ness is its own column, never a
status. FreeITSM's own schema comment says the banner and the redirects key off the column *"never off a
status name (statuses are user-configurable)"* — and after T1.A ours are too.

**Done when:** two tickets can be linked and shown on each other's detail page; one can be merged into
another and un-merged; and a merged ticket's status is untouched by the merge.

### T1.I — Case log

**Files:** new `api/src/db/schema/messages.ts`, `api/src/contracts/index.ts`,
`dashboard/src/features/tickets/components/`, `portal/src/features/tickets/`.

This is the biggest functional addition in the tier. Axiōma has an agent transcript and **no human
conversation model at all**.

`ticket_messages` with `ticket_id`, `author_id`, `body`, `visibility` (`public` | `private`),
`created_at`, following iTop's `public_log` / `private_log` `AttributeCaseLog` split. Znuny's
`article` + `article_sender_type` + `communication_channel` is the multi-channel version and belongs to
[tier-4.md](tier-4.md), not here.

**The visibility split is the portal boundary, and it is enforced by shape.** `getMyTicket` returns
public messages only — it already returns no `runs` for exactly this reason, and this extends the same
mechanism rather than adding a filter the client could forget. `reporterNote` on `tickets`, which the
MVP added as the employee's single note, becomes the first public message and the column is retired.

**Done when:** staff and reporter can converse on a ticket; a private note is absent from the portal's
network response, not merely hidden in its UI; and the transcript and the conversation render as
separate, clearly-labelled things in the dashboard.

### T1.J — Field audit and time recording

**Files:** new `api/src/db/schema/journal.ts`, `api/src/server/routers/index.ts`.

`ticket_audit` with `field_name`, `old_value`, `new_value`, `actor_id`, `created_at`, from FreeITSM.
This complements `ticket_transitions` rather than replacing it: transitions record *what happened to the
lifecycle*, audit records *what changed on the record*. A reclassification currently logs the action and
loses the values.

`ticket_time_entries` with `minutes` and a note per person, from FreeITSM's table of the same name;
iTop carries the total as `time_spent`.

**Done when:** reclassifying a ticket from P3 to P1 shows both values in the audit; time logged by two
people totals correctly on the ticket.

### T1.K — Ticket references

**Files:** new `api/src/db/schema/numbering.ts`, `api/src/server/routers/index.ts`,
`portal/src/routes/_auth/tickets/$ticketId.tsx`.

`ticket_number_counters` + `ticket_number_history` + a configurable format, from FreeITSM. Two of its
decisions are worth copying verbatim: **old numbers are retained for ever**, so a reply quoting one
still resolves after a renumber or a merge; and **the digit count is a minimum, not a limit**, so
outgrowing six digits produces a seventh rather than an error.

Format `INC-{YYYY}-{seq:5}` for incidents and `REQ-` for service requests — the record type already
exists to drive it.

**Done when:** the portal shows `INC-2026-00042` instead of a UUID fragment, and a lookup by a
superseded number still finds the ticket.

### T1.L — Presence and satisfaction

**Files:** new `api/src/db/schema/presence.ts`, `api/src/db/schema/tickets.ts`,
`dashboard/src/features/tickets/components/ticket-detail.tsx`,
`portal/src/features/tickets/components/resolution-card.tsx`.

`ticket_presence` — who else has this ticket open — from FreeITSM. A heartbeat on the detail route,
expired by a sweep, reusing the staleness pattern from `grpc.ts`.

`ticket_csat_responses` with a token, rating and comment, from FreeITSM; GLPI models it as
`TicketSatisfaction`. The request is sent on close. `resolution-card.tsx` already owns the
"This solved it" moment and is where the rating belongs.

**Done when:** two analysts opening one ticket each see the other; a closed ticket invites a rating and
the score appears in `ticketStats`.

---

## 4. Cross-component impact

| Component | Impact |
|---|---|
| `api` | Seven new schema modules, roughly ten migrations, the contract grows by the case log, links, merge, pending, assignment, time entries and CSAT. `src/server/tickets.ts` becomes table-driven but keeps its signatures and its tests. |
| `dashboard` | Queue gains SLA countdown, breach state, assignee and team columns and facets. Detail gains the case log, links, merge, time entries, presence and the audit trail. `allowed-actions.ts` gains the new actions. |
| `portal` | Public case log gives the employee a reply channel — the largest addition to that surface, and it stays inside the plain-language rule because private messages never reach the client. Pending gets a stage in `copy.ts`; the ticket shows a real reference number. |
| `agent` | `resolution_code` on the terminal `RunUpdate` (proto change, additive). Axel should be able to read the case log — a new `ticket_read_messages` read tool — so it does not re-ask what the reporter already answered. No write access to the conversation: Axel's voice is the transcript, not the case log. |
| `cli` | **None.** |

**Requires:** [tier-0.md](tier-0.md) T0.A (teams) for T1.G, T0.B/T0.C for who may see private messages.
**Required by:** [tier-2.md](tier-2.md) — problems and changes link through T1.H's model and inherit
T1.C's SLA machinery; [tier-3.md](tier-3.md)'s rules engine sets SLA and assignment from T1.C and T1.G.

---

## 5. Decisions taken

**Status becomes data, and behaviour keys off `state_type` rather than a name.** This is the most
expensive milestone in the tier — four call sites plus both frontends — and it is first because every
other milestone depends on it. SLA pausing needs `pauses_sla`; breach reporting needs `is_closed`;
pending needs a state type that means pending. Doing it after those exist means doing them twice.
Znuny's separation of a fixed behavioural type from a configurable name is the design that avoids the
mistake every ITSM system makes once.

**SLA is a stopwatch, never a stored deadline.** iTop and GLPI arrived at accumulated-elapsed-time with
a pause independently. A deadline column cannot express a pause.

**OLA alongside SLA, from day one of this tier.** Retrofitting a second target later means backfilling
history that cannot be reconstructed. And the OLA-versus-SLA gap is the honest measure of what
autonomous resolution is worth — `ticketStats` already reports the rate, and this makes it reportable in
time.

**`route` survives alongside assignment.** They answer different questions. Axel sets `route` during
routing; a human sets `assignee_id`. Collapsing them would destroy the routing signal the agent
produces, which is one of the two things `idea.md` claims the system does.

**The case log's public/private split is enforced by procedure shape.** `getMyTicket` already returns no
`runs` for exactly this reason, and [portal.md](../../completed/portal.md) argues the case: a rule enforced only by
a component choosing not to render a field is not enforced. Extending an existing mechanism beats adding
a parallel one.

**Axel reads the case log and does not write to it.** The transcript is Axel's voice and the dashboard
renders it as such; the case log is the human conversation. Letting the agent post into it would blur
the line the portal's plain-language rule depends on. Reading it is plainly useful — the reporter's
answer to "have you tried restarting" is evidence.

**`ticket_audit` complements `ticket_transitions`; neither replaces the other.** The MVP's transitions
table is good and stays. It records lifecycle with actor attribution; it does not record that impact
changed from medium to high.

**Merged-ness is a column, not a status** — copied from FreeITSM's explicit reasoning, which becomes
true for us the moment T1.A makes status names editable.

**Pending auto-resolves rather than waiting for ever.** GLPI's `followups_before_resolution` exists
because tickets waiting on a reporter who has moved on are the largest source of stale queues in every
service desk. The alternative is a number that only grows.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| T1.A touches the schema, the contract, the state machine and both frontends at once; a bad landing breaks three components' gates. | The six existing statuses seed the table with their current keys, so no data migrates and no URL changes. `api`'s seven lifecycle tests must pass **unmodified** against the table-driven machine — that is the acceptance check, and it is already written. |
| Stopwatch arithmetic across calendars, pauses and timezones is easy to get subtly wrong, and wrong SLA numbers are worse than none. | `elapsedWorkingMs` and `addWorkingMs` are pure functions tested first, before anything depends on them, with the Friday-16:00 and holiday cases from T1.B's done-condition as fixtures. Everything else calls them rather than reimplementing. |
| The SLA sweep is a second background loop beside the gRPC heartbeat, and two schedulers means two shutdown paths. | Reuse `Gateway.sweep()`'s proven pattern and its lifecycle in `api/src/index.ts`, which already closes cleanly on SIGINT/SIGTERM. |
| The case log can leak a private note to the portal — the single highest-consequence bug in this tier. | Two mechanisms: `getMyTicket` selects public rows in the query, and it already returns a shape with no run data. Add a test asserting the network response for a ticket with a private note contains neither its body nor its author. |
| Twelve milestones is a lot of schema churn, and half-landed tables invite a second migration to fix the first. | Each milestone is one migration and lands complete across schema → contract → publish → both frontends before the next begins. Contract republish (`pnpm contracts:publish`) is part of the milestone, not a follow-up. |
| Reference numbers change how tickets are identified, and the MVP has live data keyed by UUID. | Numbers are additive: the UUID stays the primary key and the API surface. `ticket_number_history` means an old reference always resolves. Nothing keys off the human-readable form except display and inbound lookup. |

---

## 7. Definition of done

1. All five components' gates pass, and `api`'s existing lifecycle tests pass unmodified against the
   table-driven state machine.
2. Renaming a status in the database changes every label in both frontends with no code change; no
   behaviour anywhere keys off a status name.
3. A ticket opened outside working hours accrues no elapsed SLA time until the calendar opens; a holiday
   shifts the deadline.
4. TTO and TTR pause on a pausing status and resume correctly; SLA and OLA deadlines are both derived
   and differ.
5. A ticket past its target is flagged breached with no human action, naming the missed target.
6. A pending ticket stops its clock, chases the reporter, and auto-resolves after the configured
   unanswered follow-ups.
7. Every resolution carries a code, including Axel's, and `ticketStats` reports the mix.
8. A ticket can be assigned to a person and a team independently, and "My queue" returns the viewer's
   own tickets.
9. Tickets can be linked, merged and un-merged; merge never touches status.
10. Staff and reporter can converse; a private note is absent from the portal's network response.
11. A field-level change shows both old and new values in the audit; time from two people totals.
12. The portal shows a human-readable reference, and a superseded number still resolves.
13. Concurrent editors see each other; a closed ticket invites a rating that reaches `ticketStats`.
