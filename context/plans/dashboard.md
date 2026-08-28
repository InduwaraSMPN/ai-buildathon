# Axiōma `dashboard` — implementation plan

**Document role:** Implementation plan for `axioma/dashboard` — the IT-facing web app, :3002
**Related:** [api.md](api.md) (read first), [agent.md](agent.md), [portal.md](portal.md)

Queue, ticket detail with the full transcript, devices, overview. Density suited to someone working it
all day — not a marketing surface and not a demo screenshot.

---

## 1. Current state

### Gates, run 2026-08-29

| Gate | Command | Result |
|---|---|---|
| Lint | `npx biome check .` | Clean, no issues |
| Types | `npx tsc --noEmit` | Clean, no errors |

`src/sdk/contracts/index.ts` is byte-identical to `api/src/contracts/index.ts` apart from the generated
banner. Note that `pnpm check-types` runs `vite build` first, because the router plugin regenerates
`routeTree.gen.ts` which `tsc` then reads.

### What is built and real

**Stack** — TanStack Router with file-based routes, React 19, TanStack Query, Tailwind 4, Vite,
Better Auth client, oRPC client with `createTanstackQueryUtils`. `@tanstack/react-table` and `recharts`
are installed and in use. `@tanstack/react-form` is installed and **not yet used anywhere**.

**Component base** — `components.json` declares style `base-lyra`, base colour `neutral`, Lucide icons.
The seventeen components in `src/components/ui/` are genuine Base UI: `dropdown-menu.tsx` imports
`Menu as MenuPrimitive from "@base-ui/react/menu"`. No Radix anywhere in this project.

Present: `attachment`, `bubble`, `button`, `card`, `checkbox`, `dropdown-menu`, `empty`, `input`,
`input-group`, `label`, `marker`, `message`, `message-scroller`, `skeleton`, `sonner`, `textarea`,
`tooltip`.

**Shell** — `src/components/layout/`: `dashboard-layout.tsx` (fixed 64-unit sidebar, rounded content
panel), `app-sidebar.tsx` (grouped nav with a mobile drawer and an overlay), `header.tsx` (sticky, mode
toggle, user nav, a pathname-derived breadcrumb), `page-container.tsx`, `info-sidebar.tsx`,
`user-nav.tsx`. Skip-to-content link present. Auth gating in `routes/_auth/route.tsx` redirects to
`/login` when there is no session.

**Feature structure** — `src/features/{tickets,devices,agent-runs,overview}/` each with
`api/{service,queries,mutations,types}.ts` and `components/`. Clean and consistent; keep it.

**Queue** — `features/tickets/components/ticket-queue.tsx`. A real `@tanstack/react-table` setup:
sorting, global filter, column visibility, client pagination, empty/loading/error states, links into
detail.

**Ticket detail** — `features/tickets/components/ticket-detail.tsx`. Header, request body, transcript,
metadata list, operator action panel.

**Transcript** — `features/agent-runs/components/agent-transcript.tsx`. Per-run summary cards and an
ordered step list with reasoning, tool input, tool output and errors rendered as labelled blocks, with
per-kind icons.

**Devices** — `features/devices/components/devices-table.tsx`. Connection badge, hostname, user, last
seen with relative time, filter, sorting, pagination.

**Overview** — `features/overview/components/overview-page.tsx`. Four stat cards and two recharts bar
charts.

**Shared UI** — `components/support-ui.tsx`: `StatusBadge` with a per-status colour map, `PageState`
for loading/empty/error, `PageHeader`, `formatDate`, `timeAgo`.

### Defects found while reading

| # | Location | Defect | Severity |
|---|---|---|---|
| B1 | `features/tickets/components/ticket-detail.tsx:118-152` | **Three operator buttons, one behaviour.** "Reassign", "Take over" and "Escalate" all call `update({ action: "escalate", … })` with different route strings. The dashboard cannot resolve, cannot assign, and cannot reopen — because the contract has only `close` and `escalate`. | High |
| B2 | `features/agent-runs/components/agent-transcript.tsx:44-50` | Steps from **all runs are flattened and sorted by timestamp**, interleaving a second attempt with the first. A ticket with two runs shows one confusing merged transcript. | High |
| B3 | `features/agent-runs/api/types.ts` | Types are **hand-declared** rather than inferred from the contract, unlike `features/tickets/api/types.ts` which does it correctly. Includes `evidence?: unknown`, which no contract field supplies — so the transcript renders a field the server can never send. Hand-declared types cannot fail to typecheck when the contract changes, which defeats the point of publishing it. | High |
| B4 | `features/overview/components/overview-page.tsx:29-88` | Fetches **every ticket** and computes all four counts and both charts in the browser. Correct at ten tickets, wrong at ten thousand, and it makes the overview the slowest page in the app. Also constructs seven `new Date()` objects on every render. | Medium |
| B5 | `features/tickets/components/ticket-detail.tsx:56` | `closed` gates the whole action panel, so a `resolved` ticket can still be escalated but a `closed` one cannot be reopened. The gate encodes the wrong state. | Medium |
| B6 | `components/support-ui.tsx:6-22` and `features/devices/components/devices-table.tsx:26-42` | Status colours are hand-rolled `Record<string, string>` maps in two places, because the contract types `status` and `connected` as `z.string()`. Two sources of truth for the same vocabulary. | Medium |
| B7 | `src/components/dashboard-shell.tsx`, `src/components/header.tsx`, `src/components/user-menu.tsx` | Orphaned by the new `components/layout/` shell. Still compiled, still linted, referenced by nothing. | Low |
| B8 | `features/tickets/components/ticket-queue.tsx:109` | `useMemo(() => columns, [])` memoises a module-level constant. | Low |
| B9 | `components/layout/header.tsx:8-12` | Breadcrumbs come from a hardcoded pathname-to-label map, so every new route needs an edit in an unrelated file. | Low |
| B10 | `features/devices/components/devices-table.tsx` | No device detail view and no command history — a device row is a dead end. | Medium |

### What is missing outright

- Every ITIL field: no priority, impact, urgency, category or record type anywhere in the UI.
- Server-side filtering and pagination — everything is fetched whole and filtered in the browser.
- Any way to start, cancel or re-run an agent run from the dashboard.
- Live transcript updates. A run in progress requires a manual refresh.
- Any use of `@tanstack/react-form`, despite it being installed and mandated for forms.
- Route-level pending and error boundaries.
- A command palette, keyboard navigation, or any density affordance for an all-day operator.
- Missing Base UI primitives: `table`, `badge`, `tabs`, `sheet`, `select`, `separator`, `avatar`,
  `popover`, `command`, `dialog`, `alert-dialog`, `scroll-area`, `sidebar`, `breadcrumb`, `collapsible`,
  `field`, `form`, `combobox`, `pagination`, `chart`, `spinner`, `item`, `kbd`, `alert`, `progress`.

---

## 2. Gaps

1. Operator controls do not map to real actions (B1, B5) and cannot until `api.md` widens
   `updateTicket`.
2. The transcript merges runs and renders a field that does not exist (B2, B3).
3. No ITIL classification is displayed, filtered on, or editable.
4. Everything is client-side: filtering, pagination, aggregation (B4).
5. No live view of a run in progress and no control over one.
6. Two hand-rolled status vocabularies instead of one contract enum (B6).
7. Devices are a dead end (B10).
8. Forms use raw `useState`; `@tanstack/react-form` is unused.
9. Two dozen Base UI primitives are missing, so screens get hand-built instead of sourced.
10. Orphaned files and small correctness litter (B7, B8, B9).

---

## 3. Component sourcing

**Where components come from.** `npx shadcn@latest add <name>` resolves against the style declared in
`components.json`, which here is `base-lyra` — a Base UI style, documented at
`ui.shadcn.com/docs/components/base/<name>`. The seventeen components already in `src/components/ui/`
were added this way and are genuinely Base UI. **No Radix adaptation is needed for anything in the
shadcn catalogue**, which is a meaningful saving over the assumption in the brief.

**Where they do not come from.** The workspace contains a downloaded reference dashboard at
`tanstack-start-dashboard-main/`. It is **Radix** (`radix-ui` package, style `new-york`, `iconLibrary:
radix`). Its primitives must not be copied — doing so would introduce a second component library into a
project that has deliberately chosen one. It is useful for exactly one thing: **composition patterns**,
which are framework-agnostic. Specifically worth reading and re-implementing on Base UI:

| Pattern in the template | What it gives | Adaptation |
|---|---|---|
| `src/components/ui/table/data-table.tsx` + `data-table-toolbar.tsx` + `data-table-pagination.tsx` + `data-table-view-options.tsx` | The full data-table composition around `@tanstack/react-table` | Structure ports directly; the toolbar's popovers and menus swap to Base UI equivalents. |
| `src/components/ui/table/data-table-faceted-filter.tsx` | Multi-select column filtering with counts — exactly what a priority/status/category filter needs | Built on Radix `popover` + `cmdk`; re-implement on Base UI `popover` + `command`. |
| `src/hooks/use-data-table.ts` | URL-synchronised table state (sorting, filters, pagination) | Depends on `nuqs`-style parsers; re-implement against TanStack Router search params, which this project already has. |
| `src/components/layout/app-sidebar.tsx`, `header.tsx`, `user-nav.tsx` | Layout composition | Already adapted into this project. Nothing more to take. |
| `src/components/command-menu.tsx` | ⌘K palette composition | Re-implement on Base UI `command`. |
| `src/hooks/use-breadcrumbs.tsx` | Route-derived breadcrumbs, fixing B9 | Router-specific; adapt to TanStack Router matches. |

That adaptation is real work and is accounted for inside the milestones below rather than waved
through.

**Per-screen sources** are named in each milestone.

---

## 4. Milestones

Dependency-ordered. Milestones A–C can start before
`api.md` milestone B lands; D onward depend on it.

### A — Contract uptake and cleanup
**Files:** `features/agent-runs/api/types.ts`, `components/support-ui.tsx`,
`features/devices/components/devices-table.tsx`, delete `components/dashboard-shell.tsx`,
`components/header.tsx`, `components/user-menu.tsx`; `features/tickets/components/ticket-queue.tsx`.

- Rewrite `features/agent-runs/api/types.ts` to infer from the client the way
  `features/tickets/api/types.ts` already does — `Awaited<ReturnType<typeof client.getTicket>>` and
  friends. Drop `evidence?: unknown` until the contract supplies it (fixes **B3**).
- Once `api.md` milestone B tightens `status` and `connected` to enums, replace both hand-rolled colour
  maps with one `Record<TicketStatus, string>` that fails to typecheck if a status is added and not
  handled (fixes **B6**).
- Delete the three orphans (**B7**) and the pointless `useMemo` (**B8**).

**Done when:** `pnpm check-types` passes, no type in `features/*/api/types.ts` is hand-declared, and
adding a status to the contract enum produces a compile error in exactly one file.

### B — Component inventory
**Files:** `src/components/ui/*` (generated).

One pass of `npx shadcn@latest add` for everything the later milestones need:

```
table badge tabs sheet select separator avatar popover command dialog
alert-dialog scroll-area sidebar breadcrumb collapsible field form
combobox pagination chart spinner item kbd alert progress
```

Review the diff — the CLI writes into `src/components/ui/` and the project's existing files must not be
clobbered without inspection. `chart` brings the shadcn recharts wrapper, which replaces the raw
`ResponsiveContainer` usage in milestone H.

**Done when:** all listed components exist, `pnpm check` and `pnpm check-types` pass, and no existing
component was silently overwritten.

### C — Shell, navigation and command palette
**Files:** `components/layout/*`, new `components/command-menu.tsx`, new `hooks/use-breadcrumbs.ts`,
`routes/__root.tsx`, `routes/_auth/route.tsx`.

- Replace the hand-rolled `<aside>` in `app-sidebar.tsx` with shadcn **`sidebar`** (Base UI), keeping
  the current nav groups. It brings collapse-to-icon, a persisted open state and mobile handling that
  the current version approximates.
- Replace the hardcoded label map with route-derived **`breadcrumb`** (fixes **B9**), adapting the
  template's `use-breadcrumbs` pattern to TanStack Router matches.
- Add a **`command`** palette on ⌘K / Ctrl-K: jump to a ticket by ID or title, jump to a device, and
  switch views. For someone working a queue all day this is the difference between navigating and
  hunting. Source: shadcn `command` + `dialog`, composition from the template's `command-menu.tsx`.
- Add route-level `pendingComponent` and `errorComponent` in `routes/_auth/route.tsx` so a slow or
  failed load is a designed state rather than a blank panel.

**Done when:** the sidebar collapses and remembers it, breadcrumbs update from the route with no
per-route edit, and ⌘K opens a palette that navigates to a ticket by ID.

### D — Queue rebuild
**Files:** `features/tickets/components/ticket-queue.tsx`, `ticket-queue-page.tsx`,
`features/tickets/api/{queries,service,types}.ts`, new `features/tickets/components/queue-columns.tsx`,
new `components/ui/table/*`, `routes/_auth/tickets.index.tsx`.

The queue is the screen an IT staff member has open all day, so it gets the most attention.

**Sources:** shadcn **`table`** and **`badge`** primitives; the data-table composition adapted from the
template's `src/components/ui/table/` as described above; faceted filters re-implemented on Base UI
`popover` + `command`.

Columns, in this order because it is triage order: **priority** (P1–P4, colour-weighted), **status**,
**record type** (incident vs service request — a small icon, not a word, to save width), **title** with
ticket ID beneath, **reporter**, **category / subcategory**, **route**, **device** (an icon when one is
linked), **updated**. Default sort: priority ascending, then updated descending.

- **Server-side everything.** Sorting, filtering and pagination move to `listTickets` using the filters
  and `limit`/`cursor` that `api.md` milestone B adds. Table state is synchronised to router search
  params, so a filtered queue is a shareable URL and a browser back button works.
- **Faceted filters** on status, priority, record type and category, with counts.
- **Saved views** as preset search-param combinations pinned above the table: *My escalations*,
  *P1 and P2 open*, *Awaiting confirmation* (status `resolved`), *Unassigned*. This is the single
  highest-value density feature for an all-day operator and costs one component plus a constant.
- **Density**: compact rows by default with a comfortable/compact toggle, a sticky header, zebra-free
  borders, and tabular numerals on every numeric and date column.
- **Row actions** via `dropdown-menu`: open, assign, reclassify, copy ID.
- **Live-ish**: a 15s `refetchInterval` on the queue, paused when the tab is hidden.

**Done when:** filtering to P1 incidents in the `infrastructure` category produces a URL that
reproduces the same view on reload; the network tab shows one request per filter change rather than a
full fetch; and 500 seeded tickets render without the page fetching all of them.

### E — Ticket detail and real operator actions
**Files:** `features/tickets/components/ticket-detail.tsx`, new
`features/tickets/components/ticket-actions.tsx`, `ticket-classification-form.tsx`,
`features/tickets/api/mutations.ts`.

**Sources:** shadcn **`tabs`**, **`badge`**, **`separator`**, **`select`**, **`field`** + **`form`**,
**`alert-dialog`** for destructive confirmations, **`sheet`** for the classification editor.

- **Fix B1.** Once `api.md` milestone C lands `resolve | reopen | reclassify | assign` alongside
  `close | escalate`, each control calls the action it names. Today's three-buttons-one-action is
  replaced by: **Resolve** (with a resolution note), **Close** (only from `resolved` or `escalated`),
  **Escalate** (with a reason and a route), **Assign** (route select), **Reopen** (only from `closed`),
  **Reclassify** (impact, urgency, category, subcategory).
- **Fix B5.** Control availability is derived from the transition table in `api.md` milestone C rather
  than from a single `closed` boolean, so the UI can never offer a transition the server will reject.
  Encode it as one `allowedActions(status)` function and drive both enabled state and tooltips from it.
- **Forms use `@tanstack/react-form`**, per the workspace rule and because these forms now have real
  validation — a resolution note is required on resolve, a reason on escalate. This is the first use of
  the library in the project; the field wrappers from the template's `src/components/forms/fields/` are
  a reasonable structural reference, re-implemented on Base UI `field`.
- **Layout**: a two-column detail with tabs on the left (*Transcript*, *Request*, *Activity*) and a
  metadata rail on the right showing priority, impact, urgency, record type, category, route, device,
  reporter, and the resolved/closed timestamps as distinct rows — the distinction is the point.
- **Priority is displayed, never edited.** Impact and urgency are the editable fields; priority renders
  as a derived badge with a tooltip naming the two inputs it came from. If an operator can type a
  priority, the matrix is decoration.

**Done when:** every action in the transition table is reachable from the UI exactly once, an action
the server would reject is not offered, and editing impact from medium to high visibly changes the
derived priority badge after the mutation settles.

### F — Transcript
**Files:** `features/agent-runs/components/agent-transcript.tsx`, new `run-selector.tsx`,
`step-card.tsx`, `evidence-block.tsx`, `features/agent-runs/api/queries.ts`.

**Sources:** shadcn **`collapsible`**, **`scroll-area`**, **`tabs`**, **`badge`**, **`item`**,
**`kbd`**. The existing hand-built step list is good and is kept as the structure; this milestone
fixes correctness and adds live behaviour rather than restarting.

- **Fix B2.** Group by run. A run selector shows each attempt with its status, model, duration and
  token count; the step list belongs to the selected run. Runs are attempts, not a continuous stream,
  and merging them by timestamp is actively misleading when a second attempt retries the first's steps.
- **Live updates.** Poll `getRun` (added by `api.md` milestone B) on a 2s interval while the run status
  is `running`, stopping when it terminates. Steps are written as they happen server-side, so a hung
  run still shows how far it got — that property only reaches the operator if the client keeps asking.
- **Step rendering**: `think` steps render as prose, `tool_call` shows the tool name and typed input,
  `observation` shows the **evidence line prominently and the full output collapsed**, `decision` is
  visually terminal. Collapse tool output by default: an operator scanning a run wants the shape first
  and the JSON on demand.
- **The escalation proposal.** Scenario 3's whole point is that Axel escalates with the scheduler's
  verbatim message and the patch it would have proposed. That deserves a dedicated block at the top of
  an escalated run — the proposed patch rendered as a diff-like structure with a **Copy** action, and
  the scheduler message quoted verbatim and marked as such. An operator taking over should be able to
  act on it in one read.
- **Cancel run** wired to the `cancelRun` procedure from `api.md` milestone H, behind an
  `alert-dialog`.
- A **Re-run** control that calls `startRun` for a ticket whose previous attempt failed.

**Done when:** a two-run ticket shows two selectable runs with separate step lists; an in-progress run
updates without a manual refresh and stops polling when it terminates; and an escalated scenario-3 run
shows the proposed patch and the scheduler message above the fold.

### G — Devices
**Files:** `features/devices/components/devices-table.tsx`, new `device-detail-sheet.tsx`,
`features/devices/api/{queries,service,types}.ts`.

**Sources:** shadcn **`table`**, **`sheet`**, **`badge`**, reusing the data-table composition from
milestone D.

- Fix **B10**: a row opens a detail sheet with hostname, owner, local username, platform, OS release,
  agent version, enrolment and last-seen timestamps, connection state, and **command history** from the
  `listDeviceCommands` procedure — sequence, action, status, duration, result or error.
- Connection state gets a live dot driven by `lastSeenAt` relative to the gateway's 30s staleness
  window, so "online" in the UI means the same thing it means in the gateway.
- Link a device to its tickets and back.

**Done when:** clicking a device shows its last twenty commands with statuses, and a command dispatched
during a live run appears there within one refetch.

### H — Overview
**Files:** `features/overview/components/overview-page.tsx`, new
`features/overview/api/{queries,service}.ts`.

**Sources:** shadcn **`chart`** (the recharts wrapper added in milestone B), **`card`**, **`badge`**.

- Fix **B4**: counts and time series come from a `ticketStats` procedure rather than from fetching
  every ticket and counting in the browser. See cross-component impact — this procedure does not exist
  yet and is requested from `api.md`.
- Tiles that matter to an IT lead rather than to a demo: **open by priority** (P1 first, and P1 count
  is the number that should be largest on the page), **awaiting confirmation** (`resolved` but not
  `closed` — the queue's silent backlog), **escalated in the last 24h**, **autonomous resolution rate**
  (closed with no human transition, over closed total), and **median time to resolution**.
- Two charts: ticket volume by day split by record type, and outcome mix over time. Both through the
  shadcn `chart` wrapper so tooltips, legends and theming are consistent with the rest of the app
  instead of raw recharts defaults.
- Every tile links into the queue with the matching filter applied — a number an operator cannot click
  through to is decoration.

**Done when:** the overview issues one request regardless of ticket count, every tile navigates to a
filtered queue, and the autonomous resolution rate is computed from real closed tickets.

### I — Density, keyboard and states
**Files:** across `components/` and `features/`.

- Keyboard: `j`/`k` to move rows, `Enter` to open, `e` to escalate, `r` to resolve, `/` to focus
  search, `?` for a shortcut sheet. Shortcuts shown with `kbd` in the command palette.
- Consistent loading, empty and error states via the existing `PageState`, plus route-level pending
  components so navigation never shows a blank panel.
- A11y pass: the queue is a real `<table>` with proper header semantics, every icon-only control has an
  accessible name, focus is visible and trapped correctly in sheets and dialogs, live regions announce
  transcript updates.
- Typography and spacing for density: tabular numerals throughout, a single compact scale, no
  decorative gradients in operator surfaces.

**Done when:** the queue is fully navigable and actionable without a mouse, and every screen has a
designed loading, empty and error state.

---

## 5. Cross-component impact

| Needed from `api` | Why | Status |
|---|---|---|
| ITIL fields on the `ticket` output | Every column and control in milestones D and E | `api.md` milestones A, B |
| `status`/`connected` as enums | Removes the two hand-rolled colour maps (B6) | `api.md` milestone B |
| `updateTicket.action` widened to `resolve \| reopen \| reclassify \| assign` | Fixes B1; without it the dashboard cannot do its job | `api.md` milestones B, C |
| `listTickets` filters plus `limit`/`cursor` | Server-side queue in milestone D | `api.md` milestone B |
| `getRun` procedure | Live transcript polling in milestone F | `api.md` milestone B |
| `startRun` and `cancelRun` procedures | Re-run and cancel controls in milestone F | `api.md` milestones C, H |
| `listDeviceCommands` procedure | Device command history in milestone G | `api.md` milestone B |
| `evidence` on `agentStep` | The evidence block in milestone F; the type already exists here and is currently a lie (B3) | `api.md`, produced by `agent.md` milestone E |
| `ticketStats` procedure | Milestone H — aggregate counts by status, priority and record type, plus a daily series and a median time to resolution, in one call | Requested by this plan, accepted into `api.md` milestone B |

Nothing in this plan edits `src/sdk/contracts/`, which is generated by `cd api && pnpm
contracts:publish` and overwritten. Nothing here edits files outside `axioma/dashboard/`.

---

## 6. Decisions taken

**Source primitives from the shadcn Base UI catalogue, never from the local Radix template.** The
project has one component library by decision and `base-lyra` covers everything needed. Copying Radix
primitives in would put two libraries in one app and split the styling system. Composition patterns are
a different matter and are worth taking, with the adaptation named explicitly in section 3.

**Server-side filtering and pagination, not client-side.** The current pattern is correct at demo scale
and wrong the moment there is a real queue, and retrofitting it later means rewriting every table's
state management. It also makes the overview's "fetch everything and count" pattern impossible to
repeat by accident.

**Table state lives in the URL.** A filtered queue an operator cannot send to a colleague is a
worse tool than one they can. It also makes the browser's back button behave, which is otherwise the
most common complaint about SPA data tables.

**Group the transcript by run.** Runs are discrete attempts. Merging their steps by timestamp is
actively misleading when a retry repeats earlier steps, and the current merge is a defect rather than a
design choice.

**Collapse tool output by default; show evidence expanded.** An operator scanning a failed run wants
the shape of what happened, then one specific payload. Rendering every pod list in full makes the
decisive line — the `ImagePullBackOff` reason, the scheduler's message — impossible to find.

**Priority is rendered, never edited.** Impact and urgency are the inputs; priority is derived. Exposing
priority as an editable field would let the UI contradict the matrix, which is the failure mode the
matrix exists to prevent.

**Derive available actions from the server's transition table.** One `allowedActions(status)` function
drives enabling, tooltips and the confirmation copy. Any other arrangement drifts from the server, and
the current three-buttons-one-action bug is what that drift looks like.

**Infer every type from the contract.** `features/agent-runs/api/types.ts` shows exactly what
hand-declared types cost: a field the server cannot send, rendered by a component, passing typecheck.

**Saved views over a filter builder.** Four named presets covering real triage intents beat a general
query UI nobody configures. They are constants, and they can be replaced by something richer if anyone
asks.

**Keep `recharts`, wrap it in shadcn `chart`.** The dependency is installed and appropriate; the raw
usage just does not match the rest of the app's theming.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Milestones D–H are blocked on `api.md` milestones B and C; starting them early means building against a contract that has not landed. | A, B and C are deliberately independent and can proceed meanwhile. Beyond that, coordinate the contract publish rather than mocking it — a mocked contract that diverges costs more than waiting. |
| `npx shadcn@latest add` writes into `src/components/ui/` and can overwrite hand-edited components. | Run milestone B as a single commit on a clean tree and read the whole diff. Seventeen existing components are Base UI as generated and should show no meaningful drift. |
| The Radix-to-Base-UI adaptation of the faceted filter and URL-synced table state is the least mechanical part of the plan and could overrun. | Named explicitly in section 3 rather than hidden. The fallback is the simpler `dropdown-menu` multi-select already used for column visibility, which is Base UI and already working. |
| Live transcript polling at 2s across several open tickets multiplies API load and Postgres queries. | Poll only the selected run, only while `running`, and only when the tab is visible. `getRun` returns one run's steps rather than the whole ticket. |
| `pnpm check-types` runs a full `vite build` first, so type feedback is slow and may get skipped during a long refactor. | Run `tsc --noEmit` directly for inner-loop feedback, accepting that a renamed route needs the build; run the real gate before every commit. |
| Density work is subjective and can absorb unbounded time. | Milestone I is bounded by a concrete checklist — keyboard map, three states per screen, a11y pass — rather than an open aesthetic brief. |

---

## 8. Definition of done

1. `pnpm check` and `pnpm check-types` pass.
2. No type under `src/features/*/api/types.ts` is hand-declared; all are inferred from the published
   contract. `src/sdk/contracts/` is untouched by hand.
3. Priority, impact, urgency, record type and category are visible in the queue and editable — except
   priority — in ticket detail.
4. Every transition in the API's state machine is reachable from the UI exactly once, and no control is
   offered for a transition the server would reject.
5. Queue filtering, sorting and pagination happen server-side, and the current view is reproducible
   from the URL.
6. A ticket with two runs shows two separate transcripts; an in-progress run updates without a manual
   refresh and stops polling when it ends.
7. An escalated scenario-3 ticket shows the proposed patch and the scheduler's verbatim message above
   the fold, with a working copy action.
8. A device row opens a detail view with its command history, and a command dispatched during a live
   run appears there.
9. The overview issues one request regardless of ticket count, and every tile links to a filtered
   queue.
10. The queue is fully operable from the keyboard, and every screen has a designed loading, empty and
    error state.
11. `src/components/dashboard-shell.tsx`, `src/components/header.tsx` and `src/components/user-menu.tsx`
    are gone.
