# Tier 0 — Identity and authorization

**Document role:** Adoption plan for the authorization prerequisite
**Parent:** [oss-adoption.md](../oss-adoption.md) · **Next:** [tier-1.md](tier-1.md)

Everything in Tiers 2 and 4 that records a human decision — a CAB vote, an approval, who may read a
knowledge article — depends on this tier. It reverses a decision `architecture.md` states explicitly,
and §5 gives the reason.

---

> ### Where the current truth lives
>
> **The current-state section below is a snapshot taken before this tier was built.** It is kept as
> written because the milestones, decisions and definition of done are argued from it. It no longer
> describes the tree.
>
> The fresh 2026-08-29 post-close-out audit found **5 of 5 milestones complete**. Identity administration is wired
> end to end, and the live database contains a staff administrator with the required role grants.
>
> Section 7 remains the definition of done; [../execution/chat-a-identity.md](../execution/chat-a-identity.md)
> is retained as execution history.

## 1. Current state

The MVP shipped and every gate is green (`biome` and `tsc --noEmit` clean in `api`, `dashboard` and
`portal`; `pnpm test` 7 passing under `tsx --test`; `ruff` clean and 36 pytest passing in `agent`;
`go vet`, `go build` and 34 tests passing across 5 packages in `cli`).

**Authentication exists. Authorization does not.**

`api/src/server/orpc.ts` is 26 lines and holds the whole access-control story:

```ts
const requireAuth = os.middleware(async ({ context, next }) => {
  if (!context.session?.user) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { session: context.session } });
});
export const protectedProcedure = os.use(requireAuth);
```

Fourteen of the fifteen contract procedures use `protectedProcedure`. Any signed-in account can call
any of them: close anyone's ticket, cancel any run, enrol any device, read every transcript. This is
`architecture.md`'s stated position — *"Nothing checks authorization. Any authenticated user can call
any procedure"* — and it names authorization as one of the two things to fix first if the system moves
past a demo.

**Identity is a single flat table.** `db/schema/auth.ts` has Better Auth's `user` with
`id, name, email, emailVerified, image, createdAt, updatedAt`. There is no notion of an IT staff member
versus an employee who reports tickets. The distinction is currently made per-procedure by filtering:
`listTickets` takes `scope: "mine" | "all"`, and `getMyTicket` returns a ticket shape with no `runs`.
Both are shape-based mitigations chosen precisely because no permission check exists — see
[portal.md](../../completed/portal.md), which argues that case explicitly.

**There are no teams and no departments.** Assignment is `tickets.route`, a six-value enum
(`unassigned`, `infrastructure`, `device`, `application`, `identity`, `human_triage`). It names a
destination, not a person or a group, so nothing can be assigned *to* anyone.

### Gap rows this tier owns

| # | Capability | Axiōma today | Source model |
|---|---|---|---|
| 0.1 | Roles and capabilities | Nothing | FreeITSM `rbac_roles` → `rbac_role_capabilities` (capability keys) → `rbac_analyst_roles` / `rbac_team_roles`. Znuny `acl` + `acl_ticket_attribute_relations` for the field-level layer |
| 0.2 | Staff vs end-user identity split | One flat `user` table | FreeITSM separates `analysts` from `users`, with `teams`, `departments`, `analyst_teams`, `department_teams` |

---

## 2. Gaps

1. No permission model of any kind; `requireAuth` is the only gate.
2. No way to tell an IT staff member from a reporter, so no procedure can differ by who is asking.
3. No teams or departments, so nothing can be owned by a group.
4. Assignment names a route rather than a person, so a queue cannot be "mine".
5. The portal's data boundary is enforced by procedure shape alone — correct as a defence in depth,
   wrong as the only defence.
6. No audit of who was granted what.

---

## 3. Milestones

### T0.A — Person model

**Files:** `api/src/db/schema/auth.ts`, new `api/src/db/schema/org.ts`, new migration.

Add `kind` to the Better Auth `user` table — `staff | reporter`, defaulting to `reporter` — rather than
splitting into two tables as FreeITSM does with `analysts` and `users`. Better Auth owns that table
through its Drizzle adapter, and forking it costs more than the separation returns. A discriminator
gives the same query power.

Add `departments`, `teams`, `team_members` and `department_teams`, following FreeITSM's shape. A person
belongs to zero or more teams; a team belongs to a department.

Add `job_title`, `phone` and `manager_id` (self-referencing) to `user`. FreeITSM's point that "the staff
who hold equipment are largely the staff who never log in" applies here too, and a manager relationship
is the prerequisite for any approval chain in [tier-2.md](tier-2.md).

**Done when:** a person can be marked staff, placed in a team, and that team resolved to a department;
existing accounts default to `reporter` with no data loss.

### T0.B — Roles and capabilities

**Files:** new `api/src/db/schema/rbac.ts`, `api/src/shared/index.ts`, new migration.

Transcribe FreeITSM's model: `roles` → `role_capabilities` (a role holds a set of capability keys) →
`user_roles` and `team_roles` (a person holds roles directly and through their teams). Effective
capabilities are the union.

Capability keys are namespaced strings declared as a const array in `api/src/shared/index.ts` beside the
existing vocabulary, so an unknown key is a compile error:

```
ticket.read.own   ticket.read.all   ticket.create   ticket.resolve   ticket.close
ticket.escalate   ticket.reclassify ticket.assign   ticket.reopen
run.start         run.cancel        run.read
device.read       device.enroll     device.command
stats.read        admin.roles       admin.settings
```

Seed three roles covering the real personas from `idea.md`: **Employee** (`ticket.create`,
`ticket.read.own`), **IT Analyst** (everything on tickets, runs and devices), **Platform Engineer**
(analyst plus `admin.*`).

**Done when:** the seeded roles exist, a person's effective capability set resolves through both direct
and team grants, and the set is exposed on the session.

### T0.C — Enforcement

**Files:** `api/src/server/orpc.ts`, `api/src/server/context.ts`, `api/src/contracts/index.ts`.

Add `requireCapability(key)` beside the existing `requireAuth` in `api/src/server/orpc.ts` — the same
place, the same shape, composed after it — and a `staffProcedure` / `reporterProcedure` pair so the
common cases read cleanly at the call site.

`createContext` resolves the capability set once per request and puts it on the context, so a procedure
checking two capabilities does not query twice.

**Deny by default.** Every procedure names its capability; a procedure that names none fails to build.
This is the only arrangement that survives someone adding a sixteenth procedure in six months.

Two procedures need capability *variants* rather than a single key, and they are the two the portal
depends on: `listTickets` with `scope: "all"` requires `ticket.read.all` while `scope: "mine"` requires
only `ticket.read.own`; `getTicket` (which returns full transcripts) requires `ticket.read.all`, while
`getMyTicket` requires `ticket.read.own` **and** ownership of the row.

Keep both shape-based mitigations exactly as they are. `getMyTicket` returning no `runs` was the right
call when no permission model existed and remains the right call now: defence in depth means a bug in
the capability check still cannot leak a transcript to an employee.

**Done when:** an account without `ticket.close` receives `FORBIDDEN` from `updateTicket`; an account
with `ticket.read.own` cannot read another person's ticket through any procedure; and every procedure in
`appContract` names its capability.

### T0.D — Frontends

**Files:** `dashboard/src/features/tickets/components/allowed-actions.ts`, `dashboard/src/routes/_auth/route.tsx`,
`portal/src/routes/_auth/route.tsx`, both `src/utils/orpc.ts`.

`allowed-actions.ts` already derives which controls to show from ticket status — it is exactly the right
seam, and it gains a second input. A control is offered when the transition is legal **and** the viewer
holds the capability. The function keeps one home, and the UI still cannot offer an action the server
would reject.

Both `_auth/route.tsx` guards gain a `kind` check: the dashboard requires `staff`, the portal admits
either. A reporter reaching the dashboard is redirected rather than shown an empty queue.

The capability set arrives on `privateData`, which already returns the session user and is already
called at load.

**Done when:** a reporter signing into the dashboard is redirected to the portal; an analyst without
`ticket.assign` sees no assign control; and no control is present that the server would refuse.

### T0.E — Administration

**Files:** `api/src/contracts/index.ts`, `api/src/server/routers/index.ts`, new
`dashboard/src/features/admin/`.

Procedures: `listRoles`, `getRole`, `updateRoleCapabilities`, `assignRole`, `listTeams`, `updateTeam` —
all gated on `admin.roles`. A `role_grants` audit table records who granted what to whom and when,
following the same shape as the existing `ticket_transitions`, which already records actor and time for
lifecycle changes and is the pattern to copy rather than invent.

A dashboard screen lists roles and their capability sets as a matrix. Sourced from shadcn `table` and
`checkbox`, both already present in `dashboard/src/components/ui/`.

**Done when:** a role's capabilities can be edited from the dashboard, the change takes effect on the
holder's next request, and the grant is recorded with its actor.

---

## 4. Cross-component impact

| Component | Impact |
|---|---|
| `api` | Two new schema modules (`org.ts`, `rbac.ts`), two migrations, `orpc.ts` gains one middleware, every procedure gains a capability annotation, contract grows by six admin procedures. |
| `dashboard` | `allowed-actions.ts` gains a capability input; route guard requires `staff`; one new admin feature folder. |
| `portal` | Route guard admits `reporter`; nothing else changes. The portal is already the least privileged surface. |
| `agent` | **None.** Axel authenticates over gRPC, not oRPC, and still holds no credentials. Capabilities govern humans calling procedures. Do not conflate the two boundaries. |
| `cli` | **None.** `enrollDevice` gains the `device.enroll` capability on the oRPC side; the device's own gRPC hello path is unchanged. |

**Required by later tiers:** [tier-2.md](tier-2.md) approvals and CAB voting need `T0.B`;
[tier-1.md](tier-1.md) assignment-to-a-person needs `T0.A`'s teams; [tier-3.md](tier-3.md) API keys
reuse `T0.B`'s capability vocabulary rather than defining a second permission model.

---

## 5. Decisions taken

**This reverses `architecture.md`, and the reason is specific.** Not "authorization is good practice" —
the reason is that several capabilities in later tiers *record decisions nobody is authorised to make*.
CAB voting where anyone can cast anyone's vote is a form, not an approval. An approval gate with no
notion of who may approve gates nothing. `knowledge_articles.is_restricted` where every reader sees
every article is a column that lies. Shipping those without enforcement is worse than not shipping
them, because a missing feature is visible and a fake one is not. `architecture.md` is updated in the
same change rather than left to contradict the code.

**A `kind` discriminator on `user`, not two tables.** Better Auth owns that table through its Drizzle
adapter; a second identity table means two sources of truth for "who is this" and a join on every
query. FreeITSM's `analysts` / `users` split is right for a system that owns its own auth and wrong
here.

**Capability keys as a const array in `api/src/shared/index.ts`.** They join `TICKET_STATUSES`,
`RECORD_TYPES` and the rest, so a typo is a compile error rather than a silent permission hole. The
contract duplicates them, as it already duplicates every other enum — the `@orpc/contract` + `zod`-only
import rule forces that, and `contracts/index.ts` already carries the comment saying so.

**Deny by default; a procedure with no capability fails to build.** Allow-by-default degrades the first
time someone adds a procedure in a hurry, and that is exactly when it matters.

**Keep the shape-based portal boundary.** `getMyTicket` returning no `runs` predates this tier and
survives it. Two independent mechanisms — the data shape and the capability check — mean a bug in
either still does not put a model transcript in an employee's browser.

**Roles are seeded, not invented at runtime.** Three roles matching the three personas in `idea.md`.
A permission system nobody configures should still be correct on the day it ships.

**No field-level ACLs yet.** Znuny's `acl_ticket_attribute_relations` controls which fields are editable
in which state by whom. Richer, and nothing in Tiers 1–4 needs it. Named here so a later reader knows it
was considered.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Adding a check to all fifteen procedures at once risks locking the team out of a working system. | Seed roles and grant every existing account the IT Analyst role in the same migration, so the day this lands nothing changes behaviourally. Restriction happens by narrowing grants afterwards, which is reversible. |
| A half-landed permission model is worse than none — some procedures checked, some not, with no way to tell which. | Deny by default at the builder level: a procedure that names no capability does not compile. There is no partial state to land in. |
| Capability resolution on every request adds a query to the hot path. | Resolve once in `createContext`, which already runs `auth.api.getSession` per request, and cache the union on the context. One extra query per request, not per check. |
| Reversing a documented architecture decision leaves two contradicting documents. | `architecture.md`'s "What This Architecture Does Not Do" section is edited in the same change. A plan that quietly contradicts the architecture doc is how the two drift permanently. |
| The dashboard could show controls the server refuses, or hide ones it allows. | `allowed-actions.ts` is the single derivation for both status legality and capability, and it is already tested (`allowed-actions.validation.mjs`). Extend that test rather than adding a second code path. |
| Teams and departments are modelled here but nothing uses them until Tier 1 assignment. | Accepted deliberately: they are two tables with no behaviour, and building them alongside roles is cheaper than a second migration later. Tier 1's first milestone consumes them immediately. |

---

## 7. Definition of done

1. All five components' gates still pass: `biome`/`tsc` in the three TypeScript projects, `pnpm test`
   in `api`, `ruff`/`pytest` in `agent`, `go vet`/`go build`/`go test` in `cli`.
2. Every procedure in `appContract` names a capability; a procedure naming none fails to compile.
3. An account lacking `ticket.close` receives `FORBIDDEN` from `updateTicket` with `action: "close"`.
4. An account with only `ticket.read.own` cannot read another person's ticket through `listTickets`,
   `getTicket` or `getMyTicket`.
5. `getMyTicket` still returns no `runs` and no `agent_steps` field, unchanged from the MVP.
6. A reporter is redirected away from the dashboard; an analyst reaches it.
7. The dashboard offers no control the server would refuse, verified through `allowed-actions`' existing
   validation test extended with capability cases.
8. Roles are editable from the dashboard by a holder of `admin.roles`, and every grant is recorded with
   its actor and timestamp.
9. `architecture.md` no longer states that nothing checks authorization.
10. Axel's gRPC path is untouched: it still holds no credentials and still asks the API for every side
    effect.
