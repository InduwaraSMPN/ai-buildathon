# Brief E — Mail, inventory, origins, dead tables

**Read first:** [README.md](README.md) — coordination map, blocker protocol, ground rules, and the list of
things that are already correct and must not be changed.
**Tier document:** [tier-4.md](../tiers/tier-4.md)
**Reserved migrations:** `0032` – `0035`
**Status file you own:** `context/plans/oss-adoption/execution/status/chat-e.md`

## Mission

Tier 4 is 6 of 9 — the strongest tier in the programme. All four of its high-risk invariants hold:
threading is by reference and never by subject, snooze is a computed comparison with no snoozed status in
code or in the live `ticket_statuses` table, the attachment allow-list and inherited visibility are
enforced server-side over the Tier 1 case-log mechanism, and directory sync ships a preview that writes
nothing, leaver-marking instead of deletion, and a 40% shrink brake reporting both counts, each tested.

Three milestones stop one step short, and each fails differently. You also own the largest share of the
fifteen dead tables.

## What you own

```
axioma/api/src/server/mail/
axioma/api/src/server/inventory.ts
axioma/api/src/server/{status,scheduling,channel-ingestion,software-compliance}.ts
axioma/api/src/server/{assets,documents,directory}/
axioma/api/src/contracts/{assets,scheduling,status,mail,documents,suppliers,devices}.ts
axioma/api/src/server/routers/{assets,scheduling,status,mail,documents,suppliers,devices}.ts
axioma/api/src/db/schema/{mail,channels,assets,inventory,software-licences,status,documents,scheduling,suppliers,dashboards,identity-providers,templates}.ts
axioma/dashboard/src/features/{tier4,devices}/
axioma/dashboard/src/routes/_auth/{devices,assets,suppliers,mail-*,software-licences,calendar}.tsx
axioma/portal/src/features/status/
axioma/portal/src/routes/status.tsx
axioma/cli/                                   (all)
```

Brief 0 ran first and split the old `contracts/tier4.ts` and `routers/tier4.ts` — seven unrelated domains
in one file — into the domain files above. **The `file:line` references below were captured before that
move — locate by procedure or symbol name, which the refactor preserved exactly.** Read
`status/chat-0.md` for the final domain-to-file map.

Brief D will make one small edit to `server/mail/db.ts` around `:196` and `:251` — the rules-before-model
call and the missing audit rows. Expect it; do not do it yourself.

Brief B owns `portal/src/features/tickets/copy.ts`. Your copy work goes in
`portal/src/features/status/copy.ts`, which is a different file — no conflict.


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

### E1 — Surface the device inventory · the milestone's whole point

**Confirmed:** the collection half is genuinely done and correct. The Windows CLI collects real data —
`Win32_DiskDrive`, `Win32_ComputerSystem` / `BIOS` / `OperatingSystem` / `Processor`, and both Uninstall
registry hives (`cli/internal/device/inventory_windows.go:10-38`) — parsed with `DisallowUnknownFields`
(`inventory.go:77-98`) and shipped on a 24-hour ticker over a dedicated `DeviceMessage_Inventory` path
(`daemon.go:19, 207-241`), correctly **not** through `device_read_state`, whose six diagnostic facets are
untouched exactly as decided. The API ingests it with a reconciling upsert and delete-missing
(`server/grpc.ts:564-568` → `server/inventory.ts:57-235`).

Then the path stops. **`assetDisks`, `assetHardware` and `inventoryReports` appear only as inserts and
deletes in `server/inventory.ts` — there are no reads anywhere in the codebase.** No procedure, no
contract field, no UI. Only software surfaces, and only indirectly through `readSoftwareCompliance`
(`routers/tier4.ts:688-741`). `dashboard/src/routes/_auth/devices.tsx` shows no inventory at all.

**Build:** a `readDeviceInventory` procedure — or extend `listAssets` — joining `asset_devices` to
`asset_disks`, `asset_hardware` and `software_inventory_apps` with `inventory_reports.reportedAt`, and
render it on the device or asset detail.

**Optional, if budget allows:** `inventory_darwin.go` and `inventory_linux.go` using `system_profiler`,
`lsblk` and `dpkg`/`rpm`. Today `inventory_other.go:10-12` returns `unsupported platform`, mirroring the
shipped facets fallback — a scope note rather than a breach, so record it as handed off if you run short.

### E2 — Mailboxes that can exist, and mail that carries a reference

Two coupled failures. Fix them together, because the second cannot be verified without the first.

**No mailbox can be created.** `mailboxes` has no contract entry, no router procedure, no dashboard page
and no seed; live count is 0. The whole inbound pipeline is dormant in the running system even though it
is well-built and well-tested. Add `listMailboxes`, `upsertMailbox` and `deleteMailbox` under
`admin.settings`, plus a dashboard page.

**No outbound mail carries a ticket reference.** `selectTemplateRule` and `renderTemplate`
(`server/mail/templates.ts:11-44`) have **zero non-test callers** — verified by repo-wide grep. Every real
send passes the workflow action's static `title` and `body` (`server/workflows/runtime.ts:79-81, 121`), so
no template is selected and no merge code is expanded; `[ticket_url]` and `[ticket_reference]` exist only
in `mail.test.ts:183-192`. Because of that, **T4.A's own done-condition — a reply to a notification landing
on the right ticket — cannot occur**, since the reply has no token for `findTicketReference` to match.

In the notification mail branch, load enabled `email_template_rules`, call `selectTemplateRule`, render
through `renderTemplate` with `ticket_reference` and `ticket_url`, and fall back to the raw title and body
when no rule matches. At minimum, prefix the subject with the ticket's `number` for ticket sends. Seed a
default template and rule.

**Do not change the threading logic.** `server/mail/inbound.ts:60-93` matches retained ticket-reference
tokens from `ticket_number_history` with a word-boundary regex, and `mail.test.ts:28-52` asserts
`"Re: printer issue"` does not match while `"Fwd: [OLD-0042] printer"` does. That is the plan's standard
and it is met. If you think RFC 5322 `Message-ID` / `In-Reply-To` threading should be added on top —
headers are persisted at `db/schema/mail.ts:56-59` and never consulted — put it to the user rather than
changing it unilaterally.

**One performance fix:** `server/mail/db.ts:119-124` issues an unbounded `select` over
`ticket_number_history` and regex-scans the whole set in JavaScript for every inbound message, growing
linearly with all numbers ever issued. Extract reference-shaped tokens from the message first and look
those up with an indexed `inArray`.

### E3 — Make the mail audit trail readable

**Confirmed:** the tier's risk table promises every inbound decision is recorded in `mailbox_activity_log`,
and it is — but **nothing reads it**, and nothing reads `inbound_emails` either. The audit trail is
write-only. Add `listMailboxActivity` and surface it beside the existing mail send log at
`dashboard/src/routes/_auth/mail-log.tsx`.

### E4 — One origin vocabulary

**Confirmed:** gap row 4.4 and the cross-tier "one vocabulary per concept" decision want a single origin
vocabulary. There are three representations and a dead table:

- `ticket_origins` — a lookup table, **empty**, seeded by nothing, and referenced only by
  `messaging_channels.default_origin_id`. No router or contract code touches it at all.
- `mailboxes.ticket_origin` (`db/schema/mail.ts:34`) — unconstrained free text.
- `messaging_threads.origin_key` (`db/schema/channels.ts:55`) — unconstrained free text.

Make `mailboxes.ticket_origin` and `messaging_threads.origin_key` foreign keys into `ticket_origins`, seed
the origin rows (portal, email, chat, monitoring, phone), and select from them in E2's mailbox page.

### E5 — Clear your share of the dead tables

Each of these exists in the database, is declared in the Drizzle schema, and is **read and written by
nothing** in `api/src` — confirmed for both Drizzle symbols and raw SQL. Wire each one or drop it, and say
which you chose and why.

| Table | Context |
|---|---|
| `sso_identities` | Better Auth's `account` table already holds the issuer and subject linkage, acknowledged at `auth/oidc.ts:28`. The plan named the table explicitly — either populate it from a Better Auth hook or drop it. |
| `status_incident_updates` | T4.E's incident update stream. The status page works without it, so it is a genuine feature gap rather than clutter. |
| `asset_types`, `asset_locations` | Lookups behind `assets.type_id` and `location_id`. Both empty; nothing reads or writes them, so assets have no type or location. |
| `contract_terms`, `payment_schedules` | T4.H contract detail. Suppliers and coverage windows work; these two do not exist to the application. |

### E6 — Two smaller gaps

- **Configurable widgets have no data.** `dashboard_widgets` drives rendering correctly at
  `dashboard/src/features/overview/components/overview-page.tsx:50, 92-94, 265-278`, but the table is empty
  and nothing seeds a default arrangement, so a new analyst sees whatever the fallback is. Seed a sensible
  default per analyst on first load.
- **The portal status page breaks the copy rule.** `portal/src/routes/status.tsx:21, 25, 34` hardcodes
  three employee-facing strings and `:27` renders `query.error.message` raw to an employee. Move them into
  `portal/src/features/status/copy.ts` and replace the raw error with a written one. Availability itself is
  correct — derived from incidents, with planned change windows subtracted — leave that alone.

### E7 — One decision to put to the user

`server/assets/import.ts:28-36` writes imported CSV columns into the `assets.attributes` jsonb, a second
per-asset attribute mechanism alongside the Tier 3 dynamic fields the same router already exposes
(`routers/tier4.ts:280-294`). §5 says assets use the Tier 3 mechanism rather than a second one.

The defensible reading is that `attributes` holds raw import provenance and dynamic fields hold declared
data. If you agree, write that into the schema comment and map declared profile columns onto dynamic
fields. If you disagree, put it to the user. Brief D owns the dynamic-fields module, so coordinate through
your status file rather than editing it.

---

## Definition of done

- A device's disks, hardware and software are visible in the dashboard on the path the CLI already feeds.
- A mailbox can be created from the dashboard, and a reply to an outbound notification threads onto the
  right ticket.
- The inbound decision log is readable.
- Origin is one vocabulary with seeded rows and no free-text columns.
- Every table in E5 is either wired or dropped, with the choice recorded.
- Every employee-facing string on the status page originates in `features/status/copy.ts`.
- All five component gates pass, run and quoted.
