# Axiōma — Product Brief for Restyle

> Source: `context/SPEC.md` + `../../context/idea/idea.md` §Claim Discipline. Where they disagree, `idea.md` wins.

## What Axiōma Is

Axiōma is an **IT service management platform with an agent inside it**. An employee opens a ticket (portal, email, messaging). **Axel** — one reasoning surface — reads it, gathers evidence from infrastructure or the employee's laptop via **axel-cli** (typed device actions), applies a fix if one is available, checks it, and either closes the ticket or escalates to a human with the full transcript and evidence.

The service-management half is not a shell: record types, catalogue, change/CAB, problems/known-errors, knowledge base, SLA/OLA against business calendars, CMDB with provenance, rules/workflows, assets, authorization (deny-by-default + capability keys), channels, directory sync. The agent is a participant in that system, same audit trail as a human.

Deployment: **inside the customer's own infrastructure**, one stack per customer, no multi-tenancy. `AXIOMA_API_URL` points the web at the API.

## Audience

- **IT leaders** — CIOs, heads of IT, platform engineering managers. Arrive via search/referral, skim 1–2 pages, want to know what the loop does and where agent/human boundary sits.
- **Employees & IT staff** — read the flow to understand what changes for them.

The site is **read, not used**: no accounts, no posts, no analytics. Every interaction navigates or opens a mail client (`hello@axioma.dev`).

## Six Routes — Each Has One Job

| Route | Job | Proof surfaces |
|---|---|---|
| `/` | Explain the loop in one scroll: symptom → investigation → action/handoff | Ticket dossier (AX-1042) + `axel-cli` terminal transcript |
| `/product` | Walk the ticket flow end-to-end (creation → routing → remediation → closure/escalation) and state tool-order: **typed action → computer-use → human** | Flow list, decision grid, roles grid |
| `/pricing` | Explain what each tier covers / how tiers differ; **every CTA routes to a conversation**. No figures (D5) | Two plan groups (Teams: Pilot/Team/Scale; Enterprise: Enterprise/Self-hosted) with positioning + feature lists |
| `/about` | Why the company exists: diagnosis, action, accountability stay together | Statement grid + 3 principles |
| `/contact` | One address + useful first-email context | `mailto:hello@axioma.dev?subject=…` |
| `/status` | Daily availability per service (90-day strip + 7/30/90 uptime). **Fails closed** to “we could not load” when `AXIOMA_API_URL` unreachable | `statusRouter.readStatus` |

## Claims Allowed (from `idea.md`)

1. **No novelty claims** for triage, remediation, RMM, CMDB. Differentiator is the **working end-to-end loop** across them, in one system.
2. **No performance/savings/accuracy/production-readiness numbers.** No “resolve X%”, no benchmarks, no uptime promises.
3. **No data-residency claims** until inference-location open question answered. Say “inside customer’s own infrastructure” as architecture, not guarantee.
4. **Agent capability = the loop:** reads ticket → gathers evidence → applies available fix → checks → escalates with reasoning. Names commands; does not run arbitrary commands.
5. **Pricing never invents figures.** Tier names/positioning/feature lists survive; dollar figures do not. Real figures later drop into `src/content/pricing.ts`.

If a sentence cannot be traced to `idea.md`, cut or hedge.

## Copy Voice

- Plain, declarative, present tense. One fact per sentence.
- Speaks as “we are connecting…”, names **Axel** (agent) and **axel-cli** (device executor), uses macron `Axiōma` in prose.
- Concrete nouns: “evidence”, “transcript”, “typed action” — not “seamless/powerful/revolutionary”.
- Em-dashes for asides, semicolons sparingly. UK-leaning neutral English.

## Must Be Preserved (non-negotiable)

- **Brand SVGs** `public/brand/` + `src/components/brand.tsx` — mark/wordmark fixed.
- **Shared palette** zinc + brand green (`green-700/800`) matching dashboard/portal — re-tint via tokens, never hand-mix hues.
- **mailto-only contact** — footer subscribe + contact page open mail client, say so, no backend.
- **Status failure behaviour** — `/status` loader `→ null` → `StatusUnavailable` when API down. Never fake availability.
- **Editorial layout** `page-frame`/`page-sheet` on veil, rounded panels, mono ledger strips, pill buttons — evolve, don’t replace with generic template.
- **Accessibility baseline** — skip link, `aria-current`, labelled SVGs, `prefers-reduced-motion`, keyboard via Radix (`tabs`, `dropdown-menu`, `toggle-group`).
- **Product truth** — routes and copy unchanged across variations; only `src/styles/**` (and `DESIGN.md`) may change in Large. Pricing tiers real, figures absent.

## What Changes in a Restyle

Only appearance. No new routes, no copy changes outside `src/content/*`, no deployment changes (Nitro/Dockerfile/Helm untouched per D4). Each discipline pass is its own diff:

- `colorize` → `tokens.css` only
- `typeset` → `tokens.css` + font package + `base.css`/`primitives.css` rhythm
- `layout` → surfaces/dividers/radius + `layout.css`/`sections.css` grid
