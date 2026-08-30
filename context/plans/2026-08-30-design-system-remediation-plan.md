# Dashboard and Portal Design-System Remediation Plan

Date: 2026-08-30
Scope: `axioma/dashboard/`, `axioma/portal/`, `axioma/api/`, `axioma/agent/`, and `axioma/cli/`

## Objective

Bring the dashboard and portal into consistent alignment with their existing shadcn `base-nova` design system while preserving application behavior, API contracts, agent wire semantics, CLI behavior, and existing user work.

## Decisions finalized

1. Add shared `success`, `warning`, and `info` semantic color tokens, with foreground values and paired light/dark definitions, to both frontends.
2. Delete `portal/src/features/request-catalogue/components/dynamic-request-form.tsx` if a fresh import search confirms it remains unused; preserve or relocate any types still consumed by active code.
3. Use official `Message`, `Bubble`, and `MessageScroller` primitives in the portal if a targeted shadcn dry-run resolves cleanly from the configured registry without unwanted dependencies. Otherwise retain the semantic list and normalize it without inventing a chat framework.
4. Preserve the preset typography: Inter for body/UI text, Instrument Sans for headings, and Geist Mono only for technical text.
5. Standardize product icons on Remix Icon, as configured by both `components.json` files.

## Current architecture

Both frontends use React 19, Vite, Tailwind CSS v4, TanStack Router/Query/Form, shadcn `base-nova`, Base UI primitives, and the Remix Icon preset.

The API owns canonical oRPC contracts and protobuf definitions:

- `api/src/contracts/*` is mirrored into `dashboard/src/sdk/contracts/*` and `portal/src/sdk/contracts/*`.
- `api/proto/axioma.proto` is mirrored into `agent/proto/axioma.proto` and `cli/proto/axioma.proto`.
- Generated mirrors must never be edited directly.

The API already exposes all semantic data needed by the UI. This remediation does not require backend, database, agent, protobuf, or CLI changes.

## Documented implementation rules

- Forms use `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`, and `FieldError`.
- Put `data-invalid` on `Field` and `aria-invalid` on the control.
- `SelectItem` collections belong inside `SelectGroup`.
- `DropdownMenuItem` collections belong inside `DropdownMenuGroup`.
- Use `NativeSelect` for native/mobile behavior, ordinary form submission, and multiple selection.
- Use `Select` for styled single-selection interactions.
- Use `buttonVariants` on links rather than nesting links and buttons.
- Icons inside Buttons use `data-icon="inline-start|inline-end"`; the Button owns icon size.
- Use `Badge`, `Alert`, `Empty`, `Skeleton`, `Spinner`, `Separator`, `Card`, `Table`, and installed chat primitives instead of local lookalikes.
- Call-site classes describe layout, not primitive color, typography, radius, or shadows.

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

# Shared foundation

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

Changes:

1. Add/import `@fontsource-variable/inter`.
2. Keep `--font-sans: "Inter Variable"`.
3. Keep `--font-heading: "Instrument Sans Variable"`.
4. Keep Geist Mono as `--font-mono`.
5. Remove global `html { @apply font-mono; }`.
6. Add missing `destructive-foreground`.
7. Add `success`, `success-foreground`, `warning`, `warning-foreground`, `info`, and `info-foreground` in light and dark themes.
8. Expose all new tokens through `@theme inline`.
9. Align hard-coded browser `theme-color` metadata with the settled primary token.
10. Keep the two frontend token files equivalent unless a documented product distinction is intentional.

## Missing primitives

Add through targeted shadcn commands after `--dry-run` and `--diff` review:

- `dashboard/src/components/ui/native-select.tsx`
- `portal/src/components/ui/native-select.tsx`
- `dashboard/src/components/ui/spinner.tsx`

Conditionally add to portal if the official registry resolves cleanly:

- `portal/src/components/ui/message.tsx`
- `portal/src/components/ui/bubble.tsx`
- `portal/src/components/ui/message-scroller.tsx`

Do not use `--all`, `--overwrite`, or apply a new preset. Do not bulk-regenerate existing primitives.

---

# Dashboard plan

## D1. Shared state and layout components

### `dashboard/src/components/support-ui.tsx`

- Render `StatusBadge` with the installed `Badge`.
- Centralize finite state-to-semantic-variant mapping.
- Remove raw palette and manual dark-mode strings.
- Recompose loading, empty, and error states with `Spinner`/`Skeleton`, `Empty`, and `Alert`.
- Preserve `formatDate` and `timeAgo`.
- Retire `PageHeader` after consumers move to `PageContainer`.
- Migrate icons to Remix.

### `dashboard/src/components/loader.tsx`

- Replace Lucide loader with the shared `Spinner`.
- Keep only wrapper/layout responsibility.

### `dashboard/src/components/route-state.tsx`

- Use `Spinner` for pending and `Alert`/shared state composition for errors.
- Preserve retry behavior and accessibility roles.

### `dashboard/src/components/layout/page-container.tsx`

- Make it the canonical page-heading composition.
- Apply `font-heading` to page titles.
- Preserve title, description, action, main-content ID, and focus behavior.

### `dashboard/src/features/tickets/components/ticket-detail.tsx`

- Stop using the duplicate `PageHeader`.
- Use `PageContainer` for title, description, and actions.
- Convert repeated card-like sections to full `Card` composition.
- Preserve queries, actions, and tabs.

### `dashboard/src/components/layout/info-sidebar.tsx`

- Replace its custom card shell with `Card` composition if it remains visually exposed after shared normalization.

## D2. Remix Icon migration

Replace `lucide-react` in:

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

After the source grep is clean, remove `lucide-react` from `dashboard/package.json` and regenerate the lockfile.

## D3. Forms and controls

### `dashboard/src/components/sign-in-form.tsx`
### `dashboard/src/components/sign-up-form.tsx`

- Use `FieldGroup`, `Field`, `FieldLabel`, and `FieldError`.
- Set `data-invalid` and `aria-invalid`.
- Use `Spinner` for pending submit actions.
- Remove red error classes and indigo link overrides.
- Preserve TanStack Form, Zod, and auth behavior.

### `dashboard/src/features/changes/components/changes.tsx`

- Use `NativeSelect` for FormData-backed simple selects.
- Keep hidden inputs.
- Use `Input type="datetime-local"` and `Textarea` for PIR fields.
- Add explicit labels and Field composition.
- Replace empty list text with `Empty`.
- Preserve all payload transformations.

### `dashboard/src/features/admin/roles-page.tsx`

- Replace person-kind and team-department raw selects with `NativeSelect` or `Select` as appropriate.
- Preserve existing Checkboxes and mutation payloads.
- Move create forms to Field composition.

### `dashboard/src/features/automation/components/automation-pages.tsx`

- Replace raw checkbox with `Checkbox`.
- Use Field composition.
- Preserve Dialog/Card structure, JSON editing, schemas, and mutations.
- Add Spinner and `data-icon` where appropriate.

### `dashboard/src/features/knowledge/components/knowledge.tsx`

- Use Field composition in the editor.
- Replace raw single select and checkbox with `Select`/`NativeSelect` and `Checkbox`.
- Replace empty states with `Empty`.
- Preserve CRUD and routing.

### `dashboard/src/features/tickets/components/dynamic-fields.tsx`

Map controls as follows:

- text/reference: `Input`
- integer: numeric `Input`
- date/datetime: native input types through `Input`
- textarea: `Textarea`
- dropdown: `Select`
- checkbox: `Checkbox`
- multiselect: `NativeSelect multiple`

Remove duplicated control classes and preserve value shapes and serialization.

### `dashboard/src/features/tickets/components/ticket-collaboration.tsx`

- Replace raw relationship select.
- Use Field composition for composers/forms.
- Use warning `Alert` for merge/private-note states.
- Use `Empty` for empty lists.
- Preserve link, merge, watcher, message, and time-entry mutations.

### `dashboard/src/routes/_auth/forms.tsx`

- Replace raw selector with `NativeSelect`/`Select`.
- Use Field composition.
- Replace empty paragraph with shared Empty state.
- Preserve form-definition mutations.

### `dashboard/src/routes/_auth/mail-templates.tsx`

- Replace raw textarea with `Textarea`.
- Use labelled Field composition.
- Preserve template syntax and saves.

### `dashboard/src/routes/_auth/mailboxes.tsx`

- Add `SelectGroup`.
- Normalize form fields.
- Preserve Checkboxes and mutations.

### `dashboard/src/features/problems/components/problems.tsx`

- Use Field composition for its small form.
- Do not introduce TanStack Form solely for this form.

### `dashboard/src/features/documents/components/index.tsx`

- Keep the native file input.
- Style the visible trigger using `buttonVariants`.
- Preserve upload behavior.

## D4. Menu and select structure

Add `SelectGroup` around item collections in:

- `dashboard/src/routes/_auth/mailboxes.tsx`
- `dashboard/src/features/tickets/components/ticket-actions.tsx`
- `dashboard/src/features/tickets/components/ticket-classification-form.tsx`
- every converted Select in roles, changes, knowledge, dynamic fields, collaboration, and forms

Add `DropdownMenuGroup` in:

- `dashboard/src/components/mode-toggle.tsx`
- `dashboard/src/features/tickets/components/queue-facet.tsx`
- `dashboard/src/features/tickets/components/ticket-queue.tsx`

Review but retain correct grouping in `dashboard/src/components/user-menu.tsx`.

## D5. Tables and interactive rows

### `dashboard/src/features/assets/components/index.tsx`

- Replace raw table markup with installed Table primitives.
- Replace raw import-history button with Button or Item.
- Normalize Card composition.
- Preserve custody/import actions.

### `dashboard/src/features/mail/components/index.tsx`

- Convert both raw tables to Table primitives.
- Add accessible headers to inbound activity.
- Normalize empty state.

### `dashboard/src/features/tickets/components/ticket-queue.tsx`

- Convert DOM table markup to Table primitives while retaining TanStack Table behavior.
- Preserve sticky header, sorting, `aria-sort`, selection, density, pagination, and horizontal scrolling.
- Add Enter/Space opening behavior.
- Replace manual `animate-pulse` rows with `Skeleton`.

### `dashboard/src/features/problems/components/problems.tsx`
### `dashboard/src/features/changes/components/changes.tsx`
### `dashboard/src/features/knowledge/components/knowledge.tsx`

- Replace click-only rows/cards with a real link/button or complete keyboard activation and visible focus behavior.

## D6. Cards, states, and semantic colors

Normalize state presentation in:

- `dashboard/src/components/layout/notification-center.tsx`
- `dashboard/src/features/tickets/components/ticket-queue.tsx`
- `dashboard/src/features/agent-runs/components/agent-transcript.tsx`
- `dashboard/src/features/approvals/components/approvals.tsx`
- `dashboard/src/features/problems/components/problems.tsx`
- `dashboard/src/features/changes/components/changes.tsx`
- `dashboard/src/features/mail/components/index.tsx`
- `dashboard/src/routes/_auth/forms.tsx`

Normalize semantic state colors in:

- `dashboard/src/features/tickets/components/allowed-actions.ts`
- `dashboard/src/features/tickets/components/queue-columns.tsx`
- `dashboard/src/features/tickets/components/ticket-collaboration.tsx`
- `dashboard/src/features/agent-runs/components/step-card.tsx`
- `dashboard/src/features/agent-runs/components/agent-transcript.tsx`
- `dashboard/src/features/devices/components/devices-table.tsx`
- `dashboard/src/features/devices/components/device-detail-sheet.tsx`

Normalize malformed/content-only Cards in:

- `dashboard/src/routes/_auth/mailboxes.tsx`
- `dashboard/src/routes/_auth/mail-templates.tsx`
- `dashboard/src/features/assets/components/index.tsx`
- `dashboard/src/features/automation/components/automation-pages.tsx`
- `dashboard/src/features/scheduling/components/index.tsx`

Optional adjacent cleanup only when touched:

- `dashboard/src/routes/_auth/software-licences.tsx`
- `dashboard/src/features/suppliers/components/index.tsx`
- `dashboard/src/features/overview/components/overview-page.tsx`
- `dashboard/src/features/cmdb/components/ticket-impact.tsx`
- `dashboard/src/features/tickets/components/sla-countdown.tsx`
- `dashboard/src/features/tickets/components/ticket-actions.tsx`

## D7. Messaging and attachments

### `dashboard/src/features/tickets/components/ticket-collaboration.tsx`

Use installed:

- `MessageScroller`
- `MessageScrollerViewport`
- `MessageScrollerContent`
- `MessageScrollerItem`
- `MessageScrollerButton`
- `Message`
- `Bubble`
- `Marker`

Keep existing queries, presence, mutations, and native form. Do not write custom scroll-observer logic.

### `dashboard/src/features/documents/components/index.tsx`

Use installed Attachment composition while preserving native file input, upload loop, link mutation, and download URLs.

### `dashboard/src/features/agent-runs/components/run-selector.tsx`

Replace raw styled buttons with Button or Item while preserving `fieldset`, hidden legend, `aria-pressed`, selected state, and run metadata. Do not add ToggleGroup solely for this.

## D8. Agent transcript presentation

### `dashboard/src/features/agent-runs/components/step-card.tsx`

- Use Alert for evidence/error surfaces.
- Use Badge for tool names.
- Use semantic step-kind tokens.
- Preserve Collapsible output and serialization.

### `dashboard/src/features/agent-runs/components/agent-transcript.tsx`

- Use warning Alert for escalation.
- Use semantic success/destructive diff colors.
- Preserve polling, selection, clipboard, retry, cancellation, takeover, and escalation parsing.

Do not modify:

- `dashboard/src/features/agent-runs/components/escalation.ts`
- `dashboard/src/features/agent-runs/components/run-polling.ts`
- their validation files

---

# Portal plan

## P1. Shared portal components

### `portal/src/components/ticket-ui.tsx`

- Keep `getStatus`, `formatDate`, `PageShell`, and `PageHeading`.
- Render status through `Badge` and semantic variants.
- Replace raw emerald/blue and manual dark classes.
- Replace custom error Card with Alert/Empty.
- Keep loading cards but rely on primitive-owned Skeleton styling.
- Replace Lucide component typing.

### `portal/src/components/loader.tsx`

- Use existing Spinner.

### `portal/src/components/header.tsx`

- Convert to Remix icons.
- Add mobile navigation with existing DropdownMenu.
- Preserve TanStack Links.

### `portal/src/components/notification-center.tsx`

- Use `DropdownMenuGroup` and `DropdownMenuItem` with Base UI `render` for routed records.
- Use Skeleton/Alert/Empty for states.
- Use menu separators.
- Preserve mark-read behavior.

### `portal/src/components/user-menu.tsx`

- Replace nested routed Button markup with `buttonVariants` on Link.
- Preserve grouping and logout.

### `portal/src/components/mode-toggle.tsx`

- Migrate icons.
- Remove manual Button icon dimensions.
- Add accessible trigger name.
- Wrap items in `DropdownMenuGroup`.

## P2. Remix Icon migration

Replace Lucide imports in:

- `portal/src/components/header.tsx`
- `portal/src/components/loader.tsx`
- `portal/src/components/mode-toggle.tsx`
- `portal/src/components/notification-center.tsx`
- `portal/src/components/ticket-ui.tsx`
- `portal/src/routes/_auth/home.tsx`
- `portal/src/routes/_auth/tickets/new.tsx`
- `portal/src/routes/_auth/tickets/$ticketId.tsx`
- `portal/src/features/tickets/components/conversation-card.tsx`
- `portal/src/features/tickets/components/progress-timeline.tsx`
- `portal/src/features/tickets/components/request-form.tsx`
- `portal/src/features/tickets/components/resolution-card.tsx`

Then remove `lucide-react` from `portal/package.json` and regenerate the lockfile.

## P3. Forms

### `portal/src/components/sign-in-form.tsx`
### `portal/src/components/sign-up-form.tsx`

- Use Field composition and accessible invalid states.
- Use Spinner for submission.
- Replace decorative divider markup with Separator.
- Preserve auth/provider behavior.

### `portal/src/routes/_auth/home.tsx`

- Convert enrollment control to Field composition.
- Keep native details/summary.
- Use Spinner in pending action.
- Preserve correct Empty use.

### `portal/src/features/tickets/components/request-form.tsx`

- Remove local `FieldError` and use the installed component.
- Convert title, body, device, catalogue, and dynamic fields to Field composition.
- Keep RadioGroup for request questions.
- Use FieldSet/FieldLegend for related choices.
- Use Select/SelectGroup for styled single selects.
- Use Checkbox for booleans.
- Use NativeSelect multiple for multiselect.
- Keep native date/datetime through Input.
- Remove duplicate control classes.
- Add Spinner and `data-icon`.
- Preserve schemas, form state, activation logic, serialization, invalidation, and payloads.

### `portal/src/features/tickets/components/dynamic-fields.tsx`

- Apply the same field/control mapping.
- Preserve value shapes and serialization.

### `portal/src/features/tickets/components/conversation-card.tsx`

- Use Field composition for reply and comment.
- Keep CSAT as RadioGroup with star-styled FieldLabels.
- Replace amber palette with semantic rating/accent treatment.
- Add Spinner.
- Preserve submit-reset behavior.

### `portal/src/routes/_auth/tickets/$ticketId.tsx`

- Convert add-detail dialog to Field composition.
- Preserve Dialog title/description.
- Replace `window.prompt` link attachment entry with a small Dialog form.
- Keep native file input styled by `buttonVariants`.
- Normalize upload failures with Alert.
- Preserve ticket and upload behavior.

### `portal/src/features/knowledge/components/knowledge-browser.tsx`

- Use Input, Select/SelectGroup, and Field.
- Render article results using Item or Card.
- Use Empty for no results.

### `portal/src/features/knowledge/components/knowledge-article.tsx`

- Use Button/buttonVariants for back action.
- Model Yes/No as RadioGroup inside FieldSet/FieldLegend.
- Preserve article semantics.

### `portal/src/routes/status.tsx`

- Use Button for retry, Spinner/Skeleton for loading, and Alert for errors.

## P4. Cards, states, status, and routes

### `portal/src/features/status/components/service-status.tsx`

- Use Card composition.
- Use Badge for operational/disrupted state.
- Use semantic success/warning/destructive tokens in the 90-day strip.
- Keep the domain visualization and accessibility labels.
- Use Empty for no services.

### `portal/src/features/tickets/components/resolution-card.tsx`

- Replace emerald classes with semantic success/warning treatment.
- Migrate icon.
- Preserve status branches.

### `portal/src/routes/_auth/knowledge.tsx`
### `portal/src/routes/_auth/knowledge.$articleId.tsx`

- Normalize loading, error, empty, and not-found states with shared primitives.
- Preserve querying and routing.

### `portal/src/routes/_auth/tickets/new.tsx`

- Migrate back icon and apply `data-icon`.
- Remove redundant Card radius override.

### `portal/src/routes/_auth/tickets/$ticketId.tsx`

- Remove redundant Card restyling.
- Use Badge for categorical metadata.
- Use Item for repeated detail/attachment rows where suitable.
- Use Separator for structural dividers.

### `portal/src/routes/_auth/home.tsx`

- Remove redundant Card styling.
- Keep native disclosures.
- Normalize connection and finished-ticket sections around Card and Separator.

## P5. Conversation

### `portal/src/features/tickets/components/conversation-card.tsx`

If official primitives resolve cleanly:

- add and use MessageScroller, Message, and Bubble,
- use Empty when there are no messages,
- keep Card as the outer panel,
- do not add custom scroll-following logic.

Otherwise:

- retain semantic `ol/li`,
- normalize tokens, spacing, and empty state,
- do not create local chat framework primitives.

## P6. Remove dormant duplicate form

Freshly search all imports of:

- `portal/src/features/request-catalogue/components/dynamic-request-form.tsx`

If still unused:

1. Delete it.
2. Update `portal/src/features/request-catalogue/components/index.ts`.
3. Preserve or relocate any types used by `request-form.tsx`.
4. Run existing catalogue and form validation scripts.

If a real caller appears before implementation, retain and migrate it using the same Field/Input/Textarea/NativeSelect/Checkbox/Button rules.

---

# Backend plan: `api/`

Required modified files: **none**.

The API already exposes ticket state metadata, dynamic field definitions, notifications, status availability, agent transcripts, catalogue forms, knowledge, assets, and changes.

Do not modify:

- `api/src/contracts/*`
- `api/src/server/routers/*`
- `api/src/db/schema/*`
- `api/proto/axioma.proto`

Only change these if implementation identifies genuinely missing data or behavior. Visual variants remain frontend concerns. If a contract changes, update the canonical API contract first, publish mirrors, and never edit generated frontend SDK files directly.

---

# AI Brain plan: `agent/`

Required modified files: **none**.

The existing transcript payload supports all planned presentation changes. Do not modify agent loop, model, server, tools, protobuf mirror, or generated bindings.

Agent/API/protobuf work is justified only if a separate product decision introduces a structured escalation payload, new run status, or new step kind.

---

# CLI plan: `cli/`

Required modified files: **none**.

The CLI is a separate Bubble Tea/Lip Gloss terminal UI and communicates through the device protobuf channel. Frontend design-system remediation has no CLI impact.

Do not modify CLI TUI, device logic, CUA logic, protobuf mirror, or generated bindings unless wire semantics, device actions, enrollment, or the terminal UI itself are separately redesigned.

---

# Regression guards

Add:

- `dashboard/src/components/design-system.validation.mjs`
- `portal/src/components/design-system.validation.mjs`

Use only Node standard-library modules. Scan first-party source while excluding primitive internals, brand assets, generated route trees, and documented native exceptions.

Fail on:

1. `lucide-react` imports.
2. Unapproved visible raw single-value selects.
3. Raw product checkboxes where Checkbox should be used.
4. Feature-level `animate-pulse` outside Skeleton.
5. Raw status palette classes in remediated product files.
6. Raw table tags outside dashboard's Table primitive.
7. Missing SelectGroup/DropdownMenuGroup in known call sites.
8. Newly introduced `space-x-*`/`space-y-*` in touched product files.

Allow:

- hidden inputs,
- native file/date/datetime inputs,
- native multiselect,
- semantic details/summary,
- primitive internals,
- brand SVGs,
- domain status visualizations backed by semantic tokens.

Do not add a test framework solely for these checks.

---

# Files explicitly excluded

- `dashboard/src/routes/_auth/calendar.tsx` — existing user change; preserve byte-for-byte.
- `dashboard/src/routeTree.gen.ts`
- `portal/src/routeTree.gen.ts`
- all generated `dashboard/src/sdk/contracts/*`
- all generated `portal/src/sdk/contracts/*`
- API contracts, routers, schemas, and protobuf unless a real boundary change emerges
- agent and CLI generated protobuf bindings
- `axioma/web/*`
- brand artwork and public assets
- existing primitive files except targeted additions reviewed via shadcn diff

Avoid repository-wide format/fix commands that could alter unrelated user work.

---

# Execution order

1. Snapshot Git status and protect `dashboard/src/routes/_auth/calendar.tsx`.
2. Apply shared font/token foundation to dashboard and portal.
3. Preview/add NativeSelect and dashboard Spinner.
4. Recompose shared status, loading, empty, and error components.
5. Migrate product icons to Remix and remove Lucide dependencies.
6. Convert auth forms.
7. Convert active dynamic/request/admin forms.
8. Correct Select and DropdownMenu grouping.
9. Convert dashboard tables and keyboard interactions.
10. Normalize Cards and semantic states.
11. Convert dashboard chat/attachments.
12. Resolve and, if clean, add portal chat primitives; otherwise normalize the semantic list.
13. Delete the unused portal DynamicRequestForm if still unreferenced.
14. Add design-system validation scripts.
15. Run full automated and manual acceptance.

---

# Automated validation

Run in both frontends after every phase:

```powershell
pnpm check-types
pnpm validate
pnpm check
pnpm build
```

Final API integrity gate:

```powershell
cd axioma/api
pnpm check
pnpm check-types
pnpm test
pnpm build
pnpm contracts:check
```

No database check is required unless schema or migration files change.

If a protobuf boundary unexpectedly changes:

```powershell
uv run --directory axioma/agent ruff check axel tests
uv run --directory axioma/agent pytest
uv build --directory axioma/agent

cd axioma/cli
pwsh scripts/generate-proto.ps1
go vet ./...
go test ./...
go build ./...
```

Static residue checks:

```powershell
git grep -n 'lucide-react' -- dashboard/src portal/src
git grep -n '<select' -- dashboard/src portal/src
git grep -n 'type="checkbox"' -- dashboard/src portal/src
git grep -n '<textarea' -- dashboard/src portal/src
git grep -n 'animate-pulse' -- dashboard/src portal/src
git grep -nE 'emerald-|amber-|orange-|red-|yellow-|violet-|sky-|blue-' -- dashboard/src portal/src
git grep -nE '<table|<thead|<tbody|<tr|<th|<td' -- dashboard/src portal/src
```

Expected exceptions must be explicit and documented.

---

# Manual acceptance

Validate keyboard-only navigation, visible focus, accessible errors, dialog focus behavior, light/dark modes, and 320/375/768/desktop widths.

Dashboard flows:

- authentication,
- sidebar/command/theme/notifications,
- ticket queue sorting/filtering/density/pagination/keyboard opening,
- ticket actions and classification,
- dynamic fields,
- collaboration and merge/link flows,
- agent run selection/evidence/escalation/cancel/takeover,
- assets, mail, roles, forms, knowledge, changes, problems, and approvals,
- all empty/loading/error states.

Portal flows:

- mobile and desktop navigation,
- authentication/provider flows,
- incident and catalogue request creation,
- dynamic value serialization,
- enrollment,
- ticket details and attachments,
- reply and CSAT,
- knowledge search/filter/feedback,
- public status history,
- notifications and menus,
- all empty/loading/error states.

State must never be communicated through color alone.
