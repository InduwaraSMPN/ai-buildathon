# Brief A — Identity, authorization and database hygiene

**Read first:** [README.md](README.md) — coordination map, blocker protocol, ground rules, and the list of
things that are already correct and must not be changed.
**Tier document:** [tier-0.md](../tiers/tier-0.md)
**Reserved migrations:** `0017` – `0019` — `0016` is held by brief P
**Status file you own:** `context/plans/oss-adoption/execution/status/chat-a.md`

## Mission

You own the two blockers that make the running system unusable, and the database hygiene nobody else will
get to. **Four other sessions are running in parallel and several of them cannot verify their work by hand
until your first two tasks land, so do those first and record in your status file the moment they are
done.**

Tier 0's authorization half is genuinely finished — 140 contract procedures, 132 capability-gated, deny-by-
default enforced structurally. The identity half is not. Nothing you need to build is a redesign.

## What you own

```
axioma/api/src/auth/                          (all)
axioma/api/src/server/authorization.ts
axioma/api/src/contracts/identity.ts
axioma/api/src/server/routers/identity.ts
axioma/api/src/db/schema/{auth,org,rbac}.ts
axioma/api/src/shared/index.ts                (capability list)
axioma/dashboard/src/features/admin/
axioma/dashboard/src/routes/_auth/admin.*.tsx
```

Brief 0 ran first and moved the admin procedures out of `routers/index.ts` and `contracts/index.ts` into
the domain files named above; both `index.ts` files are now composition only. **The `file:line`
references below were captured before that move — locate by procedure or symbol name, which the refactor
preserved exactly.** Read `status/chat-0.md` for the final domain-to-file map.

Task A7 touches the duplicated capability list. Brief 0 moved the contract-side copy into
`contracts/shared.ts`, which every session reads — check `status/chat-0.md` for where it landed before
you change it.


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

### A1 — A write path for `user.kind` · BLOCKER

**Confirmed:** no code anywhere writes `user.kind = 'staff'`. Every occurrence of the literal across
`api/src`, `dashboard/src` and `portal/src` is a read, a zod enum, a type declaration, or an unrelated
concept (`ticketMessages.authorType`, knowledge `audience`). Better Auth declares the field
`input: false` at `api/src/auth/index.ts:29`; directory sync hard-codes `reporter` at
`api/src/server/directory/store.ts:94`. Because `dashboard/src/routes/_auth/route.tsx:22` redirects
non-staff to the portal, **the dashboard is unreachable for every account.**

Two consequences, both confirmed:
- `listTicketAssignmentOptions` filters `eq(user.kind, "staff")` (`routers/index.ts:1235`, also `:1309`),
  so it always returns an empty list and assignment to a person can never succeed.
- `assignDefaultReporterRole` returns early for non-reporters (`server/authorization.ts:18`), so the first
  staff user created after your fix would receive **no roles at all**.

**Build:**
- A `setUserKind` procedure gated on `admin.roles`, taking a user id and `staff | reporter`. Record the
  change in `role_grants` the way `assignRole` already does, with the acting user's id.
- Extend `assignDefaultReporterRole` to assign *IT Analyst* for `staff` and *Employee* for `reporter`.
  Rename it if the name no longer fits what it does.
- Map an identity-provider claim or directory attribute to `staff` in
  `api/src/server/directory/store.ts` — a configurable attribute name, not a hard-coded one. If you
  cannot settle the attribute name without the user, pick `department`-style precedent from the existing
  code, state your assumption in the status file, and keep going.

### A2 — Bootstrap an administrator · BLOCKER

**Confirmed:** migration `0009_tier0_identity_rbac.sql:124` backfills *IT Analyst* only to users present
when it ran. This database had none, so it was a no-op. Live counts: two users, both `reporter`;
*IT Analyst* zero holders; *Platform Engineer* zero holders; zero teams. Nobody holds `admin.roles`, and
the screen that would grant it is gated behind it.

**Build:** an environment-driven bootstrap — add `AXIOMA_BOOTSTRAP_ADMIN_EMAIL` to `api/src/env.ts` as an
optional value, and on startup grant that account *Platform Engineer* and `kind = 'staff'` if it exists.
Make it idempotent and log what it did. A seed script is an acceptable alternative if you prefer it;
say which you chose and why.

### A3 — Guard the last administrator

**Confirmed:** `updateRoleCapabilities` (`routers/index.ts:1858`) deletes and rewrites a role's whole
capability set with no protection for system roles and no check on the last `admin.roles` holder. One
unchecked box permanently locks every administrator out with no in-product recovery.

**Build:** refuse any write that would leave zero users holding `admin.roles`, counting direct and team
grants the way `resolveCapabilities` does. Return a named conflict, not a generic error. Consider an
`is_system` flag on `roles` for the three seeded roles.

### A4 — Teams and departments a human can create

**Confirmed:** `updateTeam` requires a pre-existing row, and the only code that creates teams or
departments is `applyDirectorySync` (`server/directory/store.ts:143-195`). Without a directory provider,
`teams` and `departments` cannot be populated at all, so `team_roles` and the team leg of
`resolveCapabilities` are dead. Live: zero teams, zero departments.

**Build:** `createTeam`, `createDepartment`, and enough of an update path to place a team under a
department and a person on a team. Gate on `admin.settings` or `admin.roles` — pick one, and say which.

### A5 — The admin UI people actually need

**Confirmed:** `dashboard/src/features/admin/` holds only `roles-page.tsx`, which covers `listRoles` and
`updateRoleCapabilities`. `assignRole`, `listTeams` and `updateTeam` are published, gated and called from
nowhere. A role's capabilities can be edited but a role cannot be granted to a person.

**Build:** role assignment, team and department management, and a control for A1's `setUserKind`. Follow
the existing page's shape — shadcn `Table` and `Checkbox`, the same route-guard pattern as
`routes/_auth/admin.roles.tsx:5`.

### A6 — Route-level capability guards

**Confirmed:** only `admin.roles.tsx` carries a route guard. Staff routes — `assets`, `suppliers`,
`mail-templates`, `software-licences`, `workflows` — are reachable by any staff user and fail with a
server `FORBIDDEN` rather than redirecting, even where `app-sidebar.tsx:84-110` already hides them.

**Build:** the same `beforeLoad` guard on each staff route, keyed to the capability the underlying
procedure requires.

### A7 — One capability list

**Confirmed:** the list is written three times — `api/src/shared/index.ts:16`, `api/src/contracts/index.ts:200`,
and `dashboard/src/features/admin/roles-page.tsx:16`. §5 of tier-0 sanctions the contract copy, because
contracts may only import zod and `@orpc/contract`. The dashboard copy is a third source of truth and
nothing asserts the three agree.

Also: `role_capabilities_key_check` is a hand-maintained SQL `CHECK` list. Migration `0009:55` omitted
`ticket.update` and `0015` had to repair it. It will drift again.

**Build:** derive the dashboard matrix from what `listRoles` returns, or add a test asserting the lists
match. Add a test that the database `CHECK` list equals `CAPABILITIES`.

### A8 — Index the foreign keys

**Confirmed:** 63 foreign-key columns have no leading index. The ones on hot paths matter most —
`tickets.assignee_id`, `tickets.owner_id`, `tickets.team_id`, `tickets.pending_reason_id`,
`tickets.merged_into_id` all back the queue, its facets and "My queue".

**Build:** one migration adding the missing indexes. Run this query to regenerate the list rather than
trusting a copy:

```sql
SELECT c.conrelid::regclass::text AS tbl,
       (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS fk_cols
FROM pg_constraint c
WHERE c.contype = 'f' AND connamespace = 'public'::regnamespace
  AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid
    AND (i.indkey::int2[])[0:array_length(c.conkey,1)-1] = c.conkey)
ORDER BY 1;
```

Skip any table another brief is likely to reshape — `forms`, `mailboxes`, `cmdb_relationship_types` — and
note the skip. Mirror every index into the Drizzle schema so `drizzle-kit check` stays clean.

---

## Definition of done

- A staff account can be created, reaches the dashboard, and holds capabilities. **Say so in your status
  file as soon as this is true — four other sessions are waiting on it.**
- An administrator exists on a fresh database with no hand-written SQL.
- The last `admin.roles` holder cannot be removed.
- Teams and departments are creatable, and a person can be placed on a team, from the dashboard.
- Every staff route redirects rather than erroring when the capability is missing.
- The capability list has one source of truth, or a test that proves the copies agree.
- The foreign-key index migration is applied and `drizzle-kit check` is clean.
- All five component gates pass, run and quoted.
