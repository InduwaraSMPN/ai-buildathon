# Axiōma Web — High-End Uplift Plan

Applying `context/BUILD_HIGH_END_WEB_APPS_WITH_AI.md` to the existing `axioma/web` site.

**Scope boundary:** every command, install, and file change in this plan happens inside
`D:\Work\hackthons\ai-buildathon\axioma\web`. Nothing is installed globally, and nothing outside
this directory is modified. Sibling apps (`axioma/dashboard`, `axioma/portal`, `axioma/ui`) and the
repo-root `.agents/` and `.claude/` directories are read-only references for this work.

---

## 1. How the guideline maps to this project

The guideline is written for a greenfield clone-and-restyle flow. This site already exists, is
server-rendered, is in the Helm deployment, and has a deliberate editorial design. The guideline's
own "Existing Project" column applies, so the mapping is:

| Guideline step | Verdict here | Why |
|---|---|---|
| 1. Collect context (`grill-me`) | **Adopt, on the delta** | No `SPEC.md` / `DECISIONS.md` exists. Product truth lives in `../../context/idea/idea.md` but has never been reduced to a web spec. |
| 2. Find a proven UI to clone | **Skip** | Current UI is the baseline. It is already distinctive, not templated. |
| 3. Pixel-perfect clone | **Skip** | Same reason. |
| 4. Embed context into V1 | **Reframe as restructure** | Content is hardcoded inside route components; extract it so design and copy can move independently. |
| 5. Restyle with Impeccable | **Adopt** (`/impeccable live` + single-discipline passes) | Needs the CSS split in Phase 2 first, or every pass rewrites one 2,006-line file. |
| 6. Parallel variations via worktrees | **Adopt, gated** | Requires explicit approval — repo rules forbid unrequested git writes. |
| 7. Polish & consistency | **Adopt, and it is the biggest item** | A dark palette is defined but dead; tokens are literal, not semantic. |
| 8. Higgsfield motion assets | **Recommend replacing** | Paid third-party video generation; a 1080p asset is heavy for a container-delivered B2B site. Substitute: scroll-linked motion on the visuals we already have. |
| 9. Apple-style scroll page | **Adopt in reduced form** | Scroll-driven reveal choreography, no video scrub. |
| 10. Cloudflare Pages | **Skip** | Production delivery is SSR-in-a-container via `axioma/deploy/helm/axioma/templates/web.yaml`. Pages would be a second target, not a migration, and the deployment path is deliberately left alone. |

---

## 2. Current state audit

Stack as installed: React 19.2, TanStack Router 1.170 / Start 1.168 (SSR via Nitro 3 beta), Tailwind
CSS 4.3, Vite 8, Biome 2.5, pnpm 11. Fifteen source files, six routes, one shared stylesheet.

### 2.1 Two design systems occupy one stylesheet

`src/styles.css` is 2,006 lines and contains two unrelated token sets:

- **Editorial tokens** in `@theme` (lines 5–29): `--color-ink`, `--color-paper`, `--color-veil`,
  `--color-lead`, `--color-slate`, `--color-brand`, `--color-rule-*`. Every component uses these.
- **shadcn tokens** in `:root` / `.dark` / `@theme inline` (lines 33–145): `--background`,
  `--foreground`, `--primary`, `--sidebar-*`, `--chart-*`. Nothing in the app uses these.

The editorial tokens are named for *literal appearance* ("ink", "paper"), not for *role* ("surface",
"text"). That is the single biggest obstacle to a dark theme, and it is measurable: roughly 152
`var(--color-ink|paper|veil|lead|slate|brand|rule-soft)` references across the stylesheet would need
to resolve differently per theme.

### 2.2 The dark theme is dead code

`.dark` (line 118) defines a complete dark palette. Nothing ever applies that class — there is no
theme toggle, no `dark:` variant in application code, and no system-preference script. The
`.dark-section` class (line 671) is unrelated: it is a dark-background *section* on a light page.

Consequence: the guideline's Step 7 ("verify every page, both themes") currently has only one theme
to verify, and the dark palette in the file misleads anyone reading it.

### 2.3 shadcn/ui is installed but unused

`components.json`, the `shadcn` dependency, `radix-ui`, and `src/components/ui/button.tsx` are all
present. A search for imports from `@/components/ui` returns zero hits — every button on the site is
the hand-written `.button` class (`src/styles.css:322`). `SHADCN_PLAN.md` (16.5 KB) describes an
integration that was only partly carried out.

Also note the tab interface on `src/routes/pricing.tsx:172` is hand-rolled ARIA (`role="tablist"`,
manual `aria-selected`) with no arrow-key handling — the exact case a primitive library solves.

### 2.4 Fonts are loaded twice over, from the wrong place

- `package.json` ships `@fontsource-variable/instrument-sans` and `@fontsource-variable/geist-mono`.
  Neither is imported anywhere.
- `src/routes/__root.tsx:29–38` loads Instrument Sans **and Fragment Mono** from the Google Fonts
  CDN — a render-blocking third-party request on every page.
- `--font-mono` (`src/styles.css:10`) declares Fragment Mono, while the installed mono package is
  Geist Mono. Two different answers to the same question.

### 2.5 Metadata and SEO gaps

- `src/routes/__root.tsx` sets `og:site_name` and `og:type` only. No `og:title`, `og:description`,
  `og:image`, `og:url`, no Twitter card, no canonical link.
- No sitemap. `public/robots.txt` is two lines with no `Sitemap:` reference.
- `public/site.webmanifest` sets `theme_color: "#0b0e12"`; `__root.tsx:24` sets
  `<meta name="theme-color" content="#008236">`; the actual page background is
  `oklch(1 0 0)` / `oklch(0.967 0.001 286.375)`. Three inconsistent answers.
- The 404 component (`__root.tsx:80`) renders no `<title>`.
- No structured data (JSON-LD).

### 2.6 Motion fires on load, not on scroll

The reveal system (`src/styles.css:1798–1845`) is a load-time CSS keyframe with `nth-child` delays
inside `@media (prefers-reduced-motion: no-preference)`. Every `.reveal-group` on the page — including
sections far below the fold — completes its animation before the visitor has scrolled to it. The
staggering is real; the scroll choreography the guideline calls for is not.

Credit where due: `prefers-reduced-motion: reduce` is handled properly at line 1997.

### 2.7 Content is welded into components

`src/routes/index.tsx` holds `steps`, `transcript`, `stages`, and `systems` arrays plus the
`ContextMap` and `TicketVisual` components in one 8.9 KB file. `pricing.tsx` holds the entire plan
matrix. Any restyle pass therefore edits files that also own the copy, which makes the parallel
worktree variations of Step 6 conflict-prone and hard to diff.

### 2.8 No verification gates for this package

`.github/workflows/contracts.yml` is the only workflow; it does not build or check `axioma/web`.
There is no test setup, no accessibility check, and `pnpm check-types` requires a full build first
(TanStack Router must generate `routeTree.gen.ts`).

### 2.9 Content honesty flags

- `src/routes/pricing.tsx:36` is explicit that every price is a placeholder. That must be resolved
  before any public deployment, and the guideline's polish steps must not quietly launder it into
  looking authoritative.
- `src/lib/status.ts:13` defaults `AXIOMA_API_URL` to `http://localhost:3000`; the status route
  fails closed to `StatusUnavailable` when the API is unreachable. Correct behaviour — keep it.
- The subscribe form (`src/components/site.tsx:48`) intentionally has no backend and opens a mail
  client. Keep the behaviour and keep saying so on the page.

---

## 3. Decisions

**D1 — shadcn/ui: RESOLVED — adopt narrowly.**
Radix-backed primitives take over interactive behaviour and accessibility only: pricing tabs, mobile
navigation, and the theme toggle. The editorial CSS keeps ownership of every marketing surface.
`src/components/ui/` grows with `tabs.tsx` and a menu primitive; `button.tsx` is either used for real
or deleted. This fixes the hand-rolled tab keyboard handling on `src/routes/pricing.tsx:172` and
gives the theme toggle a correct implementation.

**D2 — Dark mode: RESOLVED — ship it.**
Introduce semantic token pairs, migrate the ~152 literal-token references, add a no-flash inline
theme script, ship a three-state toggle, and redesign `.dark-section` for a dark page. Roughly a day
of careful work, and it is the substance of Phase 3.

**D3 — Motion: RESOLVED — code-driven scroll motion.**
CSS `animation-timeline: view()` with a `@supports` fallback to the current behaviour. No Higgsfield
CLI, no generated video, no canvas frame scrubbing, no new runtime dependency unless the JS fallback
proves necessary. `/about` remains a slot a cinematic asset could fill later without disturbing
anything else.

**D4 — Cloudflare Pages: RESOLVED — skip.**
Deployment is not touched. The Nitro Node build (`.output/server/index.mjs`), the Dockerfile, and
`axioma/deploy/helm/axioma/templates/web.yaml` stay exactly as they are. Guideline Step 10 does not
apply to this project, and Phase 8 is removed from the plan.

**D5 — Pricing figures: RESOLVED — restructure to "talk to us".**
The plan tiers, their positioning, and the feature lists survive. The invented dollar figures do not.
`/pricing` becomes a page that explains what each tier covers and routes to a conversation, so the
polish passes can make it look finished without making a placeholder look authoritative. Real figures
drop into `src/content/pricing.ts` later without a layout change.

**D6 — Third-party skills: RESOLVED — install what the work needs, project scope only.**
Every install runs with the working directory pinned to `axioma/web` and lands under
`axioma/web/.claude/skills/`. Each `SKILL.md` is read before first use, and `git status` from the
repo root confirms nothing landed outside `axioma/web` before work continues. Anything that escapes
the boundary is reverted immediately. Expected installs: `impeccable` (Phase 5, the restyle engine)
and `grill-me` (Phase 1, if the conversational delta-grill is not preferred).

---

## 4. Phased plan

Each phase is independently shippable and independently revertible. Phases 1–2 are prerequisites for
everything after them.

### Phase 0 — Tooling, scoped to this directory

| File | Change |
|---|---|
| `.claude/launch.json` | **Created already.** Dev server entry `web` on port 3010 so the browser tooling can drive the site from this directory. |
| `.claude/skills/` | New. Install target for `impeccable` and, if used, `grill-me` (**D6** resolved: project scope only). |
| `.gitignore` | Add `.claude/skills/` and `.impeccable/` unless the skills are to be committed. Currently 61 B; append only. |

Commands, all run with the working directory pinned to `axioma/web`:

```bash
pnpm dlx skills@latest add mattpocock/skills --skill grill-me
```

```bash
pnpm dlx impeccable install
```

After each install, `git status` from the repo root is checked to prove nothing landed outside
`axioma/web`. Anything that did is reverted before continuing.

### Phase 1 — Context (guideline Step 1)

| File | Change |
|---|---|
| `context/DECISIONS.md` | New. Every decision from the delta-grill, logged with its reasoning, including D1–D6 above once answered. |
| `context/SPEC.md` | New. The aggregate: audience, the six routes and each one's single job, the claims the site is allowed to make, the copy voice, what must be preserved (brand SVGs, shared palette, mailto-only contact, status-page failure behaviour). |
| `context/BUILD_HIGH_END_WEB_APPS_WITH_AI.md` | Unchanged, kept as the source guideline. |

The grill covers the delta only: what exists, what changes, what must not move. `SPEC.md` must
import the claim discipline from `../../context/idea/idea.md` — the marketing site is the most likely
place for an unearned claim to appear.

### Phase 2 — Restructure the baseline (guideline Step 4, reframed)

The goal is that a later restyle pass can change appearance without touching copy, and change copy
without touching appearance.

| File | Change |
|---|---|
| `src/styles.css` | **Split and deleted.** 2,006 lines become the files below. No CSS is rewritten in this phase — it is moved verbatim so the diff stays reviewable. |
| `src/styles/index.css` | New entry point: `@import "tailwindcss"` and `tw-animate-css`, then the partials in cascade order. Referenced from `__root.tsx`. |
| `src/styles/tokens.css` | New. The `@theme` block, `:root` custom properties, `.dark`, `@custom-variant`. This is the file a "small variation" re-tints in Phase 5. |
| `src/styles/base.css` | New. Reset, `@layer base`, typography defaults, `::selection`, skip link, `.sr-only`. |
| `src/styles/primitives.css` | New. `.eyebrow`, `.button`, `.button-light`, `.button-quiet`, `.text-link`, `.tag`, `.live-pill`, `.ledger-index`. |
| `src/styles/layout.css` | New. `.page-frame`, `.page-sheet`, `.shell`, `.site-header`, `.nav-shell`, `.desktop-nav`, `.mobile-nav`, `.site-footer` and the footer grid. |
| `src/styles/sections.css` | New. `.hero`, `.ticket-*`, `.statement`, `.context-map`, `.process`, `.step-grid`, `.device-section`, `.terminal-*`, `.cta-band`, `.flow-*`, `.decision-*`, `.roles*`, `.principle*`, `.about-*`, `.contact-*`, `.status-*`, `.not-found`, pricing. |
| `src/styles/motion.css` | New. The reveal keyframes and both `prefers-reduced-motion` blocks, isolated so Phase 6 has one file to rework. |
| `src/routes/__root.tsx` | Import path changes from `../styles.css?url` to `../styles/index.css?url`. |
| `src/content/home.ts` | New. `steps`, `transcript`, `stages`, `systems` moved out of `index.tsx` with exported types. |
| `src/content/product.ts` | New. The `flow` array and the decision/roles copy. |
| `src/content/pricing.ts` | New. `groups` and the `Plan` type. Per **D5** the `price` / `per` fields are dropped from the type and the data; tier names, positioning notes, and feature lists are kept. |
| `src/content/site.ts` | New. `nav`, `footerColumns`, `CONTACT_EMAIL`, and a new `SITE_URL` constant that Phase 4 needs for canonicals. |
| `src/routes/index.tsx` | Imports its data; keeps `ContextMap`, `TicketVisual`, `Check` as presentation. Drops from 8.9 KB to roughly 4 KB. |
| `src/routes/product.tsx`, `about.tsx`, `pricing.tsx` | Same treatment. |
| `src/components/site.tsx` | Imports `nav` / `footerColumns` / `CONTACT_EMAIL` from `src/content/site.ts`. |
| `components.json` | `tailwind.css` currently points at `src/styles.css`. Repoint to `src/styles/index.css` **before** any shadcn component is added, or the CLI writes tokens into a file that no longer exists. |
| `biome.json` | `files.includes` currently excludes `src/components/ui`. Confirm the new `src/styles/**` is covered by the `**` entry (it is) and no new exclusion is needed. |

Verification for this phase is strict, because it is a pure refactor: the rendered CSS must be
byte-equivalent in effect. `pnpm build` succeeds, then every route is compared against a screenshot
taken before the split.

**D1 lands here.** `src/components/ui/` gains `tabs.tsx` and `dropdown-menu.tsx` (mobile navigation),
and later `toggle-group` (theme toggle). `pricing.tsx` and `site.tsx` are rewritten against them.
`button.tsx` is either wired into the hero and CTA surfaces or deleted — it does not stay unused. The
shadcn token block in `tokens.css` stops being dead weight at this point, because the primitives
consume `--background`, `--foreground`, `--primary`, `--border`, and `--ring`; the `--sidebar-*` and
`--chart-*` groups have no consumer on a marketing site and are deleted.

Additions run through the local skill: `pnpm dlx shadcn@latest add tabs dropdown-menu toggle-group`
with `components.json` already pointing at `src/styles.css` — that path is updated to
`src/styles/index.css` **before** any component is added, or the CLI writes tokens into a file that
no longer exists.

### Phase 3 — Tokens become semantic, dark mode becomes real (guideline Step 7, part 1)

**D2 resolved: ship it.**

| File | Change |
|---|---|
| `src/styles/tokens.css` | Introduce role-named tokens that flip per theme: `--surface-page`, `--surface-raised`, `--surface-sunken`, `--surface-inverse`, `--text-strong`, `--text-body`, `--text-muted`, `--rule`, `--rule-strong`, `--brand`, `--brand-contrast`. Define once for light, redefine under the dark selector. Keep `--color-ink` etc. as *aliases* during migration so nothing breaks mid-way, then delete them at the end of the phase. |
| `src/styles/*.css` (all partials) | Mechanical replacement of ~152 literal-token references with the role tokens. Every replacement is a judgement about role, so this is reviewed section by section, not scripted. |
| `src/styles/sections.css` | `.dark-section` is re-specified. On a light page it stays an inverted band; on a dark page it must become a *contrast* band (raised surface) rather than dark-on-dark. This is the one genuinely tricky piece of the phase. |
| `src/routes/__root.tsx` | Add an inline, render-blocking theme script in `<head>` that sets the theme class from `localStorage` then `prefers-color-scheme`, before first paint. Required to avoid a flash on an SSR page. Add `suppressHydrationWarning` where the class is applied. |
| `src/components/theme-toggle.tsx` | New. Three-state control (light / dark / system) writing `localStorage.theme`, per the Tailwind v4 documented pattern. Placed in the header, and in the footer on mobile. |
| `src/components/site.tsx` | Header renders the toggle; the mobile menu gains it too. |
| `src/styles/tokens.css` | `color-scheme` is set per theme so form controls and scrollbars follow. |
| `public/site.webmanifest` | `theme_color` and `background_color` reconciled with the real palette. |
| `src/routes/__root.tsx` | `theme-color` meta split into a light and a dark variant with `media` attributes, replacing the single `#008236`. |
| `src/routes/__root.tsx` | Google Fonts CDN links removed (the `preconnect` pair and the `css2` stylesheet). Third-party render-blocking request goes away. |
| `src/styles/index.css` | Self-host instead: `@import "@fontsource-variable/instrument-sans"` — the package is already a dependency and has never been imported. |
| `package.json` | Resolve the mono mismatch: either swap `@fontsource-variable/geist-mono` for the Fragment Mono package that `--font-mono` actually names, or change `--font-mono` to Geist Mono. One answer, not two. |
| `src/styles/tokens.css` | `--font-mono` updated to match whichever package wins. |
| `SHADCN_PLAN.md` | Superseded by this document once D1 is executed. Delete, or reduce to a pointer here. |

The existing `@custom-variant dark (&:is(.dark *))` at `styles.css:31` stays valid; it is widened to
`&:where(.dark, .dark *)` so the root element itself is covered.

The mono face is not cosmetic here — it carries the `axel-cli` transcript, the `.eyebrow` labels, the
`.tag` chips, and the `.ledger-index` strips. Changing it changes the site's voice, so the choice is
made deliberately in Phase 5's `typeset` pass if it is not settled before then.

### Phase 4 — Metadata, SEO, and the honest-claims pass

| File | Change |
|---|---|
| `src/lib/seo.ts` | New. A `pageMeta({ title, description, path, image })` helper returning the meta and links array, so every route declares its head the same way. Includes `og:*`, `twitter:card`, and canonical. |
| `src/routes/__root.tsx` | Site-wide defaults only: `og:site_name`, `og:type`, locale, default OG image, `twitter:site`. Per-page values move to the routes. |
| `src/routes/index.tsx`, `product.tsx`, `pricing.tsx`, `about.tsx`, `contact.tsx`, `status.tsx` | Each `head()` switches to `pageMeta(...)`, gaining canonical and social tags. |
| `src/routes/__root.tsx` (NotFound) | Gains a title and `noindex`. |
| `public/og.png` | New. 1200×630 social card built from the brand assets in `public/brand/`. |
| `public/sitemap.xml` | New, static, six URLs. Static is the right call here: the installed `@tanstack/router-core` (1.171) exposes no `server.handlers` route option — that API is newer than this project's pinned version — and this site has no dynamic routes. If a dynamic sitemap is ever needed, the escape hatch is a Nitro server route, not a TanStack route. |
| `public/robots.txt` | Add the `Sitemap:` line. |
| `src/routes/__root.tsx` | Add JSON-LD (`Organization` + `WebSite`) via a script tag in head. |
| `src/content/*.ts` | Copy reviewed against `SPEC.md` claim discipline. Anything the product cannot do today is cut or hedged. |
| `src/content/pricing.ts`, `src/routes/pricing.tsx` | **D5 lands here.** The `.plan-price` block is removed from the card and from `src/styles/sections.css`; each tier ends in a "Talk to us" action instead of a figure. The `Teams` / `Enterprise` toggle survives, since the tiers themselves are real positioning. Page title and lede are rewritten to describe how plans differ rather than what they cost. |

### Phase 5 — Restyle and parallel variations (guideline Steps 5 and 6)

Requires Phase 2 (so a variation can be a `tokens.css` diff) and explicit approval for the git
operations.

1. `/impeccable init` inside `axioma/web` produces `PRODUCT.md` and `DESIGN.md`, seeded from
   `context/SPEC.md` rather than from a blank prompt.
2. Single-discipline passes — `colorize`, `typeset`, `layout` — each reviewed as its own diff.
3. Three worktrees plus the current main, each on its own port:

| Variation | Scope | Files touched |
|---|---|---|
| Small | Re-tint only | `src/styles/tokens.css` |
| Medium | Small, plus a distinctive display face, revised surface/divider stack, new radius rhythm | `tokens.css`, `base.css`, `primitives.css`, `package.json` (font package) |
| Large | New visual world; product truth, routes, and copy unchanged | `src/styles/**`, `DESIGN.md` |

Ports 3011 / 3012 / 3013 via `pnpm dev --port`. The winner is merged; the rest are deleted. Every
git command in this phase is proposed for approval first, per the repo rules.

### Phase 6 — Motion (guideline Steps 8 and 9, in the reduced form of D3)

**D3 resolved: code-driven scroll motion.**

| File | Change |
|---|---|
| `src/styles/motion.css` | Reveal switches from load-time keyframes to scroll-driven: `animation-timeline: view()` with `animation-range`, so each element animates as it enters the viewport. Both `prefers-reduced-motion` blocks are preserved and extended to cover the new timelines. |
| `src/hooks/use-in-view.ts` | New, only if a JS fallback is wanted for browsers without scroll-driven animation support. Small `IntersectionObserver` hook adding an `is-visible` class; the CSS treats it as an alternative trigger. |
| `package.json` | `motion` added **only** if the JS path is chosen over the CSS-first one. Prefer not to add it. |
| `src/routes/index.tsx` | The `axel-cli` transcript gains a scroll-scrubbed line-by-line reveal — the strongest existing moment on the page, and the one that actually encodes something true (a typed timeline). The ticket dossier's stage rail advances with scroll. |
| `src/routes/about.tsx` | Optional scroll-narrative treatment. Only if the design direction from Phase 5 calls for it. |
| `src/styles/motion.css` | A `@supports (animation-timeline: view())` guard keeps the current behaviour as the fallback. |

Deliberately excluded: Higgsfield CLI, generated video assets, `/frames` extraction, canvas frame
scrubbing.

### Phase 7 — Verification gates

| File | Change |
|---|---|
| `package.json` | Add `"check-all": "pnpm check && pnpm build && pnpm check-types"`. Note the existing ordering constraint: the build must run before `tsc` so `routeTree.gen.ts` exists. |
| `.github/workflows/web.yml` | New. On changes under `axioma/web/**`: install, `pnpm check`, `pnpm build`, `pnpm check-types`. Mirrors the existing `contracts.yml` conventions. |
| `context/DECISIONS.md` | Records the manual verification matrix: six routes × two themes × three widths (360 / 768 / 1440), keyboard traversal of header, mobile menu, pricing tabs, and theme toggle, plus reduced-motion on. |
| `README.md` | Document the split stylesheet layout, the `check-all` script, the theme toggle, and the `AXIOMA_API_URL` requirement for `/status`. Currently 553 B and silent on all four. |

### Phase 8 — Deployment: removed

**D4 resolved: skip.** `vite.config.ts`, the `Dockerfile`, and the Helm chart are not modified by any
part of this plan. `README.md` is still updated in Phase 7 to document the new `check-all` script and
the split stylesheet layout.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| The stylesheet split silently changes cascade order and breaks a page. | Move verbatim, no rewrites in Phase 2; screenshot every route before and after; `@import` order in `index.css` matches the original file order exactly. |
| The dark theme reads as a different product rather than the same one at night. | Semantic tokens are defined as a *pair* per role from the start; `.dark-section` is redesigned deliberately rather than inverted mechanically. |
| Impeccable's passes overwrite the editorial identity that already works. | Seed `PRODUCT.md` / `DESIGN.md` from `SPEC.md`; run single-discipline passes and review each as its own diff; never run a broad pass on `main`. |
| Third-party skills execute instructions from outside this repository. | Install into `axioma/web/.claude/skills/` only, read the `SKILL.md` before first use, and verify with `git status` that nothing landed outside `axioma/web`. |
| Placeholder pricing gets polished into looking authoritative. | Closed by **D5**: the figures are removed in Phase 4, before any pass makes the page look finished. |
| Scroll-driven CSS is unsupported in an older target browser. | `@supports` guard keeps the present load-time reveal as the fallback. |
| Git operations for worktrees violate the repo's no-unrequested-writes rule. | Every git command in Phase 5 is proposed and approved before it runs. |

---

## 6. Explicitly out of scope

- `axioma/dashboard`, `axioma/portal`, `axioma/ui`, `axioma/api`, `axioma/agent`, `axioma/cli`.
- The repo-root `.agents/` and `.claude/` directories.
- The Helm chart, the Dockerfile, and `vite.config.ts`'s Nitro output — deployment is untouched (**D4**).
- The status API contract in `axioma/api`.
- Brand SVGs in `public/brand/` — the mark and wordmark are fixed assets.
