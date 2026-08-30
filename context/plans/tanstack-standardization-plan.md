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
- Do **not** introduce TanStack DB, AI, Store, Charts, Hotkeys, Markdown, Highlight, Virtual, Pacer, or Start into the authenticated SPAs without a concrete product requirement.
- Do **not** add `RouterButton`, `RouterDialog`, `RouterSheet`, `createLink(Button)` wrappers, a `#portal-root` element, or a shared navigation abstraction. The existing semantic links and Base UI `render` composition already solve these concerns.

No generic repository layer, form factory, table wrapper, shared frontend package, or monorepo conversion will be introduced.

### Scope exclusions

- The public `axioma/web/` application does not use shadcn/ui and is outside this plan.
- `api/`, `agent/`, and `cli/` require no TanStack changes except the explicit protobuf, Tilt, and documentation corrections in Phases 8-9. Any broader security or architecture improvements belong to the separate gRPC TLS workstream (§12).

### Integration verdict (from prior review)

The TanStack Router + shadcn/ui integration in `dashboard/` and `portal/` is already correct and uses newer shadcn/Base UI patterns than parts of the referenced TanStack guide. Verified correct and to be preserved:

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

## 2. Current status and prerequisites

### Verified state

- API contract mirrors are current.
- All three protobuf copies have identical content.
- API type checking passes.
- API tests pass: **147/147**.
- Agent tests pass: **43/43**.
- Agent Ruff check passes.
- CLI vet, build, and tests pass.
- Dashboard and portal production Vite builds pass.
- Dashboard and portal `tsc --noEmit` currently fail only at their respective `spinner.tsx`.
- Neither frontend has a conventional unit/component test suite.
- Existing CI validates contracts, API, agent, and CLI, but not dashboard or portal.

### Files inspected but not requiring changes

The following were inspected during the Router + shadcn/ui review and require **no** changes; do not modify them as part of this plan:

- `axioma/dashboard/components.json`
- `axioma/portal/components.json`
- `axioma/dashboard/vite.config.ts`
- `axioma/portal/vite.config.ts`
- `axioma/dashboard/tsconfig.json`
- `axioma/portal/tsconfig.json`
- `axioma/dashboard/src/styles/globals.css`
- `axioma/portal/src/styles/globals.css`
- `axioma/dashboard/src/main.tsx` (except Router context cleanup in §6 if proven unused)
- `axioma/portal/src/main.tsx` (except Router context cleanup in §6 if proven unused)
- `axioma/dashboard/src/routes/__root.tsx` (except devtools boundary in §4 and context cleanup in §6)
- `axioma/portal/src/routes/__root.tsx` (except devtools boundary in §4 and context cleanup in §6)
- `axioma/dashboard/src/components/ui/button.tsx`
- `axioma/portal/src/components/ui/button.tsx`
- `axioma/dashboard/src/components/layout/app-sidebar.tsx`
- `axioma/dashboard/src/components/layout/header.tsx`
- `axioma/portal/src/components/header.tsx`
- `axioma/portal/src/routes/_auth/tickets/new.tsx`

Also see §1 Scope exclusions for `axioma/web/` and §10 for `api/` files that must be preserved.

### Existing unrelated working-tree changes

The following already differ from Git and must not be overwritten:

- `context/plans/oss-adoption/execution/README.md`
- `context/plans/oss-adoption/oss-adoption.md`
- `axioma/E2E-REPORT.md` is untracked

### Documentation research

Context7 was invoked for TanStack Router, Query, and oRPC, but its monthly quota was exhausted. Current primary documentation was therefore cross-checked through official/current documentation and installed package metadata:

- [TanStack Router Devtools](https://tanstack.com/router/latest/docs/devtools)
- [TanStack Router external data loading](https://tanstack.com/router/latest/docs/guide/external-data-loading)
- [TanStack Query prefetching and router integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching)
- [TanStack Form Standard Schema example](https://tanstack.com/form/latest/docs/framework/react/examples/standard-schema)
- [oRPC TanStack Query integration](https://github.com/middleapi/orpc/blob/dd4fc06d/apps/content/docs/integrations/tanstack-query.md)

Before implementation, Context7 can be retried if its quota is restored, but it is not required to begin.

## 3. Phase One — Repair validation baselines

These changes must precede CI expansion so newly added checks produce meaningful results.

### 3.1 Fix the shared spinner type error

Files:

- `axioma/dashboard/src/components/ui/spinner.tsx`
- `axioma/portal/src/components/ui/spinner.tsx`

Current props use `React.ComponentProps<"svg">`, which permits `children`, while `RiLoaderLine` explicitly declares `children?: never`.

**Pre-check — delete if unused:** Immediately before implementation, search both apps for imports/usages of `components/ui/spinner`. If either file is confirmed unused, delete it instead of fixing unused code.

Otherwise change the component props to derive from the icon component itself:

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

Preserve `className`, accessibility attributes (`role="status"`, `aria-label="Loading"`), forwarded icon props, and current markup. Apply the same minimal fix in both applications.

Also run Biome formatting on these files; both currently use formatting inconsistent with the surrounding codebase.

Validation:

```powershell
pnpm --dir axioma/dashboard check-types
pnpm --dir axioma/portal check-types
```

Expected result: both pass. If deleted, verify no import remains and both typechecks still pass.

### 3.2 Separate build, type checking, checking, and fixing

#### `axioma/dashboard/package.json`

Change:

```json
"check-types": "vite build && tsc --noEmit"
```

to:

```json
"check-types": "tsc --noEmit"
```

Keep `"build": "vite build"`. The two checks should fail independently and produce focused diagnostics.

#### `axioma/portal/package.json`

Change:

```json
"check": "biome check --write .",
"check-types": "vite build && tsc --noEmit"
```

to:

```json
"check": "biome check .",
"fix": "biome check --write .",
"check-types": "tsc --noEmit"
```

CI must never rewrite files.

### Biome baseline

Files:

- `axioma/dashboard/biome.json`
- `axioma/portal/biome.json`

The repositories currently have substantial pre-existing lint debt. Do not combine a whole-codebase formatting rewrite with this standardization change.

Implementation should:

1. update deprecated Biome configuration syntax if required by installed Biome;
2. lint changed files first;
3. put full-repository cleanup in a separate commit or follow-up;
4. enable whole-app CI lint only after the baseline is clean.

This avoids a large unrelated diff.

## 4. Phase Two — Development-only devtools

The packages already return null outside development, but static imports still make bundling behavior depend on optimizer elimination. The explicit development boundary should be visible in application code.

Files:

- `axioma/dashboard/src/routes/__root.tsx`
- `axioma/portal/src/routes/__root.tsx`

Remove static imports of `@tanstack/react-query-devtools` and `@tanstack/react-router-devtools`.

Use React `lazy` and `Suspense`, with dynamic imports inside an `import.meta.env.DEV` branch:

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

Use the same local implementation in each application. The applications are intentionally independent; creating a cross-application utility for this block would be more expensive than the duplication.

### Validation

For both applications:

1. Development server:
   - Query and Router launchers appear.
   - Both panels open correctly.
2. Production build:
   - no launcher is rendered;
   - production assets contain no dedicated devtools chunk;
   - search built output for package/component names.
3. Existing route error, pending, theme, and toast rendering remains unchanged.

## 5. Phase Three — Consolidate dashboard Query usage on oRPC

The dashboard currently has two parallel client data layers:

1. the standard `orpc.<procedure>.queryOptions()` and `.mutationOptions()` API;
2. handwritten service/query/mutation forwarding wrappers.

Remove only the wrappers that duplicate oRPC. Preserve every polling and invalidation behavior.

### 5.1 Keep the integration root

No structural change:

- `axioma/dashboard/src/utils/orpc.ts`

Keep:

```ts
export const client = createORPCClient(link);
export const orpc = createTanstackQueryUtils(client);
```

`client` may remain for imperative calls that are not Query-managed. Query-managed React operations should use `orpc`.

### 5.2 Tickets

#### Modify `axioma/dashboard/src/features/tickets/components/ticket-queue-page.tsx`

Replace `ticketQueries.list(...)` and `ticketMutations.update(...)` with:

- `orpc.listTickets.queryOptions({ input, ... })`
- `orpc.updateTicket.mutationOptions({ ... })`

Preserve:

- visible-tab polling every 15 seconds;
- URL-derived search input;
- mutation error handling;
- cursor pagination;
- success behavior;
- list invalidation using `orpc.listTickets.key()`.

#### Modify `axioma/dashboard/src/features/tickets/components/ticket-detail.tsx`

Replace:

- `ticketQueries.detail(ticketId)`
- `ticketQueries.sla(ticket.id)`
- `ticketMutations.update(...)`
- handwritten `ticketKeys`

with:

- `orpc.getTicket.queryOptions({ input: { id: ticketId } })`
- `orpc.listTicketSla.queryOptions({ input: { ticketId } })`
- `orpc.updateTicket.mutationOptions(...)`
- generated keys such as `orpc.getTicket.key({ input: { id } })`

Preserve:

- 15-second visible-tab SLA polling;
- focused detail invalidation;
- ticket-list invalidation;
- optimistic/local custom-field behavior;
- existing success and failure messages.

#### Modify `axioma/dashboard/src/features/agent-runs/components/agent-transcript.tsx`

Remove references to `ticketKeys`. Use generated oRPC keys for affected ticket data.

#### Delete after all callers migrate

- `axioma/dashboard/src/features/tickets/api/service.ts`
- `axioma/dashboard/src/features/tickets/api/queries.ts`
- `axioma/dashboard/src/features/tickets/api/mutations.ts`

#### Modify `axioma/dashboard/src/features/tickets/index.ts`

Remove exports for:

- `ticketService`
- `ticketQueries`
- `ticketKeys`
- `ticketMutations`

Retain public component and type exports still in use.

### 5.3 Devices

#### Modify `axioma/dashboard/src/features/devices/components/devices-table.tsx`

Replace `deviceQueries.all()` with:

```tsx
orpc.listDevices.queryOptions({
	refetchInterval: 5_000,
})
```

Do not modify its TanStack Table implementation.

#### Modify `axioma/dashboard/src/features/devices/components/device-detail-sheet.tsx`

Replace wrappers with:

```tsx
orpc.readDeviceInventory.queryOptions({
	input: { deviceId: device.id },
})
```

and:

```tsx
orpc.listDeviceCommands.queryOptions({
	input: { deviceId: device.id, limit: 20 },
	refetchInterval: 5_000,
})
```

#### Delete

- `axioma/dashboard/src/features/devices/api/service.ts`
- `axioma/dashboard/src/features/devices/api/queries.ts`
- `axioma/dashboard/src/features/devices/api/mutations.ts`

The mutation file is already dead and contains only an empty object.

### 5.4 Overview

#### Modify `axioma/dashboard/src/features/overview/components/overview-page.tsx`

Replace `overviewQueries.stats(DAYS)` with:

```tsx
orpc.ticketStats.queryOptions({
	input: { days: DAYS },
})
```

Do not change Recharts or `components/ui/chart.tsx`.

#### Delete

- `axioma/dashboard/src/features/overview/api/service.ts`
- `axioma/dashboard/src/features/overview/api/queries.ts`

### 5.5 Agent runs

#### Modify `axioma/dashboard/src/features/agent-runs/components/agent-transcript.tsx`

Replace:

- `agentRunQueries.detail(...)`
- `agentRunMutations.start(...)`
- `agentRunMutations.cancel(...)`

with:

- `orpc.getRun.queryOptions(...)`
- `orpc.startRun.mutationOptions(...)`
- `orpc.cancelRun.mutationOptions(...)`

Preserve:

- 2-second polling only while the run is active and the document is visible;
- run invalidation;
- ticket detail/list invalidation;
- callbacks and toasts;
- selected/queried run behavior.

Add a `typeof document !== "undefined"` guard to polling logic so the query options remain environment-safe.

#### Delete

- `axioma/dashboard/src/features/agent-runs/api/service.ts`
- `axioma/dashboard/src/features/agent-runs/api/queries.ts`
- `axioma/dashboard/src/features/agent-runs/api/mutations.ts`

## 6. Phase Four — Router and Query integration

### Dashboard authorization preload

Modify:

- `axioma/dashboard/src/routes/_auth/route.tsx`

Current auth loading calls `client.privateData()` directly. Change the route to consume `queryClient` from Router context and call:

```tsx
await context.queryClient.ensureQueryData(
	orpc.privateData.queryOptions({
		staleTime: /* explicit short authorization freshness */,
	}),
)
```

Retain Better Auth session checking and both redirect paths.

Use a deliberately short `staleTime`, or zero if capability freshness is security-sensitive. Performance must not weaken authorization freshness.

Also verify that auth cache is removed or invalidated on:

- logout;
- successful login;
- account switch;
- capability/role changes.

If those flows do not currently centralize invalidation, retain the existing direct authorization request instead. Security correctness takes precedence over Query consistency.

### Router context cleanup

If no route needs an `orpc` context property after that change:

#### `axioma/dashboard/src/main.tsx`

Change:

```tsx
context: { orpc, queryClient }
```

to:

```tsx
context: { queryClient }
```

#### `axioma/dashboard/src/routes/__root.tsx`

Remove `orpc` from `RouterAppContext` and remove its type import.

Perform the same cleanup in portal only if a full caller search proves its `orpc` context member is unused:

- `axioma/portal/src/main.tsx`
- `axioma/portal/src/routes/__root.tsx`

Do not remove `orpc` from either context speculatively.

## 7. Phase Five — Form boundaries

### 7.1 Portal fixed-schema forms

#### Modify `axioma/portal/src/features/tickets/components/conversation-card.tsx`

Migrate the two stateful native forms to TanStack Form.

Reply shape:

```ts
type ReplyValues = {
	body: string;
};
```

Rules:

- trim on submission;
- nonempty;
- maximum 10,000 characters;
- reset only after successful mutation;
- invalidate `orpc.getMyTicket.key({ input: { id: ticketId } })`;
- preserve toast behavior;
- disable while invalid or submitting.

CSAT shape:

```ts
type CsatValues = {
	rating: number;
	comment: string;
};
```

Rules:

- integer rating from 1–5;
- optional comment;
- maximum 2,000 characters;
- keep native radio inputs, labels, keyboard operation, and focus behavior;
- preserve success state and toast behavior.

#### Modify `axioma/portal/src/routes/_auth/tickets/$ticketId.tsx`

Migrate the add-detail dialog’s `detailNote` state to a one-field TanStack Form:

```ts
type DetailValues = {
	note: string;
};
```

Add:

- semantic `<form>`;
- trim/nonempty/max-length validation;
- disabled state while mutation runs;
- reset and close only after successful submission.

Do not convert one-click actions, confirmations, or file uploads into forms.

### 7.2 Portal dynamic form boundary

#### Modify `axioma/portal/src/features/tickets/components/request-form.tsx`

`customFields` is server-defined at runtime and should not be represented as a fixed TanStack Form field.

Change:

1. Remove `customFields` from the fixed Zod schema.
2. Remove it from `IncidentValues`.
3. Remove it from TanStack Form defaults.
4. Hold it in local state:

```tsx
const [customFields, setCustomFields] =
	useState<Record<string, unknown>>({});
```

5. Render `DynamicFields` directly instead of inside `form.Field`.
6. Serialize that state into the mutation input during form submission.
7. Keep title, body, impact inputs, timing, and device selection in TanStack Form.

No changes:

- `axioma/portal/src/features/request-catalogue/components/dynamic-request-form.tsx`
- `axioma/portal/src/features/tickets/components/dynamic-fields.tsx`

These are genuinely runtime-driven. Native controls, browser constraints, and server validation remain the correct design.

### 7.3 Dashboard forms

#### Modify `axioma/dashboard/src/features/tickets/components/ticket-classification-form.tsx`

Add authoritative submit validation for:

- record type;
- impact;
- urgency;
- service;
- subcategory.

Prefer the existing Zod/Standard Schema capability already installed. Type assertions in select handlers are not runtime validation.

#### Modify `axioma/dashboard/src/features/tickets/components/ticket-actions.tsx`

For resolve, escalate, and assignment forms:

- use one authoritative submit validator;
- validate route and select enumerations;
- remove identical validation duplicated at both form and field levels;
- keep field validation only where immediate feedback materially helps;
- preserve confirmation dialogs and pending states.

### No bulk migration

Leave small native forms unchanged in:

- `features/admin/roles-page.tsx`
- `features/problems/components/problems.tsx`
- `features/changes/components/changes.tsx`
- `features/knowledge/components/knowledge.tsx`
- `routes/_auth/forms.tsx`
- `features/tickets/components/ticket-collaboration.tsx`

Migrating all small forms would be consistency churn rather than high-value standardization.

## 8. Phase Six — Portal state correctness

These are not new TanStack adoptions; they correct Query-state presentation.

### `axioma/portal/src/routes/_auth/knowledge.tsx`

Render distinct states for:

1. pending;
2. request error with retry;
3. successful empty response;
4. populated response.

Do not turn an error into an empty result.

### `axioma/portal/src/routes/_auth/knowledge.$articleId.tsx`

Render distinct states for:

1. pending;
2. request error with retry;
3. genuine missing article;
4. article content.

Do not report network/server failures as “not found.”

## 9. Phase Seven — Dependency alignment

### Version policy

Dashboard and portal are already aligned:

| Package | Resolved version |
|---|---:|
| `@tanstack/react-router` | 1.170.32 |
| `@tanstack/router-plugin` | 1.168.35 |
| `@tanstack/react-router-devtools` | 1.167.1 |
| `@tanstack/react-query` | 5.102.8 |
| `@tanstack/react-query-devtools` | 5.102.8 |
| `@tanstack/react-form` | 1.33.5 |
| `@tanstack/react-table` | 8.21.3, dashboard only |

Do **not** force Router, plugin, and devtools to one numeric version. They are independently published, and their current peer ranges are compatible.

Do **not** upgrade Table v8 to v9 during this work. That is a separate major migration.

### Manifest changes

#### `axioma/portal/package.json`

Remove unused:

```json
"@orpc/server": "^1.14.12"
```

No portal source import exists.

### Lockfiles

Regenerate, never hand-edit:

- `axioma/dashboard/pnpm-lock.yaml`
- `axioma/portal/pnpm-lock.yaml`

Use frozen installs afterward to prove reproducibility.

No dependency upgrade sweep should be folded into this change. Current unrelated updates include TypeScript 7, Table 9, Recharts, Better Auth, Zod, and shadcn; each deserves separate compatibility review.

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

Preserve:

- Hono HTTP composition;
- oRPC contracts and handlers;
- Drizzle/PostgreSQL;
- API-only-writer invariant;
- Better Auth;
- gRPC gateway.

TanStack DB would introduce a synchronization architecture, not replace the current ORM.

### Correct the canonical protobuf documentation

Modify:

- `axioma/api/proto/axioma.proto`

Replace the inaccurate statement that the TypeScript API does not use protobuf. Clarify:

- portal and dashboard communicate with the API through oRPC;
- the TypeScript API gateway loads this protobuf definition;
- Python and Go require it as the cross-language wire format.

Republish through the existing source-of-truth command:

```powershell
pnpm --dir axioma/api contracts:publish
```

Generated/mirrored files changed by that command:

- `axioma/agent/proto/axioma.proto`
- `axioma/cli/proto/axioma.proto`

No manual edits to mirrors.

## 11. Phase Nine — Agent and CLI integration hygiene

### 11.1 Clean-checkout agent generation

Modify:

- `axioma/Tiltfile`

The agent imports generated bindings unconditionally, but `agent/axel/pb/` is ignored and Tilt currently starts the agent without generating them.

Update the agent setup command to run, in order:

1. `uv sync --all-extras`
2. protobuf generation
3. agent server

Include these as Tilt dependencies:

- `agent/proto/axioma.proto`
- `agent/scripts/generate-proto.sh`

The exact command must remain cross-platform-compatible with the project’s supported Tilt host environment. If Windows is the primary host, add/use a PowerShell generation script rather than assuming Bash.

### 11.2 Agent documentation

Modify:

- `axioma/agent/README.md`

Document:

- `api/proto/axioma.proto` is canonical;
- local copy is generated/mirrored;
- required generation order;
- Ruff command;
- pytest command;
- package build command;
- repository-local pytest temp directory on Windows if needed.

Do not add TanStack AI or rewrite the agent.

### 11.3 CLI help accuracy

Modify:

- `axioma/cli/cmd/axel-cli/main.go`

Narrow help descriptions:

- `status`: connection/device state, not “recent commands”;
- `doctor`: identity, state directory, and local prerequisites, not network connectivity.

Adding those absent features is unnecessary for a documentation defect.

### 11.4 CLI documentation

Modify:

- `axioma/cli/README.md`

Add development commands for:

```powershell
pwsh scripts/generate-proto.ps1
go vet ./...
go test ./...
go build ./...
```

Reiterate that the API protobuf is canonical and generated bindings must not be edited.

## 12. Separate security workstream — gRPC transport

This is important but should be a separate implementation unit from TanStack standardization because it changes deployment and credential handling.

Affected files at minimum:

- `axioma/api/src/env.ts`
- `axioma/api/src/server/grpc.ts`
- `axioma/api/.env.example`
- `axioma/agent/axel/config.py`
- `axioma/agent/axel/server.py`
- `axioma/agent/.env.example`
- `axioma/cli/internal/device/config.go`
- `axioma/cli/internal/device/daemon.go`
- `axioma/cli/cmd/axel-cli/main.go`
- `axioma/cli/scripts/install.ps1`
- `axioma/cli/README.md`
- `axioma/Tiltfile`
- relevant API, agent, and CLI tests

Current transport is plaintext:

- API: `grpc.ServerCredentials.createInsecure()`
- Agent: `grpc.aio.insecure_channel(...)`
- CLI: `insecure.NewCredentials()`

### Recommended direction

Use TLS with server identity verification as the minimum production boundary. Add mTLS only if client certificates and lifecycle management are operationally available.

Requirements:

1. Explicit development-only insecure mode.
2. Production startup fails closed without TLS configuration.
3. Agent verifies server CA and hostname.
4. CLI verifies server CA and hostname.
5. No certificate/private-key content is placed in normal logs.
6. Health/readiness distinguishes configuration failure from reconnecting.
7. Tests cover:
   - trusted server;
   - wrong hostname;
   - untrusted CA;
   - missing production certificate;
   - explicit development insecure mode.

Because deployment topology and certificate issuance are not specified, the implementation plan must choose those details before code is changed. Do not silently invent certificate distribution.

## 13. CI plan

Modify:

- `.github/workflows/contracts.yml`

The existing workflow is broader than its name but omits both frontends.

### Add dashboard and portal jobs or matrix entries

For each:

```powershell
pnpm install --frozen-lockfile
pnpm check-types
pnpm build
```

Add `pnpm check` after the existing lint baseline is repaired.

### Strengthen existing component checks

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
python -m build
```

Package build can be deferred if the `build` package is not intentionally part of the development environment.

CLI:

```powershell
pwsh scripts/generate-proto.ps1
git diff --exit-code -- internal/pb
go vet ./...
go test ./...
go build ./...
```

Do not run `db:check` in CI until its database/tooling prerequisites are explicitly provisioned.

## 14. Focused validation assets

### Fix existing dashboard validation scripts

#### `axioma/dashboard/src/features/tickets/components/queue-search.validation.mjs`

Remove stale `category` expectations and cover current fields:

- record type;
- service;
- route;
- priority;
- cursor;
- autonomous/resolved filters.

### SLA validation

Current validation cannot import its TSX source under plain Node.

Files:

- existing SLA countdown component;
- `axioma/dashboard/src/features/tickets/components/sla-countdown.validation.mjs`;
- new small TypeScript logic module only if needed.

Move `formatSlaTarget` into a plain `.ts` module shared by the component and validation, or execute the validation through an already installed TypeScript runtime. Do not add a testing framework solely for this.

### Add minimal behavior tests for changed logic

Use the smallest existing-capability approach. Cover:

- generated oRPC key invalidation after ticket updates;
- polling stops while the page is hidden;
- run polling stops when status is no longer `running`;
- reply validation/reset;
- CSAT rating bounds;
- add-detail validation/reset;
- fixed and runtime incident field serialization;
- knowledge loading/error/empty distinction.

A full frontend testing framework is not required unless DOM interaction tests cannot be verified reliably through existing build/type checks and focused browser validation.

## 15. End-to-end verification sequence

### Dependency and generated-file integrity

```powershell
pnpm --dir axioma/dashboard install --frozen-lockfile
pnpm --dir axioma/portal install --frozen-lockfile
pnpm --dir axioma/api install --frozen-lockfile
pnpm --dir axioma/api contracts:check
```

After intentional manifest or contract changes, first regenerate normally, then repeat with frozen/check mode.

### Frontends

```powershell
pnpm --dir axioma/dashboard check-types
pnpm --dir axioma/dashboard check
pnpm --dir axioma/dashboard build

pnpm --dir axioma/portal check-types
pnpm --dir axioma/portal check
pnpm --dir axioma/portal build
```

Manual/browser regression:

Domain and data-layer checks:

- login and logout;
- protected-route redirects;
- ticket queue filters, sorting, paging, keyboard controls;
- ticket detail update and cache refresh;
- running-agent polling and cancellation;
- device filter, sort, paging, detail polling;
- portal ticket creation with and without dynamic fields;
- reply, CSAT, add-detail flows;
- knowledge loading, failure, empty, and success states;
- devtools present in development and absent in preview builds.

Router + shadcn/ui composition checks (verify in both dashboard and portal — merge of `STANDARDIZATION-PLAN.md` validation):

1. Internal links (`Link` from TanStack Router) navigate without a full-page reload.
2. Active navigation styles update after navigation (`activeProps` / router-state).
3. Button-styled links render as semantic anchors (`<a>` styled with `buttonVariants`) and remain keyboard accessible.
4. Sidebar and breadcrumb/header links composed through Base UI (`render={<Link ... />}` in `app-sidebar.tsx` / `header.tsx`) navigate correctly.
5. Dialogs and sheets open, close, and animate correctly (controlled state).
6. Browser back/forward navigation preserves expected route behavior.
7. No nested interactive markup such as `<button><a /></button>` is rendered (inspect DOM).

Static validation for the above composition must also show `pnpm --dir axioma/dashboard check-types` and `pnpm --dir axioma/portal check-types` passing with no new dependencies installed.

### API

```powershell
pnpm --dir axioma/api check-types
pnpm --dir axioma/api test
pnpm --dir axioma/api build
pnpm --dir axioma/api contracts:check
```

### Agent

```powershell
bash axioma/agent/scripts/generate-proto.sh
uv run --directory axioma/agent ruff check axel tests
uv run --directory axioma/agent pytest
```

On affected Windows environments:

```powershell
uv run --directory axioma/agent pytest --basetemp .pytest-tmp
```

### CLI

```powershell
pwsh axioma/cli/scripts/generate-proto.ps1
git diff --exit-code -- axioma/cli/internal/pb
go vet ./...
go test ./...
go build ./...
```

Run Go commands from `axioma/cli`.

## 16. Recommended execution order

1. Fix spinner typing and split validation scripts.
2. Make devtools development-only.
3. Consolidate dashboard Query wrappers one domain at a time:
   - devices;
   - overview;
   - tickets;
   - agent runs.
4. Verify Router context and authorization freshness.
5. Correct portal fixed/dynamic form boundaries.
6. Fix portal knowledge Query-state rendering.
7. Remove unused portal dependency and regenerate lockfiles.
8. Correct protobuf comment and republish mirrors.
9. Fix Tilt generation, agent docs, and CLI docs/help.
10. Expand CI after local gates are clean.
11. Implement gRPC TLS as a separately reviewed security change.

## 17. Estimated effort

| Workstream | Estimate |
|---|---:|
| Validation baseline and scripts | 0.5–1 day |
| Devtools boundary | 0.5 day |
| Dashboard Query consolidation | 1.5–3 days |
| Router/auth integration | 0.5–1 day |
| Portal form boundary and migrations | 1.5–3 days |
| Portal Query-state fixes | 0.5 day |
| Dependency/contract/docs/Tilt cleanup | 0.5–1 day |
| CI expansion and regression checks | 1–2 days |
| gRPC TLS/mTLS | Separate, approximately 3–7+ days |

**Core standardization total:** approximately **6–11 engineer-days**, excluding transport security.

The key restraint is intentional: this plan removes duplicate layers and closes real validation gaps without forcing TanStack products into backend, agent, CLI, or simple native UI paths where they provide no net value.

## 18. Completion criteria

This plan is complete when (merged criteria from both prior plans):

- Both frontend typechecks pass (`pnpm --dir axioma/dashboard check-types` and `pnpm --dir axioma/portal check-types`).
- Both frontend production builds pass (`pnpm --dir axioma/dashboard build` / `pnpm --dir axioma/portal build`) with no new dependencies.
- Focused Router + shadcn/ui browser checks pass (§15: 7 composition checks).
- Domain regression checks pass (§15: login, tickets, devices, agent runs, portal forms, knowledge states).
- Devtools are present in development and absent from production bundles (§4 validation).
- No unnecessary compatibility wrappers or dependencies have been added (`RouterButton`/`RouterDialog`/`RouterSheet`/`createLink(Button)`/`#portal-root`/shared nav abstraction, plus TanStack DB/AI/Store/etc. per §1).
- All modified Query/Form paths preserve polling, invalidation, validation, and toast behavior per Phases 3-7.
- Contract mirrors remain identical (`pnpm --dir axioma/api contracts:check`).
- CI gates for dashboard/portal/api/agent/cli are green on a clean checkout.
