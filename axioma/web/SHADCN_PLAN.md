# Plan: Add shadcn/ui to `axioma/web` — Clean, Seamless Integration

> Research via **Context7 MCP** (`/shadcn-ui/ui` + `/websites/ui_shadcn` — Vite + Tailwind v4 + TanStack Start docs) + full audit of current `web/` codebase. **No code executed yet — plan for review.**

---

### 0. Research Summary (Context7)

Sources queried: Vite install (`/shadcn-ui/ui: vite.mdx`), `vite.config.ts` template (`templates/vite-app`), `tsconfig.json` alias, `components.json` schema, Tailwind v4 CSS variables + `@theme inline` + `@custom-variant dark`, `cn` utility, TanStack Start install (`/websites/ui_shadcn: installation/tanstack`).

**Canonical shadcn Vite+Tailwind v4 setup (official):**

1. `tailwindcss` + `@tailwindcss/vite` already present → *skip reinstall*.
2. `vite.config.ts` must define `resolve.alias.@ → ./src` via `path` + `import "path"` — requires `@types/node` (`/shadcn-ui/ui: vite.mdx`).
3. `tsconfig.json` needs `compilerOptions.baseUrl: "."` + `paths: {"@/*": ["./src/*"]}` (also `tsconfig.app.json` if split — not our case).
4. `npx shadcn@latest init` generates `components.json` (style, `cssVariables: true`, `tailwind.css`, aliases, `iconLibrary: lucide`).
5. Global CSS must add:
   ```css
   @import "tailwindcss";
   @import "tw-animate-css";
   @custom-variant dark (&:is(.dark *));
   @theme inline { --color-background: var(--background); ... --radius-*: ... }
   :root { --background: oklch(...) ... --radius:0.625rem }
   .dark { --background: oklch(...) }
   @layer base { * { @apply border-border outline-ring/50 } body{ @apply bg-background text-foreground } }
   ```
   (`/websites/ui_shadcn: installation/manual`).
6. `src/lib/utils.ts` → `cn(...inputs)` via `clsx` + `twMerge` (`/websites/ui_shadcn: manual`).
7. TanStack Start is supported explicitly: `pnpm dlx shadcn@latest init -t start` for *new* projects, manual steps for *existing* projects with `rsc: false, tsx: true` (`/websites/ui_shadcn: installation/tanstack`). Do **not** select `shadcn` add-on in `tanstack/cli create` — init later.

---

### 1. Current State Audit — Why Careful Merge Is Needed

| File | Current | Risk if Naïve `shadcn init` |
|------|---------|------------------------------|
| `vite.config.ts:9` | `plugins: [tailwindcss(), tanstackStart(), nitro(), react()]` — no alias, no `path` import. Plugin order matters for Start+Nitro. | `shadcn init` would overwrite plugin order or duplicate `tailwindcss`. |
| `tsconfig.json:3` | No `baseUrl`/`paths`, single file (no `tsconfig.app.json`). | Alias `@` will fail for `tsc --noEmit` + Vite until added. |
| `src/styles.css:1-13` | `@import "tailwindcss"` + **single `@theme` with Axioma tokens** (`--color-floor:#d4dce6`, `--color-card:#eef3f7`, `--color-ink:#15202b`, `--color-panel:#163544`, `--color-signal:#0f7c78`, `--color-brass:#c56a1c`, fonts). `:root` is `light` only, no shadcn variables, no `@theme inline`, no `tw-animate-css`. 1122 LOC of semantic classes (`.page-frame`, `.ticket-visual`, `.terminal` etc.) | Overwriting with shadcn template would **delete brand palette** and break layout. Must *merge*, not replace. |
| `src/components/site.tsx` | Hand-rolled nav, no `cn()`, no shadcn components. | No conflict, but future shadcn components will expect `cn` + alias. |
| No `components.json`, no `src/lib/utils.ts` | Missing required shadcn config. | `shadcn add` will fail. |
| `package.json` | No `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css`. Has `@types/node:26.2.0` already (good). | Missing deps = runtime error. |

**Design Principle:** Preserve Axioma visual identity. shadcn tokens become *semantic layer* (background/foreground/border/ring/primary) **mapped to Axioma hex/oklch**, not replacement. Existing `.button`, `.ticket-visual` etc. stay untouched; shadcn components coexist via `.border-border`, `bg-background` utilities.

---

### 2. Target Architecture

```
web/
├── components.json          NEW — shadcn CLI config (style default, cssVariables true)
├── vite.config.ts           MOD — add alias "@" via path, preserve plugin order
├── tsconfig.json            MOD — baseUrl + paths @/*
├── src/
│   ├── styles.css           MOD — append (not replace) shadcn Tailwind v4 theme block
│   ├── lib/utils.ts         NEW — cn() helper
│   ├── components/ui/       NEW (future) — generated per `pnpm dlx shadcn add button card ...`
│   └── components/site.tsx  MOD (later, optional) — migrate .button → <Button />
```

**Decisions proposed (need your confirmation §7):**

* `style`: `default` (Tailwind v4 recommended) — alternative `new-york` is also valid. Docs show `default` for TanStack/Vite.
* `baseColor`: `neutral` (closest to Axioma grayscale) — **not** `zinc/slate`; CSS variables will override anyway.
* `cssVariables: true` (required for theming Axioma palette).
* `iconLibrary: lucide` (shadcn default).
* No `tailwind.config.js` — Tailwind v4 is CSS-first (`tailwind.config: ""`).

---

### 3. Detailed File-by-File Change Plan

#### A. `package.json` — Add dependencies (no removal)

```diff
 dependencies: add
   "class-variance-authority": "^0.7.0",
   "clsx": "^2.x",
   "lucide-react": "^0.x",
   "tailwind-merge": "^2.x"
   // tailwindcss already 4.3.3, @tailwindcss/vite already 4.3.3, keep
 devDependencies: add
   "tw-animate-css": "^1.x"  // required for @import "tw-animate-css" per docs
 // @types/node already 26.2.0 — verified, no change
 // No @types/node reinstall needed but keep if init prompts
```
Install cmd (pnpm — project uses `pnpm@11.24.0`):
```sh
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add -D tw-animate-css
```

#### B. `vite.config.ts` — Add alias, keep plugin order

*Full diff:*

```ts
import path from "path"; // NEW — requires @types/node already present
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 3000 },
  plugins: [tailwindcss(), tanstackStart(), nitro(), react()], // KEEP order — plugin/2023 fix
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```
**Why not `react(), tailwindcss()` order from docs?** Docs template is vanilla Vite. TanStack Start docs *explicitly* keep `tailwindcss()` first + `tanstackStart()` before `nitro()` — verified in `vite.config.ts:9`. We preserve that.

#### C. `tsconfig.json` — Add path mapping

```diff
 {
   "include": ["**/*.ts", "**/*.tsx"],
   "compilerOptions": {
     "target": "ES2022",
+    "baseUrl": ".",
+    "paths": {
+      "@/*": ["./src/*"]
+    },
     "jsx": "react-jsx",
     ...
   }
 }
```
No `tsconfig.app.json` exists — add to root `tsconfig.json` only (per Context7: "add to tsconfig.json and tsconfig.app.json *if* split").

#### D. `components.json` — NEW file (root: `web/components.json`)

Per `installation/manual.mdx` + `components-json.mdx`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```
**Justification:** `rsc:false` per Vite/TanStack manual (not Next.js). `tailwind.css: "src/styles.css"` — we reuse existing file, not `src/styles/globals.css`. `config: ""` — Tailwind v4 no JS config.

#### E. `src/styles.css` — Surgical merge (MOST CRITICAL)

**Do NOT replace file.** Keep lines `1: @import "tailwindcss"` + `3-13 @theme Axioma` + `15-1122` custom CSS. Insert shadcn block **after** existing `@theme` and **before** `:root`.

*Proposed insertion (after line 13):*

```css
@import "tailwindcss";
@import "tw-animate-css"; /* NEW per manual */

@theme {
  --font-sans: "IBM Plex Sans", ...;
  --color-floor: #d4dce6;
  /* ... existing Axioma tokens — KEEP */
}

/* ---- NEW: shadcn Tailwind v4 tokens ---- */
@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  /* Preserve Axioma brand as additional tokens — not inline-mapped, stays as --color-* */
}

:root {
  --radius: 0.625rem;
  /* Map shadcn semantics → Axioma palette (oklch from hex) */
  --background: oklch(0.89 0.02 245); /* #d4dce6 floor */
  --foreground: oklch(0.20 0.02 230); /* #15202b ink */
  --card: oklch(0.96 0.01 230);       /* #eef3f7 card */
  --card-foreground: oklch(0.20 0.02 230);
  --popover: oklch(0.96 0.01 230);
  --popover-foreground: oklch(0.20 0.02 230);
  --primary: oklch(0.32 0.06 200);   /* #163544 panel */
  --primary-foreground: oklch(0.96 0.01 230);
  --secondary: oklch(0.92 0.01 230);
  --secondary-foreground: oklch(0.20 0.02 230);
  --muted: oklch(0.92 0.01 230);
  --muted-foreground: oklch(0.55 0.02 230); /* #5a6976 */
  --accent: oklch(0.55 0.08 180);    /* #0f7c78 signal */
  --accent-foreground: oklch(0.98 0 0);
  --destructive: oklch(0.62 0.20 25);
  --border: oklch(0.80 0.02 230);    /* #aebaca */
  --input: oklch(0.80 0.02 230);
  --ring: oklch(0.55 0.08 180);      /* signal */
  --chart-1: oklch(0.55 0.15 45);
  --chart-2: oklch(0.60 0.12 185);
  /* ... charts 3-5, sidebar vars as per shadcn defaults or Axioma neutrals */
  --sidebar: oklch(0.98 0 0);
  --sidebar-foreground: oklch(0.20 0.02 230);
  /* ... rest from manual */
  /* KEEP existing :root props below — move them here or merge: */
  color-scheme: light;
  font-family: var(--font-sans);
  color: #15202b;
  background: #d4dce6;
}

.dark {
  /* Provide dark even though site is light-only — prevents flash if .dark added later */
  --background: oklch(0.20 0.02 230);
  --foreground: oklch(0.96 0.01 230);
  /* ... full dark per manual, mapped subtly */
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```
**Then keep** `*`, `html`, `body`, `a`, `.page-frame` etc. unchanged after. Remove duplicate `body { background: #d4dce6 }` if `@layer base` now handles it — keep but ensure no specificity clash (body `@apply` wins).

**Alternative if oklch conversion is premature:** Use hex directly in `--background: #d4dce6` — valid CSS, Tailwind v4 supports it. But shadcn manual uses `oklch` for wider gamut; propose `oklch` but note we can use hex during init and migrate later. Your choice.

#### F. `src/lib/utils.ts` — NEW

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
From `/websites/ui_shadcn: utils`.

#### G. `biome.json` — Optional but recommended

Add ignore for generated UI:
```diff
 "files": {
   "includes": ["**", "!**/.output", "!**/dist", "!**/node_modules", "!**/routeTree.gen.ts"]
+  // optionally: "!src/components/ui/**" to avoid linting shadcn generated code
 }
```
Not required but avoids Biome style churn on `cva` components.

#### H. No change needed

* `src/router.tsx`, `src/routes/__root.tsx:35 { rel:"stylesheet", href: styles }` — still works, now points to augmented `styles.css`. No rename to `globals.css`.
* `public/favicon.svg` — untouched.
* No `tailwind.config.js` creation — Tailwind v4 is CSS-configured.

---

### 4. Initialization & Verification Sequence

**Phase 1 — Prepare (manual, no CLI overwrite):**

```sh
cd web
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add -D tw-animate-css
# @types/node already present — if missing: pnpm add -D @types/node
```

Edit `vite.config.ts` + `tsconfig.json` per §3 B/C (commit).

**Phase 2 — Generate `components.json` + `utils`:**

Option A — *manual* (safer, avoids CLI overwriting `styles.css`):
* Create `components.json` + `src/lib/utils.ts` by hand per §3 D/F, then edit `styles.css` per §3 E.

Option B — *CLI-assisted* (if you prefer `init`):
```sh
pnpm dlx shadcn@latest init -d
# init will prompt: style=default, baseColor=neutral, cssVariables=true
# It will try to overwrite src/styles.css — answer NO or diff carefully, then apply §3 E manually.
```
**Recommendation:** Option A for this repo — full control, preserves Axioma tokens.

**Phase 3 — Smoke test:**

```sh
pnpm check        # Biome
pnpm check-types  # tsc --noEmit after vite build (routeTree.gen.ts regenerates)
pnpm build        # vite build → .output/server/index.mjs
pnpm dev          # visual check: header still #d4dce6, feed-rail intact
pnpm dlx shadcn@latest add button --yes --overwrite  # test generation: creates src/components/ui/button.tsx with @/lib/utils import
pnpm build && pnpm check-types # verify alias + CVA compiles
git status # expect new: components.json, src/lib/utils.ts, src/components/ui/button.tsx
```

**Phase 4 — Optional pilot migration (not in this plan's scope, but ready):**

* Replace `components/site.tsx:239 .button` with `<Button>` (variant `default` → maps to `--primary: #163544`, variant `outline` etc.)
* Replace `contact.tsx` card with `<Card><CardContent>`.

Keep old `.button` CSS during transition — shadcn `Button` uses `bg-primary text-primary-foreground`, which will now resolve to Axioma palette due to our mapping.

---

### 5. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Plugin order break** | Preserve `[tailwindcss(), tanstackStart(), nitro(), react()]` — verified against TanStack docs. Test `pnpm build`. |
| **Brand color loss** | Merge `@theme` blocks, don't replace. Map shadcn vars to Axioma hex/oklch. Keep `--color-floor/card/ink/panel/signal/brass` tokens. |
| **Alias failure** | Update both Vite + TSConfig simultaneously. `tsc --noEmit` will catch before runtime. |
| **Biome churn** | Exclude `src/components/ui` or run `biome check --write` only after. |
| **`shadcn init` overwrite** | Use manual creation or `init -d` with dry-run/diff; never blindly accept stylesheet overwrite. |
| **SSR/Nitro mismatch** | `rsc:false` — TanStack Start SSR but not RSC. No server component import. |

---

### 6. Decisions Needed Before Execution

1. **Style:** `default` (recommended, neutral, supports v4 best) vs `new-york` (more opinionated). 
2. **BaseColor:** `neutral` (proposed) vs `zinc`/`slate`/`stone` — cosmetic only since we override vars to Axioma palette.
3. **Color mapping:** Accept `oklch` conversion (modern, per shadcn) or keep hex in vars for simplicity?
4. **Dark mode:** Currently `light` only. Add full `.dark` vars now (future-proof) or postpone until needed? Plan includes `.dark` skeleton.
5. **CLI mode:** Manual hand-create `components.json` (cleanest) vs running `pnpm dlx shadcn init` interactively?
6. **First component set:** `button`+`card`+`input` for immediate use, or just scaffold infra and add per-need?

**Please confirm 1-6** (or `approve as proposed` for defaults: `default`+`neutral`+`oklch`+include dark+manual). Then we execute in one clean sequence: deps → `vite.config.ts` → `tsconfig.json` → `components.json` → `styles.css` merge → `utils.ts` → `shadcn add button` smoke → `pnpm build` verification.
