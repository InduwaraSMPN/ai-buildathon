# Employee portal: new `/home` landing page

## Context

After signing in, an employee lands on `/my-requests`, one flat list of their tickets. It answers "what did I file?" but not "what do I need to do right now?" The two things that need the employee's own action, a support question waiting on a reply and a fix waiting to be confirmed, sit mid-list with no priority, and their computers are invisible until they open a request form.

`/home` becomes the landing page: a tailored overview that puts the actionable items first. `/my-requests` stays as the full list. An approved static mockup exists at [context/mockups/portal-home.html](context/mockups/portal-home.html), preview at https://claude.ai/code/artifact/41db852f-7fef-4865-aa89-b0ff0c75477f. It is the visual contract. Every colour, radius and type size in it already comes from `axioma/ui/src/styles/globals.css`; nothing about the theme changes.

Layout at `lg` and up. Both columns end on the same line; below `lg` they stack, requests first.

```
Good to see you, Sofia                                    Saturday, 5 September
Two requests need something from you and two are moving.
┌────────────────────────────┐  ┌──────────────────────────────────┐
│ My requests            [+] │  │ Needs you            2 waiting   │
│ (All 7)(Needs you 2)(…)    │  │ ┌──────────────────────────────┐ │
│ ─ request row + stage bar  │  │ │ green: resolution ready      │ │
│ ─ request row              │  │ ├──────────────────────────────┤ │
│ ─ request row              │  │ │ amber: waiting for your reply│ │
│ [ View all 7 requests    ] │  │ └──────────────────────────────┘ │
└────────────────────────────┘  └──────────────────────────────────┘
                                ┌──────────────────────────────────┐
                                │ Your computers  [+ Connect …]    │
                                └──────────────────────────────────┘
```

Decisions taken with the user:
- **`/my-requests` stays.** `/home` shows the three most recent requests and links to the full list.
- **"Needs you" = `pending` + `resolved` only.** No approval lookups.
- **Devices panel lists `listMyDevices`**, and "Connect a computer" opens a dialog holding the `claimDevice` form currently inline on `/my-requests`.
- **The note cards quote the real message.** Worth the extra fetch; a generic status line does not tell you what was asked.
- **The note cards stack vertically.** Side by side they get about 250px each at the portal's real width and their buttons wrap.

Two deliberate deviations from the mockup, both measured rather than guessed. The page keeps the shipped `max-w-6xl` column instead of the mockup's 80rem, because the header is shared by every authenticated route and widening it reflows the ticket detail page's fixed sidebar. And the note cards stack, per the decision above.

## Data

The page runs on `listTickets` with `scope: "mine"`, overridden to `sortBy: "updatedAt"`, `sortDirection: "desc"`, `limit: 20`. The default sort is `priority` ascending, which is a support-queue ordering that exists for the dashboard. The list item already carries everything the rows and cards render, including `escalationFlag`, `resolution`, `resolvedAt` and `progressMarker`.

Message bodies are the one exception: they live only on `getMyTicket`. Each pending card fetches its own ticket to quote the last staff message. Use `orpc.getMyTicket.queryOptions({ input: { id } })` with no interval; the key matches `myTicketQueryOptions`, so the cache is shared with the detail page and clicking through is instant.

`listMyDevices` feeds the devices panel. Its output is only `{ id, hostname, connected, lastSeenAt }`. There is no platform or OS field on the portal contract, so the mockup's "Windows 11, seen just now" becomes a relative last-seen string alone.

Filter buckets, derived client-side:

| Tab | States |
| --- | --- |
| All | everything |
| Needs you | `pending`, `resolved` |
| In progress | `new`, `open` |
| Done | `isFinishedTicket`, which is `closed` only |

The "View all N requests" count uses `items.length` only when `nextCursor` is null. The status facets are computed over the whole scope but skip the snoozed-ticket filter, so they can overcount; fall back to an unnumbered "View all requests" when the page is truncated.

## Files

### New: `src/features/home/`
- `copy.ts` — page title, greeting, the summary sentence builder, filter labels, panel headings, empty states.
- `components/home-page.tsx` — the bento composition.
- `components/request-list-card.tsx` — filter pills, three rows, "View all" pinned to the card bottom.
- `components/stage-bar.tsx` — the compact three-segment bar.
- `components/needs-you-card.tsx` — the two tinted notes.

### New: `src/features/devices/`
No devices feature exists today; `listMyDevices` is only read by two request-form pickers. Devices are now a first-class portal surface, so they get their own folder rather than living under tickets.
- `copy.ts` — the seven device strings currently sitting in `homeCopy`, plus the panel's own labels.
- `components/device-claim-form.tsx` — the extracted claim form.
- `components/device-list.tsx` — the "Your computers" rows.

### New: `src/routes/_auth/home.tsx`
Thin route in the house style: `createFileRoute("/_auth/home")`, a `head` meta title, `Route.useRouteContext()` for `session`. The `tanstackRouter` Vite plugin regenerates `routeTree.gen.ts`, which is gitignored, so no manual registration. The `_auth` layout already supplies the session guard, header, skip link and pending skeleton.

### Extracted for reuse
- **`features/tickets/components/resolution-actions.tsx`** — the verdict buttons with their confirm `AlertDialog` and note `Dialog`, lifted out of [resolution-card.tsx](axioma/portal/src/features/tickets/components/resolution-card.tsx) lines 160 to 248. The note dialog serves both the resolved and escalated branches, so it moves too. Its hard-coded `id="resolution-note"` becomes `useId()`, since two notes can be mounted at once on `/home`. `ResolutionCard` keeps the reopen dialog and restores its own button order through `className`. The file drops from 251 lines to about 145, and its `space-y` count stays at 2, matching the baseline.
- **`features/devices/components/device-claim-form.tsx`** — the form from [my-requests.tsx](axioma/portal/src/routes/_auth/my-requests.tsx) lines 57 to 74 and 150 to 215. Takes `onSuccess` so the home dialog closes itself; `/my-requests` renders the same component inside its existing collapsible with no callback. The extraction fixes a real bug: the input allows 64 characters where the contract caps the code at 32, so an over-length paste currently fails on the server as a generic "check it and try again".
- **`getStageIndex`** in [features/tickets/copy.ts](axioma/portal/src/features/tickets/copy.ts) — the state-to-stage map is currently private inside `progress-timeline.tsx`. It belongs beside `ticketStages` and the `stages` label record it indexes into. Type it as `Record<StateType, …>` so a new state type fails to compile, matching `stages` and `stateTones`.
- **`timeAgo`** in [components/ticket-ui.tsx](axioma/portal/src/components/ticket-ui.tsx), beside `formatDate`. The portal has no shared relative-time helper; two byte-identical minute-only copies sit in `request-form.tsx` and `draft-review.tsx`, and both currently render a three-day-old laptop as "4,320 minutes ago". Replace them; neither call site depends on the minute-only output.

### Route retarget
Seven files point at `/my-requests` as the landing:

| File | Change |
| --- | --- |
| `routes/index.tsx` | signed-in redirect target |
| `routes/login.tsx` | already-signed-in redirect target |
| `components/sign-in-form.tsx` | the `LANDING` constant, which also feeds the OAuth callback URL |
| `components/sign-up-form.tsx` | same constant |
| `components/header.tsx` | logo link, plus a new "Home" pill before "My requests" |
| `components/not-found.tsx` | both back links, copy becomes "Back to home" |
| `components/notification-center.tsx` | the non-ticket fallback |

Links that mean "back to the list" stay on `/my-requests`: the ticket detail page, the new request form, and the request form's cancel buttons. After the edits, a sweep for `"/my-requests"` should return only the header pill and the new "View all requests" link.

## Reuse

- **Shell**: `PageShell`, `PageHeading`, `StatusBadge`, `LoadingCards`, `ErrorState`, `formatDate` in `components/ticket-ui.tsx`. `PageShell` already carries the mockup's ground tint and the `id="main-content"` the skip link targets.
- **Filter pills use `ToggleGroup`, not `Tabs`.** The filter swaps a client-side list with no panels; `Tabs` without `TabsContent` ships `role="tab"` with no `aria-controls`, which screen readers announce as a tab governing nothing. `ToggleGroup` also needs four class overrides to reach the mockup's pill where `Tabs` needs about twelve. It renders `role="group"`, so an `aria-label` is required.
- **Card is already `flex flex-col`**, so `mt-auto` on the last child pins the "View all" button to the bottom with no wrapper. Equal columns come from grid defaults plus `lg:grid-rows-[auto_1fr]` on the right column.
- **Status tones**: `ticketStatusTone` in `lib/status-tone.ts`. The tinted notes use the same `border-X/30 bg-X/10 text-X` recipe as the `Badge` tone variant.
- **Mutations**: `updateMyTicketMutationOptions()` already invalidates both `getMyTicket` and `listTickets`, so a verdict given on `/home` refreshes the page for free.
- **Front-door gate**: `orpc.portalIsFrontDoor` decides whether a "New request" action appears at all. The header already reads it; the home page's "+" must respect the same flag.

## Constraints

`pnpm validate` runs the design-system suite over every product file. The rules that bite here:

- No `space-x-*` or `space-y-*` in any new file; the baseline defaults to zero for unlisted files. Use `gap`.
- No hand-set type sizes. The allowlist is empty, so a `text-[15px]` copied from the mockup fails.
- A tinted background pairs with the tone's own text colour, `text-success`, never `text-success-foreground`.
- No raw palette classes such as `bg-emerald-500`. Semantic tokens never match the rule, so the tinted notes are fine either way, but add `resolution-actions.tsx` to `statusPaletteFiles` to keep it under the same guard as its parent.
- No `<table>`, `<details>`, raw `<select>`, checkbox inputs, `window.confirm`, `animate-pulse` outside `Skeleton`, or `lucide-react`.

Never edit `components/ui/*`, `lib/utils.ts` or `lib/status-tone.ts`. They are mirrored from `axioma/ui` and CI fails on drift. Nothing here needs them.

Biome formats with tabs and double quotes. Run `pnpm fix` first.

## Verification

From `axioma/portal`, in this order. Build precedes type-check because Vite regenerates `routeTree.gen.ts`, and a fresh `check-types` would otherwise fail on the unknown `/home` route id:

```
pnpm fix
pnpm check
pnpm validate
pnpm build
pnpm check-types
```

**Signing in needs a real account.** None of the seeded demo users can authenticate; the seed writes `user` rows but no credentials. Sign up through the portal at `http://localhost:3001/login`, then set `SEED_REPORTER_EMAIL` to that address in `axioma/api/.env` and re-seed, so the demo tickets, notifications and devices attach to it. Left unset, the fallback is a display-only identity and `/home` renders empty for reasons unrelated to this work. The portal is `strictPort`, and the API admits only ports 3001 and 3002 as CORS origins, so a port collision breaks auth cookies silently.

Run the API on :3000 and the portal on :3001, then check with the chrome-devtools MCP at 1440, 1024 and 375 px, in both light and dark:

- `/` and `/login` redirect to `/home` when a session exists; signing in lands there.
- The greeting names the user and its counts agree with the filter pills.
- Filter pills swap the list, the pressed pill is the inverse fill, arrow keys move between them, and each announces as pressed.
- The stage bar tracks state: `new` marks segment one current, `open` and `pending` segment two, `resolved` and `closed` all three done.
- A pending note quotes the last staff message; a resolved note offers both verdicts. "This solved it" closes the request and the note leaves the panel. "It didn't" opens the note dialog and escalates. Then repeat both on `/tickets/$ticketId` to prove the extraction did not regress the detail page.
- Devices show online and offline with a relative last-seen. "Connect a computer" opens the dialog, a bad code shows the inline error, a good one closes and adds the row. Paste a 40-character string and confirm the field stops at 32, on both the dialog and the collapsible on `/my-requests`.
- Empty state: a reporter with no tickets sees the empty panel and a route to create one, and that route is hidden when `portalIsFrontDoor` reports a foreign front door.
- Both columns end flush at `lg`. At 375px they stack, requests first, with no horizontal page scroll. Check the header nav between 768 and 1023px, where the fourth pill is added but the "New request" label is still hidden.
- Keyboard: the skip link reaches `#main-content`, focus rings are visible, dialogs trap focus and close on Escape.
