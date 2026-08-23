# AI Buildathon — Context Harvest Plan (Enterprise Customer Support track)

## Context

You are registered for the Alibaba Cloud × University of Kelaniya **AI Buildathon**, competing in **Track 06 — Enterprise Customer Support**. The goal of this task is to build a complete, evidence-backed context base so the idea we lock in is aimed squarely at the published rubric rather than at guesswork.

Six context files exist in `context/` but are all **0 bytes**. This plan fills them from primary sources and produces one hub document that turns the raw research into a ranked, rubric-scored idea shortlist.

### What reconnaissance already established

Live extraction of `https://aibuildathon.imssa.lk/` plus your five kickoff-deck screenshots (`context/images/Screenshot (423–427).png`) gave us the full ruleset. Two facts materially change the work:

**1. The kickoff deck contradicts the public website on the deadline.**

| Item | Website says | Kickoff deck says |
|---|---|---|
| Submission deadline | Aug 27, 2026 | **Aug 31, 2026** |
| Build window | "two weeks" from Aug 20 | **Aug 24–30** (Ideate & Build) |
| Cloud credits distribution | not mentioned | **Aug 24** |
| Finals / pitching | Sept 4 (tentative) | **TBA** |

The deck is the later, in-session source, so we plan against **Aug 31** but treat the gap as an open risk. Either way credits land **Aug 24 (tomorrow)** and the real build window is **8 days**, not two weeks.

**2. The rubric is published in the deck — five criteria, no weights disclosed.**

1. **Innovation & Originality** — novelty of the approach, uniqueness of the idea
2. **AI Integration & Depth** — effective, meaningful, sophisticated use of AI models and tools
3. **Technical Execution & Architecture** — code quality, stability, scalability, cloud tooling usage
4. **Impact & Business Feasibility** — viability, market relevance, potential value creation
5. **Pitch & Demo Delivery** — clarity of presentation, live prototype performance, Q&A handling

Deck closing line: *"Think beyond just building — deliver an innovative, technically sound, and clearly demonstrable product."*

Every research file must therefore be mined for **rubric ammunition**, not just interesting links: novelty evidence for #1, agent-architecture depth for #2, market/ROI numbers for #4, and demo-able moments for #5.

### Hard constraints the idea must satisfy

- **Track 06 scope (verbatim):** "Autonomous AI agents, omnichannel workflow automation, ticket resolution, and sentiment analysis." These four sub-capabilities are the scoring surface.
- **Core requirements:** Real-World Impact (defined problem in one track) · AI at the Core (ML/LLM/GenAI central to functionality) · **Ecosystem Integration — must leverage Alibaba Cloud AI tools, "powered by QwenWork / Qwen ecosystem"** · Functional Working Prototype — a testable live demo, explicitly *not* wireframes or slides.
- **Accepted formats:** Web apps · Mobile apps · Autonomous AI Agents / Workflows · Enterprise Backend Systems · GenAI Solutions & APIs.
- **Deliverables at submission:** GitHub repository + working demo video + project documentation.
- **Naming discrepancy to resolve:** the website calls the desktop agent **QoderWork**; the deck calls it **QwenWork**. Toolkit per website is Qoder (agentic IDE), QoderWork/QwenWork (desktop AI agent), MuleRun (AI workflow runtime).
- Team 1–3 members, University of Kelaniya only. Prizes $1000 / $800 / $500 + Alibaba Cloud certificates + credits.

### Decisions taken

- **200-startup pass: full depth on all 200** (your call), not the tiered subset.
- **Stack: undecided** — the shortlist will therefore cost every candidate idea against three build paths (full-stack web, Python + light UI, MuleRun/QwenWork-led) so you can choose after seeing them.

---

## Deliverables

| File | Content |
|---|---|
| `context/aibuildathon.imssa.lk.md` | Authoritative event spec: site extract + deck transcription, rubric, constraints, conflicts |
| `context/news.ycombinator.com.md` | HN signal on support AI — stories *and* comment-mined pain points |
| `context/techmeme.com.md` | Enterprise/support AI news cycle and competitive moves |
| `context/tldr.tech.md` | Recent newsletter signal across AI / tech / founders / product |
| `context/techcrunch.com.md` | All 200 Startup Battlefield 2026 companies, deep pass |
| `context/context.md` | Hub: constraints, cross-source synthesis, rubric-scored idea shortlist |

Harvest scripts live in the session scratchpad (`.../scratchpad/harvest/`), keeping the repo to the six requested files. Say the word and I'll promote them to `scripts/` for re-runnability.

---

## Step 1 — `context/aibuildathon.imssa.lk.md`

No new fetching needed; the source material is already captured.

- Transcribe all five deck screenshots verbatim into structured sections: Buildathon Journey (6 phases with dates), Perks & Benefits, Problem Tracks (all six, full descriptions), Solution Guidelines & Deliverables (core requirements + accepted formats), Evaluation Criteria & Rubric.
- Merge the full site text (Overview, Format, Team Size, six tracks, three-tool toolkit, timeline, prizes, contacts, "REGISTRATIONS CLOSED ON AUGUST 15 AT 7:00 AM").
- Add a **Conflicts & Open Questions** section: Aug 27 vs Aug 31 deadline, QoderWork vs QwenWork, finals date, no submission portal URL published anywhere, no rubric weights disclosed.
- Add a **Track 06 deep-read** section breaking the four sub-capabilities into concrete product surfaces the judges will recognize.
- Draft (do not send) a short message to coordinators Tharindu Dhanushka / Aadila Anees confirming the deadline, portal URL, rubric weights, and video length limit.

## Step 2 — `context/news.ycombinator.com.md`

Use the HN **Algolia API** (`https://hn.algolia.com/api/v1/search`) rather than scraping — verified working, returns points, comment counts, dates, URLs.

- Run a query battery: `customer support AI`, `support agent`, `helpdesk`, `ticket deflection`, `Zendesk`, `Intercom`, `CSAT`, `voice agent`, `AI agent memory`, `RAG production`, `agent evals`, `Show HN support`, `chatbot failure`, `escalation`, `omnichannel`, `sentiment analysis`. Restrict to `tags=story`, sort by points, plus a recency pass over the last ~12 months.
- Cross-check the front page via the official Firebase API (`/v0/topstories.json` → `/v0/item/{id}.json`) for anything live today.
- **Mine comment threads** on the highest-signal posts via `/api/v1/items/{id}`. HN comments are where practitioners describe what current support AI actually gets wrong — this is the richest source of a defensible problem statement and directly feeds rubric criterion #1 and #4.
- Organize the file as: Top threads table → **Recurring pain points** (the important section, each with quoted evidence + thread link) → Tooling/competitor landscape → Anti-patterns to avoid → Idea seeds tagged to the four Track-06 sub-capabilities.

## Step 3 — `context/techmeme.com.md`

- Fetch the front page and `/river` for the recent window. Raw HTML is served (verified, 164 KB) but class names are terse, so render via the already-open Chrome DevTools session and pull `innerText` from the main column, plus anchor hrefs for source attribution.
- Filter to enterprise software, AI agents, customer service, contact-center, and CX-platform items.
- Capture headline, publication, date, link, and the discussion cluster beneath each item.
- Organize as: Enterprise AI agents · Customer service / CX platform moves · Model & infra releases relevant to agents · Funding and M&A in support tooling · **Why it matters for Track 06** (a short analytic note per cluster).

## Step 4 — `context/tldr.tech.md`

- Verified: issues live at dated URLs, `https://tldr.tech/{newsletter}/YYYY-MM-DD`, plain `curl` works and returns `<h3>` headlines with summary paragraphs.
- Pull the last ~4–6 weeks across `ai`, `tech`, `founders`, and `product`. Parse section headers (Headlines & Launches, Deep Dives & Analysis, Engineering & Research), each item's headline, read-time, summary, and outbound link.
- Filter to support/agent/enterprise relevance; keep a short "adjacent but useful" bucket for agent-architecture material (memory, tool use, evals, long-horizon tasks) that strengthens rubric criterion #2.
- Organize by theme with dated citations.

## Step 5 — `context/techcrunch.com.md` — all 200, deep

Verified structure: exactly **200 external links** under **21 category headings**. Distribution: Enterprise tech 23 · Health & wellness 22 · Biotech 16 · Cybersecurity 14 · Consumer 13 · Manufacturing 13 · Energy 12 · Fintech 12 · Space & defense 10 · Edtech 9 · Marketing 7 · Proptech 7 · Automotive 6 · E-commerce 6 · Logistics 6 · Agtech 5 · Entertainment 5 · Government/legal 5 · HR 5 · Smart cities 4.

**Stage A — index.** One `evaluate_script` against the open TechCrunch page walks `h2`/`h3` and anchors in document order, emitting `{name, url, category}` × 200 to `harvest/battlefield200.json`.

**Stage B — bulk fetch.** Node 24 script, native `fetch`, concurrency ~10, 12 s timeout, browser user-agent, follow redirects. Per site extract: `<title>`, `meta description`, `og:title`/`og:description`, all `h1`/`h2`, nav labels, and the first ~2000 chars of tag-stripped visible text. Opportunistically also fetch same-origin `/about` and `/product` when linked. A 6-site smoke test ran **6/6 clean in 2.8 s**, so the full run is roughly 1–3 minutes.

**Stage C — render fallback.** Sites returning thin text (JS-only shells — Canopii was one in testing) get re-loaded through Chrome DevTools and read via `innerText`. Anything still failing is recorded explicitly as unreachable rather than silently dropped.

**Stage D — write-up.** All 200 entries, grouped under the 21 original categories. Per startup: name · URL · category · one-line positioning · 2–3 lines on what it does · AI angle · **Support-relevance tag** — `DIRECT` (customer support/CX product) · `ADJACENT` (enterprise workflow, agents, comms) · `PATTERN` (transferable mechanic — routing, escalation, sentiment, memory, evals) · `NONE`.

File closes with the sections that actually earn their keep: **DIRECT + ADJACENT roster**, **transferable patterns worth stealing**, **crowded spaces to avoid** (differentiation evidence for rubric #1), and **whitespace where nobody in the 200 is playing**.

## Step 6 — `context/context.md` — the hub

More than an index. Structure:

1. **Mission & constraints** — track, rubric, deadline, deliverables, Alibaba/Qwen ecosystem requirement. Single source of truth for the build.
2. **File index** — each context file with a one-line description of what it answers.
3. **Cross-source synthesis** — the themes that appear in three or more of HN / Techmeme / TLDR / Battlefield 200. Convergence is the strongest available novelty signal.
4. **Problem candidates** — each with evidence citations back into the source files.
5. **Ranked idea shortlist** — 5–7 candidates. Each scored 1–5 against all five rubric criteria with justification, plus a **demo-moment** line (the single thing that wins criterion #5) and **build cost under each of the three stack paths**, since the stack is undecided.
6. **Recommendation** — one idea, with the reasoning and the runner-up.
7. **Open questions & risks** — deadline ambiguity, portal URL, credit availability, rubric weights.

---

## Verification

- **Counts:** assert exactly 200 entries in `context/techcrunch.com.md` and that per-category counts match the 21 numbers above; report any unreachable sites by name.
- **No empty files:** all six non-zero, each with a populated `Sources` section carrying real URLs and access dates.
- **Rubric traceability:** every shortlisted idea in `context.md` cites at least one piece of evidence from a source file for criteria #1 and #4.
- **Fact check:** re-read `context/aibuildathon.imssa.lk.md` against the five screenshots to confirm dates, rubric wording, and track text are transcribed exactly, with the Aug 27/Aug 31 conflict stated rather than silently resolved.
- **Spot check:** manually re-open 5 random startup URLs and confirm the written summaries match.

## Out of scope

No git writes (per repo rules — commands will be provided for you to run). No message sent to the coordinators; the draft is yours to send. No code written for the buildathon project itself in this task — this plan ends at a locked-in, evidence-backed idea.
