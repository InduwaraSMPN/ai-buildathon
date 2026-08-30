# Selective TanStack Standardization Plan

## 1. Objective

Standardize only where the current architecture benefits:

- Keep **TanStack Router** as the React routing standard.
- Keep **TanStack Query + oRPC** as the frontend server-state boundary.
- Keep **TanStack Form** for fixed, typed forms.
- Keep **TanStack Table** only for interactive data grids.
- Ensure devtools are development-only and absent from production bundles.
- Preserve:
  - Hono, oRPC, Drizzle, and PostgreSQL in `api/`
  - Python and LiteLLM in `agent/`
  - Go and typed device actions in `cli/`
- Do **not** introduce TanStack DB, AI, Store, Charts, Hotkeys, Markdown, Highlight, Virtual, or Pacer into the authenticated SPAs without a concrete product requirement.
- Do **not** add TanStack Start to `dashboard/` or `portal/`. Both are Vite SPAs with a single `index.html` and no SSR. `axioma/web/` already uses `@tanstack/react-start`; that is unrelated to this plan and stays as it is.
- Do **not** add `RouterButton`, `RouterDialog`, `RouterSheet`, `createLink(Button)` wrappers, a `#portal-root` element, or a shared navigation abstraction. The existing semantic links and Base UI `render` composition already solve these concerns.

No generic repository layer, form factory, table wrapper, shared frontend package, or monorepo conversion will be introduced.

### Scope

Four independent pnpm projects live under `axioma/`, each with its own `pnpm-lock.yaml`: `api`, `dashboard`, `portal`, `web`. There is no pnpm workspace. The three `pnpm-workspace.yaml` files that exist (`api`, `dashboard`, `portal`) contain only an `allowBuilds:` block and are build-approval config, not workspace roots.

- `dashboard/` and `portal/` carry the Query, Form, and Router work.
- `api/` and `web/` are in scope **only** for the shared script defects in §3.3 and the CI work in §13. `web/` does not use shadcn/ui and needs no TanStack changes.
- `agent/` and `cli/` require no TanStack changes, only the protobuf, Tilt, and documentation corrections in §10-11.
- Broader transport security belongs to the separate gRPC workstream in §12.

### Database

126 tables in `public`, 28 Drizzle journal entries, 28 rows in `drizzle.__drizzle_migrations`. Schema and migrations are in sync. No schema, migration, or data change is part of this plan.

### Integration verdict

The TanStack Router + shadcn/ui integration in `dashboard/` and `portal/` is correct and uses newer shadcn/Base UI patterns than parts of the referenced TanStack guide. Verified and to be preserved:

- `components.json` uses `rsc: false`, valid aliases, and the real Tailwind CSS entry.
- The empty Tailwind config is correct for Tailwind CSS v4.
- Vite's Tailwind and TanStack Router plugins are configured correctly.
- TypeScript `@/*` aliases match the shadcn aliases.
- Global Tailwind, animation, and shadcn styles are imported.
- Internal navigation uses TanStack Router's typed `Link`.
- Button links are semantic anchors styled with `buttonVariants`.
- Base UI components compose links through `render={<Link ... />}`.
- Active navigation uses supported `activeProps` or router-state patterns.
- Dialogs and sheets use controlled state where needed.

Both `main.tsx` files are byte-identical and already set `defaultPreload: "intent"`, `scrollRestoration: true`, and `defaultPendingComponent`. Neither app integrates Query with the router: there is no `@tanstack/react-router-with-query`, and there are **zero route `loader` functions** in either app. Every route is `beforeLoad` + `component`, and all fetching is component-level `useQuery`. That is a deliberate shape and this plan does not change it.

## 2. Current state

### Verified

- API contract mirrors are current; all three protobuf copies are byte-identical (sha256 `6290ebcf2f96f5…`).
- Agent tests: 43 collected. Ruff is configured in `agent/pyproject.toml` (`line-length = 100`, `target-version = "py314"`, `select = ["E","F","I","UP","B","SIM"]`) and is never run by CI.
- Dashboard and portal production Vite builds pass.
- Dashboard and portal `tsc --noEmit` each report exactly **one** error, both at `src/components/ui/spinner.tsx(6,6)` TS2769.
- Neither frontend has a conventional unit/component test suite. Five hand-rolled `*.validation.mjs` scripts exist in `dashboard/`; none is wired to an npm script or to CI.

### Blocking defect: CI is red on every run

`.github/workflows/contracts.yml` has failed on all eight most recent runs. The failing step is `pwsh cli/scripts/generate-proto.ps1`:

```
/tmp/axioma-protoc-go/protoc-gen-go.exe: program not found or is not executable
--go_out: protoc-gen-go: Plugin failed with status code 1.
```

`cli/scripts/generate-proto.ps1` hardcodes `protoc-gen-go.exe` and `protoc-gen-go-grpc.exe` via `Join-Path $tools '…exe'`, but the workflow runs on `ubuntu-latest`, where `go install` emits those binaries without an extension. Every step after it — `git diff --exit-code -- cli/internal/pb`, `go test ./...`, `pnpm --dir api check-types`, `pnpm --dir api test` — has never executed. Nothing downstream of that step in the current workflow can be treated as passing.

This is Phase One. It must be fixed before any claim about CI, and before §13 adds jobs on top of it.

### Files inspected and requiring no change

- `axioma/dashboard/components.json`, `axioma/portal/components.json`
- `axioma/dashboard/vite.config.ts`, `axioma/portal/vite.config.ts`
- `axioma/dashboard/tsconfig.json`, `axioma/portal/tsconfig.json`
- `axioma/dashboard/src/styles/globals.css`, `axioma/portal/src/styles/globals.css`
- `axioma/dashboard/src/components/ui/button.tsx`, `axioma/portal/src/components/ui/button.tsx`
- `axioma/dashboard/src/components/layout/app-sidebar.tsx`, `axioma/dashboard/src/components/layout/header.tsx`
- `axioma/portal/src/components/header.tsx`
- `axioma/portal/src/routes/_auth/tickets/new.tsx`
- `axioma/portal/src/features/request-catalogue/components/dynamic-request-form.tsx`
- `axioma/portal/src/features/tickets/components/dynamic-fields.tsx`
- `axioma/portal/src/features/tickets/api/queries.ts` and `mutations.ts` — the reference implementation this plan converges on

`main.tsx` and `__root.tsx` in both apps change only per §4 and §6.

### Documentation basis

Context7 was queried for oRPC, TanStack Router, TanStack Query, and TanStack Form. Installed package type declarations were read directly for the devtools prop surfaces and for `@orpc/tanstack-query`'s `QueryKeyOptions`.

## 3. Phase One — Repair the validation baseline

### 3.1 Fix cross-platform protobuf generation for the CLI

File:

- `axioma/cli/scripts/generate-proto.ps1`

Resolve the plugin binaries by platform rather than hardcoding `.exe`. `$IsWindows` is available in PowerShell 7; the workflow's `pwsh` on Ubuntu sets it to `$false`.

```powershell
$suffix = if ($IsWindows) { ".exe" } else { "" }
"--plugin=protoc-gen-go=$(Join-Path $tools "protoc-gen-go$suffix")"
"--plugin=protoc-gen-go-grpc=$(Join-Path $tools "protoc-gen-go-grpc$suffix")"
```

Validation: the workflow reaches `git diff --exit-code -- cli/internal/pb` and that step passes, meaning the committed Go bindings match a fresh generation on Linux.

### 3.2 Fix the shared spinner type error

Both `axioma/dashboard/src/components/ui/spinner.tsx` and `axioma/portal/src/components/ui/spinner.tsx` are byte-identical (338B) and declare props as `React.ComponentProps<"svg">`, spreading them onto `RiLoaderLine`. `@remixicon/react@4.9.0` (`index.d.ts:9-13`) declares `RemixiconProps` with `children?: never` and additionally strips `color`, `size`, `width`, `height`, `fill`, and `viewBox` from the SVG prop set. Hence:

```
src/components/ui/spinner.tsx(6,6): error TS2769: No overload matches this call.
    Types of property 'children' are incompatible.
      Type 'ReactNode' is not assignable to type 'undefined'.
```

The two copies have different fates:

**Dashboard — delete.** `axioma/dashboard/src/components/ui/spinner.tsx` has **zero importers** repo-wide. It exists only to break `check-types`. Delete it.

**Portal — fix.** One importer: `axioma/portal/src/features/tickets/components/progress-timeline.tsx:2`, used at line 69 as `<Spinner className="size-4" aria-hidden="true" />`. Derive the props from the icon:

```tsx
type SpinnerProps = React.ComponentProps<typeof RiLoaderLine>;

function Spinner({ className, ...props }: SpinnerProps) {
	return (
		<RiLoaderLine
			data-slot="spinner"
			role="status"
			aria-label="Loading"
			className={cn("size-4 animate-spin", className)}
			{...props}
		/>
	);
}
```

Preserve `className`, `role="status"`, `aria-label="Loading"`, forwarded icon props, and current markup. Run Biome formatting on the file.

Validation:

```powershell
pnpm --dir axioma/dashboard check-types
pnpm --dir axioma/portal check-types
```

Both must pass with zero errors, and no import of the deleted dashboard file may remain.

### 3.3 Separate build, type checking, checking, and fixing

Three of the four projects conflate these. Fix all of them; the defect is not dashboard-and-portal-only.

| Project | `check` now | `check-types` now |
|---|---|---|
| `api` | `biome check --write .` | `tsc --noEmit` |
| `dashboard` | `biome check .` | `vite build && tsc --noEmit` |
| `portal` | `biome check --write .` | `vite build && tsc --noEmit` |
| `web` | `biome check --write .` | `vite build && tsc --noEmit` |

Target shape for every project:

```json
"build": "vite build",
"check": "biome check .",
"fix": "biome check --write .",
"check-types": "tsc --noEmit"
```

(`api` keeps `"build": "tsdown"`.) No project currently has a `fix` script; add it to all four. CI must never rewrite files, and a type failure and a build failure must be distinguishable.

### 3.4 Biome baseline

Files:

- `axioma/dashboard/biome.json`, `axioma/portal/biome.json` (byte-identical), plus the `api` and `web` equivalents

Installed Biome is **2.5.10** (declared `^2.5.6`). It emits a deprecation on the current config in both apps:

```
biome.json:29:12 deserialize  DEPRECATED
  i The use of the recommended field has been deprecated, and will removed in the
    next major version of Biome. Use preset instead.
```

Replace `linter.rules.recommended: true` (`biome.json:32`) with the `preset` form.

Measured debt from `biome check .` (no `--write`):

| | Dashboard | Portal |
|---|---:|---:|
| Files checked | 161 | 75 |
| Errors | 109 | 56 |
| Warnings | 144 | 75 |

Lint-rule errors account for only 49 (dashboard) and 27 (portal); the remaining ~89 errors are **formatter drift** — the checked-in source is not Biome-formatted, and `biome.json` itself is among the flagged files. Dominant rules: `organizeImports` (35/18 errors), `useSortedClasses` (119/63 warnings), `useImportType` (23/12 warnings).

Therefore:

1. Fix the deprecated `recommended` key.
2. Lint only changed files during this work.
3. Put the whole-repository formatter pass in its own commit, separate from every other change here.
4. Enable whole-app `pnpm check` in CI only after that commit lands.

## 4. Phase Two — Development-only devtools

Files:

- `axioma/dashboard/src/routes/__root.tsx`
- `axioma/portal/src/routes/__root.tsx`

Both statically import `@tanstack/react-query-devtools` and `@tanstack/react-router-devtools` and render:

```tsx
<TanStackRouterDevtools position="bottom-left" />
<ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
```

Every prop here is valid in the installed versions (`@tanstack/react-router-devtools` 1.167.1, `@tanstack/react-query-devtools` 5.102.8), and `TanStackRouterDevtools` is the correct export — the package exports `TanStackRouterDevtoolsPanel` and `…InProd` variants alongside it. Do not change the component choice or any prop.

The packages already return a null component outside development (`process.env.NODE_ENV !== "development"`), so this is purely about keeping them out of the production module graph. Replace the static imports with a development-gated dynamic import:

```tsx
import { lazy, Suspense } from "react";

const Devtools = import.meta.env.DEV
	? lazy(async () => {
			const [{ ReactQueryDevtools }, { TanStackRouterDevtools }] =
				await Promise.all([
					import("@tanstack/react-query-devtools"),
					import("@tanstack/react-router-devtools"),
				]);

			return {
				default: function Devtools() {
					return (
						<>
							<TanStackRouterDevtools position="bottom-left" />
							<ReactQueryDevtools
								position="bottom"
								buttonPosition="bottom-right"
							/>
						</>
					);
				},
			};
		})
	: null;
```

Render:

```tsx
{Devtools ? (
	<Suspense fallback={null}>
		<Devtools />
	</Suspense>
) : null}
```

Use the same local implementation in each application. The applications are intentionally independent; a cross-application utility for this block would cost more than the duplication.

### Validation

1. Development server: both launchers appear and both panels open.
2. Production build: no launcher renders; the built output contains no devtools chunk. Grep `dist/` for `react-query-devtools` and `router-devtools`.
3. Route error, pending, theme, and toast rendering are unchanged.

## 5. Phase Three — Consolidate dashboard Query usage on oRPC

The dashboard has two parallel client data layers: the standard `orpc.<procedure>.queryOptions()` / `.mutationOptions()` API, and handwritten service/query/mutation wrappers in four feature folders. Twelve other dashboard feature folders already call `orpc.*` directly from components, and `portal/src/features/tickets/api/` is already fully migrated. Direct oRPC use is the established house style; the wrappers are the outlier.

`appRouter` is a **flat, single-level object** of 163 procedures composed from 17 sub-routers — there is no namespacing. Every procedure name used below was verified against `axioma/api/src/server/routers/index.ts` and the generated mirror `axioma/dashboard/src/sdk/contracts/index.ts`.

### 5.1 Keep the integration root

No structural change to `axioma/dashboard/src/utils/orpc.ts`. It exports `createQueryClient()` (with a `QueryCache.onError` toast carrying a retry action), `queryClient`, `link`, `client`, and `orpc`.

`client` must remain: every `features/*/api/types.ts` derives its types from it via `Parameters<>` / `Awaited<ReturnType<>>`.

### 5.2 Rules that apply to every migration below

These are the behaviours most easily lost. Treat them as requirements, not notes.

**Do not delete `api/types.ts` in any feature folder.** `tickets/api/types.ts` (44 lines) builds `TicketAction`, `TicketActionInput<A>`, `TicketOperatorAction`, and `TicketOperatorActionInput` by distributing over the `updateTicket` discriminated union. These are consumed by `ticket-actions.tsx`, `queue-search.ts`, and `ticket-detail.tsx:101`, and re-exported from `features/tickets/index.ts`. `devices/api/types.ts` (5 lines) and `agent-runs/api/types.ts` (7 lines) are likewise kept. `overview` has no `types.ts`.

**`ticketKeys.all` has no oRPC equivalent.** `ticketKeys` (`tickets/api/queries.ts:5-10`) is a hierarchical namespace rooted at `["tickets"]` covering list, detail, and SLA, so one `invalidateQueries({ queryKey: ticketKeys.all })` refreshes all three. oRPC keys are per-procedure paths with no common prefix short of `orpc.key()`, which matches **every** oRPC query in the app. Replace each `ticketKeys.all` invalidation with three explicit calls:

```ts
await Promise.all([
	queryClient.invalidateQueries({ queryKey: orpc.listTickets.key() }),
	queryClient.invalidateQueries({ queryKey: orpc.getTicket.key({ input: { id } }) }),
	queryClient.invalidateQueries({ queryKey: orpc.listTicketSla.key({ input: { ticketId: id } }) }),
]);
```

Never substitute `orpc.key()`. That is silent over-invalidation across devices, assets, and automation.

**Replace visibility guards with `refetchIntervalInBackground: false`.** The dashboard wrappers hand-roll `typeof document === "undefined" || document.visibilityState === "visible" ? 15_000 : false`. Both apps are Vite SPAs with no SSR, so the `typeof document` half is dead code. React Query already suspends interval refetching for an unfocused window, and `portal/src/features/tickets/api/queries.ts:12` states it explicitly. Use a plain interval plus `refetchIntervalInBackground: false`. Do not add SSR guards.

**Mutation callback ordering.** `tickets/api/mutations.ts` defines a `Callbacks` adapter whose contract is *await invalidation, then call `callbacks.onSuccess`*. Call sites depend on the toast firing after the cache is invalidated. `orpc.*.mutationOptions({ onSuccess })` performs no invalidation of its own, so each call site must re-add both the invalidation and the ordering.

### 5.3 Tickets

Symbols and their consumers: `ticketQueries` (`index.ts:2`, `ticket-queue-page.tsx:8,18`, `ticket-detail.tsx:24,37,82,88`), `ticketMutations` (`index.ts:1`, `ticket-queue-page.tsx:7,20`, `ticket-detail.tsx:23,96`), `ticketKeys` (`index.ts:2`, `tickets/api/mutations.ts:2,21,32`, **`agent-runs/api/mutations.ts:2,15`**, **`agent-runs/components/agent-transcript.tsx:18,53`**), `ticketService` (`index.ts:3` and inside the api folder only).

The two `agent-runs` consumers are cross-feature and must not be missed.

#### `axioma/dashboard/src/features/tickets/components/ticket-queue-page.tsx`

Replace `ticketQueries.list(...)` and `ticketMutations.update(...)` with `orpc.listTickets.queryOptions({ input, ... })` and `orpc.updateTicket.mutationOptions({ ... })`.

`listTickets` requires `input` (`scope` is mandatory; `limit`, `sortBy`, `sortDirection` carry `.default()`). `toTicketListInput` hardcodes `scope: "all"`.

Preserve: 15-second polling with `refetchIntervalInBackground: false`; the URL-derived search input object passed unchanged as `input`; mutation error handling; success behaviour; list invalidation via `orpc.listTickets.key()`.

Cursor pagination lives in the Router search params (`cursor` plus a `cursorHistory` stack), not in the query. There is no `placeholderData`, so paging shows the pending state — that is existing behaviour and stays as it is.

#### `axioma/dashboard/src/features/tickets/components/ticket-detail.tsx`

Replace `ticketQueries.detail(ticketId)`, `ticketQueries.sla(ticket.id)`, `ticketMutations.update(...)`, and `ticketKeys` with `orpc.getTicket.queryOptions({ input: { id: ticketId } })`, `orpc.listTicketSla.queryOptions({ input: { ticketId } })`, `orpc.updateTicket.mutationOptions(...)`, and generated keys.

The SLA input field is `ticketId`, not `id`. `getTicket`'s output is `.nullable()`.

Line 88 currently invalidates by a **full-match** `queryKey`. Choose deliberately: `orpc.getTicket.queryKey({ input: { id } })` for exact match, `orpc.getTicket.key({ input: { id } })` for prefix match. Prefer `.key()` for consistency with the rest of the file, which already uses `orpc.listFieldDefinitions`, `orpc.getTicketServiceRecords`, and `orpc.setTicketDynamicFields.mutationOptions`.

Preserve: 15-second SLA polling; focused detail invalidation; ticket-list invalidation; optimistic/local custom-field behaviour; existing success and failure messages. `sla.data ?? []` and `fieldDefinitions.data ?? []` are component-level and unaffected. `detail` has no polling and gains none.

#### Live bug this migration closes

`axioma/dashboard/src/features/tickets/components/ticket-collaboration.tsx:41`, `:223`, and `:234` already invalidate `orpc.getTicket.key({ input: { id: ticket.id } })` after `addTicketMessage`, `mergeTickets`, and `unmergeTicket`. The detail query is currently registered under the handwritten key `["tickets","detail",id]` (`tickets/api/queries.ts:25`), so those three keys never match and the invalidations are **silent no-ops today** — the ticket detail does not refresh after adding a message, merging, or unmerging.

Migrating `ticket-detail.tsx` to `orpc.getTicket.queryOptions` fixes this. It is a completion criterion, not a side effect: verify each of the three actions refreshes the detail pane.

#### `axioma/dashboard/src/features/tickets/index.ts`

Remove the `ticketService`, `ticketQueries`, `ticketKeys`, and `ticketMutations` exports. Retain the type re-exports (`Ticket`, `TicketDetailData`, `TicketScope`, `TicketStatus`, `CreateTicketInput`, `UpdateTicketInput`) and `export * from "./components"`.

#### Delete after all callers migrate

- `axioma/dashboard/src/features/tickets/api/service.ts`
- `axioma/dashboard/src/features/tickets/api/queries.ts`
- `axioma/dashboard/src/features/tickets/api/mutations.ts`

Keep `axioma/dashboard/src/features/tickets/api/types.ts`.

### 5.4 Devices

The exported service symbol is **`devicesService`**. `deviceMutations` (`devices/api/mutations.ts`, 2 lines, `{} as const`) has zero importers.

#### `axioma/dashboard/src/features/devices/components/devices-table.tsx`

Replace `deviceQueries.all()` (line 123) with:

```tsx
orpc.listDevices.queryOptions({
	refetchInterval: 5_000,
	refetchIntervalInBackground: false,
})
```

`listDevices` declares no `.input()`. `@orpc/tanstack-query@1.15.0` types `QueryKeyOptions<TInput>` as `undefined extends TInput ? { input?: … } : { input: … }`, so omitting `input` is type-legal; `overview-page.tsx:50` already relies on this for `getDashboardArrangement`.

Do not modify the TanStack Table implementation. `query.data ?? []` feeds `useReactTable`; `SortingState` and `globalFilter` are local state.

#### `axioma/dashboard/src/features/devices/components/device-detail-sheet.tsx`

```tsx
orpc.readDeviceInventory.queryOptions({
	input: { deviceId: device.id },
})
```

(already the shape used inside the wrapper), and:

```tsx
orpc.listDeviceCommands.queryOptions({
	input: { deviceId: device.id, limit: 20 },
	refetchInterval: 5_000,
	refetchIntervalInBackground: false,
})
```

The `limit: 20` is currently hardcoded in `devices/api/service.ts:5` and is surfaced in UI copy at `device-detail-sheet.tsx:54` ("the latest 20 commands"). Carry it explicitly. Inventory has no polling and gains none. The queries mount only when `device !== null`; the sheet unmounts rather than using `enabled`.

#### Delete

- `axioma/dashboard/src/features/devices/api/service.ts`
- `axioma/dashboard/src/features/devices/api/queries.ts`
- `axioma/dashboard/src/features/devices/api/mutations.ts`

Keep `axioma/dashboard/src/features/devices/api/types.ts`.

### 5.5 Overview

#### `axioma/dashboard/src/features/overview/components/overview-page.tsx`

Replace `overviewQueries.stats(DAYS)` (line 49) with:

```tsx
orpc.ticketStats.queryOptions({
	input: { days: DAYS },
})
```

The wrapper's only added behaviour is a `days = 30` default that the caller already supplies explicitly. No poll, no `select`, no `staleTime`. Do not change Recharts or `components/ui/chart.tsx`.

#### Delete

- `axioma/dashboard/src/features/overview/api/service.ts`
- `axioma/dashboard/src/features/overview/api/queries.ts`

### 5.6 Agent runs

The exported service symbol is **`agentRunsService`**.

#### `axioma/dashboard/src/features/agent-runs/components/agent-transcript.tsx`

Replace `agentRunQueries.detail(...)`, `agentRunMutations.start(...)`, `agentRunMutations.cancel(...)`, and the `ticketKeys` references with `orpc.getRun.queryOptions(...)`, `orpc.startRun.mutationOptions(...)`, `orpc.cancelRun.mutationOptions(...)`, and generated ticket keys.

Preserve exactly:

- **The `enabled` override.** Line 40-43 is `useQuery({ ...agentRunQueries.detail(queriedId), enabled: Boolean(queriedId) })`. `getRun`'s `id` is `min(1)` and `queriedId` is `""` when no run is selected, so the key becomes `{ input: { id: "" } }` and only `enabled` prevents the call. This must survive the migration verbatim.
- **Data-dependent polling.** 2 seconds only while `query.state.data?.status === "running"`. Under `orpc.getRun.queryOptions` the data is typed `AgentRun | null`, so the existing cast can go, but the predicate stays. Pair it with `refetchIntervalInBackground: false` rather than the `document.visibilityState` check.
- **The transition effect** at lines 46-55, which invalidates the ticket detail when the polled run leaves `running` while the listed run still reports `running`. This is a prefix invalidation and becomes `orpc.getTicket.key({ input: { id: ticketId } })`.
- **Cross-feature mutation invalidation.** `agent-runs/api/mutations.ts:12-17` fires `Promise.all` over `agentRunKeys.all` **and** `ticketKeys.all` for both `start` and `cancel`. Replicate the ticket half using the three explicit invalidations from §5.2. Losing this means starting or cancelling a run stops refreshing the ticket queue and detail.
- Callbacks and toasts, and the `runQuery.data ?? listedRun` fallback and merge at lines 44 and 56-60.

`startRun` takes `{ ticketId }`; `cancelRun` takes `{ id, reason }` with `reason` defaulting to `"run cancelled"`.

#### Delete

- `axioma/dashboard/src/features/agent-runs/api/service.ts`
- `axioma/dashboard/src/features/agent-runs/api/queries.ts`
- `axioma/dashboard/src/features/agent-runs/api/mutations.ts`

Keep `axioma/dashboard/src/features/agent-runs/api/types.ts`.

### 5.7 Blast radius

No route loader, prefetch, or test references any of these symbols — `rg "ensureQueryData|prefetchQuery|loader:" src/routes` returns zero hits across the dashboard. The four folders above are the only `features/*/api/` directories in the dashboard, and there are no flat `api.ts` modules. The portal needs no change.

## 6. Phase Four — Router context and authorization freshness

### Authorization: keep the direct call

`axioma/dashboard/src/routes/_auth/route.tsx:13-28` and `axioma/portal/src/routes/_auth/route.tsx:16-22` both run, in `beforeLoad`, a Better Auth `getSession()` gate followed by `await client.privateData()`, returning `{ session, privateData, capabilities }` into the route context. The dashboard additionally rejects `privateData.user?.kind !== "staff"`; the portal rethrows `session.error` where the dashboard ignores it.

`capabilities` gates seven admin routes (`admin.roles`, `workflows`, `assets`, `mailboxes`, `software-licences`, `mail-templates`, `suppliers`) plus the sidebar and layout. It is a live authorization surface, re-checked on every navigation today.

**Do not move this onto `ensureQueryData`.** Two independent reasons:

1. `ensureQueryData` returns cached data **even when stale** and only background-revalidates when `revalidateIfStale: true` is passed — and even then it hands the caller the stale value. `staleTime: 0` does not force a refetch through this method. The mechanism cannot express "always fresh".
2. There is no cache reset anywhere in either app. `queryClient.clear()`, `removeQueries()`, and `resetQueries()` return zero hits repo-wide. Both sign-out handlers (`user-menu.tsx:45-53` in each app) and the portal sign-in success handler navigate client-side, so the cache survives the session change. Caching `privateData` would let one user's capabilities be served to the next user in the same tab.

Keep `client.privateData()` in `beforeLoad` in both apps. Retain Better Auth session checking and every redirect path.

If a future change does move authorization into Query, it must use `queryClient.fetchQuery(...)` with `staleTime: 0` — not `ensureQueryData` — and must add `queryClient.clear()` to both `user-menu.tsx` sign-out handlers and to the portal sign-in success handler first. That is a separate, security-reviewed change.

### Router context cleanup

`main.tsx` in both apps passes `context: { orpc, queryClient }`, typed as `RouterAppContext` in `__root.tsx`.

A full search proves both members are unused as *router context*: **zero** `context.orpc` references and **zero** `context.queryClient` references in either app. Every `useRouteContext()` call reads only `capabilities` or `session`, and every `beforeLoad({ context })` destructure reads only `context.capabilities` — all of which come from the `_auth` route's `beforeLoad` return value, not from the router context.

Remove `orpc` from the context in **both** apps:

- `axioma/dashboard/src/main.tsx` and `axioma/portal/src/main.tsx`: `context: { orpc, queryClient }` becomes `context: { queryClient }`.
- `axioma/dashboard/src/routes/__root.tsx` and `axioma/portal/src/routes/__root.tsx`: drop `orpc` from `RouterAppContext` and remove its type import.

Retain `queryClient` in the context. It is the conventional slot for it and costs nothing.

## 7. Phase Five — Form boundaries

The house Standard Schema idiom is a bare Zod v4 object handed to a form-level validator, with no adapter package. Five existing precedents: `dashboard/src/components/sign-in-form.tsx:43-48`, `dashboard/src/components/sign-up-form.tsx:45`, `portal/src/components/sign-in-form.tsx:53`, `portal/src/components/sign-up-form.tsx:49`, `portal/src/features/tickets/components/request-form.tsx:154`.

```tsx
validators: {
	onSubmit: z.object({ /* … */ }),
},
```

Installed: `@tanstack/react-form` 1.33.5, `zod` 4.4.3 in both apps.

### 7.1 Portal fixed-schema forms

#### `axioma/portal/src/features/tickets/components/conversation-card.tsx`

Migrate the two stateful native forms to TanStack Form.

**Reply** (`ConversationCard`, lines 82-106; state `body` at line 33). Today validation is inline only — `const message = body.trim(); if (message) reply.mutate(...)` plus `disabled={!body.trim() || reply.isPending}`. No error message is ever shown.

```ts
type ReplyValues = { body: string };
```

Rules: trim on submission; nonempty; maximum 10,000 characters with a visible message; reset only after successful mutation (currently `setBody("")` in `onSuccess`, line 37); keep invalidation of `orpc.getMyTicket.key({ input: { id: ticketId } })` (line 39); keep the `conversationCopy.replySent` / `replyError` toasts; disable while invalid or submitting.

**CSAT** (`CsatCard`, lines 135-188; state `rating` and `comment` at lines 113-114, seeded from props). Today validation is `if (rating)` plus `disabled={!rating || submit.isPending}`. There is **no reset and no invalidation** — success is handled by the `submit.isSuccess` short-circuit at line 121. Preserve that; do not introduce an invalidation that does not exist today.

```ts
type CsatValues = { rating: number; comment: string };
```

Rules: integer rating 1-5; optional comment; maximum 2,000 characters; keep the native radio inputs, labels, keyboard operation, and focus behaviour; keep the `conversationCopy.feedbackSaved` / `feedbackError` toasts and the success short-circuit.

#### `axioma/portal/src/routes/_auth/tickets/$ticketId.tsx`

Migrate the add-detail dialog's `detailNote` state (line 57) to a one-field form. The dialog is at lines 347-390; the submit is `updateTicket.mutate({ id, action: "add_detail", note: detailNote.trim() })` with an `onSuccess` that clears the note and closes the dialog. There is no validation feedback today.

```ts
type DetailValues = { note: string };
```

Add a semantic `<form>`, trim/nonempty/max-length validation with a visible message, a disabled state while the mutation runs, and reset-and-close only after successful submission. Keep `detailHelpOpen` (line 56) as dialog state.

Do not convert one-click actions, confirmations, or file uploads into forms.

### 7.2 Portal dynamic form boundary

#### `axioma/portal/src/features/tickets/components/request-form.tsx`

`customFields` is currently a `z.record(z.string(), z.unknown())` key on `incidentSchema` (line 47), part of `IncidentValues`, defaulted to `{}` (line 152), and rendered through `<form.Field name="customFields">` (line 293) into `DynamicFields`. Submission serializes it via `serializeDynamicFields(fieldDefinitions.data ?? [], value.customFields)` (line 166).

Leave that arrangement in place. A record-valued `form.Field` is supported TanStack Form usage, the schema key costs nothing even though `z.record(z.string(), z.unknown())` validates nothing, and keeping it inside the form keeps a single submission path. **The boundary rule for this file: runtime-defined fields stay inside the form as one record-valued field; they are never promoted to individual typed fields, and they are never split out into separate `useState` that the submit handler has to recombine.**

The un-migrated form in this file is `CatalogueRequestForm` (lines 402-561): five `useState` hooks (`selectedId`, `title`, `body`, `values`, `detailsError` at lines 405-409) with a manual `requestDetailsSchema.safeParse` at line 530 and hand-rolled error state, sitting beside a TanStack Form implementation of the same concern in the same file. Migrate `CatalogueRequestForm` to TanStack Form using `requestDetailsSchema` as the submit validator, keeping the catalogue selection and the runtime `values` record on the same `form.Field` pattern the incident form already uses.

No changes to `axioma/portal/src/features/request-catalogue/components/dynamic-request-form.tsx` or `axioma/portal/src/features/tickets/components/dynamic-fields.tsx`. These are genuinely runtime-driven; native controls, browser constraints, and server validation remain the correct design.

### 7.3 Dashboard forms

#### `axioma/dashboard/src/features/tickets/components/ticket-classification-form.tsx`

Lines 33-42 have **no `validators` key at all** — no submit-level and no field-level validation anywhere in the file. Type assertions in the select handlers are not runtime validation.

Add one authoritative `validators.onSubmit` Zod object covering `recordType`, `impact`, `urgency`, `serviceId`, and `serviceSubcategoryId`.

#### `axioma/dashboard/src/features/tickets/components/ticket-actions.tsx`

Validation is **triplicated**, not duplicated, in two of the three forms:

- `NoteForm`: form-level `validators.onSubmit` (lines 228-231) returning `` `${label} is required` ``, plus field-level `onChange` **and** `onSubmit` (lines 270-275) each returning the identical string.
- `EscalateForm`: form-level `validators.onSubmit` (lines 328-331) with `"Escalation reason is required"`, plus field-level `onChange` and `onSubmit` (lines 343-348) with the same literal.
- `AssignForm` (from line ~390): **no validators at all**.

All existing validators are plain predicate functions rather than Zod. For each of the three forms: use one authoritative submit validator in the house Zod idiom, validating the route and select enumerations; delete validation duplicated at both form and field level; keep field-level validation only where immediate feedback materially helps (the free-text note and escalation reason qualify; the selects do not); preserve confirmation dialogs and pending states.

### No bulk migration

Leave the small native forms in `features/admin/roles-page.tsx`, `features/problems/components/problems.tsx`, `features/changes/components/changes.tsx`, `features/knowledge/components/knowledge.tsx`, `routes/_auth/forms.tsx`, and `features/tickets/components/ticket-collaboration.tsx` on their current implementations. Migrating all small forms would be consistency churn.

This applies to form migration only. `routes/_auth/forms.tsx` is separately in scope for §8.

## 8. Phase Six — Query-state correctness

A failed request is currently rendered as an empty list or as "not found" in **thirteen** places across both apps. The anti-pattern is systemic, so the whole set is in scope: fixing a couple of instances while leaving eleven is not a correctness improvement.

The codebase already contains the correct idiom. Copy it from `dashboard/src/routes/_auth/suppliers.tsx:21-31` (`isPending` → loading state, then `const error = a.error ?? b.error` → error state) or `portal/src/features/tickets/components/request-form.tsx:256-291` (`isPending` / `isError` with a `refetch()` retry button).

### Detail routes — must distinguish a genuine miss from a failure

Render four states: pending; request error with retry; genuine missing record; content.

- `axioma/portal/src/routes/_auth/knowledge.$articleId.tsx:12-22` — renders "Article not found." for both
- `axioma/dashboard/src/routes/_auth/knowledge.$articleId.tsx:23-30` — exact twin, "Article not found."
- `axioma/dashboard/src/routes/_auth/problems.$problemId.tsx:11-17` — "Problem not found."
- `axioma/dashboard/src/routes/_auth/changes.$changeId.tsx:12-39` — "Change not found."

### List routes — must distinguish a successful empty response from a failure

Render four states: pending; request error with retry; successful empty response; populated response.

- `axioma/portal/src/routes/_auth/knowledge.tsx:15-23` — `(articles.data ?? []).filter(...)`
- `axioma/dashboard/src/routes/_auth/knowledge.index.tsx:15,27` — `articles={query.data ?? []}`
- `axioma/dashboard/src/routes/_auth/problems.index.tsx:15,25`
- `axioma/dashboard/src/routes/_auth/changes.index.tsx:15,31`
- `axioma/dashboard/src/routes/_auth/approvals.tsx:12,21`
- `axioma/dashboard/src/routes/_auth/forms.tsx:14,63` — `(query.data ?? []).map(...)`
- `axioma/dashboard/src/components/layout/command-menu.tsx:37,56` — a failed search renders as "no results"
- `axioma/dashboard/src/features/tickets/components/saved-view.tsx:32` — `orpc.listSavedViews.queryOptions()` with no error branch
- `axioma/portal/src/components/notification-center.tsx:15-27` — `query.data?.filter(...) ?? 0`; on a 30-second `refetchInterval` a failing fetch reads as "0 unread"

None of these thirteen files references `isError`, `isPending`, or `.error`.

If the full set is too large for one change, split it: detail routes first (four files, where "not found" is an outright false statement), list routes second. Do not stop at the two portal files.

## 9. Phase Seven — Dependency alignment

### Version policy

Dashboard and portal declare identical ranges and resolve identically:

| Package | Declared | Resolved |
|---|---|---:|
| `@tanstack/react-router` | `^1.170.18` | 1.170.32 |
| `@tanstack/router-plugin` | `^1.168.23` | 1.168.35 |
| `@tanstack/react-router-devtools` | `^1.167.0` | 1.167.1 |
| `@tanstack/react-query` | `^5.101.4` | 5.102.8 |
| `@tanstack/react-query-devtools` | `^5.101.4` | 5.102.8 |
| `@tanstack/react-form` | `^1.33.2` | 1.33.5 |
| `@tanstack/react-table` | `^8.21.3` | 8.21.3, dashboard only |
| `@orpc/client`, `@orpc/tanstack-query` | `^1.14.12` | 1.15.0 |
| `@biomejs/biome` | `^2.5.6` | 2.5.10 |

Do **not** force Router, plugin, and devtools to one numeric version. They are independently published and their current peer ranges are compatible.

Do **not** upgrade Table v8 to v9 during this work. That is a separate major migration.

Note for the record: with four independent lockfiles, caret ranges, and no workspace or catalog, nothing *prevents* dashboard and portal from drifting apart on the next unrelated `pnpm install` in one of them. (`web/` already pins exact versions instead.) Introducing a shared catalog is out of scope here; the mitigation available today is that §13 installs with `--frozen-lockfile` in CI, which at least makes drift visible in a diff.

### Manifest changes

#### `axioma/portal/package.json`

Remove two unused dependencies:

```json
"@orpc/server": "^1.14.12"
"@shadcn/react": "^0.2.1"
```

No portal source file imports either. `@orpc/server` is portal-only — the dashboard does not declare it. `@shadcn/react` **is** used in the dashboard, once, at `dashboard/src/components/ui/message-scroller.tsx:7`; keep it there.

`@tailwindcss/vite` shows as unimported from `src/` in both apps but is used in each `vite.config.ts`. Keep it.

### Lockfiles

Regenerate, never hand-edit:

- `axioma/portal/pnpm-lock.yaml`
- any other lockfile touched by the script changes in §3.3

Use frozen installs afterwards to prove reproducibility.

No dependency upgrade sweep belongs in this change. TypeScript 7, Table 9, Recharts, Better Auth, Zod, and shadcn updates each deserve separate compatibility review. (Both apps are already on TypeScript `^6.0.3`, Vite `^8.1.5`, React `^19.2.8`.)

## 10. Phase Eight — Backend preservation and boundary corrections

### API implementation: no TanStack migration

No functional TanStack changes are warranted in:

- `axioma/api/src/app.ts`
- `axioma/api/src/server/context.ts`
- `axioma/api/src/server/orpc.ts`
- `axioma/api/src/server/routers/index.ts`
- `axioma/api/src/db/index.ts`
- `axioma/api/src/db/schema/**`
- `axioma/api/src/db/migrations/**`
- `axioma/api/drizzle.config.ts`

Preserve Hono HTTP composition, the oRPC contracts and handlers, Drizzle/PostgreSQL, the API-only-writer invariant, Better Auth, and the gRPC gateway. TanStack DB would introduce a synchronization architecture, not replace the current ORM.

`axioma/api/package.json` still needs the `check` / `fix` split from §3.3.

### Correct the canonical protobuf documentation

Modify `axioma/api/proto/axioma.proto`, lines 14-17:

> The TypeScript half of the system (portal, dashboard, API) does not use this file. It uses oRPC, where the contract is the TypeScript definition itself and inference runs end to end.

This is false for the API. `axioma/api/src/server/grpc.ts` imports `@grpc/proto-loader` (line 5), resolves `../../proto/axioma.proto` (line 55, with a `process.cwd()` fallback at line 59), calls `protoLoader.loadSync` (line 60) and `grpc.loadPackageDefinition` (line 66). `@grpc/proto-loader` and `@grpc/grpc-js` are runtime dependencies of `api`, and `axioma/api/src/server/tools/parity.test.ts:39` reads the proto as part of a four-way parity assertion.

Rewrite the comment to state that portal and dashboard talk to the API through oRPC; that the TypeScript API gateway loads this protobuf definition at runtime; and that Python and Go require it as the cross-language wire format.

Keep the edit inside the existing detached comment block, above the `// ---` separator that precedes `service AgentChannel`. Verified: this block does not propagate into the generated Go, so no binding regeneration is required. Republish and confirm:

```powershell
pnpm --dir axioma/api contracts:publish
git diff --exit-code -- axioma/cli/internal/pb
```

`scripts/publish-contracts.mjs` mirrors the oRPC contract into `portal` and `dashboard` and the proto into `agent/proto/` and `cli/proto/`. It does not regenerate Python or Go bindings — its closing line says so. No manual edits to mirrors.

## 11. Phase Nine — Agent and CLI integration hygiene

### 11.1 Clean-checkout agent generation

`axioma/agent/axel/server.py:21-22` imports the generated bindings unconditionally at module top level, with no try/except and no lazy import:

```python
from axel.pb import axioma_pb2 as pb
from axel.pb import axioma_pb2_grpc as pb_grpc
```

`axel/pb/` is gitignored (`axioma/agent/.gitignore:7`) and `git ls-files axioma/agent/axel/pb` returns nothing. The Tilt agent resource (`axioma/Tiltfile:70-81`) runs `cmd='uv sync --all-extras'` and then `serve_cmd='uv run python -m axel.server'`, with `deps=['agent/axel', 'agent/pyproject.toml', 'agent/uv.lock']`. **A clean checkout starts the agent with no bindings and it fails on import.**

Note the asymmetry with the CLI, which commits its generated bindings (`cli/internal/pb/*.pb.go` are tracked) and whose Tilt resource therefore needs no generation step. Either convention is defensible; the agent's is the one Tilt does not honour.

#### Add `axioma/agent/scripts/generate-proto.ps1`

The only generation script today is `generate-proto.sh`, which requires Bash and uses GNU `sed -i` (line 14). Windows is a supported development host — `cli/` ships four `.ps1` scripts and `api/package.json` has a `pwsh`-based `seed:device` — so the PowerShell script is required, not conditional. Mirror the `.sh` behaviour: create `axel/pb/`, touch `__init__.py`, run `uv run python -m grpc_tools.protoc` with `--python_out`, `--grpc_python_out`, `--pyi_out`, then rewrite the top-level `import axioma_pb2 as` line in `axioma_pb2_grpc.py` to `from axel.pb import axioma_pb2 as`. Keep both scripts; CI on Ubuntu continues to use the `.sh`.

#### Modify `axioma/Tiltfile`

The agent resource runs, in order: `uv sync --all-extras`, then protobuf generation, then the server. Add to its `deps`:

- `agent/proto/axioma.proto`
- `agent/scripts/generate-proto.sh`
- `agent/scripts/generate-proto.ps1`

Select the generation script by host so Tilt works on both Windows and Linux.

Validation: delete `axioma/agent/axel/pb/`, run `tilt up`, and confirm the agent reaches its `/health` readiness probe.

### 11.2 Agent documentation

Modify `axioma/agent/README.md`.

It already documents the architecture invariant, `uv sync --extra server`, `uv run python -m axel.server`, the gitignored `axel/pb/` and the `./scripts/generate-proto.sh` command, the requirement that bindings be generated before running Axel, the `/health` semantics, and the environment variables. Add only what is missing:

- `api/proto/axioma.proto` is canonical and the local copy is a mirror published by `pnpm --dir axioma/api contracts:publish` (the README currently says only "kept in sync with the other Axiōma components")
- the new PowerShell generation script alongside the Bash one
- `uv run ruff check axel tests`
- `uv run pytest`
- the package build command
- the repository-local pytest temp directory needed on affected Windows environments

Do not add TanStack AI and do not rewrite the agent.

### 11.3 CLI help accuracy

Modify `axioma/cli/cmd/axel-cli/main.go`, lines 68 and 70:

```
  status    Show connection state and recent commands.
  doctor    Check connectivity, identity, and action prerequisites.
```

Both overpromise. `runStatus` (lines 100-113) loads `device.Load()` and `device.LoadDaemonState()` and renders `tui.NewStatus` — persisted identity and daemon state only, no command history. `runDoctor` (lines 126-155) runs five local checks (device identity, state directory, `tui.BinaryPresent` for `ipconfig` / `powershell` / `klist` / `taskkill`, and `cua.Check`) and never dials `gatewayHost()`.

Narrow `status` to connection and device state, and `doctor` to identity, state directory, and local prerequisites. Adding the absent features is not warranted by a documentation defect.

### 11.4 CLI documentation

Modify `axioma/cli/README.md`. It documents `build.ps1`, `install.ps1`, and `uninstall.ps1` only; its single "proto" mention (line 58) is in an unrelated cua paragraph. Add:

```powershell
pwsh scripts/generate-proto.ps1
go vet ./...
go test ./...
go build ./...
```

State that `api/proto/axioma.proto` is canonical and that generated bindings in `internal/pb` must be regenerated rather than edited, and committed when they change.

## 12. Separate security workstream — gRPC transport

This is a separate implementation unit from TanStack standardization because it changes deployment, credential handling, and the device trust model.

### Current state

Transport is plaintext at all three ends:

- API: `axioma/api/src/server/grpc.ts:102` — `grpc.ServerCredentials.createInsecure()`
- Agent: `axioma/agent/axel/server.py:275` — `grpc.aio.insecure_channel(config.api_grpc_host)`
- CLI: `axioma/cli/internal/device/daemon.go:103` — `grpc.WithTransportCredentials(insecure.NewCredentials())`

**There is also no authentication of any kind on the channel.** No token metadata, no shared secret, no `WithPerRPCCredentials`, no composite channel credentials, no server-side interceptor. The CLI's `connect()` (`daemon.go:101-120`) passes only transport credentials and keepalive parameters; the agent's `connect_forever()` (`server.py:275-278`) opens the stream with no metadata; the API's `Gateway` constructor (`grpc.ts:81-95`) wires handlers with no auth.

Device identity is **self-asserted in the first stream message**. `registerDevice` (`grpc.ts:630-668`) takes `deviceId` straight from the hello and upserts it, and the caller then receives that device's replayed command outbox (`grpc.ts:692-700`). The `enrolmentCode` field is an ownership-claim flow that binds a device to a user; it is optional, and a connection without it still registers and still receives commands.

So the exposure is larger than encryption: TLS alone would encrypt the channel and still leave device impersonation open to anyone who can reach port 50051. It also means the enrolment code itself currently crosses the wire in cleartext.

### Recommended direction

Two requirements, in order:

1. **Channel authentication.** A per-device credential presented on connect and verified server-side before any command is replayed. mTLS with per-device client certificates satisfies both this and transport security at once, if certificate issuance and lifecycle are operationally available; a signed device token over TLS is the lighter alternative.
2. **TLS with server identity verification** as the minimum transport boundary, with mTLS where client certificates are available.

Requirements:

1. Explicit development-only insecure mode.
2. Production startup fails closed without TLS configuration.
3. Agent verifies server CA and hostname.
4. CLI verifies server CA and hostname.
5. Device identity is verified against a credential, not accepted from the hello message.
6. No certificate or private-key content in normal logs.
7. Health/readiness distinguishes configuration failure from reconnecting.
8. Tests cover: trusted server; wrong hostname; untrusted CA; missing production certificate; explicit development insecure mode; and a connection asserting a device ID it cannot authenticate.

### Affected files

`axioma/api/src/env.ts`, `axioma/api/src/server/grpc.ts`, `axioma/agent/axel/config.py`, `axioma/agent/axel/server.py`, `axioma/agent/.env.example`, `axioma/cli/internal/device/config.go`, `axioma/cli/internal/device/daemon.go`, `axioma/cli/cmd/axel-cli/main.go`, `axioma/cli/scripts/install.ps1`, `axioma/cli/README.md`, `axioma/Tiltfile`, and the relevant API, agent, and CLI tests.

`axioma/api/.env.example` does not exist and must be created. `axioma/agent/.env.example` exists but holds only `AXIOMA_API_BASE`, `AXIOMA_LLM_KEY`, `AXIOMA_MODEL`, and `AXIOMA_REASONING_EFFORT` — no gRPC host or TLS keys yet.

Because deployment topology and certificate issuance are not specified, the implementation plan must choose those details before code is changed. Do not silently invent certificate distribution.

## 13. CI plan

Modify `.github/workflows/contracts.yml`.

The workflow is one job, `freshness`, on `ubuntu-latest`, with `working-directory: axioma`. It runs `contracts:check`, agent proto generation, agent pytest, CLI proto generation, `git diff --exit-code -- cli/internal/pb`, `go test`, `api check-types`, and `api test`.

**§3.1 must land first.** Until `cli/scripts/generate-proto.ps1` resolves plugin binaries without a hardcoded `.exe`, that step fails on Ubuntu and every step after it is skipped. Adding jobs to a red workflow proves nothing.

### Restructure

Split the single job into parallel jobs — `contracts`, `api`, `agent`, `cli`, `dashboard`, `portal`, `web` — so one component's failure does not mask the rest. Each needs its own `cache-dependency-path`, since there is no pnpm workspace and each project carries its own lockfile. Add a branch filter to `on: push` so pushes to a PR branch do not run the workflow twice.

### Frontend jobs

For `dashboard`, `portal`, and `web`:

```powershell
pnpm install --frozen-lockfile
pnpm check-types
pnpm build
```

`web` is currently absent from CI entirely and shares the §3.3 script defects; include it.

Add `pnpm check` per app only after that app's Biome baseline (§3.4) is clean.

Add a `dashboard` step running the focused validation scripts once §14 wires them up.

### Component jobs

API:

```powershell
pnpm install --frozen-lockfile
pnpm contracts:check
pnpm check-types
pnpm test
pnpm build
```

Agent:

```powershell
bash scripts/generate-proto.sh
uv run ruff check axel tests
uv run pytest
```

Ruff is configured and passes locally; CI has never run it. Add `python -m build` only if the `build` package is intentionally part of the development environment.

CLI:

```powershell
pwsh scripts/generate-proto.ps1
git diff --exit-code -- internal/pb
go vet ./...
go test ./...
go build ./...
```

Do not run `db:check` in CI. `axioma/api/package.json` defines it as `drizzle-kit check && node scripts/check-migration-drift.mjs`, and the drift script requires a live PostgreSQL: it imports `pg`, reads `DATABASE_URL`, opens a client, and shells out to `drizzle-kit migrate` against a scratch database. Add it only once that service is explicitly provisioned in the workflow.

## 14. Focused validation assets

Five hand-rolled validation scripts exist in `axioma/dashboard/`. **None is referenced by any npm script or by CI**, so their current state is invisible. Actual status under Node 24:

| Script | Status |
|---|---|
| `src/components/keyboard-shortcuts.validation.mjs` | passes |
| `src/features/agent-runs/components/escalation.validation.mjs` | passes |
| `src/features/tickets/components/allowed-actions.validation.mjs` | passes |
| `src/features/tickets/components/queue-search.validation.mjs` | **fails** — `ERR_ASSERTION`, expected `['infrastructure', null]`, actual `undefined` |
| `src/features/tickets/components/sla-countdown.validation.mjs` | **crashes** — `ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension ".tsx"` |

### Wire them up first

Add to `axioma/dashboard/package.json`:

```json
"validate": "node --test 'src/**/*.validation.mjs'"
```

or an explicit `node` invocation per file if the glob form proves awkward. Add the same step to the dashboard CI job. Without this, everything below is unenforced.

Node 24 strips types from `.ts` natively, so the four `.ts`-importing scripts run under plain `node` with no flags and no TypeScript runtime.

### Fix `queue-search.validation.mjs`

Remove the stale `category` expectations and cover the current fields: record type, service, route, priority, cursor, and the autonomous/resolved filters. `normalizeTicketQueueSearch` and `toTicketListInput` in `queue-search.ts` are the units under test.

### Fix `sla-countdown.validation.mjs`

It imports `formatSlaTarget` from `sla-countdown.tsx`, and Node cannot load `.tsx` — JSX is not covered by type stripping. Move `formatSlaTarget` into a plain `.ts` module imported by both the component and the validation script. Do not add a testing framework or a TypeScript runtime for this.

### Add coverage for changed logic

Use the same `.validation.mjs` + plain-`.ts`-module approach. Cover:

- generated oRPC key invalidation after ticket updates, including the three-call replacement for `ticketKeys.all`
- polling predicates: run polling stops when status is no longer `running`
- reply validation and reset
- CSAT rating bounds
- add-detail validation and reset
- fixed and runtime incident field serialization (`serializeDynamicFields`)
- the loading / error / empty / content state selector used by §8

A full frontend testing framework is not required unless DOM interaction tests cannot be verified reliably through build and type checks plus focused browser validation.

## 15. End-to-end verification sequence

### Dependency and generated-file integrity

```powershell
pnpm --dir axioma/dashboard install --frozen-lockfile
pnpm --dir axioma/portal install --frozen-lockfile
pnpm --dir axioma/web install --frozen-lockfile
pnpm --dir axioma/api install --frozen-lockfile
pnpm --dir axioma/api contracts:check
```

After intentional manifest or contract changes, regenerate normally first, then repeat with frozen/check mode.

### Frontends

```powershell
pnpm --dir axioma/dashboard check-types
pnpm --dir axioma/dashboard check
pnpm --dir axioma/dashboard build
pnpm --dir axioma/dashboard validate

pnpm --dir axioma/portal check-types
pnpm --dir axioma/portal check
pnpm --dir axioma/portal build

pnpm --dir axioma/web check-types
pnpm --dir axioma/web build
```

Manual browser regression — domain and data layer:

- login and logout, in both apps, including that signing out and signing back in as a different user shows the correct capabilities
- protected-route redirects, including the dashboard's non-staff redirect to the portal
- ticket queue filters, sorting, paging, keyboard controls
- ticket detail update and cache refresh
- **ticket detail refreshes after adding a message, merging, and unmerging** (the §5.3 bug)
- running-agent polling and cancellation, including that starting or cancelling a run refreshes the ticket queue and detail
- device filter, sort, paging, detail polling, and that the command list still shows 20 entries
- portal ticket creation with and without dynamic fields, and catalogue request submission
- reply, CSAT, and add-detail flows
- loading, failure, empty, and success states across the §8 routes
- devtools present in development and absent in preview builds

Router + shadcn/ui composition, in both apps:

1. Internal `Link` navigation without a full-page reload.
2. Active navigation styles update after navigation.
3. Button-styled links render as semantic anchors and remain keyboard accessible.
4. Sidebar and breadcrumb/header links composed through Base UI `render={<Link ... />}` navigate correctly.
5. Dialogs and sheets open, close, and animate correctly.
6. Browser back/forward preserves expected route behaviour.
7. No nested interactive markup such as `<button><a /></button>` in the DOM.

Static validation for the above must show both `check-types` commands passing with no new dependencies installed.

### API

```powershell
pnpm --dir axioma/api check-types
pnpm --dir axioma/api test
pnpm --dir axioma/api build
pnpm --dir axioma/api contracts:check
```

### Agent

```powershell
pwsh axioma/agent/scripts/generate-proto.ps1
uv run --directory axioma/agent ruff check axel tests
uv run --directory axioma/agent pytest
```

On affected Windows environments:

```powershell
uv run --directory axioma/agent pytest --basetemp .pytest-tmp
```

Also verify from a clean state: delete `axioma/agent/axel/pb/`, run `tilt up`, and confirm the agent reaches readiness.

### CLI

Run from `axioma/cli`:

```powershell
pwsh scripts/generate-proto.ps1
git diff --exit-code -- internal/pb
go vet ./...
go test ./...
go build ./...
```

## 16. Execution order

1. Fix `cli/scripts/generate-proto.ps1` plugin resolution so CI can run at all.
2. Delete the dashboard spinner, fix the portal spinner, split `check` / `fix` / `check-types` / `build` across all four projects, fix the Biome `recommended` deprecation.
3. Land the whole-repository Biome formatter pass as its own commit.
4. Make devtools development-only.
5. Consolidate dashboard Query wrappers one domain at a time: devices, overview, tickets, agent runs.
6. Remove `orpc` from the router context in both apps; keep authorization on the direct `client.privateData()` call.
7. Correct portal and dashboard form validation boundaries.
8. Fix Query-state rendering: detail routes first, then list routes.
9. Remove the two unused portal dependencies and regenerate the lockfile.
10. Correct the protobuf comment and republish mirrors.
11. Add the agent PowerShell generation script, fix Tilt generation, complete agent and CLI documentation, narrow CLI help.
12. Wire up and repair the validation scripts.
13. Restructure and expand CI once local gates are clean.
14. Implement gRPC authentication and TLS as a separately reviewed security change.

## 17. Estimated effort

| Workstream | Estimate |
|---|---:|
| CI proto-generation repair | 0.5 day |
| Validation baseline and scripts | 1–1.5 days |
| Biome formatter pass (isolated commit) | 0.5 day |
| Devtools boundary | 0.5 day |
| Dashboard Query consolidation | 1.5–3 days |
| Router context cleanup | 0.5 day |
| Form boundaries and migrations | 1.5–3 days |
| Query-state fixes across 13 files | 1–1.5 days |
| Dependency/contract/docs/Tilt cleanup | 1–1.5 days |
| CI restructure and regression checks | 1–2 days |
| gRPC authentication + TLS/mTLS | Separate, approximately 5–10 days |

**Core standardization total:** approximately **9–15 engineer-days**, excluding transport security.

The restraint is intentional: this plan removes duplicate layers and closes real correctness and validation gaps without forcing TanStack products into backend, agent, CLI, or simple native UI paths where they provide no net value.

## 18. Completion criteria

- `.github/workflows/contracts.yml` is green on a clean checkout, with per-component jobs for contracts, api, agent, cli, dashboard, portal, and web.
- `pnpm check-types` and `pnpm build` pass in `dashboard`, `portal`, and `web`, with no new dependencies.
- `check`, `fix`, `check-types`, and `build` are separate scripts in all four projects, and no CI step rewrites files.
- All five dashboard validation scripts pass and are executed by `pnpm validate` and by CI.
- Devtools are present in development and absent from production bundles.
- No compatibility wrappers or dependencies have been added (`RouterButton` / `RouterDialog` / `RouterSheet` / `createLink(Button)` / `#portal-root` / shared nav abstraction, plus TanStack DB, AI, Store, Charts, Hotkeys, Markdown, Highlight, Virtual, Pacer, Start).
- No `features/*/api/` wrapper directory remains in the dashboard, and every `api/types.ts` still resolves.
- Every migrated Query path preserves its polling predicate, `enabled` gating, invalidation set, hardcoded limits, validation, and toasts per §5.
- Ticket detail refreshes after add-message, merge, and unmerge.
- Starting and cancelling an agent run refreshes the ticket queue and detail.
- Authorization is re-checked on every navigation in both apps; no `privateData` response is served from cache across a session change.
- All thirteen §8 sites distinguish pending, error, empty, and content.
- `pnpm --dir axioma/api contracts:check` passes and `git diff --exit-code -- axioma/cli/internal/pb` is clean.
- A clean checkout with `axioma/agent/axel/pb/` deleted reaches agent readiness under `tilt up`.
