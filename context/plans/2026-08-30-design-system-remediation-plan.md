# Dashboard and Portal Design-System Remediation Plan

Date: 2026-08-30
Scope: `axioma/dashboard/`, `axioma/portal/`, `axioma/api/`, `axioma/agent/`, and `axioma/cli/`

This is the single authoritative plan for this work. Every claim below was verified against the
working tree, the running Postgres database, the shadcn `base-nova` registry, and live tool runs on
2026-08-30. Where a fact was verified, the evidence is cited as `path:line` so the implementing agent
does not need to re-derive it.

## Objective

Bring the dashboard and portal into consistent alignment with their existing shadcn `base-nova`
design system while preserving application behavior, agent wire semantics, CLI behavior, and existing
user work. One narrow API contract change is required and is specified in the backend section.

---

# Verified baseline

Read this section before starting. It replaces guesswork about the current state.

## Build gates as they stand today

| Gate | dashboard | portal |
| --- | --- | --- |
| `pnpm check-types` | passes | passes |
| `pnpm validate` | passes, 9 tests | passes, 8 tests |
| `pnpm check` | **fails, 12 errors** | **fails, 12 errors** |

`pnpm check` runs `biome check .` and is red before any remediation work. Both apps fail with six
formatter errors and six `lint/a11y/noSvgWithoutTitle` errors.

Formatter failures, dashboard: `public/site.webmanifest`, `src/components/brand.tsx`,
`src/components/layout/app-sidebar.tsx`, `src/components/sign-in-form.tsx`,
`src/components/sign-up-form.tsx`, `src/routes/__root.tsx`.

Formatter failures, portal: `public/site.webmanifest`, `src/components/brand.tsx`,
`src/components/header.tsx`, `src/features/tickets/copy.ts`, `src/routes/__root.tsx`,
`src/routes/login.tsx`.

`noSvgWithoutTitle` failures in both apps: `public/brand/axioma-logo.svg`,
`public/brand/axioma-logo-dark.svg`, `public/brand/axioma-mark.svg`,
`public/brand/axioma-mark-dark.svg`, and `src/components/brand.tsx` at lines 18 and 37.

Because `pnpm check` is a per-phase gate, Phase 0 makes it green before any other work begins.

## Token and font state

`dashboard/src/styles/globals.css` and `portal/src/styles/globals.css` are **byte-identical**
(md5 `6d373b855ebf2f2398c9c03a6c95c526`). Every token edit is a mirrored two-file edit, and both files
carry the same three defects:

1. `--font-sans: "Inter Variable"` is declared at line 81, but `@fontsource-variable/inter` is not a
   dependency of either app and is not present in either `node_modules`. All body text currently
   falls back to the browser's generic sans-serif. This is a live bug, not a preservation task.
2. `@source "../../../apps/**/*.{ts,tsx}"` at line 6 targets `axioma/apps/`, which does not exist.
3. `html { @apply font-mono; }` at lines 131-133 makes Geist Mono the document default.

Neither file defines `--destructive-foreground`, `--success`, `--warning`, or `--info`, in `:root`,
in `.dark`, or in `@theme inline`. `dashboard/src/components/layout/notification-center.tsx:43`
already emits `text-destructive-foreground` against that undefined token, so it renders as a no-op
today.

Fonts are imported in `globals.css:4-5`, not in `__root.tsx`. `__root.tsx` imports only
`../index.css`, which is a single `@import "./styles/globals.css";` line.

`theme-color` is hard-coded in two places per app: `src/routes/__root.tsx:52` (portal) and
`src/routes/__root.tsx:55` (dashboard) as `#008236`, and `public/site.webmanifest:8` as the same
value. `#008236` is the hex equivalent of the light `--primary`. Both apps set `defaultTheme="dark"`
in `__root.tsx`.

## Installed primitives

Dashboard `src/components/ui/` holds 41 primitives including `message`, `bubble`,
`message-scroller`, `marker`, `attachment`, `table`, `collapsible`, `combobox`, `command`,
`pagination`, `scroll-area`, `sheet`, `sidebar`, `tabs`, `chart`. It has **no** `spinner.tsx`,
`native-select.tsx`, or `radio-group.tsx`.

Portal `src/components/ui/` holds 24 primitives including `spinner`, `radio-group`, `field`, `empty`,
`item`, `alert`. It has **no** `table.tsx`, `native-select.tsx`, `message.tsx`, `bubble.tsx`,
`message-scroller.tsx`, `marker.tsx`, `attachment.tsx`, `collapsible.tsx`, `tabs.tsx`, `popover.tsx`,
`scroll-area.tsx`, `command.tsx`, or `pagination.tsx`.

Five primitives present in both apps have already diverged: `dropdown-menu`, `field`, `input-group`,
`item`, `label`. The divergence is a mix of stray `"use client"` directives (inert in both apps,
which are Vite SPAs), differing a11y `role` attributes and biome suppressions, and one behavioral
regression: `portal/src/components/ui/input-group.tsx` focuses its input from `onClick` and lost the
`event.button !== 0` guard that `dashboard/src/components/ui/input-group.tsx` applies in
`onPointerDown`, so right-click and middle-click steal focus in the portal.

`SelectGroup` has zero usages across both apps despite being exported by `ui/select.tsx:194`.
`DropdownMenuGroup` is used only in `src/components/user-menu.tsx` in each app.

## Registry resolution

Every primitive this plan adds resolves from the configured `base-nova` style. Verified by fetching
`https://ui.shadcn.com/r/styles/base-nova/<name>.json`, all HTTP 200:

| Primitive | npm dependencies | registry dependencies |
| --- | --- | --- |
| `native-select` | none | none |
| `spinner` | none | none |
| `message` | none | none |
| `bubble` | none | none |
| `marker` | none | none |
| `message-scroller` | `@shadcn/react` | `button` |

`message-scroller` is the only one that pulls a package. The dashboard already depends on
`@shadcn/react@^0.2.1`; the portal does not and will gain it. That single small package is accepted.
No conditional dry-run gate is needed for any of these — resolution is already proven.

Registry files ship in 2-space, semicolon-free formatting. Both repos use tabs and double quotes, and
`src/components/ui/` is not excluded by either `biome.json`. Every `shadcn add` is therefore followed
by a targeted `npx biome check --write <the added file>` before the phase gate runs.

## Domain state vocabulary

There are no Postgres enum types anywhere in the database. Every finite set is either a Drizzle
`text(..., { enum: [...] })` TypeScript-level constraint or a runtime lookup table.

Canonical TypeScript vocabulary lives in `api/src/shared/index.ts`. The frontends **cannot** import
it: there is no pnpm workspace and no path alias reaching outside each app's `src/`. Any state map
placed in a frontend is a hand-copied declaration by construction.

| Set | Location | Values |
| --- | --- | --- |
| `STATE_TYPES` | `api/src/shared/index.ts:47-55` | `new, open, pending, resolved, closed, merged, cancelled` |
| `RUN_STATUSES` | `api/src/shared/index.ts:122-130` | `running, resolved, escalated, failed, exhausted` |
| `STEP_KINDS` | `api/src/shared/index.ts:132-139` | `think, tool_call, observation, decision, terminal` |
| `PRIORITIES` | `api/src/shared/index.ts:88` | `P1, P2, P3, P4` |
| `IMPACT_LEVELS` / `URGENCY_LEVELS` | `api/src/shared/index.ts:82,85` | `high, medium, low` |
| `tickets.escalationFlag` | `api/src/db/schema/tickets.ts:89-93` | `none, warning, breach` |
| Ticket relationship kind | `api/src/contracts/tickets.ts:119-124` | `duplicate_of, related_to, caused_by, parent_of` |
| Approval status | `api/src/contracts/catalogue.ts:5` | `waiting_for_approval, approved, rejected` |
| Change status | `api/src/contracts/changes.ts:7-18` | 10 values, `draft` through `cancelled` |
| Knowledge status | `api/src/contracts/knowledge.ts:5` | `draft, published, archived` |
| CSAT rating | `api/src/contracts/tickets.ts:137` | integer 1-5 |

`escalated` is a **run status**, not a step kind. Escalation severity on a ticket is
`escalationFlag`. These three levels are distinct and must not be conflated in the transcript UI.

Ticket status keys are runtime vocabulary held in the `ticket_statuses` table, not a compile-time
set. The database currently holds seven rows: `open, routing, resolving, pending, resolved,
escalated, closed`. Each row carries a `state_type` and an admin-editable `colour`.

The following are free strings in the contract with no finite value set, so no exhaustive semantic
mapping is possible for them without separate backend work: Problem status
(`api/src/contracts/problems.ts:10`), Asset status (`api/src/contracts/assets.ts:114`), Asset custody
action (`api/src/contracts/assets.ts:19`), Mailbox activity decision
(`api/src/contracts/mail.ts:35`), and notification `recordType`
(`api/src/contracts/automation.ts:53`). Treat these with an explicit fallback branch rather than an
exhaustive map.

## Two dynamic-field vocabularies

Ticket dynamic fields and catalogue form fields use **different** enums with different field names.
A single control renderer must handle both, or each surface keeps its own renderer.

| | Ticket dynamic fields | Catalogue form fields |
| --- | --- | --- |
| Contract | `api/src/contracts/automation.ts:107-117` | `api/src/contracts/catalogue.ts:20-28` |
| Discriminator | `fieldType` | `type` |
| Values | `text, textarea, integer, date, datetime, dropdown, multiselect, checkbox, reference` (9) | `text, textarea, number, boolean, date, select, multiselect` (7) |

`number` is not `integer`, `boolean` is not `checkbox`, `select` is not `dropdown`, and the catalogue
vocabulary has no `datetime` and no `reference`.

## Attachment upload is outside the contract

`api/src/contracts/documents.ts:35-47` exposes only `listDocuments`, `createLinkDocument`, and
`unlinkDocument`. File upload and download are raw Hono multipart routes at
`api/src/server/documents/http.ts:140-174` (`POST /api/documents`) and `:176-198`
(`GET /api/documents/:id`). Attachment upload work hand-rolls a `FormData` fetch and cannot go
through the generated SDK client.

## Contract and proto mirroring

`api/scripts/publish-contracts.mjs` publishes `api/src/contracts/*` into
`dashboard/src/sdk/contracts/*` and `portal/src/sdk/contracts/*`, and copies `api/proto/axioma.proto`
into `agent/proto/` and `cli/proto/`. `pnpm contracts:check` runs the same script with `--check` and
currently passes.

Mirrored `.ts` files are **not** byte-identical to their source: a 166-byte generated banner is
prepended to each. The two frontend mirrors are byte-identical to each other. The three
`axioma.proto` copies are byte-identical to one another (sha1 `7479b5f16921`). Any verification step
that hash-compares contract source against mirror must account for the banner.

## Decisions finalized

1. Add shared `success`, `warning`, and `info` semantic color tokens, with foreground values and
   paired light/dark definitions, to both frontends.
2. Delete `portal/src/features/request-catalogue/components/dynamic-request-form.tsx` after
   relocating the three types its only consumer needs. Deletion order is specified in P6.
3. Add the official `Message`, `Bubble`, `MessageScroller`, and `Marker` primitives to the portal.
   Registry resolution is proven; accept `@shadcn/react` as a new portal dependency.
4. Preserve the preset typography: Inter for body/UI text, Instrument Sans for headings, and Geist
   Mono only for technical text. Installing `@fontsource-variable/inter` is part of this.
5. Standardize product icons on Remix Icon, as configured by both `components.json` files.
6. Tighten `statusStateType` in the API contract to the finite `STATE_TYPES` set, and treat
   `statusColour` as a field the UI ignores. Both are specified in the backend section.

## Current architecture

Both frontends use React 19, Vite, Tailwind CSS v4, TanStack Router/Query/Form, shadcn `base-nova`,
Base UI primitives, and the Remix Icon preset. The dashboard additionally uses TanStack Table,
Recharts, and cmdk. Each app is a standalone pnpm project; there is no workspace root.

Generated mirrors must never be edited directly. Contract changes are made in `api/src/contracts/*`
and published with `pnpm contracts:publish`.

## Documented implementation rules

- Forms use `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`, and `FieldError`.
- Put `data-invalid` on `Field` and `aria-invalid` on the control.
- `SelectItem` collections belong inside `SelectGroup`.
- `DropdownMenuItem` collections belong inside `DropdownMenuGroup`.
- Use `NativeSelect` for native/mobile behavior, ordinary form submission, and multiple selection.
- Use `Select` for styled single-selection interactions.
- Use `buttonVariants` on links rather than nesting links and buttons.
- Icons inside Buttons use `data-icon="inline-start|inline-end"`; the Button owns icon size.
- Use `Badge`, `Alert`, `Empty`, `Skeleton`, `Spinner`, `Separator`, `Card`, `Table`, and installed
  chat primitives instead of local lookalikes.
- Call-site classes describe layout, not primitive color, typography, radius, or shadows.
- Replace `window.prompt`, `window.confirm`, and `window.alert` with a Dialog or AlertDialog.
- State must never be communicated through color alone.

Official references:

- https://ui.shadcn.com/docs/components/base/field
- https://ui.shadcn.com/docs/components/base/select
- https://ui.shadcn.com/docs/components/base/native-select
- https://ui.shadcn.com/docs/components/base/dropdown-menu
- https://ui.shadcn.com/docs/components/base/button
- https://ui.shadcn.com/docs/components/base/skeleton
- https://base-ui.com/react/handbook/forms
- https://base-ui.com/react/components/select
- https://tanstack.com/form/latest/docs/framework/react/guides/validation

---

# Phase 0. Make the gate meaningful

Nothing else starts until `pnpm check` is green in both apps. Without this, the per-phase gate cannot
distinguish work-introduced breakage from pre-existing breakage.

1. Snapshot Git status. `dashboard/src/routes/_auth/calendar.tsx` carries a staged user change
   (3 insertions, 2 deletions) and is preserved byte-for-byte. It contains no Lucide import, no raw
   palette class, no raw select, no raw table, and no `animate-pulse`, so no guard added later will
   flag it.
2. Format the twelve failing files with targeted writes only. Do not run a repository-wide fix.

   ```powershell
   cd axioma/dashboard
   npx biome check --write public/site.webmanifest src/components/brand.tsx src/components/layout/app-sidebar.tsx src/components/sign-in-form.tsx src/components/sign-up-form.tsx src/routes/__root.tsx

   cd ../portal
   npx biome check --write public/site.webmanifest src/components/brand.tsx src/components/header.tsx src/features/tickets/copy.ts src/routes/__root.tsx src/routes/login.tsx
   ```

3. Resolve `noSvgWithoutTitle`. The brand SVGs are excluded from design changes, so satisfy the rule
   without altering their artwork: add a `files.includes` negation for `public/brand/**` to both
   `biome.json`, and give the two inline `<svg>` elements in `src/components/brand.tsx` (lines 18 and
   37) an accessible name through `<title>` or `aria-label` plus `role="img"`. Both apps share the
   same `brand.tsx`, so apply the identical change twice.
4. Confirm `pnpm check`, `pnpm check-types`, and `pnpm validate` are green in both apps.

---

# Phase 1. Shared foundation

## Typography and tokens

Modify:

- `dashboard/src/styles/globals.css`
- `portal/src/styles/globals.css`
- `dashboard/package.json`
- `portal/package.json`
- `dashboard/pnpm-lock.yaml`
- `portal/pnpm-lock.yaml`
- `dashboard/src/routes/__root.tsx`
- `portal/src/routes/__root.tsx`
- `dashboard/public/site.webmanifest`
- `portal/public/site.webmanifest`

Changes:

1. Add `@fontsource-variable/inter` to both `package.json` files and import it in both `globals.css`
   alongside the existing geist-mono and instrument-sans imports at lines 4-5. The font imports
   belong in `globals.css`, not in `__root.tsx`; `__root.tsx` holds no font imports today.
2. Keep `--font-sans: "Inter Variable"`. After step 1 it resolves for the first time.
3. Keep `--font-heading: "Instrument Sans Variable"`.
4. Keep Geist Mono as `--font-mono`.
5. Remove `html { @apply font-mono; }` at lines 131-133.
6. Remove the dead `@source "../../../apps/**/*.{ts,tsx}"` directive at line 6.
7. Add `--destructive-foreground` in `:root` and `.dark`. This makes
   `dashboard/src/components/layout/notification-center.tsx:43` render as intended.
8. Add `success`, `success-foreground`, `warning`, `warning-foreground`, `info`, and
   `info-foreground` in light and dark themes.
9. Expose all new tokens through `@theme inline`, including `--color-destructive-foreground`, which
   is currently absent.
10. Settle `theme-color` on the **light** `--primary` and state that choice in a comment, since both
    apps default to the dark theme and the single meta value cannot track both. Apply the settled
    value to `src/routes/__root.tsx` and `public/site.webmanifest` in both apps.
11. The two `globals.css` files are byte-identical today. Keep them byte-identical after this phase.

## Primitive additions

Add through targeted shadcn commands, then format each added file:

- `dashboard/src/components/ui/native-select.tsx`
- `portal/src/components/ui/native-select.tsx`
- `dashboard/src/components/ui/spinner.tsx`
- `portal/src/components/ui/message.tsx`
- `portal/src/components/ui/bubble.tsx`
- `portal/src/components/ui/message-scroller.tsx`
- `portal/src/components/ui/marker.tsx`

`message-scroller` adds `@shadcn/react` to `portal/package.json`. Regenerate `portal/pnpm-lock.yaml`.

After each add:

```powershell
npx biome check --write src/components/ui/<name>.tsx
```

Do not use `--all`, `--overwrite`, or apply a new preset. Do not bulk-regenerate existing primitives.

## Primitive convergence

Bring the five diverged primitives back into agreement between the two apps, taking the better
variant in each case:

- `input-group.tsx`: adopt the dashboard's `onPointerDown` handler with the `event.button !== 0`
  guard in the portal, replacing the portal's `onClick` handler. This fixes right-click and
  middle-click stealing focus.
- `field.tsx`, `item.tsx`, `label.tsx`, `dropdown-menu.tsx`: adopt the portal's explicit `role`
  attributes and its biome suppression comments in the dashboard, and drop the stray `"use client"`
  directives from both apps. Neither app is a React Server Components host.

After this phase, all shared primitives are byte-identical across the two apps.

---

# Backend plan: `api/`

One contract change is required. Everything else stays as it is.

## Required change

`api/src/contracts/tickets.ts:249` declares `statusStateType: z.string()`, which discards the only
finite discriminator the ticket domain has. Change it to the finite set:

```ts
statusStateType: z.enum(STATE_TYPES),
```

importing `STATE_TYPES` from `api/src/shared`. This makes the frontend state-to-variant map
exhaustively checkable by `tsc` in both apps, which is the precondition for the centralization work
in D1, D7, and P1.

Then publish and confirm:

```powershell
cd axioma/api
pnpm contracts:publish
pnpm contracts:check
pnpm check-types
```

## `statusColour`

`api/src/contracts/tickets.ts:250` exposes `statusColour: z.string().nullable()`, computed at
`api/src/server/routers/tickets.ts:124-126` from the `ticket_statuses.colour` column. The seeded
values are literal Tailwind palette names: `blue, blue, blue, amber, green, red, slate`. The field is
admin-editable at runtime and ships on every ticket response.

No UI code consumes it today, in either app. **Keep the field and have the UI continue to ignore it.**
Do not read it, and do not map it to a token. Semantic variants derive from `statusStateType` only.
Record this decision in a comment on the contract line so the field is not mistaken for dead code.

## Not modified

- `api/src/server/routers/*`
- `api/src/db/schema/*`
- `api/proto/axioma.proto`
- Every contract other than the one line named above.

The API already exposes ticket state metadata, dynamic field definitions, notifications, status
availability, agent transcripts, catalogue forms, knowledge, assets, and changes. Status-page
availability arrives as a float in the range 0..1 (`api/src/contracts/status.ts:4-18`), so bucketing
it into semantic bands is entirely a frontend decision.

---

# Dashboard plan

## D1. Shared state and layout components

### `dashboard/src/components/support-ui.tsx`

- Render `StatusBadge` with the installed `Badge`.
- Centralize the state-to-semantic-variant mapping over all seven `STATE_TYPES` values. The current
  map in `allowed-actions.ts` covers only five and silently drops `merged` and `cancelled`.
- Remove raw palette and manual dark-mode strings, including the emerald `connectionTone` value at
  line 9.
- Split `PageState`, which today covers loading, empty, and error through one `kind` prop, into
  compositions over `Spinner`/`Skeleton`, `Empty`, and `Alert`. Keep a single exported entry point so
  the existing call sites keep passing `kind`.
- Preserve `formatDate` and `timeAgo`.
- Retire `PageHeader` after its one consumer moves to `PageContainer`.
- Migrate icons to Remix.

`StatusBadge` has four importers and six call sites, all of which shift visually when its internals
change: `features/agent-runs/components/run-selector.tsx:30`,
`features/agent-runs/components/agent-transcript.tsx:188`,
`features/tickets/components/queue-columns.tsx:29`, and
`features/tickets/components/ticket-detail.tsx:123` and `:248`. Review all six after the change.

### `dashboard/src/features/tickets/components/allowed-actions.ts`

- Make `stateTones` exhaustive over `STATE_TYPES` and express it in semantic tokens.
- Rekey `actionsByLabel` from `statusLabel` to `statusStateType`. It is currently keyed on the
  human-readable label ("Waiting for reply"), which is an admin-editable database column: renaming a
  status row in the database silently removes every operator action for that status.
- Extend `allowed-actions.validation.mjs` to cover the rekeying and the two previously unmapped state
  types.

`support-ui.tsx` imports `ticketStatusTone` from this file, so this change lands with or before D1.

### `dashboard/src/components/loader.tsx`

- Replace the Lucide loader with the shared `Spinner`.
- Keep only wrapper/layout responsibility.

### `dashboard/src/components/route-state.tsx`

- Use `Spinner` for pending and `Alert`/shared state composition for errors.
- Preserve retry behavior and accessibility roles.

### `dashboard/src/components/layout/page-container.tsx`

- Make it the canonical page-heading composition.
- Apply `font-heading` to the page title at line 22. `font-heading` currently has zero product-code
  usage; it appears only inside `ui/` primitives.
- Preserve the `main-content` id, `tabIndex={-1}`, title, description, and action slots.

`PageContainer` already has 20 importers, so this is the dominant pattern.

### `dashboard/src/features/tickets/components/ticket-detail.tsx`

- Stop using `PageHeader`. This is its only importer (`:7`, used at `:118`), so retiring `PageHeader`
  is a one-file migration.
- Use `PageContainer` for title, description, and actions.
- Convert repeated card-like sections to full `Card` composition.
- Preserve queries, actions, and tabs.

### `dashboard/src/components/layout/info-sidebar.tsx`

- Replace its custom card shell with `Card` composition if it remains visually exposed after shared
  normalization.

## D2. Remix Icon migration

Twenty-two files import `lucide-react`. The list is exact and complete; no other file in
`dashboard/src` imports it.

- `dashboard/src/components/route-state.tsx`
- `dashboard/src/components/loader.tsx`
- `dashboard/src/components/mode-toggle.tsx`
- `dashboard/src/components/support-ui.tsx`
- `dashboard/src/components/layout/app-sidebar.tsx`
- `dashboard/src/components/layout/command-menu.tsx`
- `dashboard/src/components/layout/header.tsx`
- `dashboard/src/components/layout/notification-center.tsx`
- `dashboard/src/features/agent-runs/components/agent-transcript.tsx`
- `dashboard/src/features/agent-runs/components/step-card.tsx`
- `dashboard/src/features/automation/components/automation-pages.tsx`
- `dashboard/src/features/automation/components/index.tsx`
- `dashboard/src/features/cmdb/components/ticket-impact.tsx`
- `dashboard/src/features/devices/components/device-detail-sheet.tsx`
- `dashboard/src/features/devices/components/devices-table.tsx`
- `dashboard/src/features/documents/components/index.tsx`
- `dashboard/src/features/overview/components/overview-page.tsx`
- `dashboard/src/features/tickets/components/queue-columns.tsx`
- `dashboard/src/features/tickets/components/saved-view.tsx`
- `dashboard/src/features/tickets/components/ticket-actions.tsx`
- `dashboard/src/features/tickets/components/ticket-queue.tsx`
- `dashboard/src/routes/_auth/tickets.$ticketId.tsx`

The two `dark:` classes in `mode-toggle.tsx` at lines 17-18 are icon rotate and scale transitions,
not colors. Preserve them.

After the source scan is clean, remove `lucide-react` from `dashboard/package.json` and regenerate
the lockfile.

## D3. Forms and controls

### `dashboard/src/components/sign-in-form.tsx`
### `dashboard/src/components/sign-up-form.tsx`

- Use `FieldGroup`, `Field`, `FieldLabel`, and `FieldError`.
- Set `data-invalid` and `aria-invalid`.
- Use `Spinner` for pending submit actions.
- Remove the `red-500` error classes (`sign-in-form.tsx:86,109`; `sign-up-form.tsx:88,111,134`) and
  the `indigo` link overrides (`sign-in-form.tsx:140`; `sign-up-form.tsx:165`).
- Preserve TanStack Form, Zod, and auth behavior.

### `dashboard/src/features/changes/components/changes.tsx`

- Use `NativeSelect` for the FormData-backed selects at lines 109 and 300.
- Keep hidden inputs.
- Use `Input type="datetime-local"` and `Textarea` for the PIR fields at lines 332 and 338.
- Add explicit labels and Field composition.
- Replace empty list text with `Empty`.
- Preserve all payload transformations.

### `dashboard/src/features/admin/roles-page.tsx`

- Replace the person-kind and team-department raw selects at lines 209 and 303 with `NativeSelect` or
  `Select` as appropriate.
- Preserve existing Checkboxes and mutation payloads.
- Move create forms to Field composition.

### `dashboard/src/features/automation/components/automation-pages.tsx`

- Replace the raw checkbox at line 135 with `Checkbox`.
- Use Field composition.
- Preserve Dialog/Card structure, JSON editing, schemas, and mutations.
- Add Spinner and `data-icon` where appropriate.

### `dashboard/src/features/knowledge/components/knowledge.tsx`

- Use Field composition in the editor.
- Replace the raw select at line 186 and the raw checkbox at line 199 with `Select`/`NativeSelect`
  and `Checkbox`.
- Replace empty states with `Empty`.
- Preserve CRUD and routing.

### `dashboard/src/features/tickets/components/dynamic-fields.tsx`

This surface renders **ticket** dynamic fields, whose discriminator is `fieldType` with nine values.
Map controls as follows:

- `text` / `reference`: `Input`
- `integer`: numeric `Input`
- `date` / `datetime`: native input types through `Input`
- `textarea`: `Textarea`
- `dropdown`: `Select`
- `checkbox`: `Checkbox`
- `multiselect`: `NativeSelect multiple`

Replace the raw select at line 111, the raw multiselect in the same block, and the raw checkbox at
line 161. Remove duplicated control classes and preserve value shapes and serialization.
`serialize-dynamic-fields.ts` and its validation script are the contract for value shape; keep them
passing unchanged.

### `dashboard/src/features/tickets/components/ticket-collaboration.tsx`

- Replace the raw relationship select at line 347. The value set is finite and safe:
  `duplicate_of, related_to, caused_by, parent_of`.
- Use Field composition for composers and forms.
- Use warning `Alert` for the merge banner at line 292 and the private-note panel at line 80. These
  two sites are also referenced in D7 and D8; D3 owns them.
- Use `Empty` for the empty list at line 112.
- Preserve link, merge, watcher, message, and time-entry mutations.

### `dashboard/src/routes/_auth/forms.tsx`

- Replace the raw selector at line 116 with `NativeSelect`/`Select`.
- Use Field composition.
- Replace the empty paragraph with a shared Empty state.
- Preserve form-definition mutations.

### `dashboard/src/routes/_auth/mail-templates.tsx`

- Replace the raw textarea at line 108 with `Textarea`.
- Use labelled Field composition.
- Preserve template syntax and saves.

### `dashboard/src/routes/_auth/mailboxes.tsx`

- Add `SelectGroup`.
- Normalize form fields.
- Preserve Checkboxes and mutations.

### `dashboard/src/features/problems/components/problems.tsx`

- Use Field composition for its small form.
- Do not introduce TanStack Form solely for this form.
- Problem status is a free string in the contract; branch with an explicit fallback rather than an
  exhaustive map.

### `dashboard/src/features/documents/components/index.tsx`

- Keep the native file input.
- Style the visible trigger using `buttonVariants`.
- Preserve upload behavior. Upload posts directly to `POST /api/documents` as multipart FormData and
  does not go through the generated SDK client.

## D4. Dialogs replacing browser prompts

Ten `window.prompt` and `window.confirm` calls across six files block keyboard and screen-reader
users, cannot be styled, and in three cases carry multi-field data entry.

| File:line | Current call | Replacement |
| --- | --- | --- |
| `features/documents/components/index.tsx:67,69` | link URL, then link name | one Dialog with two Fields |
| `features/tickets/components/saved-view.tsx:46` | view name | Dialog with one Field |
| `features/tickets/components/ticket-queue.tsx:135` | escalation reason, feeds a mutation | Dialog with a `Textarea` Field |
| `routes/_auth/software-licences.tsx:60,61,65` | three chained prompts | one Dialog with three Fields |
| `routes/_auth/assets.tsx:104` | custodian user ID | Dialog with one Field |
| `features/automation/components/automation-pages.tsx:263,426` | delete confirmations | `AlertDialog` |

`portal/src/routes/_auth/tickets/$ticketId.tsx` has the same defect and is handled in P3.
`routes/_auth/assets.tsx` appears in this plan only for this change.

## D5. Menu and select structure

Add `SelectGroup` around item collections in:

- `dashboard/src/routes/_auth/mailboxes.tsx`
- `dashboard/src/features/tickets/components/ticket-actions.tsx`
- `dashboard/src/features/tickets/components/ticket-classification-form.tsx`
- every converted Select in roles, changes, knowledge, dynamic fields, collaboration, and forms

Add `DropdownMenuGroup` in:

- `dashboard/src/components/mode-toggle.tsx`
- `dashboard/src/features/tickets/components/queue-facet.tsx`
- `dashboard/src/features/tickets/components/ticket-queue.tsx` (the `RowActions` menu at lines
  437-484 has no group today)

Review but retain the correct grouping already present in `dashboard/src/components/user-menu.tsx`.

## D6. Tables and interactive rows

### `dashboard/src/features/assets/components/index.tsx`

- Replace the raw table at lines 166-190 with the installed Table primitives.
- Replace the raw import-history button with Button or Item.
- Normalize Card composition.
- Preserve custody and import actions. Asset status and custody action are free strings; branch with
  a fallback.

### `dashboard/src/features/mail/components/index.tsx`

- Convert both raw tables (lines 35-52 and 77-84) to Table primitives.
- The second table has a `<tbody>` with no `<thead>`. Add accessible column headers.
- Normalize the empty state.
- Mailbox activity `decision` is a free string; branch with a fallback.

### `dashboard/src/features/tickets/components/ticket-queue.tsx`

This is the single largest conversion. The raw markup sits at lines 316, 317, 319, 325, 372, 374, and
385.

- Convert to Table primitives while retaining TanStack Table behavior. `useReactTable` at lines
  147-164 uses `getCoreRowModel()` only; sorting, pagination, and faceting are server-driven through
  search props. Do not add client row models.
- Preserve the sticky header (`sticky top-0 z-10` plus the `shadow-[0_1px_0_var(--border)]` rule),
  the computed `aria-sort` at lines 328-336, `scope="col"`, selection, density (`py-2`/`py-4` at line
  389), pagination, and the `max-h-[calc(100vh-20rem)] overflow-auto` scroll container at line 315.
- Preserve `min-w-[1100px]` on the table element; horizontal scrolling depends on it.
- Preserve the imperative `data-queue-row` focus effect at lines 103-110, which selects rows by
  attribute and calls `.focus()`. It is coupled to row render order.
- Add explicit Enter and Space handling on the row at lines 374-383. It has `tabIndex` and `onClick`
  but no `onKeyDown`; Enter currently routes only through the global `useKeyboardShortcuts` hook.
- Replace the manual `animate-pulse` rows in `QueueLoading` at lines 486-498 with `Skeleton`. This is
  the only product-code `animate-pulse` in either app.

### Click-only rows

Three further surfaces have `onClick` and `cursor-pointer` with no `tabIndex`, `onKeyDown`, or role:

- `dashboard/src/features/problems/components/problems.tsx:129-133`
- `dashboard/src/features/changes/components/changes.tsx:179-183`
- `dashboard/src/features/knowledge/components/knowledge.tsx:69-73`

Give each a real link or button, or complete keyboard activation with visible focus.
`dashboard/src/features/devices/components/devices-table.tsx:210-222` is already correct and is the
reference pattern.

## D7. Cards, states, and semantic colors

Normalize state presentation in:

- `dashboard/src/components/layout/notification-center.tsx`
- `dashboard/src/features/tickets/components/ticket-queue.tsx`
- `dashboard/src/features/agent-runs/components/agent-transcript.tsx` (dashed empty panel at line 208)
- `dashboard/src/features/approvals/components/approvals.tsx`
- `dashboard/src/features/problems/components/problems.tsx`
- `dashboard/src/features/changes/components/changes.tsx`
- `dashboard/src/features/mail/components/index.tsx`
- `dashboard/src/routes/_auth/forms.tsx`

Normalize semantic state colors. Raw palette classes exist in exactly ten files:

| File | Lines |
| --- | --- |
| `features/tickets/components/allowed-actions.ts` | 4, 5, 7, 9 |
| `features/tickets/components/queue-columns.tsx` | 8, 9, 10, 50 |
| `features/agent-runs/components/step-card.tsx` | 72, 73, 148, 151, 153 |
| `features/agent-runs/components/agent-transcript.tsx` | 269, 274, 295, 309 |
| `components/sign-up-form.tsx` | 88, 111, 134, 165 |
| `components/sign-in-form.tsx` | 86, 109, 140 |
| `features/tickets/components/ticket-collaboration.tsx` | 80, 292 |
| `components/support-ui.tsx` | 9 |
| `features/devices/components/device-detail-sheet.tsx` | 57 |
| `features/devices/components/devices-table.tsx` | 40 |

`routes/_auth/software-licences.tsx:56` matches a broad palette regex but is prose
(`"discovered-install"`), not a class. Any scan must anchor on class boundaries.

Normalize malformed and content-only Cards in:

- `dashboard/src/routes/_auth/mailboxes.tsx`
- `dashboard/src/routes/_auth/mail-templates.tsx`
- `dashboard/src/features/assets/components/index.tsx`
- `dashboard/src/features/automation/components/automation-pages.tsx`
- `dashboard/src/features/scheduling/components/index.tsx`

Adjacent cleanup only when the file is already open for another reason:

- `dashboard/src/routes/_auth/software-licences.tsx`
- `dashboard/src/features/suppliers/components/index.tsx`
- `dashboard/src/features/overview/components/overview-page.tsx`
- `dashboard/src/features/cmdb/components/ticket-impact.tsx`
- `dashboard/src/features/tickets/components/sla-countdown.tsx`
- `dashboard/src/features/tickets/components/ticket-actions.tsx`

## D8. Messaging and attachments

### `dashboard/src/features/tickets/components/ticket-collaboration.tsx`

Nothing is wired today: `Message`, `Bubble`, `MessageScroller`, `Marker`, and `Attachment` all have
zero importers across the dashboard. The conversation is a plain `<ol>`/`<li>` at lines 73-116, which
maps cleanly onto message-scroller items.

Use installed:

- `MessageScroller`
- `MessageScrollerViewport`
- `MessageScrollerContent`
- `MessageScrollerItem`
- `MessageScrollerButton`
- `Message`
- `Bubble`

`MessageScrollerProvider` is also exported; use it only if `MessageScroller` does not already supply
the context. Use `Marker` only where a genuine marker anchor exists; this file has none today, so
`Marker` may remain unused here.

Keep existing queries, presence, mutations, and the native form. Do not write custom scroll-observer
logic.

### `dashboard/src/features/documents/components/index.tsx`

Use the installed Attachment composition while preserving the native file input, the upload loop, the
link mutation, and download URLs. Upload and download are raw HTTP routes, not SDK procedures.

### `dashboard/src/features/agent-runs/components/run-selector.tsx`

Replace the raw styled buttons at lines 19-42 with Button or Item, dropping the hand-rolled class
string at line 23. Preserve the `fieldset` at line 14, the `sr-only` legend at line 15,
`aria-pressed`, selected state, and run metadata. Do not add ToggleGroup solely for this.

## D9. Agent transcript presentation

### `dashboard/src/features/agent-runs/components/step-card.tsx`

- Use Alert for evidence and error surfaces.
- Use Badge for tool names.
- Use semantic tokens keyed on the five real step kinds: `think`, `tool_call`, `observation`,
  `decision`, `terminal`. There is no `escalation` step kind.
- Preserve Collapsible output and serialization.

### `dashboard/src/features/agent-runs/components/agent-transcript.tsx`

- Use warning Alert for escalation. Escalation is signalled by the **run status** `escalated`, one of
  `running, resolved, escalated, failed, exhausted`, and separately by the ticket's `escalationFlag`
  (`none`, `warning`, `breach`). Keep the three levels distinct in the UI.
- Use semantic success and destructive diff colors.
- Preserve polling, selection, clipboard, retry, cancellation, takeover, and escalation parsing.

Do not modify:

- `dashboard/src/features/agent-runs/components/escalation.ts`
- `dashboard/src/features/agent-runs/components/run-polling.ts`
- their validation files

Note for whoever later revisits escalation content: the agent selects `evidence` with a keyword
heuristic (`agent/axel/loop.py:449`) and flattens the structured proposal to a string
(`agent/axel/model.py:194-211`), which `escalation.ts:14-23` then recovers by regex and `JSON.parse`.
The presentation work in this plan keeps that parse intact and does not depend on changing it.

---

# Portal plan

Portal scope is materially smaller than the dashboard's. Verified: **zero** raw table tags, so no
`table.tsx` is needed; **zero** `animate-pulse` in product code; **zero** click-only interactive
divs, since every `onClick` sits on `Button`, `<button type="button">`, a TanStack `Link`, or a
`DropdownMenuItem`; and only eight raw palette occurrences across four files.

## P1. Shared portal components

### `portal/src/components/ticket-ui.tsx`

- Keep `getStatus`, `formatDate`, `PageShell`, and `PageHeading`.
- Render `StatusBadge` (line 36, currently a hand-rolled `<span>`) through `Badge` with semantic
  variants over all seven `STATE_TYPES` values.
- Replace the emerald and blue classes with manual dark variants at lines 49-50. These are the only
  `dark:` classes in the portal outside `mode-toggle.tsx`.
- Replace the custom error Card with Alert/Empty.
- Keep the loading cards but rely on primitive-owned Skeleton styling.
- Replace the `LucideIcon` typing in the `statusIcons` record with the Remix equivalent.

### `portal/src/components/loader.tsx`

- Use the existing `Spinner`. `progress-timeline.tsx:69` already does this correctly.

### `portal/src/components/header.tsx`

- Convert to Remix icons.
- Add mobile navigation with the existing DropdownMenu.
- Preserve TanStack Links.

### `portal/src/components/notification-center.tsx`

- Use `DropdownMenuGroup` and `DropdownMenuItem` with Base UI `render` for routed records.
- Use Skeleton/Alert/Empty for states.
- Use menu separators.
- Preserve mark-read behavior. `recordType` is a free string in the contract; route with an explicit
  fallback branch.

### `portal/src/components/user-menu.tsx`

- Replace nested routed Button markup with `buttonVariants` on Link.
- Preserve the existing `DropdownMenuGroup` and logout.

### `portal/src/components/mode-toggle.tsx`

- Migrate icons.
- Remove manual Button icon dimensions.
- Add an accessible trigger name.
- Wrap items in `DropdownMenuGroup`.

## P2. Remix Icon migration

Twelve files import `lucide-react`. The list is exact and complete. All six portal `ui/` primitives
that use icons already use Remix, so nothing blocks removing the dependency once these twelve are
converted.

- `portal/src/components/header.tsx` (`Plus`)
- `portal/src/components/loader.tsx` (`Loader2`)
- `portal/src/components/mode-toggle.tsx` (`Moon`, `Sun`)
- `portal/src/components/notification-center.tsx` (`Bell`)
- `portal/src/components/ticket-ui.tsx` (`LucideIcon` type, plus `AlertCircle`, `CircleCheck`,
  `Clock3`, `LifeBuoy`, `Route`)
- `portal/src/routes/_auth/home.tsx` (`ArrowRight`, `CircleCheck`, `Inbox`, `Plus`)
- `portal/src/routes/_auth/tickets/new.tsx` (`ArrowLeft`)
- `portal/src/routes/_auth/tickets/$ticketId.tsx` (`ArrowLeft`, `CircleDot`, `Monitor`, `Plus`)
- `portal/src/features/tickets/components/conversation-card.tsx` (`Star`)
- `portal/src/features/tickets/components/progress-timeline.tsx` (`Check`, `Circle`)
- `portal/src/features/tickets/components/request-form.tsx` (`Info`, `Send`)
- `portal/src/features/tickets/components/resolution-card.tsx` (`Check`)

Then remove `lucide-react` from `portal/package.json` and regenerate the lockfile.

## P3. Forms

### `portal/src/components/sign-in-form.tsx`
### `portal/src/components/sign-up-form.tsx`

- Use Field composition and accessible invalid states. Replace the inline
  `<p className="text-destructive text-sm" role="alert">` blocks at `sign-in-form.tsx:96,119` and
  `sign-up-form.tsx:94,117,140` with `FieldError`.
- Use Spinner for submission.
- Replace decorative divider markup with `Separator`.
- Preserve auth and provider behavior.

### `portal/src/routes/_auth/home.tsx`

- Convert the enrollment control to Field composition; replace the inline error paragraphs at lines
  145 and 157 with `FieldError`.
- Keep the native `details`/`summary` disclosures at lines 122 and 207. There is no `collapsible`
  primitive in the portal and none is being added.
- Use Spinner in the pending action.
- Preserve the correct existing `Empty` usage.

### `portal/src/features/tickets/components/request-form.tsx`

The largest and highest-risk portal file, 826 lines, two sibling form components toggled by a radio
`Question`.

- Remove the local `FieldError` at line 104 and use the installed component.
- Convert title, body, device, catalogue, and dynamic fields to Field composition.
- Keep the local `Question` helper at line 65; it already composes `RadioGroup` and `Label`
  correctly.
- Use FieldSet/FieldLegend for related choices.
- Replace the three raw selects at lines 321, 551, and 671 with `Select`/`SelectGroup` for styled
  single selection, and `NativeSelect multiple` for multiselect.
- Replace the raw checkbox at line 622 with `Checkbox`.
- Replace the raw textarea at line 710 with `Textarea`.
- Keep native date and datetime through `Input`.
- Remove duplicate control classes, including `catalogueControlClass`.
- Add Spinner and `data-icon`.
- Preserve schemas (`requestDetailsSchema` at line 33, `incidentSchema` at line 51), form state,
  activation logic, serialization, invalidation, and payloads.

**Two vocabularies in one file.** The incident branch delegates to `DynamicFields`, which renders
ticket dynamic fields (`fieldType`, nine values). The catalogue branch at lines 600-740 renders
catalogue form fields (`type`, seven values: `text, textarea, number, boolean, date, select,
multiselect`). Do not apply one mapping to both. `number` maps to a numeric `Input`, `boolean` to
`Checkbox`, and `select` to `Select`; the catalogue vocabulary has no `datetime` and no `reference`
branch to write.

**Remove the inlined duplicate.** Lines 600-740 are a near-verbatim copy of
`dynamic-request-form.tsx:78-213` — the same checkbox branch, the same select/multiselect/textarea/
input ladder, the same `stringValue` coercion, the same "Select an option" string. Extract one
catalogue-field renderer and call it from here, so that deleting the dormant file in P6 removes the
duplication rather than just one of its two copies.

### `portal/src/features/tickets/components/dynamic-fields.tsx`

- Apply the **ticket** field mapping (nine `fieldType` values), matching the dashboard's
  `dynamic-fields.tsx`.
- Replace the raw dropdown at line 87, the raw multiselect at line 103, and the raw checkbox at line
  136.
- Preserve value shapes and serialization; `serialize-dynamic-fields.validation.mjs` must keep
  passing unchanged.

### `portal/src/features/tickets/components/conversation-card.tsx`

- Use Field composition for reply and comment; replace the inline error paragraphs at lines 126, 242,
  and 266 with `FieldError`.
- Keep the CSAT rating exactly as structured. Lines 211-240 are already accessible: a `<fieldset>`
  with an `sr-only` `<legend>`, five `sr-only` radio inputs wrapped in `<label>`, and
  `focus-within:ring-2`. Change only the `fill-amber-400 text-amber-500` classes at line 234 to a
  semantic rating treatment.
- Add Spinner.
- Preserve `submitThenReset` behavior.

### `portal/src/routes/_auth/tickets/$ticketId.tsx`

- Convert the add-detail dialog to Field composition; replace the inline error at line 408 with
  `FieldError`.
- Preserve Dialog title and description.
- Replace the chained `window.prompt` link-attachment entry at lines 340 and 346 with a Dialog form
  carrying two Fields. The add-detail Dialog at lines 380-420 is the template.
- Replace the bare `<button className="text-destructive text-sm underline">` retry at line 307 with
  `Button`.
- Keep the native file input at line 352, styled by `buttonVariants`.
- Normalize upload failures with Alert.
- Preserve ticket and upload behavior; upload is a direct multipart POST, not an SDK call.

### `portal/src/features/knowledge/components/knowledge-browser.tsx`

- Use `Input`, `Select`/`SelectGroup` for the raw select at line 82, and Field.
- Render article results using Item or Card, replacing the hand-rolled `rounded-lg border bg-card p-4`
  button shell at line 108.
- Use `Empty` for the dashed no-results div at line 135.

### `portal/src/features/knowledge/components/knowledge-article.tsx`

- Use Button or `buttonVariants` for the back action.
- Model Yes/No as RadioGroup inside FieldSet/FieldLegend.
- Preserve article semantics.

### `portal/src/routes/status.tsx`

- Use Button for retry, Spinner/Skeleton for loading, and Alert for errors.

## P4. Cards, states, status, and routes

### `portal/src/features/status/components/service-status.tsx`

This file imports zero `ui/` primitives today and is the only portal file needing all three new
semantic tokens.

- Use Card composition in place of the hand-rolled `<section>` at line 14.
- Use Badge for operational and disrupted state.
- Replace `bg-emerald-500`, `bg-amber-500`, and `bg-red-500` in `tone()` at lines 6, 8, and 9 with
  semantic success, warning, and destructive tokens. Availability arrives as a float 0..1, so the
  bucket boundaries are a frontend choice; state them explicitly in the code.
- Keep the 90-day strip, its `role="img"`, its `aria-label`, and the per-day `title` tooltips.
- Use `Empty` for the dashed no-services div at line 72.

### `portal/src/features/tickets/components/resolution-card.tsx`

- Replace the emerald classes at lines 50 and 53 with semantic success and warning treatment.
- Migrate the icon.
- Preserve status branches.

### `portal/src/routes/_auth/knowledge.tsx`
### `portal/src/routes/_auth/knowledge.$articleId.tsx`

- Replace the hand-rolled `rounded-xl border border-destructive/30 bg-card p-6` error panels at
  `knowledge.tsx:36` and `knowledge.$articleId.tsx:30` with `Alert` or `Card`.
- Normalize loading, error, empty, and not-found states with shared primitives.
- Preserve querying and routing.

### `portal/src/routes/_auth/tickets/new.tsx`

- Migrate the back icon and apply `data-icon`.
- Remove the redundant Card radius override.

### `portal/src/routes/_auth/tickets/$ticketId.tsx`

- Remove redundant Card restyling.
- Use Badge for categorical metadata.
- Use Item for repeated detail and attachment rows where suitable.
- Use Separator for structural dividers.

### `portal/src/routes/_auth/home.tsx`

- Remove redundant Card styling.
- Keep the native disclosures.
- Normalize the connection and finished-ticket sections around Card and Separator.

## P5. Conversation

### `portal/src/features/tickets/components/conversation-card.tsx`

The message list is a semantic `<ol>`/`<li>` at lines 70-99 with primary/muted bubble styling at
lines 77-78. Now that `message`, `bubble`, `message-scroller`, and `marker` are installed in Phase 1:

- Use `MessageScroller`, `Message`, and `Bubble`.
- Use `Empty` for the dashed empty `<li>` at line 95.
- Keep `Card` as the outer panel.
- Do not add custom scroll-following logic.

## P6. Remove the dormant duplicate form

`portal/src/features/request-catalogue/components/dynamic-request-form.tsx` exports one component and
three types. The component `DynamicRequestForm` (line 49) has **zero** importers repo-wide. Its only
consumer, `portal/src/features/tickets/components/request-form.tsx:14-17`, imports types only:
`RequestFormField` and `RequestFormValues`, used at `request-form.tsx:385`, `:420`, `:447`, and
`:600`.

Order matters. Relocating the types comes first; deleting first breaks the build.

1. Move `RequestFormValue` (line 3), `RequestFormValues` (line 4), and `RequestFormField`
   (lines 6-28) to a types module under `features/request-catalogue/`. `RequestFormValues` is defined
   in terms of `RequestFormValue`, so all three move together even though only two are imported
   externally.
2. Point `request-form.tsx:14-17` at the new location and confirm `pnpm check-types` passes.
3. Extract the shared catalogue-field renderer per P3, so the surviving inline copy at
   `request-form.tsx:600-740` is replaced by a call rather than left in place.
4. Delete `dynamic-request-form.tsx`. Everything else in it — `isActive` (line 30), `controlClass`
   (line 46), and the component itself — is dead.
5. Point `portal/src/features/request-catalogue/components/index.ts` at the types module. That barrel
   currently re-exports only the deleted file.
6. Run `pnpm check-types` and `pnpm validate`.

`catalogue-form-values.validation.mjs` and `form-validation.validation.mjs` do not import this file or
any type from it, so `pnpm validate` will pass regardless of whether the type relocation is correct.
`tsc --noEmit` is the only gate that catches a botched move. Do not treat a green `validate` as proof
here.

---

# AI Brain plan: `agent/`

Required modified files: none.

The existing transcript payload supports all planned presentation changes. Do not modify the agent
loop, model, server, tools, protobuf mirror, or generated bindings. The agent emits no presentational
strings — no colors, icons, severity labels, or UI-targeted markdown. All icon and color mapping is
dashboard-side.

Two facts for whoever runs the agent gates:

- `agent/axel/pb/` is listed in `agent/.gitignore:7` and is untracked. `axel/server.py:21-22` and
  `tests/test_server_proto.py:3` import from it, so on a clean checkout `uv run pytest` fails at
  import until `pwsh agent/scripts/generate-proto.ps1` runs. The CLI's Go bindings are tracked and do
  not need their generation script for a build.
- Python `StepKind` (`agent/axel/loop.py:52-56`) omits `terminal`, which `agent/axel/server.py:222-230`
  constructs directly; Python `RunStatus` (`loop.py:45-49`) omits `running`, which the API assigns.
  Neither asymmetry affects this plan.

Agent, API, and protobuf work is justified only if a separate product decision introduces a
structured escalation payload, a new run status, or a new step kind.

---

# CLI plan: `cli/`

Required modified files: none.

Verified: `go vet ./...` and `go build ./...` are clean; there are 27 tests across five files; and
`cli/` contains no import, build step, or shared file touching the frontends. The only textual
matches for frontend terms are prose in comments and one user-facing sentence at
`cli/internal/tui/enroll.go:64`.

Do not modify the CLI TUI, device logic, CUA logic, protobuf mirror, or generated bindings unless
wire semantics, device actions, enrollment, or the terminal UI itself are separately redesigned.

Recorded for a future terminal-UI pass, not for this one: `cli/internal/tui/doctor.go:18-24` defines
its own status palette as two raw ANSI indices (`"1"` red, `"2"` green) with no warning or info tier
and no adaptive light/dark handling, and renders the pending state in the same faint style as
supplementary detail text. It maps local diagnostic and connection outcomes, not ticket status, run
status, or device action outcomes, so the frontends' new semantic tokens do not put it out of sync on
any shared domain vocabulary.

---

# Cross-cutting note: duplicated state vocabulary

Not in scope for this plan; recorded so the frontend map is understood as what it is.

`api/src/shared/index.ts` is the intended TypeScript source of truth, but it does not reach the
contracts layer, the gRPC bridge, the agent, or the CLI. Run status is declared in six places, step
kind in four, device actions in five, device facets in five, and the priority matrix in two
languages. `api/src/server/tools/parity.test.ts:36-52` guards device actions and tool names only; it
does not cover run status, step kind, facets, priority, or the three-way identity of the proto
copies.

Because the frontends cannot import `api/src/shared`, the state-to-variant map added in D1 and P1 is
another hand-copied declaration. Tightening `statusStateType` to `z.enum(STATE_TYPES)` in the backend
section is what makes `tsc` catch drift in that copy.

---

# Regression guards

Add:

- `dashboard/src/components/design-system.validation.mjs`
- `portal/src/components/design-system.validation.mjs`

These are picked up by the existing `pnpm validate` script, `node --test "src/**/*.validation.mjs"`,
running on Node 24.

**These are a new category.** All twelve existing `*.validation.mjs` files are pure-function unit
tests that import a sibling `.ts` module; none reads the filesystem, walks a directory, or excludes
paths. There is no scanning convention to inherit. Build these as source-text linters using `node:fs`
and `node:path`, and wrap each rule in a named `test()` from `node:test` so that one failure does not
collapse all rules into a single opaque throw.

Scan first-party source under `src/`, excluding `src/components/ui/`, `src/sdk/`,
`src/routeTree.gen.ts`, `public/`, and `src/routes/_auth/calendar.tsx`.

Fail on:

1. `lucide-react` imports. Expected count after remediation: zero in both apps.
2. Unapproved visible raw single-value selects.
3. Raw product checkboxes where `Checkbox` should be used.
4. Feature-level `animate-pulse` outside `Skeleton`. Expected count after remediation: zero in both
   apps.
5. Raw status palette classes, matched against an explicit allowlist of remediated files declared as
   a constant at the top of the script. Use the file lists in D7 and P4 as the initial allowlist.
   The regex must cover
   `emerald|amber|orange|red|yellow|violet|sky|blue|green|rose|purple|teal|cyan|indigo|lime|fuchsia|pink`
   — `indigo` matters, since it is used at `sign-in-form.tsx:140` and `sign-up-form.tsx:165` — and it
   must anchor on class-name boundaries so prose such as `"discovered-install"` at
   `software-licences.tsx:56` does not match.
6. Raw table tags anywhere outside the dashboard's `Table` primitive. The portal has zero raw tables
   today; the guard keeps it that way.
7. Missing `SelectGroup` or `DropdownMenuGroup`, checked against an explicit list of call sites
   declared as a constant in the script. Both symbols currently have near-zero usage, so a
   presence-based heuristic would produce nothing; the list is the mechanism.
8. `space-x-*` and `space-y-*`, checked against a committed baseline file listing the current counts
   per file. The dashboard has roughly 59 occurrences across 21 files and the portal 50 across 14; a
   scanner cannot infer which are new without that baseline. Generate the baseline once at the start
   of the phase, commit it, and fail when a file's count exceeds its baseline entry.
9. `window.prompt`, `window.confirm`, and `window.alert`. Expected count after remediation: zero in
   both apps.

Allow:

- hidden inputs,
- native file, date, and datetime inputs,
- native multiselect,
- semantic `details`/`summary`,
- primitive internals,
- brand SVGs,
- the two icon-transition `dark:` classes in `mode-toggle.tsx`,
- domain status visualizations backed by semantic tokens.

Do not add a test framework solely for these checks.

---

# Files explicitly excluded

- `dashboard/src/routes/_auth/calendar.tsx` — existing user change; preserve byte-for-byte.
- `dashboard/src/routeTree.gen.ts`
- `portal/src/routeTree.gen.ts`
- all generated `dashboard/src/sdk/contracts/*`
- all generated `portal/src/sdk/contracts/*`
- API routers, schemas, and protobuf; every API contract other than the single `statusStateType` line
- agent and CLI generated protobuf bindings
- `axioma/web/*`
- brand artwork and public assets, apart from the two `site.webmanifest` `theme_color` values
- existing primitive files, apart from the targeted additions in Phase 1 and the five-file
  convergence in Phase 1

Avoid repository-wide format or fix commands that could alter unrelated user work. Every formatting
command in this plan names its files.

---

# Execution order

1. **Phase 0.** Snapshot Git status, protect `dashboard/src/routes/_auth/calendar.tsx`, format the
   twelve failing files, resolve `noSvgWithoutTitle`, and confirm all three gates green in both apps.
2. Apply the shared font and token foundation to dashboard and portal, including
   `@fontsource-variable/inter`, `destructive-foreground`, the three semantic token families, removal
   of `html { font-mono }` and the dead `@source`, and the settled `theme-color` in both `__root.tsx`
   files and both `site.webmanifest` files.
3. Add `NativeSelect` to both apps, `Spinner` to the dashboard, and `Message`/`Bubble`/
   `MessageScroller`/`Marker` to the portal. Format each added file. Regenerate
   `portal/pnpm-lock.yaml`.
4. Converge the five diverged primitives across the two apps.
5. Apply the `statusStateType` contract change in `api/`, run `pnpm contracts:publish`, and confirm
   `pnpm contracts:check`.
6. Fix `allowed-actions.ts`: exhaustive `stateTones` over seven state types, `actionsByLabel` rekeyed
   to `statusStateType`, and extended validation coverage.
7. Recompose shared status, loading, empty, and error components. `allowed-actions.ts` must land
   first, since `support-ui.tsx` imports `ticketStatusTone` from it. Review all six `StatusBadge`
   call sites afterward.
8. Migrate product icons to Remix in both apps and remove the `lucide-react` dependencies.
9. Convert auth forms in both apps.
10. Convert active dynamic, request, and admin forms. Keep the two field vocabularies separate.
11. Replace `window.prompt` and `window.confirm` with Dialogs and AlertDialogs in both apps.
12. Correct `Select` and `DropdownMenu` grouping.
13. Convert dashboard tables and keyboard interactions.
14. Normalize Cards and semantic states in both apps.
15. Convert dashboard chat and attachments; convert the portal conversation.
16. Extract the shared catalogue-field renderer, relocate the three types, then delete the dormant
    portal `DynamicRequestForm`.
17. Generate the `space-*` baseline, then add the design-system validation scripts.
18. Run full automated and manual acceptance.

---

# Automated validation

Run in each frontend after every phase, from that app's directory:

```powershell
pnpm check-types
pnpm validate
pnpm check
pnpm build
```

API integrity gate:

```powershell
cd axioma/api
pnpm check
pnpm check-types
pnpm test
pnpm build
pnpm contracts:check
```

`pnpm test` in `api/` requires a live Postgres; `src/shared/index.test.ts:29-43` queries
`pg_constraint` and there are `*.api.test.ts` files under `src/server/routers`. It is not a hermetic
unit gate.

No database check is required. The one contract change adds no migration.

If a protobuf boundary unexpectedly changes:

```powershell
pwsh axioma/agent/scripts/generate-proto.ps1
uv run --directory axioma/agent ruff check axel tests
uv run --directory axioma/agent pytest
uv build --directory axioma/agent

cd axioma/cli
pwsh scripts/generate-proto.ps1
go vet ./...
go test ./...
go build ./...
```

The agent's generation step comes first; its bindings are untracked and its tests import them.

## Static residue checks

Run from the repository root. Paths are relative to the repository root, not to `axioma/`.

```powershell
git grep -n 'lucide-react' -- axioma/dashboard/src axioma/portal/src
git grep -n '<select' -- axioma/dashboard/src axioma/portal/src
git grep -n 'type="checkbox"' -- axioma/dashboard/src axioma/portal/src
git grep -n '<textarea' -- axioma/dashboard/src axioma/portal/src
git grep -n 'animate-pulse' -- axioma/dashboard/src axioma/portal/src
git grep -nE 'window\.(prompt|confirm|alert)' -- axioma/dashboard/src axioma/portal/src
git grep -nE '(emerald|amber|orange|red|yellow|violet|sky|blue|green|rose|purple|teal|cyan|indigo|lime|fuchsia|pink)-[0-9]{2,3}' -- axioma/dashboard/src axioma/portal/src
git grep -nE '<(table|thead|tbody|tr|th|td)[ >]' -- axioma/dashboard/src axioma/portal/src
```

`git grep` searches tracked files only; run `rg` over the same paths to include anything untracked.
Expected exceptions must be explicit and documented.

---

# Manual acceptance

Validate keyboard-only navigation, visible focus, accessible errors, dialog focus behavior, light and
dark modes, and 320/375/768/desktop widths.

Dashboard flows:

- authentication,
- sidebar, command menu, theme, notifications,
- ticket queue sorting, filtering, density, pagination, horizontal scroll, and keyboard opening,
- ticket actions and classification,
- dynamic fields,
- collaboration and merge/link flows,
- agent run selection, evidence, escalation, cancel, takeover,
- every Dialog replacing a former browser prompt: documents link, saved view, queue escalation,
  software licences, asset custodian, and both automation delete confirmations,
- assets, mail, roles, forms, knowledge, changes, problems, and approvals,
- all empty, loading, and error states.

Portal flows:

- mobile and desktop navigation,
- authentication and provider flows,
- incident and catalogue request creation, with both field vocabularies exercised,
- dynamic value serialization,
- enrollment,
- ticket details and attachments, including the Dialog replacing the link prompt,
- reply and CSAT,
- knowledge search, filter, and feedback,
- public status history across all three availability bands,
- notifications and menus,
- all empty, loading, and error states.

Confirm in both apps that body text renders in Inter, headings in Instrument Sans, and only technical
text in Geist Mono.

State must never be communicated through color alone.
