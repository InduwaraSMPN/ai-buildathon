# Axiōma Web relaunch plan

**Document role:** The plan for relaunching the public site: research basis, design system, per-route content, components, implementation order, verification.
**Related:** [SPEC.md](../../axioma/web/context/SPEC.md) for what the site may say · [DECISIONS.md](../../axioma/web/context/DECISIONS.md) for the decision log this plan extends (D17–D21) · [idea.md](../idea/idea.md) for product truth and the Claim Discipline · [demo-plan.md](demo-plan.md) for the runs the hero replays.
**Status:** Planned 2026-09-05, not yet implemented.

## Context

`axioma/web` is the public site for Axiōma, an IT service management platform with an agent (Axel) inside it. The site today sells a thin slice of the product in an "editorial dossier" style (Fraunces serif, warm veil, ledger strips, eyebrows, ↗ arrows) that reads as outdated. An audit found the copy is disciplined but incomplete: no refusal story, no platform breadth, no governance, no honest limits, no numbers of any kind, a pricing page with invented SaaS quotas that contradict the one-stack-per-customer architecture, a tier-2 "computer-use" claim that the product refuses on every device, a bitmap-font `og.png`, and every CTA ending at a mailto with no explanation of what happens next.

Goal: relaunch the site so it (1) matches the product as built, (2) shows impact with attributed third-party research and an editable estimate, (3) hooks a sceptical IT buyer with proof (two real run transcripts, one fix and one refusal) rather than adjectives, and (4) stays inside the repo's claim discipline: no performance, savings, or accuracy claims *about Axiōma*.

Decisions already taken: visual direction **Proof first**; pricing becomes three figure-free **deployment packages**; research shown as **sourced benchmarks plus an interactive estimate** on a new `/impact` route with governance docs amended; CTA stays **mailto only**, copy "Start a shadow-mode pilot".

## Research basis (collected 2026-09-05)

Every number on the site must trace to a row here (or to `facts.ts`, see below). Grades decide the wording: "peer-reviewed study" only for that grade; vendor rows say "industry survey".

| # | Claim usable on the site | Figure | Source | Grade |
|---|---|---|---|---|
| R1 | Workplace computer users lose 42–43% of computer time to frustrating experiences (time to fix + time to recover lost work); 50-user time-diary study | 42.7–43.7% | Lazar, Jones & Shneiderman (2006), *Behaviour & Information Technology* 25(3) | Peer-reviewed |
| R2 | One-third to one-half of computer time lost to frustrating experiences | 33–50% | Ceaparu, Lazar, Bessiere, Robinson & Shneiderman (2004), *Int. J. Human-Computer Interaction* | Peer-reviewed |
| R3 | AI assistance raised support-agent productivity (issues resolved per hour) 14% on average, 34% for novices; 5,179 agents | +14% / +34% | Brynjolfsson, Li & Raymond, "Generative AI at Work", *QJE* 140(2), 2025 (NBER w31161) | Peer-reviewed |
| R4 | Consultants with GPT-4 finished 12.2% more tasks 25.1% faster at >40% higher quality inside the AI's frontier, but were 19 points less likely to be correct on a task outside it | 12.2% / 25.1% / −19 pp | Dell'Acqua et al., "Navigating the Jagged Technological Frontier", *Organization Science* (2025); HBS WP 24-013 | Peer-reviewed |
| R5 | Across 20 Microsoft online-service systems (2017–2020), 70.2% of time-to-mitigate is spent after the right team is found; initial triage 15.4%, reassignment 14.4%; customer-reported incidents take longest because reporters describe symptoms | 70.20% / 15.42% / 14.38% | Wang et al., "How Long Will it Take to Mitigate this Incident for Online Service Systems?", ISSRE 2021 | Peer-reviewed |
| R6 | Incident reassignment is common (4.11%–91.58% of incidents per system) and raises triage time by up to 10.16× | up to 10.16× | Chen et al., "An Empirical Investigation of Incident Triage for Online Service Systems", ICSE-SEIP 2019 | Peer-reviewed |
| R7 | LLMs evaluated on 40,000+ Microsoft production incidents for root-cause and mitigation recommendation; incident owners rated them useful | 40,000+ | Ahmed et al., ICSE 2023, "Recommending Root-Cause and Mitigation Steps for Cloud Incidents using LLMs" | Peer-reviewed |
| R8 | LLM-based on-call RCA reached 76.6% root-cause accuracy on a year of Microsoft incidents | 76.6% | Chen et al., "Automatic Root Cause Analysis via LLMs for Cloud Incidents", EuroSys 2024 | Peer-reviewed |
| R9 | Fully loaded cost per ticket: self-help ≈$2, level-1 service desk ≈$22, desktop support ≈$70, level-3 IT ≈$100, field ≈$220, vendor ≈$600 (North America, 2019); desktop support avg $62 (range $27–$490) in 2010 | $2 → $600 | MetricNet "Metrics Unleashed: Shift-Left" (2020); Rumburg, HDI "Metric of the Month: Cost per Ticket" (2011) | Independent benchmark |
| R10 | Desktop-support ticket volume 0.41 (healthcare) to 1.14 (business services) tickets per seat per month; 5.4–28.4 technicians per 1,000 seats | 0.4–1.1 / seat / month | Rumburg, HDI "Metric of the Month: Tickets per User per Month" (2012) | Independent benchmark |
| R11 | Password/access issues are 20–50% of help-desk calls (Gartner); one help-desk password reset ≈$70 fully loaded (Forrester) | 20–50% / $70 | Gartner; Forrester (widely cited; originals paywalled) | Analyst estimate |
| R12 | Median help-desk resolution 4.4 h with heavy AI automation vs 71 h without; 22% of tickets mean an employee cannot do their job; IAM 15.9%, onboarding/offboarding 16.6%, connectivity 2.4%, hardware 8.4% of tickets; median 1.6 IT staff per 100 employees; 50,000+ tickets, 30+ orgs, Jan 2025–Feb 2026 | 4.4 h vs 71 h | Fixify, "2026 IT Help Desk Benchmark Report" (Mar 2026) | Vendor benchmark |
| R13 | 49% of employees lose 1–5 hours a week to IT issues; 23% lose 6+ hours; 2,000+ respondents, US/UK/DE/AU | 49% / 23% | Unisys + HFS Research, "From Surviving to Thriving in Hybrid Work" (Mar 2023) | Vendor survey |
| R14 | ≈28 minutes lost per IT issue, ≈2 issues a week, ≈50 hours a year; about half of issues unreported. 2025: 14 negative digital experiences per employee per week (20M endpoints, 474 firms) | 28 min / 50 h/yr | Nexthink + Vanson Bourne (Apr 2020); Nexthink (Sep 2025) | Vendor survey / telemetry |
| R15 | One hour of downtime costs >$300,000 for over 90% of mid-size and large enterprises; 41% say $1M–$5M+; 1,000+ firms | >$300K / h | ITIC, "2024 Hourly Cost of Downtime" | Independent survey |
| R16 | 54% of significant outages cost >$100,000; ~20% cost >$1M | 54% / 20% | Uptime Institute, "Annual Outage Analysis 2025" | Independent survey |
| R17 | 79% of Kubernetes production issues stem from a recent change; median MTTD ≈40 min, MTTR >50 min for high-impact outages; >60% of ops time is troubleshooting; only 20% of incidents resolve without escalation | 79% / 40 min / 50 min | Komodor, "2025 Enterprise Kubernetes Report" (Sep 2025) | Vendor survey |
| R18 | Google SRE keeps toil under 50% of engineer time; measured average ≈33% | <50% / 33% | Google, *Site Reliability Engineering* book and workbook | Industry reference |
| R19 | ITSM software market ≈$13.5B (2024) → ≈$29.9B (2030), 14.4% CAGR; Mordor: $12.8B (2025) → $27.8B (2030) | ~$13B → ~$29B | Grand View Research; Mordor Intelligence | Market research |
| R20 | Employer cost of a US civilian worker $48.78 per hour worked (Dec 2025); computer user support specialists median $61,860/yr (May 2025), ~48,700 openings a year | $48.78 / h | US Bureau of Labor Statistics (ECEC; OOH) | Government statistic |
| R21 | Gartner: agentic AI will resolve 80% of common *customer service* issues by 2029, cutting operational cost 30% (Mar 2025); >40% of agentic AI projects cancelled by 2027 for "escalating costs, unclear business value or inadequate risk controls" (Jun 2025) | 80% / 30% / 40% | Gartner press releases | Analyst forecast |

Product measurements the repo sanctions (graded "measured on the demo stack; re-measure on yours"): checkout fix ≈30 s / 8 tool calls; reporting refusal ≈20 s; proxy laptop fix 57 s / 8 tool calls; UI Automation look ≈1,200 tokens; screen facet 3.6 s / 2.9 KB. Source: `context/plans/demo-plan.md`, `context/idea/idea.md`.

Copy rules: R21's 80% is customer service, not IT, so it appears only as "analysts expect" context or not at all. R12, R13, R14, R17 are vendor data: say "industry survey/benchmark", never "study". R9 dollars are North America, 2019: say so.

## What the research says (the argument the site makes)

- **The domain is large and growing**: ~$13B ITSM software, 14–17% CAGR, AI automation named as the growth driver (R19).
- **The waste is real on both sides of the ticket**: employees lose 1–5 h a week (R13) or ~28 min per incident (R14); peer-reviewed diaries put lost computer time above 40% (R1, R2). IT pays $22–$600 per ticket depending on escalation depth (R9); ops teams spend 60%+ of their time troubleshooting (R17).
- **The time goes exactly where Axel works**: 70% of incident time is spent after triage, diagnosing and mitigating (R5); reassignment multiplies triage time (R6); symptom-only reports take longest (R5). Intake composer + evidence-first run attack this.
- **Bounded AI moves the numbers; unbounded AI hurts**: +14% issues/hour with AI assistance (R3), 76.6% RCA accuracy (R8), 16× faster median resolution in automated desks (R12), but −19 pp correctness outside the AI's frontier (R4). That is the argument for typed tools, verification, and correct refusal.

## Design system: "Proof first"

**Subject and job**: an agent that fixes IT tickets, verifies its fixes, and refuses policy decisions. Audience: sceptical IT leaders. Job of the home page: make them believe the loop works and want to run it in shadow mode. The most characteristic object in this world is a run transcript, so the hero is two real transcripts replaying side by side. That is the one bold element; everything else is quiet.

**Palette** (exact Tailwind v4 stops; shared zinc + green rule from SPEC kept; brand SVGs untouched):

| Name | Light | Dark | Use |
|---|---|---|---|
| Veil (page) | zinc-100 `oklch(0.967 0.001 286.4)` (#f4f4f5) | zinc-950 `oklch(0.141 0.005 285.8)` (#09090b) | body, header, footer |
| Paper (panel) | white | zinc-900 `oklch(0.21 0.006 285.9)` | panels, transcripts, inputs |
| Ink (text) | zinc-950 | zinc-50 | headings, values, primary button |
| Slate (body) | zinc-600 `oklch(0.442 0.017 285.8)` | zinc-300 | body copy; zinc-500/400 for muted |
| Rule | zinc-200 `oklch(0.92 0.004 286.3)` | white 12% | every hairline |
| State green | green-700 `oklch(0.527 0.154 150.1)` (#008236) text and fills | green-400 text, green-800 (#016630) fills + white | resolved, verified, connected, available — **only** |
| State amber / red | amber-700 / red-700 | amber-400 / red-400 | escalated, degraded / refused, failed, disrupted |

Green is state, never decoration: `rg "green-" src/styles` must return only the `--state-ok*` definitions. Focus ring and selection use ink, not green. Dark-mode green needs two tokens (`--state-ok` green-400 for text ≈9.6:1; `--state-ok-fill` green-800 + white ≈6.9:1) because #016630 on zinc-900 is ≈2.3:1.

**Type**: Instrument Sans Variable for everything (already installed); Geist Mono only inside transcripts, formulas, and code. Fraunces removed. Scale: display h1 `clamp(38px,4.6vw,60px)/1.04` 600 −0.025em, 20ch; page h1 `clamp(32px,3.8vw,48px)/1.08`; h2 `clamp(24px,2.6vw,34px)/1.15`; h3 18px; lede `clamp(17px,1.6vw,19px)/1.55` 60ch; body 16px/1.6 64ch; meta 13px; mono 13px/1.55 tabular-nums. No uppercase-tracked labels, no eyebrows, no numbered markers except on true sequences (the run rules and the pilot steps), no `↗`, no middle-dot meta strings.

**Layout**: flat page (keep `.page-frame`/`.page-sheet` wrappers in `__root.tsx`, restyle them to nothing); `.shell` `min(100% - 2*gutter, 1200px)`, `.shell-narrow` 760px; left-aligned; section rhythm `clamp(56px,8vw,104px)` with a 1px top rule; `.panel` = paper + 1px rule + 8px radius, no shadows anywhere; `.rows > * + *` hairline list; `.grid-3` divider grid (`gap:1px; background: var(--rule)`, cells painted paper); buttons 44px, 6px radius, ink/white primary, hairline secondary; `.state` chips 13px with a 1px border in the state colour. Header: full-width bar with bottom rule, nav 14px/500, `aria-current` = ink + 2px underline; theme toggle as a hairline segmented control (component unchanged). Footer: top rule, four columns, oversized wordmark lockup kept (only place the ™ file is used).

**Motion**: one orchestrated moment, the hero replay (steps appear in sequence over ~5 s, both transcripts on one clock so the refusal finishes first). User-triggered replay. `prefers-reduced-motion: reduce` shows the final state. No per-section reveals, no scroll-driven animation (supersedes D3).

**Generic-default review**: cool zinc + hairlines could drift toward the "broadsheet" look, so radius stays 6–10px, columns stay few, and whitespace is generous; no card kit (no shadows, no identical rounded cards); no eyebrows/arrows/mono labels; no serif-on-cream. The transcript hero is specific to this product and cannot be mistaken for a template.

## Routes, sections, and copy

Voice: plain, declarative, present tense, one fact per sentence, UK spelling, "Axiōma", "Axel", "axel-cli". Every sentence traceable to `context/idea/idea.md`, `context/idea/architecture.md`, the source, or `research.ts`.

### `/` home (`src/routes/index.tsx`, rewrite)
1. **Hero** (`id="run"`): h1 "Fixes the ticket. Refuses the wrong fix. Shows its work." Lede: "Axiōma is an IT service management platform with an agent inside it. Axel reads the ticket, gathers evidence, applies a typed fix where one exists, and reads the state back before it closes anything. When the fix is a policy decision, it escalates with a diagnosis instead." CTAs: primary "Start a shadow-mode pilot" (`mailto:hello@axioma.dev?subject=Shadow-mode%20pilot`), secondary "Watch a run" (plays the replay). `RunReplay` left = checkout fix, right = reporting refusal. Caption: "Abridged transcripts of two runs on the demo stack. Tool names and evidence are the real ones; reasoning is shortened. Timings are measured on the demo stack and should be re-measured on yours."
2. **What one ticket costs today**: three sourced figures with footnotes: cost per ticket $22 → $70 → $100 by tier (R9); 28 minutes of employee time per IT issue (R14, "industry survey"); 70% of incident time spent after the right team has it (R5, peer-reviewed). Link "Read the research" → `/impact`.
3. **Every run follows the same five rules** (a true sequence, ordinals allowed): knowledge first (`knowledge_search` is always the first call; hybrid lexical and vector retrieval) · one typed tool per turn (Axel names a tool and supplies typed parameters; it cannot compose a command; ticket text is fenced as data) · every write names its read (a write returning OK means the call was accepted; the verifying read is stamped by the API, not claimed by the model) · an observation before closure (`cmdb_record_observation` must succeed before `resolve_ticket` is accepted) · bounded (15 tool calls, 14 model turns, 300 seconds; a run ends resolved, escalated, failed, or exhausted).
4. **The same loop reaches the employee's laptop**: axel-cli facts (typed actions only, no reasoning, outbound-only, non-admin, employee claims the device with a code) + compact `Transcript` of the proxy run ("57 s, 8 tool calls, no remote session").
5. **What Axel may change is a short list**: cluster = one field (image tag or digest), dry-run then apply, automatic standard change record with rollback plan and 5-minute verification deadline; laptop = 17 typed actions each paired with the facet that observes it; anything else = a proposal a named person approves, and the approver cannot be the person who started the run; Axel holds no credentials, every side effect is a request the API executes.
6. **The service desk around the agent is a full one**: `FeatureGrid` (6 of the platform groups) + link to `/product#platform`.
7. **What it does not do**: `LimitsList` (full list, see `limits.ts`).
8. **ContactBand**: "Run it in shadow mode for a fortnight." body "Shadow mode refuses every write and records the attempt. Compare each proposal with what your team did." primary mailto, secondary "Watch a run".

### `/product` (rewrite)
Title "One loop, twelve tools, and a fixed list of things it may change." Sections: `intake` (portal AI composer: streaming draft, deflection to articles, optional screenshot reading, field provenance, device picker; email; messaging; ServiceNow co-existence: their portal stays the front door, results post back as work notes; the ticket body is fenced and never selects a tool) → `run` (the five rules + bounds + terminal states) → `tools` (table of the 12 tools: reads/writes, verified-by; `device_computer_use` row: "refused by every device; not shipped") → `actions` (17 typed actions grouped by the 11 facets; the 5 `gui_*` steps drive Windows UI Automation by control name, no pixels, cursor never moves; ≈1,200 tokens per look) → `governance` (change record with rollback; CMDB provenance: ticket, run, step, time; shadow mode, agent never told; approval queue: digest-bound, single-use, expires undecided, device opted in by an operator; prompt-injection fence) → `platform` (full `FeatureGrid`) → `deployment` (Helm chart: api, agent, portal, dashboard, web, optional pgvector Postgres; one stack per customer; bring your own OpenAI-compatible model endpoint; "whether ticket text leaves your network is a value in the chart", no residency guarantee; SSO/OIDC) → `roles` (Employee, IT support, Platform engineer) → `limits` → ContactBand. Correct the current tier-2 claim: computer-use is refused; GUI remediation ships via UI Automation.

### `/impact` (new `src/routes/impact.tsx`)
Title "Where the time goes in IT support, and what a bounded agent can return." Lede: "The figures on this page are third-party research and industry benchmarks. They describe the domain. They do not measure Axiōma." Sections: `domain` (R1/R2, R13/R14, R9, R17, R19, R20) → `time` (R5 stacked bar 70.2/15.4/14.4 with visible labels and an `sr-only` list; R6; "reporters describe symptoms, not causes") → `bounded` (R3, R8, R12, R4 → why the refusal path exists) → `estimate` (`ImpactCalculator`) → `coverage` (ticket class → facet → action → verifying read; cluster rows for bad image tag and unschedulable pod; an honest "Password reset: not a typed action today; proposal or human" row) → `SourcesList` → ContactBand. R21 only as caveated context.

### `/pricing` (rewrite; delete Radix Tabs use)
Title "Three ways to deploy. No figures on this page." Lede: "Every package installs inside your own infrastructure from the same Helm chart. Prices come from a conversation, because each stack is sized to one customer." Packages: **Shadow pilot** (mode shadow; one environment; read-only evidence; every attempted write recorded, none applied; transcript review; CTA "Start a shadow-mode pilot") · **Platform** (act mode per environment; enrolled Windows devices with the 17 typed actions; device command approvals with separation of duty; change records, CMDB provenance, knowledge, catalogue, SLA/OLA, rules and workflows; email and messaging; roles and capability keys) · **Enterprise** (Platform plus SSO/OIDC, ServiceNow co-existence, directory sync, named support, deployment handover). Foot: "No quotas and no per-run counts." Then "How a pilot runs" (ordered: shadow for a fortnight → compare proposals with what your team did → switch one environment to act). Package CTAs → `/contact`.

### `/about` (rewrite)
Title "Diagnosis, action, and accountability belong in one record." Sections: the problem (symptoms not causes; two costs; target the second first); how we work (Evidence before action; Restraint is a result; One accountable agent — unnumbered); what we do not claim (the claim discipline stated publicly: no performance, savings, or accuracy claims about Axiōma; third-party figures are attributed and graded); naming (Axiōma, Axel, axel-cli).

### `/contact` (rewrite)
Title "Tell us which ticket class you want to see closed without a human." mailto panel (no arrow) + storage disclosure; "Useful context" list: environments and count; Windows laptops, managed or not; whether ServiceNow is the front door; which actions must stay human decisions; what happens next (reply by email, shadow-mode pilot).

### `/status`: restyle only; loader, validation, fail-closed state untouched; state colours map to `--state-ok-fill` / `--state-warn` / `--state-bad`.

### Chrome (`src/components/site.tsx`, `src/content/site.ts`)
Nav: Product, Impact, Pricing, About, Contact. Footer columns: Product (Product, Impact, Deployment packages, Service status) · Company (About, Contact) · Contact (email). Subscribe disclosure rendered **above** the field with `aria-describedby`. `PageIntro` loses `eyebrow`; `ContactCta` becomes `ContactBand({ title, body?, primaryLabel, secondary? })`; `Arrow` deleted. 404: drop eyebrow and arrow.

## Components (new, `src/components/`)

- `transcript.tsx` — `Transcript({ run, frame, compact?, headingLevel? })`: `<section class="transcript panel">` with header (ticket, environment, state chip running → resolved/escalated when `frame >= steps.length`), `<ol>` of `<li class="transcript-step" data-kind data-tone data-revealed>` (mono tool name, compact input, evidence with tone rule, "Verifies `tool`" chip), footer outcome line with `role="status"` and the measured-on-demo-stack caption. Hidden steps use `visibility:hidden; opacity:0` so height never changes (no CLS).
- `run-replay.tsx` — `useReplay(runs, { cadenceMs })` + `RunReplay({ id, left, right, frame, status, onReplay })`. Initial `frame = 0` on server and client (no hydration mismatch). Steps are hidden only when `html.js` is present: add `root.classList.add("js")` to the `themeInit` inline script in `__root.tsx`; CSS `html.js .transcript-step[data-revealed="false"]{opacity:0; visibility:hidden}`, and `@media (prefers-reduced-motion: reduce)` forces visible. On mount: reduced motion → jump to final frame; otherwise start the `setTimeout` chain within one frame (cadence ≈550 ms, observations ≈350 ms after their call). "Replay" button resets and plays regardless of preference. From other routes "Watch a run" is `<Link to="/" hash="run">`. No `IntersectionObserver`, no new dependency.
- `sources.tsx` + `src/lib/sources.ts` — `createSourceIndex(ids)` gives deterministic footnote numbers per page; `SourceRef` renders `<sup><a href="#src-R9">3</a></sup>`; `SourcesList` renders title, publisher, year, grade label, URL. Grade labels: Peer-reviewed study / Industry benchmark (year) / Industry survey / Analyst estimate / Government statistic / Market research / Measured on the demo stack.
- `impact-calculator.tsx` + `src/lib/impact.ts` (pure `estimate(inputs)`) + `src/lib/format.ts` (hand-rolled en-US thousands/currency formatting so SSR and client match). Six labelled number inputs with `SourceRef`, outputs in a sunken well with `aria-live="polite"`, "Reset to defaults", the formula printed verbatim in mono, and the label **"Estimate from published benchmarks, not a measurement of Axiōma."** above the outputs. Nothing persisted.
- `feature-grid.tsx` (`FeatureGrid({ groups, limit? })`), `limits-list.tsx` (`<dl class="rows">`), `package-list.tsx` (three cells, mode chip, includes list, CTA → `/contact`).

## Content files (`src/content/`)

- `research.ts` — `sources: Source[]` = R1–R21 + M1–M3 (measured), each `{ id, title, publisher, year, url, grade, figures: string[], note? }`; `figures` lists every printable number for that row (the audit matches against it).
- `facts.ts` — product constants: tools 12, deviceActions 17, guiSteps 5, facets 11, maxToolCalls 15, maxModelTurns 14, runDeadlineSeconds 300, changeVerificationMinutes 5, directoryShrinkBrakePercent 40, processAllowlist 8, measured timings with `remeasure: true`.
- `runs.ts` — `RunStep { ordinal, kind: tool_call|observation|think|decision, tool?, input?, evidence?, tone?, verifies?, delayMs? }`, `RunRecord { id, ticket, environment, outcome, outcomeLine, durationSeconds, toolCalls?, measuredNote, steps }`; three records. Seeded facts to use: checkout image `nginx:1.99.99-nope` in namespace `demo`, patched via `cluster_patch_image` container 0, verified by `cluster_read_deployment` (available 1/1); reporting `requests.cpu: "64"`, `Pending` / `Unschedulable` / scheduler `Insufficient cpu`, `escalate_ticket` with proposal `before cpu: 64` attached, not applied, no write step; laptop `ProxyEnable 1, ProxyServer 127.0.0.1:9` → `device_read_state [proxy]` → `device_run_action disable_proxy` (or `clear_proxy_override`, whichever the real run used) → `device_read_state [proxy]` verifies → `cmdb_record_observation` → `resolve_ticket`. Before launch, copy the exact evidence strings and the corrected image tag from the dashboard Transcript tab of a real seeded run (a kind cluster has one node, so the scheduler line differs from the unit test's "0/3 nodes"); label transcripts "abridged".
- `platform.ts` — groups verified against `api/src/contracts` and dashboard routes: Intake, Queue (SLA/OLA, presence, saved views, merge/link, audit, time entries), Catalogue (forms, requests, approvals), Change enablement (CAB voting; auto change record on cluster writes), Problems and known errors, Knowledge (versions, folders, ACL, public articles, automatic gap detection), CMDB (typed classes, relationships, provenance, impact walk), Assets (inventory, imports, licences, suppliers, contracts, scheduling), Automation (rules with recorded firings, workflows, webhooks with retry, API keys with rate limits), People (directory sync with 40% shrink brake, roles with capability keys, deny-by-default, SSO/OIDC), Devices (enrolment tokens, claim codes, rotation, revocation, command approval queue), Environments (act/shadow per environment, namespace allowlist), Operations (status page with incidents; overview with autonomous resolution rate — metric named, no value printed).
- `limits.ts` — not proactive; cluster write surface is one field; no blast-radius limit inside granted scope; no approval step before a cluster action (device commands have one); device delivery at-most-once; ServiceNow only ITSM connector, Kubernetes only infrastructure connector; Windows-only devices; `axel-cli.exe` unsigned; no HA/autoscaling/backup/DR in the chart; `device_computer_use` refused everywhere; no performance, savings, or accuracy claim about Axiōma.
- `impact.ts` — `impactDefaults { employees 500, ticketsPerEmployeeMonth 0.8 (R10), autoShare 0.25 (user-set; label: "Share of your tickets in classes Axel can close, see the coverage map; Axiōma has not measured its own rate"), costPerTicket 45 (R9 midpoint of $22 and $70), lostMinutesPerIncident 28 (R14), loadedHourly 48.78 (R20) }`; `timeSplit` (R5); `coverage` rows (13 device rows by facet + 2 cluster rows + the password-reset honesty row); footnote order.
- `packages.ts` — replaces `pricing.ts` (no icons, badges, quotas). `home.ts` and `product.ts` deleted with the old sections. `site.ts` gains `PILOT_MAILTO`, the Impact nav item, and new footer columns.

Formula shown on the page: `ticketsPerYear = employees × ticketsPerEmployeeMonth × 12; autoClosed = ticketsPerYear × autoShare; itSavings = autoClosed × costPerTicket; employeeHours = autoClosed × lostMinutes ÷ 60; employeeValue = employeeHours × loadedHourly`.

## CSS files (`src/styles/`)

`index.css` imports: tailwindcss, instrument-sans, geist-mono, tokens, base, primitives, layout, replay, impact, sections, motion (Fraunces and `tw-animate-css` imports removed). Rewrite `tokens.css` (palette above; keep the minimal shadcn alias block `--background/--foreground/--border/--input/--ring/--destructive/--radius` because `base.css` `@apply`s them; keep `@custom-variant dark`), `base.css` (reset, type classes, shell, skip link, ink focus ring), `primitives.css` (button, panel, rows, state, meta, mono, prose, footnote; delete eyebrow, tag, live-pill, ledger-index, button-light, button-quiet, text-link), `layout.css` (header bar, nav, toggle, footer), new `replay.css` and `impact.css`, a much smaller `sections.css`, and `motion.css` (only `step-in` keyframes + the reduced-motion block). Transition aliases for `--surface-inverse*`, `--text-inverse*`, `--rule-inverse`, `--brand*` stay until the last route is rewritten, then go.

## Implementation order (build green at every step; `pnpm check && pnpm build && pnpm check-types`)

1. Baseline: run the gates; screenshot the six routes light/dark with the chrome-devtools MCP for before/after.
2. Add content files only (`research.ts`, `facts.ts`, `runs.ts`, `impact.ts`, `platform.ts`, `limits.ts`, `packages.ts`); no consumers.
3. Fraunces out, part A: remove `@fontsource-variable/fraunces` from `package.json` and `index.css`; alias `--font-display` to the sans stack; `pnpm install` (lockfile changes ship with the work).
4. New components with no consumers (`transcript`, `run-replay`, `sources`, `impact-calculator`, `feature-grid`, `limits-list`, `package-list`) + `lib/sources.ts`, `lib/impact.ts`, `lib/format.ts`; `pnpm fix`.
5. `routes/impact.tsx` → `pnpm build` regenerates `routeTree.gen.ts` → then add the Impact nav item, footer links, and the sitemap entry.
6. Tokens/base/primitives/layout rewrite with transition aliases; add `replay.css`, `impact.css`; add `js` class to `themeInit`.
7. Route rewrites in this order so the highest-value pages land first: `index.tsx` + `site.tsx` chrome → `pricing.tsx` (delete `ui/tabs.tsx`, `content/pricing.ts`) → `product.tsx` → `about.tsx` → `contact.tsx` → `status.tsx` restyle → 404 in `__root.tsx`. Gate after each.
8. Delete dead CSS, transition aliases, `--font-display`, `content/home.ts`, `content/product.ts`; new `sections.css`; `rg -n "↗|·|eyebrow|ledger-index|font-display|Fraunces|fraunces|reveal" src` returns nothing.
9. SEO: per-route titles/descriptions (see table below); `public/sitemap.xml` + `/impact` (priority 0.8); rewrite `public/og.svg` in the new voice (white card on #f4f4f5, hairline #e4e4e7, "Fixes the ticket. Verifies the fix. Or escalates with the evidence.", a mono "resolved" chip in #008236); rasterise `og.png` with headless Chrome from a `scripts/og.html` that inlines the SVG and `@font-face`s the two woff2 files, via `scripts/gen-og.ps1`; delete `scripts/gen-og.mjs`.
10. Add `scripts/audit-figures.mjs` (`node` script, Biome-excluded dir): loads `research.ts` figures + `facts.ts` values, scans `src/content/*.ts` and `src/routes/*.tsx` for numbers with `%|pp|×|h|s|min|KB|tokens|$` units (ignoring years, `ordinal:`, `viewBox`/px), fails on any untraceable number; wire `"audit-figures"` into `check-all`.
11. Docs (below). Then verification.

| Route | Title | Description |
|---|---|---|
| `/` | Axiōma — IT support that verifies its own fixes | Axiōma is an IT service management platform with an agent inside it. Axel fixes the ticket, verifies the fix, or escalates with the evidence. |
| `/product` | Product — the run, the tools, the limits — Axiōma | Every run: knowledge first, one typed tool per turn, every write verified by a read, an observation before closure. Twelve tools, seventeen device actions, one cluster write. |
| `/impact` | Impact — where IT support time goes — Axiōma | Third-party research on the cost and time of IT support, an editable estimate from published benchmarks, and the ticket classes Axel covers. |
| `/pricing` | Deployment packages — Axiōma | Shadow pilot, Platform, and Enterprise. No figures and no quotas; every package installs in your own infrastructure. |
| `/about` | About — Axiōma | Why Axiōma keeps diagnosis, action, and accountability in one record. |
| `/contact` | Contact — Axiōma | One address for a shadow-mode pilot or a question about the loop. |

## Documentation updates (same change)

- `axioma/web/PRODUCT.md` and `axioma/web/context/SPEC.md`: seven routes (add `/impact`, pricing → packages); claim rule 2 becomes "no performance, savings, accuracy, or production-readiness numbers **about Axiōma**; third-party figures allowed when attributed to `src/content/research.ts` and graded; the estimate is labelled 'estimate from published benchmarks, not a measurement of Axiōma'"; "must be preserved" replaces the dossier system with the Proof-first system; copy voice adds "no eyebrows, arrows, middle-dot meta; ordinals only on sequences"; "every number traces to `research.ts` or `facts.ts`".
- `axioma/web/DESIGN.md`: rewrite for Proof first (tokens, type scale, green-is-state rule with the two dark tokens, motion, components).
- `axioma/web/context/DECISIONS.md`: D17 third-party data policy; D18 `/impact` route (client-only calculator, nothing stored, static sitemap of seven); D19 deployment packages (Radix Tabs removed, `ui/tabs.tsx` deleted, CTAs → `/contact`); D20 Proof-first restyle (supersedes D3 scroll motion and the dossier identity; Fraunces removed); D21 og pipeline; correct D16 (`web.yml` does not exist; the job is `contracts.yml:web`). Verification matrix → seven routes.
- `axioma/web/README.md`: dev port 3003 (not 3000), stylesheet list, seven routes, `audit-figures`, CI job location.
- `context/idea/idea.md` unchanged (it governs claims about Axiōma; the site cites third parties).

## Verification

From `axioma/web` (PowerShell):

```
pnpm install
pnpm fix
pnpm check
pnpm build            # must regenerate src/routeTree.gen.ts with /impact
pnpm check-types      # after build
node scripts/audit-figures.mjs
rg -n "↗|·|eyebrow|ledger-index|font-display|Fraunces|fraunces|reveal" src public/og.svg
rg -n "green-" src/styles
pnpm dev              # http://localhost:3003
```

Manual matrix via the chrome-devtools MCP (`new_page`, `resize_page` 360/768/1440, `emulate` dark + reduced motion, `take_screenshot`, `take_snapshot`, `list_console_messages`, `lighthouse_audit`):

| Check | Routes | Themes | Widths |
|---|---|---|---|
| Visual pass: no shadows, hairlines align, green only on state, no horizontal scroll | all seven | light + dark | 360 / 768 / 1440 |
| Keyboard: skip link, nav, mobile menu, theme toggle, Replay button, calculator fields, footer form | all seven | light | 360 / 1440 |
| Reduced motion: hero shows the final state on load; Replay still animates on click | `/` | light + dark | 1440 |
| `/product` → "Watch a run" → `/#run` scrolls and plays | `/product` | light | 1440 |
| Zero hydration warnings in the console | `/`, `/impact` | — | 1440 |
| `/status` fail-closed state with `AXIOMA_API_URL` unset | `/status` | light | 1440 |
| Dark contrast: `--state-ok` text ≥ 4.5:1 on paper; `--state-ok-fill` + white ≥ 4.5:1 | `/`, `/status` | dark | 1440 |
| Lighthouse accessibility ≥ 95, no CLS from the replay | `/`, `/impact`, `/pricing` | light | 1440 |

Also: every figure on `/impact` and `/` resolves to a footnote; the calculator label is visible above the outputs; `og.png` renders the new card at 1200×630; sitemap lists seven URLs.

## Risks

- `routeTree.gen.ts` must be regenerated (`pnpm build`) before any `<Link to="/impact">` type-checks.
- Biome (tabs, double quotes) rejects unformatted new files: run `pnpm fix` after each step.
- Evidence strings must come from a real run, not be invented; keep seeded values as the floor and label transcripts abridged.
- Two 40% values exist (R11 anchor vs directory shrink brake); each traces to its own source; the audit allows both.
- Hydration: replay starts at frame 0 on both sides; timers and `matchMedia` only in effects; if the JS bundle fails after `html.js` is set, steps stay hidden (accepted; the inline script and the bundle ship together).
- `og.png` rasterisation needs a local Chrome; documented in `scripts/gen-og.ps1`; `@resvg/resvg-js` is the CI-reproducible alternative recorded in D21.
- Scope: no analytics, no forms posting, no new runtime dependency, brand SVGs untouched, `/status` behaviour untouched.

## Out of scope (noted, not done)

Dependency hygiene (`@remixicon/react`, `class-variance-authority`, `@radix-ui/react-slot`, `shadcn` and `tailwindcss` in `dependencies`, `tw-animate-css`), a dedicated `web.yml` workflow, automated visual tests, a booking link or demo video (none exist), and any change to portal/dashboard/ui.
