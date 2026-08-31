# Build High-End Web Apps with AI — Universal Guidelines

> Extracted from *"Stop Building AI Slop – Build High-End Web Apps with AI."*
> Step-by-step workflow applicable to **new** and **existing** projects.

---

## Core Principles

1. **Never start from a blank prompt** — clone proven, battle-tested UI architectures.
2. **Context beats guessing** — feed AI a rigorous spec or it invents features/styles.
3. **Use specialized skills**, not one giant prompt.
4. **Iterate in parallel** — generate variations, pick the best, discard the rest.
5. **Motion + polish = "high-end"** — scroll animations and token-consistent styling separate premium apps from AI slop.

---

## Step 1 — Collect Context (Spec-Driven Development)

**Goal:** Produce `DECISIONS.md` + `SPEC.md` before writing any code.

```bash
npx skills add https://github.com/mattpocock/skills --skill grill-me
```

1. Run `/grill-me` in Claude Code.
2. Give a simple brain-dump (e.g., "I want to build an investor tracker for financial influencers").
3. Let AI interview you **one question at a time**: target user, mock data, tech stack, V1 scope.
4. Output:
   - `DECISIONS.md` — every decision logged (prevents context loss at 30–100 questions deep)
   - `SPEC.md` — aggregated summary of all decisions

> **Existing projects:** grill on the delta — what exists, what changes, what must be preserved.

---

## Step 2 — Find a Proven UI Architecture to Clone

**Goal:** Borrow UX that already has users, revenue, and validated conversion.

- **Option A:** A live app you already use whose layout fits your niche (e.g., CoinMarketCap → creator dashboard).
- **Option B:** Template galleries (e.g., **Vercel Templates** — Next.js Commerce, etc.), which ship working demos + source repos.

**Rule:** If an app has millions of daily users, don't reinvent its wheel — replicate the layout, customize later.

---

## Step 3 — Deep Research & Pixel-Perfect Clone

**Goal:** 1:1 cloned baseline using the original's actual open-source libraries.

Prompt Claude Code with the target URL(s) and trigger the built-in `/deep-research` skill:

```
Clone [url] — homepage + detail pages. Replicate layouts, assets, charts,
typography pixel-perfect. Deep-research which UI/component libraries they use
and reuse those open-source components. Stack: React. Keep it simple.
/deep-research
```

- Saves massive time vs. rebuilding components from scratch.
- Result: a working clone (navbar, tables, charts, detail pages, dark/light mode).

---

## Step 4 — Embed Your Context (Clone → V1)

**Goal:** Merge your spec with the cloned architecture.

1. Copy the clone to a new folder (e.g., `web-1.0`).
2. Re-run spec-driven development using `SPEC.md` / `DECISIONS.md`.
3. **Keep** the cloned UI components and structure.
4. **Replace** names, data models, routes, and logic with your domain (e.g., coins → influencers, tickers → creator calls).

---

## Step 5 — Restyle with Impeccable

**Goal:** Stop it looking like a clone; give it a unique design language.

```bash
npx skills add https://github.com/pbakaus/impeccable
```

**Impeccable roadmap:**

| Phase | Commands |
|---|---|
| Start | `/impeccable init`, `/impeccable shape` |
| Iterate | `/impeccable live`, `colorize`, `typeset`, `layout`, `bolder/quieter`, `critique` |
| Polish | `audit`, `clarify`, `harden`, score it, rewrite copy, stress-test |
| Maintain | Consolidate drift, re-capture the system |

- **New projects:** `/impeccable init` → creates `PRODUCT.md` + `DESIGN.md`.
- **Existing projects:** `/impeccable live` or single-discipline passes (`colorize`, `typeset`, `layout`).
- The detector runs after every UI file edit to auto-refine components.

---

## Step 6 — Parallel Variations via Git Worktrees

**Goal:** Generate competing designs without file conflicts.

Fork into separate worktrees (one agent per branch), each running on its own port:

| Variation | Scope |
|---|---|
| **Small** | Re-tint `tokens.css` only — ownable accent colors, same layout. Near-zero regression risk. |
| **Medium** | Small + distinctive typeface, new surface/divider stack, revised radius/border rhythm. "Stops being a clone, gets a POV." |
| **Large** | New visual world — re-lay pages, replace `DESIGN.md`; keep product truth (data, routes, copy). |
| **Surprise** | Let the AI freestyle a 4th option. |

1. Run all versions on different ports side by side.
2. Pick the winner.
3. Merge its worktree into `main`; delete the rest.

---

## Step 7 — Polish & Consistency Pass

**Goal:** Eliminate hardcoded styles and contrast bugs.

- Hunt for off-theme colors (e.g., leftover purple) → replace with **design tokens**.
- Screenshot issues → prompt AI: "Improve dark-mode contrast and accessibility; make all pages reference design tokens consistently."
- Verify every page, both themes.

---

## Step 8 — Generate Motion Assets (Higgsfield AI)

**Goal:** Custom cinematic/3D video assets for scroll animations.

```bash
npm i -g @higgsfield/cli
higgsfield auth login
npx skills add higgsfield-ai/skills
```

1. **Reference:** find a motion-inspiration video (Pinterest, product ads).
2. **Frame analysis:** prompt your agent to break it into `/frames` JPEGs + `frame-analysis.md`.
3. **Storyboards:** `/higgsfield generate` → 2×3 grid storyboard sheets for your concept.
4. **Final video:** generate with **Seedance 2.5**, 15–20s, 1080p.
5. **Trim** unwanted end frames.

---

## Step 9 — Apple-Style Scroll-Driven Page

**Goal:** Turn the video into a scroll-synced landing/About page.

1. Add the `animated-website-skill` to `.agents/skills`.
2. Run:

```
/animate-website
Video: /path/to/trimmed.mp4
Target: /path/to/web
Generate a scroll-driven /about route: frames synced to scroll position,
text overlays, and CTA sections.
```

Result: 60fps canvas-rendered animation where visuals react to scroll (like Apple product pages).

---

## Step 10 — Deploy to Cloudflare Pages

**Goal:** Free live hosting, no CI/CD or public repo required.

```bash
npx wrangler login
npm --prefix web run build
npx wrangler pages deploy web/dist --project-name <your-app>
```

→ Live at `https://<your-app>.pages.dev`.

---

## Quick Reference: New vs. Existing Projects

| Step | New Project | Existing Project |
|---|---|---|
| Context | Full `/grill-me` session | Grill the delta only |
| Clone | Clone external app/template | Skip — use current UI as baseline |
| V1 | Embed context into clone | Restructure per spec |
| Restyle | `/impeccable init` | `/impeccable live` / passes |
| Worktrees | From V1 | From current `main` |
| Motion + Deploy | Same for both | Same for both |

---

## The 5-Pillar Recap

1. **Collect Context** — `grill-me` → `DECISIONS.md` + `SPEC.md`
2. **Clone Proven UI** — battle-tested app/template as baseline
3. **Embed Context into V1** — wire in your domain logic
4. **Restyle & Polish** — Impeccable + Git worktrees for variations
5. **Add Motion & Deploy** — Higgsfield AI scroll animations → Cloudflare Pages