# Axiōma Web — Site Specification

The web spec the uplift plan and every restyle pass must obey. Product truth
lives in [`axioma/context/idea/idea.md`](../../../context/idea/idea.md); this
file reduces it to what the marketing site may say and do. Where the two
disagree, `idea.md` wins.

## Audience

- **IT leaders evaluating the product** — CIOs, heads of IT, platform
  engineering managers. They arrive from a search or a referral, skim one or two
  pages, and want to know what the loop does and where the boundary between
  agent and human sits.
- **Employees and IT staff who will use it** — they read the product flow to
  understand what changes for them.

The site is read, not used. It stores nothing: no accounts, no form posts, no
analytics. Every interactive element either navigates or opens the visitor's
email client.

## The six routes and each one's single job

| Route | Single job |
|---|---|
| `/` | Explain the loop in one scroll: symptom → investigation → action or handoff, with the ticket dossier and `axel-cli` transcript as the two proof surfaces. |
| `/product` | Walk the ticket flow end to end (creation, routing, remediation, closure/escalation) and state the tool-order discipline: typed action → computer-use → human. |
| `/pricing` | Explain what each tier covers and how the tiers differ; route every intent to a conversation. No figures. |
| `/about` | State why the company exists: diagnosis, action, and accountability stay together. |
| `/contact` | Hand the visitor one address (`hello@axioma.dev`) and the context worth including in a first email. |
| `/status` | Report daily service availability from the live API — and fail closed, honestly, when it cannot. |

## Claims the site is allowed to make

Imported from `idea.md` §Claim Discipline, applied to marketing copy:

1. **No novelty claims** for AI ticket triage, agentic remediation, remote
   endpoint management, or CMDB population. The differentiator is the working
   end-to-end loop across them, in one system.
2. **No performance, savings, accuracy, or production-readiness numbers.** No
   "resolve X% automatically", no benchmarks, no uptime promises.
3. **No data-residency claims** until the inference-location question in
   `idea.md` is answered. Deployment is described as "inside the customer's own
   infrastructure" — the statement of architecture, not a guarantee.
4. **Agent capability is stated as the loop, not as general power**: reads the
   ticket, gathers evidence, applies an available fix, checks it, escalates
   with its reasoning otherwise. It names commands; it does not run them.
5. **Pricing copy never invents figures or presents placeholders as decided.**

If a sentence cannot be traced to something in `idea.md`, it is cut or hedged.

## Copy voice

- Plain, declarative, present tense. Short sentences that carry one fact each.
- The site speaks as Axiōma ("we are connecting…"), names Axel as the agent and
  `axel-cli` as the device executor, and uses the macron in "Axiōma" in prose.
- Concrete nouns over adjectives: "evidence", "transcript", "typed action" —
  not "seamless", "powerful", "revolutionary".
- Em-dashes for asides, semicolons sparingly. UK-leaning neutral English.

## Must be preserved

- **Brand SVGs** in `public/brand/` and their React wrappers
  (`src/components/brand.tsx`) — the mark and wordmark are fixed assets.
- **The shared palette**: zinc scale + brand green (`green-700/800`) matching
  the dashboard and portal. Restyles re-tint via tokens, never by hand-mixing
  new hues.
- **mailto-only contact**: the contact page and footer subscribe open the
  visitor's email client and say so. No form backend, no "successfully
  submitted" state.
- **Status-page failure behaviour**: `/status` fails closed to an honest
  "we could not load availability data" state when `AXIOMA_API_URL` is
  unreachable. Never fake availability.
- **Editorial layout system**: `page-frame`/`page-sheet` on a veil background,
  rounded panels, mono ledger strips, pill buttons. Restyle passes evolve this;
  they do not replace it with a generic template.
- **Accessibility baseline**: skip link, `aria-current` navigation, labelled
  SVGs, `prefers-reduced-motion` handling, keyboard-operable controls (now via
  Radix primitives).
