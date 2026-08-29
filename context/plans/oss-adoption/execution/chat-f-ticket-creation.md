# Brief F — One ticket-creation service across five intake paths

**Read first:** [README.md](README.md) — coordination map, blocker protocol, ground rules.
**Source:** [github-issues-codebase-audit.md](github-issues-codebase-audit.md) issue 8
**Runs after:** brief 0. Coordinate with B, C and E — this crosses all three.
**Reserved migrations:** `0036` – `0037`, and only if a defaulting fix needs one.
**Status file you own:** `context/plans/oss-adoption/execution/status/chat-f.md`

## Mission

**This is a correctness brief, not an organization one.** Tickets are inserted through five production
paths, each of which independently decides which creation invariants to apply. They disagree, and the
disagreements are silent — a ticket created through the request catalogue is a different shape of record
from one created through the portal, and nothing surfaces that.

The audit found the divergence; the specifics below were re-verified against the tree. Two of them
invalidate outcomes other tiers count as delivered.

## The five paths

| # | Path | Entry point |
|---|---|---|
| 1 | Portal and direct API | `server/routers/index.ts` — the `createTicket` handler |
| 2 | Request catalogue | `server/routers/tier2.ts` |
| 3 | External channel ingestion | `server/routers/tier4.ts` |
| 4 | Inbound email | `server/mail/db.ts` |
| 5 | Recurrence generation | `server/scheduling-runtime.ts` |

After brief 0 these live in domain files; locate them by handler name.

## Confirmed divergence

**Ticket numbering — two paths allocate nothing.** `ticketNumberCounters` and `ticketNumberHistory` are
written by exactly three of the five: `routers/index.ts`, `mail/db.ts` and `routers/tier4.ts`. The
catalogue path in `tier2.ts` and the recurrence path in `scheduling-runtime.ts` never touch either. **A
catalogue-requested ticket and a recurring ticket therefore have no human-readable reference**, so they
cannot be found by `lookupTicket`, cannot be quoted to an employee, and cannot be matched by inbound
email threading — which matches on retained reference tokens. Tier 1 counts T1.K as delivered; it is
delivered on three paths out of five.

**SLA attachment is hardcoded on one path and absent on others.**
`server/routers/tier4.ts:490` calls `attachTicketStopwatches(result.ticketId, "P3")` — a literal — on the
line after the handler has computed a real priority. Every channel-created ticket gets a P3 clock
regardless of its impact and urgency. The catalogue, email and recurrence paths attach no stopwatch at
all, so those tickets have no SLA state and are invisible to the breach sweep.

**Rules, audit, indexing and the creation event are applied unevenly.** The portal path evaluates rules,
records firings, writes rule-attributed audit rows, indexes the ticket and fires `ticket.created`. The
email path records firings but writes no audit rows. The catalogue and recurrence paths do none of it.
So a rule that would classify a ticket does so only when the ticket arrived one particular way.

**Verify each of these yourself before you change it.** They were confirmed by inspection, not by running
each path end to end, and brief 0 has moved the code since.

## What to build

One domain-owned creation service — `api/src/server/tickets/create.ts` after brief 0's layout — owning
the transaction and the invariants shared by every ticket, and taking explicit source-specific input:

```ts
createTicket({
  source: "portal" | "catalogue" | "email" | "channel" | "recurrence",
  reporterId, title, body,
  serviceId, serviceSubcategoryId,
  origin, metadata,
});
```

**Centralize only what is genuinely common:** input normalization and defaults, service and subcategory
consistency, rule evaluation and firing persistence, number allocation and history, initial status and
assignment, SLA and OLA attachment, the initial audit or transition record, search indexing, the
`ticket.created` dispatch, and the transaction and failure semantics.

**Leave in each adapter:** parsing, authentication, authorization, deduplication, and anything genuinely
source-specific — the email path's reference matching and duplicate suppression, the channel path's
idempotency on external message id, the recurrence path's occurrence key.

**Decide explicitly which effects are atomic and which run after commit with retry.** Indexing and
workflow dispatch are the obvious after-commit candidates; §6 of tier-3 already says a failed index write
must log rather than fail the request, and today two call sites `await` it unguarded. Write the decision
down in the module, not just in the commit.

## Coordination

This brief reaches into files three other briefs own. Read their status files before you start and tell
them what you changed:

- **Brief B** owns tickets, the SLA module and `startTicketRun`. Your service will call into both.
- **Brief C** owns the catalogue path and is separately removing `category` / `subcategory`.
- **Brief E** owns the mail and channel paths.
- **Brief D** wires the rules-before-model check into the intake paths — the same call sites you are
  consolidating. If D has already landed, your service is where that check belongs; if it has not, leave a
  clearly named seam for it and say so in your status file.

If two of you are live at once, the one who lands second rebases. Say in your status file when you start,
so the others can see it.

## Tests

Table-driven coverage proving the same core invariants for all five sources: portal ticket, catalogue
request, inbound email, external channel message, recurring ticket. Each must come out with a number, a
valid status, a service classification, an SLA stopwatch at its real priority, an audit record, a search
document and a `ticket.created` event.

## Definition of done

- [ ] All five intake paths call one creation service; no adapter inserts into `tickets` directly.
- [ ] Every ticket gets a number and a history row, whatever path created it.
- [ ] SLA and OLA attach at the ticket's real priority — no literal `"P3"` anywhere.
- [ ] Rule evaluation, firing records and rule-attributed audit rows are consistent across sources.
- [ ] Search indexing and `ticket.created` fire for every source, after commit, failing soft.
- [ ] Source-specific authorization, deduplication and idempotency stay in the adapters.
- [ ] Duplicate external messages stay idempotent; recurrence generation stays atomic.
- [ ] Table-driven tests prove equivalent invariants across all five paths.
- [ ] All five component gates pass, run and quoted.
