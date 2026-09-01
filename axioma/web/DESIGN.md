# Axiōma Web — Design Direction

> Editorial, not templated. Seeded from `context/SPEC.md` §Must be preserved + `src/styles/tokens.css`.

## Identity

**Editorial dossier on a veil field.** A floating `page-sheet` (`surface-page: veil 0.967 light / ink 0.141 dark`) inset on a veil page, with `nav-shell` and `footer-panel` as rounded white (`surface-raised`) cards. Ledger strips (`ledger-index`) read as filing labels; `eyebrow` / `tag` / `live-pill` carry mono voice. Buttons are pill (`--edge-pill: 999px`), panels `clamp(20px,2.2vw,32px)`, cards `clamp(14px,1.3vw,20px)`. Ink runs deep (zinc 0.141–0.37), green is the only accent.

**Preserved:** `page-frame`/`page-sheet`/`shell` max 1320px, `gutter` fluid, `brand` green-700/800 matching dashboard/portal, `wordmark-logo` 26px, mono ledger strips, pill buttons. Retints happen via `tokens.css` only.

## Palette — Semantic Roles (flip per theme)

Raw palette (`@theme`) is private — `veil #f4f4f5`, `paper #fff`, `ink #09090b/0.141`, `slate 0.37`, `lead 0.55`, `brand 0.527/150deg`, `rule-soft 0.92`. No component touches raw outside `tokens.css`.

| Role | Light | Dark | Use |
|---|---|---|---|
| `surface-page` | `veil 0.967` | `ink 0.141` | `body`, `page-sheet`, `site-header` bg |
| `surface-raised` | `paper 1` | `ink-raised 0.21` | `nav-shell`, `ticket-visual`, `pricing-panel`, `flow li`, `step cards` |
| `surface-soft` | `veil 0.967` | `ink-soft 0.274` | `tag`, `theme-toggle`, `pricing plan cards`, `status-card`, `footer-panel` |
| `surface-sunken` | `0.939` | `0.165` | sunken wells (if needed) |
| `surface-inverse` | `ink 0.141` | `ink-raised 0.21` | `button` (primary), `nav [aria-current]`, `cta-inner`, `terminal`, featured pricing card |
| `surface-inverse-raised` | `ink-raised 0.21` | `ink-soft 0.274` | decision-grid cards, map nodes |
| `text-strong` | `ink 0.141` | `white 0.985` | headings, `ledger-index` last span |
| `text-body` | `slate 0.37` | `0.871` | body, `tag` text, plan features |
| `text-muted` | `lead 0.55` | `0.705` | ledes, `pricing-sub`, `ticket-topline`, `contact-chip` |
| `text-inverse` | `paper 1` | `white 0.985` | text on `surface-inverse`, `dark-section h2`, `terminal` |
| `text-inverse-muted` | `lead-light 0.705` | `0.705` | muted on dark |
| `rule` | `rule-soft 0.92` | `12% white` | dividers, `plan-toggle` track, card borders |
| `rule-inverse` | `10% white` | `16% white` | dividers on dark (`dark-section`, `terminal`) |
| `brand` | `0.527/150deg` | same | accent, `wordmark`, `::selection`, `eyebrow` |
| `brand-soft` | `0.723` | `0.723` | soft brand on dark |
| `brand-tint` | `8%` | `18%` | `eyebrow`, `ticket-note` bg |
| `brand-contrast` | `paper 1` | `0.982` | text on brand |

**Dark rule:** `.dark-section > .shell` is `surface-inverse` + `1px rule-inverse` — inverted band on light (veil vs ink), **raised contrast band** on dark (`0.21` vs page `0.141`, not dark-on-dark). Fixed-light controls (`button-light`, featured plan button, map source pill) stay `paper` bg + `ink` text both themes — they live on dark panels.

**Manifest/theme-color:** `site.webmanifest` `theme_color`/`background_color` `#f4f4f5` (light veil); `__root.tsx` emits two `theme-color` metas `media` light `#f4f4f5` / dark `#09090b`.

## Typography

- **Sans/Display:** `Instrument Sans Variable` (`@fontsource-variable/instrument-sans`, self-hosted, no CDN). `--font-sans` + `--font-display` same stack — display is sans at `700` with tight `letter-spacing -0.045em`. Hero `clamp(44px,6.2vw,84px)/0.98`, page-intro `clamp(40px,5.6vw,76px)`, section `clamp(30px,3.9vw,52px)/1.02`, device `clamp(28px,3.4vw,44px)`.
- **Mono:** `Geist Mono Variable` (`geist-mono`) — carries `axel-cli` transcript, `eyebrow` `10.5px/0.12em`, `ledger-index` `10px/0.12em`, `tag` `9.5px/0.1em`, `flow-index` `11px`. Voice: filing labels, not decoration.
- **Scale:** fluid `clamp(14px–32px)` edges, `panel-pad` `clamp(28px,5vw,72px)`, `gutter` `clamp(12px,1.6vw,24px)`. Body `max-width 560px` ledes, `text-body` `16–18px/1.6`.
- **Voice:** mono strips label, sans carries facts. No display serif in base — Medium may introduce one.

## Layout & Surfaces

- **Frame:** `page-frame min-height:100svh` → `page-sheet` (veil) → `shell` (min `100% - 2*gutter`, 1320px). `site-header sticky top gutter`, `nav-shell h68` (60 mobile) flex `space-between`, `desktop-nav` pills (`aria-current` = `surface-inverse`/`text-inverse`).
- **Sections:** `hero` 1.02fr/0.9fr → single col at 980px; `ticket-visual` 560px max; `statement-grid` 1.05/0.95; `step/principle/decision/roles` 3-col → 2 at 1080 → 1 at 720, `device-section` 0.9/1.1 → 1 col at 980; `pricing` 3-col (`is-2` → 2) → 1 at 720; `flow li` `56px|1fr|1fr` → 48px|1fr at 980.
- **Footer:** `site-footer` brand-green band `pad clamp(16px,2.4vw,32px) top`, `footer-panel` soft veil inset `32/64` pad, `footer-top` 1fr/1.05fr → 1 col at 980, `footer-logo` oversized bleed `margin -0.6*pad-x` + `mb -4.542%` to cancel viewBox descent.
- **Motion gating:** `@media (prefers-reduced-motion: no-preference)` → `@supports (animation-timeline: view())` scroll-driven `animation-range entry 12% cover 28%` + hero `entry 0% cover 20-28%`; fallback `forwards` with `nth-child` delays 80–540ms; `reduce` → `0.001ms` + `animation-timeline:auto`.

## Components

- `eyebrow` pill mono 10.5px/0.12em `brand-tint`/`brand`; `button` 52px pill `surface-inverse`/`text-inverse` hover `surface-inverse-hover`; `button-light` **fixed** `paper`/`ink` (not semantic) for dark panels; `text-link` 52px pill transparent + `rule` border hover `brand`; `tag` soft/muted mono; `live-pill` brand outline; `ledger-index` `surface-raised`/`text-muted` mono.
- `terminal` `surface-inverse`/`text-inverse` with `rule-inverse` bar, `status-dot` `brand-soft`, `dots` `rule-inverse`, `code` grid `62px|1fr|auto`, `terminal-time` `text-muted`, `prompt` `text-inverse`, `muted` `text-inverse-muted`, `accent` `brand-soft`.
- `pricing-toggle` segmented `rule` track `5px` pad + `surface-raised` active; `plan-card` `surface-soft` (featured `surface-inverse`/`text-inverse`), `plan-icon` `surface-raised`/`text-strong` (featured brand/contrast), `plan-badge` brand/contrast.

## What a Restyle May Change

- **Small** — `tokens.css` only: re-tint palette, adjust `radius`/`edge-*`, keep faces.
- **Medium** — + distinctive display face (add `@fontsource` package, swap `--font-display`), revised `surface`/`rule` stack, new radius rhythm, touch `base.css`/`primitives.css`.
- **Large** — `src/styles/**` + `DESIGN.md`: new visual world, editorial frame preserved, product truth/copy unchanged.

No new hues hand-mixed; all via tokens. No new routes. Pricing stays figure-free.
