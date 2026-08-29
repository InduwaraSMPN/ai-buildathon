# Brief B — Status as data, SLA, breach, pending

**Read first:** [README.md](README.md) — coordination map, blocker protocol, ground rules, and the list of
things that are already correct and must not be changed.
**Tier document:** [tier-1.md](../tiers/tier-1.md)
**Reserved migrations:** `0020` – `0023`
**Status file you own:** `context/plans/oss-adoption/execution/status/chat-b.md`

## Mission

Tier 1 is 7 of 12. The schema layer is complete and high quality — all 21 tables, every constraint
validated, no stored deadline anywhere, calendar arithmetic pure and timezone-correct with real boundary
tests. Five milestones stop one step short of the product: **T1.A is half converted, and T1.C, T1.D and
T1.F are complete in the database and invisible to a human.**

Nothing here is a redesign. It is deletion, wiring and seeding.

## What you own

```
axioma/api/src/server/tickets.ts
axioma/api/src/server/grpc.ts                 (status writes)
axioma/api/src/server/pending.ts
axioma/api/src/server/sla/                    (all)
axioma/api/src/contracts/tickets.ts
axioma/api/src/server/routers/tickets.ts
axioma/api/src/db/schema/{vocabulary,sla,pending,calendars}.ts
axioma/dashboard/src/features/tickets/        (allowed-actions, queue-search, queue-columns, ticket-queue)
axioma/dashboard/src/features/overview/
axioma/portal/src/features/tickets/           (copy.ts, conversation-card, progress-timeline, ticket-ui)
```

Brief 0 ran first and split the ticket procedures out of `routers/index.ts` and `contracts/index.ts` into
the domain files above; both `index.ts` files are now composition only. **The `file:line` references
below were captured before that move — locate by procedure or symbol name, which the refactor preserved
exactly.** Read `status/chat-0.md` for the final domain-to-file map.

Two shared modules are read by every session: `contracts/shared.ts` holds the zod primitives (including
`ticketStatus`) and `server/routers/shared.ts` holds `findTicket`, `findTicketMessages`, `decodeCursor`,
`getRun` and `startTicketRun`. You will need to touch both — several of your fixes are in those helpers.
Keep the changes additive where you can and say what you changed in your status file.

Brief C will remove `category` and `subcategory` from the ticket schema and the reclassify action, which
is in the files you own. Expect it; do not do it yourself. Brief D will call `startTicketRun` from three
intake paths — do not change its signature without telling D through your status file.


## Use subagents for reading, never for writing

Your brief is a session's worth of work, so widen what you can see rather than multiplying what writes.
**Every edit stays in this session.** Two agents editing one working tree is a lost write, not a merge
conflict, and lost writes are silent.

Delegate read-only questions and act on the answers yourself. The two that pay off most here:

- **Finding what brief 0 moved.** Every `file:line` below predates the domain refactor. A subagent that
  answers "where does this procedure live now, and what calls it" costs you no context and is faster than
  sweeping for it.
- **Confirming a claim before you act on it.** "Check nothing else reads this table" is a good subagent
  question. "Fix this table" is not.

Do not delegate gate runs — a typecheck against a tree that is mid-edit means nothing.

---

## Tasks, in order

### B1 — Finish status as data

The conversion is genuinely half done, and the half that is done is correct. Do not redo it.

**Already correct — leave alone:** the schema enum is now `text` with a foreign key to `ticket_statuses`
(`db/schema/tickets.ts:59-62`); the contract enum is now `z.string().min(1)` (`contracts/index.ts:7`); the
`listTickets` status facet reads the table (`routers/index.ts:722`); `ticketStats.byStatus` reads the table
(`:1637`); `updateTicket` and `startRun` resolve transitions from the table via `resolveTicketStatus`
(`:266`, `:1341`). The live table holds seven statuses with correct `state_type`, `is_closed` and
`pauses_sla`, and 31 transition rows.

**Confirmed broken:**

- **`server/tickets.ts:22-72` still holds the hardcoded transition literal.** `nextTicketStatus:85` reads
  it, and grep shows its only callers are `tickets.test.ts`. So the literal is dead in production while
  the seven lifecycle tests validate it — and **nothing anywhere tests the table-driven path.** Delete the
  literal, delete or convert `nextTicketStatus`, and rewrite the tests to exercise
  `ticket_status_transitions`. Assert the same 31 edges and the named conflict on an invalid transition.
- **`server/grpc.ts` bypasses the state machine entirely.** It never calls `resolveTicketStatus` and writes
  literals at `:226` (`"escalated"`), `:318` (`"pending"`), `:498-499` (`"resolving"` where status is
  `"routing"`), `:973` (`"escalated"`). This is the path Axel actually drives tickets through, so the
  agent's whole lifecycle sits outside the configurable machine. Route every one through
  `resolveTicketStatus`.
- **`server/pending.ts:22,30,38,68`** compares and writes `"pending"` and `"resolved"` literals. Key off
  `state_type` and the `is_default` status instead.
- **`routers/index.ts:969-978`** — `addMyTicketMessage` un-pends by matching `"pending"` and writing
  `"open"`. Same fix.
- **`server/tickets.ts:78-83`** — `canRerun` gates on `status === "escalated"`.
- **`knowledge/gaps.ts:97`** — `eq(tickets.status, "resolved")`.
- **`routers/index.ts:1652-1658, 1691, 1721, 1726, 1770`** — `ticketStats` aggregates other than `byStatus`
  iterate literal status names.

**Both frontends still key behaviour off names, and this is what DoD 2 fails on:**

- `dashboard/src/features/tickets/components/allowed-actions.ts:12-37` maps six literal statuses to tone
  and allowed actions; `:57` returns **zero actions** for any status not in the map, and `:59` gates the
  reopen window on `"closed"`. Renaming or adding a status silently disables the ticket UI — the exact
  failure the milestone exists to prevent. `statusStateType` and `statusColour` already reach both
  frontends on every ticket (`contracts/index.ts`, populated at `routers/index.ts:126-128`) and have
  **zero consumers**. Key off `statusStateType`.
- `dashboard/src/features/tickets/queue-search.ts:27-34` hardcodes a six-value allow-list that **omits
  `pending`**, so the seventh shipped status can never be filtered from the URL. Compounded by
  `contracts/index.ts:442` capping the status filter at `.max(6)` while seven active statuses exist.
  Validate server-side against `ticket_statuses` and raise the cap.
- `dashboard/src/features/overview/components/overview-page.tsx:44-45, 104, 108, 296` — literal status
  lists.
- `portal/` keys off status names in 24 places, notably `features/tickets/copy.ts:93-171` (three
  name-keyed maps), `copy.ts:173` (`isFinishedTicket = status === "closed"`),
  `progress-timeline.tsx:10-17` (hardcoded stage ladder), `ticket-ui.tsx:44` (badge colour off
  `"resolved"` / `"closed"`), `queries.ts:7-9` (live-polling gate).

**Also:** the status facet renders raw keys because the facet output carries only `{value, count}` —
unlike the assignee facet, which carries `name` (`contracts/index.ts:469-474`,
`dashboard/.../queue-facet.tsx:40`). Add `label` to the status facet.

**Acceptance:** renaming a status row in the database changes every label in both frontends and breaks
nothing. Write a test that exercises the transition table.

### B2 — Make SLA state readable

**Confirmed:** stopwatches accumulate correctly, SLA and OLA are both derived and genuinely differ (live:
480/2400 against 240/1440), and no deadline is stored anywhere. But **no procedure or ticket field exposes
elapsed, target or remaining**, so no client can build a countdown, and `ticketStats` reports no SLA or
OLA attainment — which T1.C's done-condition names explicitly.

**Build:** elapsed, target and remaining per policy and target, either on `ticketSelection` or as a
`listTicketSla` procedure; attainment in `ticketStats`; a countdown in the dashboard ticket detail and
queue.

**Also:** `ticket_stopwatches.policy_id` has no foreign key — it is polymorphic over `slas` and `olas` by
`policy_type`, documented at `db/schema/sla.ts:64-65`. A dangling id is silently skipped by
`sla/sweep.ts:24` rather than rejected. Decide whether to keep that and say why.

### B3 — Make breach visible and drive it from rules

**Confirmed:** the sweep runs on the existing `Gateway.sweep()` tick (`server/grpc.ts:991-993`) — correct,
no second scheduler — and writes `escalation_flag` and a reason naming the missed target. Two failures:

- **`sla_notification_rules` is created, migrated, present in the database and read by nothing.** No
  recipient is ever notified, and the warning threshold is hardcoded at `sla/sweep.ts:37` as
  `targetMs * 0.8` instead of the rows' `threshold_percent`. Join the rules on
  `(policy_type, policy_id, trigger_type, target_type)`, use `threshold_percent`, and dispatch to the
  resolved recipient. Seed a default rule set.
- **`escalationFlag` and `escalationReason` reach the contract (`contracts/index.ts:329-330`) and are
  rendered nowhere.** Add a breach and warning badge to `queue-columns.tsx` — buildable today with no API
  change.

**Also:** the flag is never cleared. A reopened or un-pended ticket stays flagged `breach` for ever. Clear
it on `reopen`, on `unpend`, and when a stopwatch restarts.

### B4 — Make pending reachable

**Confirmed:** the clock genuinely pauses — `pending` has `state_type='pending'` and `pauses_sla=true`,
read at `sla/runtime.ts:128`. Everything else is missing:

- **`pending_reasons` is empty, seeded by nothing, and no procedure lists or creates them.** Since
  `updateTicket`'s `pend` rejects an unknown `reasonId` (`routers/index.ts:1337`), **the action is
  unreachable end to end.** Seed GLPI-style defaults with `followup_frequency_minutes` and
  `followups_before_resolution`, and add `listPendingReasons`.
- **No pend or unpend control in the dashboard.** Both actions are in the contract;
  `ticket-actions.tsx:98-161` renders neither and `allowed-actions.ts:43-50` has no entry for them. Add
  them with a reason picker.
- **"Pending chases itself" is bookkeeping only.** `server/pending.ts:55-78` increments
  `pending_followups` and inserts a row but sends **no message and no notification**, then auto-resolves
  with `no_action_required` as though the reporter had been chased. Insert a public `ticket_messages` row
  or fire a notification event on each follow-up.

### B5 — Surface the resolution-code mix

**Confirmed:** iTop's exact six codes ship, the contract requires one on `resolve`, and `grpc.ts:786-797`
rejects a resolved terminal without a valid code, so Axel supplies it too. `ticketStats.byResolutionCode`
exists. Two gaps: `overview-page.tsx` never reads it, so "the overview shows the mix" is unmet; and
`ticket-queue.tsx:134` hardcodes `resolutionCode: "fixed"` on the keyboard-shortcut resolve path,
bypassing the picker at `ticket-actions.tsx:202-228` and silently mis-coding outcomes. Render the mix and
the CSAT figure (`stats.csat`, also unrendered), and make the shortcut use the picker.

### B6 — The portal copy rule

**Confirmed:** tier-1 states it plainly — every visible string originates in
`portal/src/features/tickets/copy.ts`. Roughly seventeen are hardcoded in
`components/conversation-card.tsx:40-183`, with more in `resolution-card.tsx`, `routes/_auth/tickets/$ticketId.tsx`
and `home.tsx`. `progress-timeline.tsx:75` leaks the literal word "Pending" to an employee. Move them all
into `copy.ts`.

Brief E owns `portal/src/routes/status.tsx` and `features/status/copy.ts`. Leave those alone.

### B7 — Two small correctness gaps

- **`routers/index.ts:1490-1516`** — the field audit covers classification and `route` but not
  `assigneeId`, `ownerId` or `teamId`, so a reassignment records nothing. Add the three.
- **`routers/index.ts:601-607`** — `listTickets.search` matches title, id and reporter name but not
  `tickets.number`, so a human-readable reference cannot be typed into the queue search. Add it.

### B8 — Two missing tests the tier asks for by name

- A procedure-level test that a private note is absent from `getMyTicket`'s **network response** — not
  just a unit test on the helper, which is what `server/messages.test.ts` gives today. The tier's risk
  table asks for the response assertion specifically.
- A stopwatch test that pauses across a closed period. `stopwatch.test.ts` injects `elapsedMs`
  synthetically and nothing wires `elapsedWorkingMs` into `transitionStopwatch`. Pause Friday 16:30,
  resume Monday 09:30, assert the accrual.

---

## Definition of done

- Renaming a status in the database changes every label in both frontends and changes no behaviour.
- A test exercises `ticket_status_transitions`; the hardcoded literal is gone; `grpc.ts` and `pending.ts`
  resolve through the table.
- An SLA countdown is visible on a ticket, and attainment appears in `ticketStats`.
- A breached ticket reads as breached in the queue, and a notification rule sends to its recipient.
- A ticket can be put on hold from the dashboard with a reason, the reporter is chased, and the clock stops.
- The resolution-code mix and CSAT appear on the overview.
- Every employee-facing string in the tickets feature originates in `copy.ts`.
- All five component gates pass, run and quoted.
