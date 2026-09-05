# Axiōma portal + dashboard shell redesign

## Context

The portal's top menu is a stock shadcn starter header: translucent blurred sticky bar, plain text links whose only active cue is a font-weight change, a right cluster of five mismatched controls (outline "New request", ghost bell, outline theme dropdown, the user's full name in an outline button), and a hamburger `DropdownMenu` on mobile that duplicates the nav list by hand (three inline comments warn that every visibility gate must be applied twice). The user does not like how it looks. The theme (zinc + brand green `#008236` tokens, Inter / Instrument Sans / Geist Mono, dark default, shadcn base-nova on Base UI, Remix icons) must stay exactly as is — no token, font or radius changes.

Decisions made with the user:
- **Portal header**: flush full-width bar, opaque (no blur), **pill navigation**; the current page is an **ink-filled pill** (`bg-foreground text-background`) — the treatment `axioma/web` uses for `aria-current`. Not the floating-card variant.
- **Theme control**: stays **standalone in the header** as a 3-state **segmented control** (sun / moon / monitor), like the marketing site's `theme-toggle`; replaces the dropdown.
- **Dashboard**: same header cleanup for consistency **plus** grouping the 22 flat sidebar items into sections.

Design plan (same tokens throughout):
- Colour roles: ground/bar `background` + `border-b`; nav `muted-foreground`, hover `muted`/`foreground`; active pill `foreground`/`background`; the **only** coloured control is "New request" (`primary`) beside the green wordmark; unread dot `primary`.
- Type: Inter `text-sm font-medium` for nav pills; avatar initials `text-xs font-medium`. No new faces, no uppercase labels, no numbered markers.
- Layout: column `mx-auto max-w-6xl px-4 sm:px-6 lg:px-8` unchanged so the wordmark keeps aligning with `PageShell`. Bar `h-14 sm:h-16`.
- Principles: one nav list rendered once (responsive by CSS order/wrap, never a second JSX copy); location = inverse pill and nothing else uses inverse fill; quiet ghost icon buttons for everything but the single primary action; no decorative motion.

```
lg+   ┌────────────────────────────────────────────────────────────────────────────┐
      │ AXIŌMA   [My requests] Help articles  Service status ↗      (+ New request) 🔔• ☼◐▣ ◉ │ h-16, border-b
      └────────────────────────────────────────────────────────────────────────────┘
md    same row, "New request" icon-only (measured: labelled row needs ~790px, md inner is 720px)
<md   ┌──────────────────────────────────────┐
      │ AXIŌMA                  (+) 🔔• ☼◐▣ ◉ │ row 1, h-14
      │ [My requests] Help articles Status ↗  │ row 2, pills, scroll-x
      └──────────────────────────────────────┘
```

## Files

### Shared primitives (`axioma/ui`, source of truth — mirrored copies are never edited)
- **NEW** `axioma/ui/src/components/ui/toggle.tsx` — `Toggle` + `toggleVariants` (cva) wrapping `@base-ui/react/toggle` (present in both apps, `@base-ui/react` 1.7.0). Pressed styling on `aria-pressed:`/`data-pressed:` (Base UI attributes, not Radix `data-[state=on]`). `sm` size uses `text-xs`, not upstream's `text-[0.8rem]` (the vendored-primitive type-scale test bans it; same documented deviation as `button.tsx`).
- **NEW** `axioma/ui/src/components/ui/toggle-group.tsx` — `ToggleGroup` (wraps `@base-ui/react/toggle-group`, `data-slot="toggle-group"`, forwards `orientation`) + `ToggleGroupItem` (wraps Toggle, `data-slot="toggle-group-item"`, requires `value`). Base UI API: `value: string[]`, `onValueChange(groupValue: string[])`, single-select by default; clicking the pressed item yields `[]` — callers ignore it. Explicit Tailwind classes + `cn()`, style of `tabs.tsx` / `radio-group.tsx`; skip upstream's `spacing`/join machinery.
- `axioma/ui/manifest.json` — add both files to **both** `dashboard` and `portal` lists (the mirror script throws for an unlisted source; `toggle-group.tsx` imports `toggle.tsx`).
- Run `pnpm --dir axioma/ui mirror`. Gotcha: each app's `biome check .` lints the mirrored copies, so any formatting fix goes into `axioma/ui/src` and is re-mirrored — never `pnpm fix` an app copy and leave it diverged (`pnpm --dir axioma/ui check` then fails with `stale generated file`).

### Portal (`axioma/portal/src`)
- `components/header.tsx` — rewrite (sketch below). Remove the hamburger `DropdownMenu`, `RiMenuLine`, the `signedIn` gates on nav links and the stale "/status page" comments. Keep `authClient.useSession()` only for `enabled: Boolean(session)` on the `portalIsFrontDoor` query. Must **not** call `Route.useRouteContext()`: `AuthPending` in `routes/_auth/route.tsx` renders the real `Header` before the context exists.
- `components/mode-toggle.tsx` — segmented control on `ToggleGroup` (keep the `ModeToggle` export name).
- `components/user-menu.tsx` — avatar trigger, two-line label, `align="end"`; keep `DropdownMenuGroup` (Base UI throws if `DropdownMenuLabel` sits outside a group; the validator also requires it in `notification-center.tsx`).
- `components/notification-center.tsx` — unread dot on the bell trigger: `className="relative"` on the rendered Button, dot `<span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />` when `unread > 0` (count already in `aria-label`).
- `components/design-system.config.json` — remove the `groupedCallSites` entries for `components/header.tsx` and `components/mode-toggle.tsx` (neither will contain a dropdown). Keep `notification-center.tsx`. Space baseline untouched.

### Dashboard (`axioma/dashboard/src`)
- `components/layout/header.tsx` — bar becomes opaque `bg-background` (drop `/80 backdrop-blur-md`, matching the portal). Right cluster: Search (`size="default"` so it is 32px like its neighbours; replace the raw `<kbd>` with `Kbd` from `components/ui/kbd.tsx`, `className="hidden md:inline-flex"`, label `⌘K` when `/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)` else `Ctrl K`), `NotificationCenter`, `ModeToggle`, `UserNav`.
- `components/mode-toggle.tsx`, `components/user-menu.tsx` — same rewrites as portal (dashboard signs out to `/`, portal to `/login`). Also fix the dashboard's signed-out fallback `<Link><Button/></Link>` (nested `a > button`) to `<Link className={buttonVariants({ variant: "outline" })}>`.
- `lib/navigation.ts` — add `NAV_SECTIONS = ["Work", "Records", "Setup", "Mail", "Administration"] as const`, a `section` on every entry, reorder the array by section (keep the literal `] as const;` — `routes/navigation.validation.mjs` anchors on it; every `to`/`label`/`capabilities` value unchanged). Optional hardening: `satisfies ReadonlyArray<{ …; section: NavSection; … }>`. Add `visibleSections(held)` → `{ section, entries }[]` in `NAV_SECTIONS` order with empty sections dropped.
  - **Work**: Overview, Ticket queue, Approvals, Device commands, Scheduled work
  - **Records**: Devices, Problems, Changes, Knowledge, Assets, Software licences, Suppliers & contracts
  - **Setup**: Request forms, Ticket rules, Workflows
  - **Mail**: Mail send log → `RiMailSendLine`, Mailboxes → `RiInboxLine`, Mail templates → `RiDraftLine` (all three currently share `RiMailLine`)
  - **Administration**: Roles, ITSM connectors, Environments
- `components/layout/app-sidebar.tsx` — one `SidebarGroup` + `SidebarGroupLabel` + `SidebarMenu className="gap-1" aria-label={section}` per entry of `visibleSections` (replaces the single "Operations" group; the existing `SidebarMenuItem`/`SidebarMenuButton` block is unchanged). Add `<SidebarRail />` as a direct child of `Sidebar` after `SidebarContent`. Labels already fade in icon-collapsed mode; no primitive tweak needed.
- `components/layout/command-menu.tsx` — "Views" becomes one `CommandGroup heading={section}` per section from `visibleSections`, each filtered by the typed term, empty groups dropped.
- `components/route-state.tsx` — `AuthPending` header-right skeleton `w-44` → `w-52`.
- `components/design-system.config.json` — remove the `components/mode-toggle.tsx` entry.

## Sketches

Portal `header.tsx` — single `<nav>`, flex-wrap handles both layouts; merge breakpoint is `md`, label appears at `lg`:
```tsx
const navPill =
	"inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 font-medium text-muted-foreground text-sm outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:bg-foreground data-[status=active]:text-background data-[status=active]:hover:bg-foreground/90";

<header className="sticky top-0 z-20 border-b bg-background">
	{/* Same column as PageShell in ticket-ui.tsx */}
	<div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 px-4 sm:px-6 md:flex-nowrap lg:px-8">
		<Link to="/my-requests" className="flex h-14 shrink-0 items-center sm:h-16">
			<AxiomaWordmark className="h-7 w-auto text-primary" title="Axiōma" />
		</Link>
		<nav aria-label="Primary navigation"
			className="order-last flex min-w-0 basis-full items-center gap-1 overflow-x-auto pt-1 pb-2 md:order-none md:basis-auto md:flex-1 md:p-0">
			<Link to="/my-requests" className={navPill}>My requests</Link>
			<Link to="/help-articles" className={navPill}>Help articles</Link>
			<a href={siteUrl("status")} className={navPill}>
				{statusCopy.viewStatus}<RiArrowRightUpLine className="size-3.5" aria-hidden="true" />
			</a>
		</nav>
		<div className="ml-auto flex h-14 shrink-0 items-center gap-1 sm:h-16 sm:gap-2">
			{foreignFrontDoor ? null : (
				<Link to="/tickets/new" aria-label="New request"
					className={buttonVariants({ className: "max-lg:w-8 max-lg:px-0" })}>
					<RiAddLine aria-hidden="true" />{/* no data-icon: its :has() padding rule would off-centre the icon-only button */}
					<span className="hidden lg:inline">New request</span>
				</Link>
			)}
			<NotificationCenter /><ModeToggle /><UserMenu />
		</div>
	</div>
</header>
```
- `<md`: nav has `order-last basis-full` → its own row, pills scroll horizontally; `ml-auto` keeps actions right on row 1. `md+`: `md:flex-nowrap` + `md:order-none md:basis-auto md:flex-1 min-w-0` → one row, nav scrolls inside its cell instead of overflowing the bar if space runs out. No `space-x/y` utilities anywhere.
- TanStack `Link` sets `data-status="active"` + `aria-current="page"` itself (verified in `@tanstack/react-router` 1.170 `link.js`); `/help-articles` stays active on `/help-articles/$articleId` (non-exact default). Links styled with `buttonVariants(...)` as elsewhere in the app — not `Button render={<Link/>}` (Base UI warns on non-native buttons).

`mode-toggle.tsx` (both apps):
```tsx
const THEMES = [
	{ value: "light", label: "Light theme", icon: RiSunLine },
	{ value: "dark", label: "Dark theme", icon: RiMoonLine },
	{ value: "system", label: "Follow system theme", icon: RiComputerLine },
] as const;
const DEFAULT_THEME = "dark"; // mirrors ThemeProvider defaultTheme in routes/__root.tsx and index.html

const { theme, setTheme } = useTheme(); // theme = stored setting, undefined before mount
const current = THEMES.some((t) => t.value === theme) ? theme : DEFAULT_THEME;
<ToggleGroup value={[current]} onValueChange={([next]) => { if (next) setTheme(next); }} aria-label="Theme"
	className="gap-0.5 rounded-full bg-muted p-0.5">
	{THEMES.map(({ value, label, icon: Icon }) => (
		<ToggleGroupItem key={value} value={value} size="sm" aria-label={label}
			className="w-7 rounded-full px-0 text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-foreground/10">
			<Icon aria-hidden="true" />
		</ToggleGroupItem>
	))}
</ToggleGroup>
```
`size="sm"` goes on the items, not the group (a group-level size would set a `data-size` radius that beats `rounded-full`). Track = 32px tall, matching `size="icon"` buttons. Arrow keys / Home / End come from Base UI's composite root.

`user-menu.tsx` (both apps):
```tsx
function initials(name: string | null | undefined, email: string) {
	const letters = (name?.trim().split(/\s+/).filter(Boolean) ?? []).slice(0, 2).map((w) => w.charAt(0)).join("");
	return (letters || email.charAt(0)).toUpperCase();
}
if (isPending) return <Skeleton className="size-8 rounded-full" />;
<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account" />}>
	<Avatar><AvatarImage src={image ?? undefined} alt="" /><AvatarFallback className="font-medium text-xs">{initials(name, email)}</AvatarFallback></Avatar>
</DropdownMenuTrigger>
<DropdownMenuContent align="end" className="min-w-56">
	<DropdownMenuGroup>
		<DropdownMenuLabel className="flex flex-col gap-0.5"><span>{name}</span><span className="font-normal text-muted-foreground text-xs">{email}</span></DropdownMenuLabel>
		<DropdownMenuSeparator />  Acceptable use policy ↗ (external Link)  <DropdownMenuSeparator />  Sign out (variant="destructive")
	</DropdownMenuGroup>
</DropdownMenuContent>
```
Avatar root/fallback render `<span>`, image `<img>` → valid inside the trigger `<button>`. Drop the current `className="bg-card"` override so the popup matches the other menus.

## Reuse
- `AxiomaWordmark` — `components/brand.tsx`; `Avatar*` — `components/ui/avatar.tsx` (mirrored to both, unused until now); `Button`/`buttonVariants` (`default` = brand green) — `components/ui/button.tsx`; `Kbd`, `Skeleton`, `DropdownMenu*` (Base UI `render` prop).
- `Sidebar*` incl. `SidebarRail`, `SidebarGroupLabel` — `components/ui/sidebar.tsx`.
- `visibleNavigation`/`permits` — `dashboard/src/lib/navigation.ts`; `siteUrl` — `portal/src/lib/api-url.ts`; `statusCopy.viewStatus` — `portal/src/features/status/copy.ts`.

## Verification
1. `pnpm --dir axioma/ui mirror` then `pnpm --dir axioma/ui check` (must print "ui copies are fresh"). Re-run `check` last if `pnpm fix` was used in either app.
2. Per app (`axioma/portal`, `axioma/dashboard`), in order: `pnpm check` → `pnpm validate` → `pnpm build` → `pnpm check-types` (build first: Vite regenerates `routeTree.gen.ts`). `validate` covers grouped call sites, type scale, tone tints, space baseline, and the dashboard's `navigation.validation.mjs`.
3. Visual: start `api` (`pnpm db:start && pnpm dev`, :3000), `portal` (:3001), `dashboard` (:3002); sign in with a seeded demo user (`api/src/db/seed/data.ts` `DEMO_USERS`; staff e.g. alex.morgan@axioma.demo for the dashboard). Screenshot via the chrome-devtools MCP at 1280 / 768 / 375 px, light and dark:
   - Portal: active pill follows `/my-requests`, `/help-articles`, `/help-articles/:id`; "New request" hidden when the front door is foreign, icon-only below `lg`; two-row header with scrolling pills at 375; bell dot with an unread item; theme control switches, re-clicking the pressed item keeps it pressed, persists via `vite-ui-theme`; avatar menu shows name/email, policy link, sign out → `/login`.
   - Dashboard: five sidebar sections, empty sections hidden for a low-capability user, labels vanish when icon-collapsed, rail toggles; `⌘K`/`Ctrl K` per platform; palette groups by section; pending skeleton geometry matches; header opaque.
   - Keyboard: Tab order wordmark → pills → actions; visible focus rings; arrow keys move inside the theme control.
