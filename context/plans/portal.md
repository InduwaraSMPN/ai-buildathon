# Axiōma `portal` — implementation plan

**Document role:** Implementation plan for `axioma/portal` — the employee-facing web app, :3001
**Related:** [api.md](api.md) (read first), [dashboard.md](dashboard.md)

Open a ticket, follow it, see the outcome. Plain language only: never raw tool output, never model
reasoning, never a tool name. An employee should be able to read this surface without knowing an agent
exists.

---

## 1. Current state

### Gates, run 2026-08-29

| Gate | Command | Result |
|---|---|---|
| Lint | `npx biome check .` | Clean, no issues |
| Types | `npx tsc --noEmit` | Clean, no errors |

`src/sdk/contracts/index.ts` is byte-identical to `api/src/contracts/index.ts` apart from the generated
banner. As in the dashboard, `pnpm check-types` runs `vite build` first so the router plugin can
regenerate `routeTree.gen.ts`.

### What is built and real

**Stack** — TanStack Router, React 19, TanStack Query, Tailwind 4, Vite, Better Auth client, oRPC
client. `@tanstack/react-form` is installed and **not used anywhere**. Correctly, there is no
`@tanstack/react-table` and no `recharts` — this surface needs neither.

**Component base** — `components.json` declares style `base-lyra`, base colour `neutral`, Lucide icons.
Seventeen Base UI components in `src/components/ui/`, the same set as the dashboard.

**Shell** — `routes/__root.tsx` renders a persistent `Header` above the outlet inside a
`grid-rows-[auto_1fr]` layout. `components/header.tsx` has the brand, a "My requests" nav link, a "New
request" button, the theme toggle and the user menu. `main.tsx` sets a `defaultPendingComponent`, so
navigation already has a loading state.

**Auth** — `routes/_auth/route.tsx` resolves the session in `beforeLoad` and redirects to `/login`,
exposing `session` on the route context. `routes/login.tsx` toggles between sign-in and sign-up forms.

**My requests** — `routes/_auth/home.tsx`. Greets by first name, lists the employee's tickets as cards
with status, last-updated, title and a two-line body excerpt, with a proper `Empty` state and a
skeleton loading state. Genuinely good.

**New request** — `routes/_auth/tickets/new.tsx`. Title and body with min/max length, a "please don't
include passwords" note, optimistic navigation to the created ticket, toasts on success and failure.

**Request detail** — `routes/_auth/tickets/$ticketId.tsx`. Status card with a plain-language label and
detail line, the employee's original text, a resolution card when one exists, a "This solved it"
button that closes and an "I still need help" button that escalates, plus a request-information rail.

**Shared UI** — `components/ticket-ui.tsx`. A `statusCopy` map translating each status into employee
language ("Finding the right help", "With a specialist"), `StatusBadge`, `PageShell`, `PageHeading`,
`LoadingCards`, `ErrorState`. This module is the best thing in the component and is the right idea:
one place where system vocabulary becomes human vocabulary.

### Defects found while reading

| # | Location | Defect | Severity |
|---|---|---|---|
| P1 | `routes/_auth/tickets/$ticketId.tsx` | **A request page never updates.** There is no polling and no invalidation on a timer, so an employee watching Axel work sees a frozen "In progress" until they reload. Following a request is half the product and it does not happen. | High |
| P2 | `routes/_auth/tickets/$ticketId.tsx:98-108` | **"I still need help" escalates from any incomplete state**, including while Axel is actively working. It invites an employee to escalate a ticket thirty seconds after opening it, which defeats autonomous resolution. | High |
| P3 | `routes/index.tsx` | The public landing page is the **unmodified Better-T-Stack scaffold** — ASCII art reading "BETTER T STACK" and an API health-check indicator. This is what an employee sees at the root URL. The dashboard's equivalent route redirects; this one does not. | High |
| P4 | `routes/_auth/tickets/new.tsx` | Forms use raw `useState` plus HTML `required`/`minLength`, **not `@tanstack/react-form`**, which the workspace rules mandate and which is already a dependency. | Medium |
| P5 | `routes/_auth/tickets/new.tsx` | **No device attachment.** `createTicket` accepts `deviceId`; the portal never sends one, so every device-path ticket depends on the API guessing. | Medium |
| P6 | `routes/__root.tsx:47-50` | The `Header` renders on `/login`, so a signed-out visitor sees a "New request" button and a user menu. | Medium |
| P7 | `routes/login.tsx:11` | `showSignIn` starts `false`, so the **sign-up form is the default**. A returning employee lands on registration. | Low |
| P8 | `components/ticket-ui.tsx:15-51` | The status vocabulary is a hand-rolled `Record<string, …>` because the contract types `status` as `z.string()`. Same root cause as the dashboard's two colour maps. | Low |
| P9 | `src/components/ui/{attachment,bubble,message,message-scroller,marker}.tsx` | Five chat-oriented components installed and referenced by nothing. | Low |
| P10 | `routes/_auth/tickets/$ticketId.tsx` | `getTicket` returns **every agent run with every step** — reasoning, tool names, tool inputs and outputs — to this client. The portal does not render them, but they are on the wire and in the browser's memory and devtools. The rule "never raw tool output or model reasoning" is currently enforced by the component not reading a field, which is not enforcement. | Medium |

### What is missing outright

- Impact and urgency capture, so the API has nothing to derive priority from and every ticket lands at
  the default P3.
- Any distinction between "something is broken" and "I need something" — the incident versus service
  request split.
- Any live sense of progress. There is a status label and nothing between "Received" and "Resolved".
- Device attachment.
- A route-level error boundary; a failed load inside `_auth` has no designed state.
- A confirmation loop that actually distinguishes resolved from closed in the employee's terms.

---

## 2. Gaps

1. A request page does not update while Axel works (P1) — the core of "follow it".
2. Escalation is offered at the wrong moments (P2).
3. The root route is scaffold output (P3).
4. No classification capture: impact, urgency, record type (and therefore no derived priority).
5. No device attachment (P5).
6. Forms do not use the mandated library (P4).
7. The plain-language rule is enforced by omission rather than by the data the client receives (P10).
8. Signed-out chrome and a sign-up-first login (P6, P7).
9. Status vocabulary duplicated with the dashboard's (P8).

---

## 3. Component sourcing

Same rule as the dashboard: `npx shadcn@latest add <name>` resolves against `components.json`'s
`base-lyra` style, which is Base UI (`ui.shadcn.com/docs/components/base/<name>`). The seventeen
existing components are genuine Base UI. **No Radix adaptation is required.** The Radix template at
`tanstack-start-dashboard-main/` is not a source for this component at all — its density is wrong for
an employee surface, and its primitives are the wrong library.

Needed additions: `field`, `form`, `radio-group`, `select`, `separator`, `badge`, `alert`, `progress`,
`avatar`, `item`, `spinner`, `alert-dialog`, `dialog`.

Per-screen sources are named in each milestone.

---

## 4. Milestones

Dependency-ordered.

### A — Entry points and chrome
**Files:** `routes/index.tsx`, `routes/__root.tsx`, `routes/login.tsx`, `routes/_auth/route.tsx`.

- **P3** — `routes/index.tsx` becomes a redirect: to `/home` when a session exists, otherwise to
  `/login`, matching the dashboard's `routes/index.tsx`. Delete the ASCII art and the health-check
  panel. A health indicator is an operator concern and belongs on the dashboard if anywhere.
- **P6** — move `Header` out of `__root.tsx` and into the `_auth` layout, so signed-out pages have no
  authenticated chrome. `/login` gets its own minimal brand header.
- **P7** — default `/login` to sign-in, with sign-up as the secondary path.
- Add `errorComponent` and `pendingComponent` to `routes/_auth/route.tsx`.

**Done when:** a signed-out visitor at `/` lands on a sign-in form with no app chrome, and a signed-in
one lands on their requests.

### B — Component inventory
**Files:** `src/components/ui/*` (generated).

```
npx shadcn@latest add field form radio-group select separator badge alert progress avatar item spinner alert-dialog dialog
```

Read the diff; do not let the CLI clobber the existing seventeen. Remove the five unused chat
components (**P9**) unless milestone E's comment thread adopts them — decide in E, delete here only if
not.

**Done when:** the listed components exist and both gates pass.

### C — New request: classification in plain language
**Files:** `routes/_auth/tickets/new.tsx`, new `features/tickets/components/request-form.tsx`,
new `features/tickets/copy.ts`, `components/ticket-ui.tsx`.

This is the milestone that feeds the entire ITSM model, and it is the one where the wrong wording
produces the wrong data.

**Sources:** shadcn **`field`** + **`form`** wired to `@tanstack/react-form` (fixes **P4**),
**`radio-group`** for the classification questions, **`select`** for device, **`alert`** for the
sensitive-information notice, **`item`** for the device picker rows.

**Never show the employee the model's vocabulary.** They do not choose an "impact" or a "record type",
and the word *priority* never appears on this surface. They answer three ordinary questions, and the
client maps the answers:

| Question shown | Options | Maps to |
|---|---|---|
| "What kind of help do you need?" | *Something isn't working* / *I need something set up or installed* | `recordType`: `incident` / `service_request` |
| "Who else is affected?" | *Just me* / *My team* / *Lots of people across the company* | `impact`: `low` / `medium` / `high` |
| "How soon do you need this?" | *When you get to it* / *Today* / *I'm blocked right now* | `urgency`: `low` / `medium` / `high` |

Three radio groups, sensible defaults selected (just me, today), and no free-text priority anywhere.
The mapping lives in `features/tickets/copy.ts` next to the status vocabulary so all
system-to-human translation is in one place.

**Device attachment (P5).** When the employee is linked to a device, offer it: *"Is this about this
computer? — DESKTOP-4F2A, last seen 3 minutes ago"*, with a yes/no and an "a different computer"
escape. When they have no enrolled device, the field is absent rather than empty — an employee should
never be asked about a device they do not have. Requires the `listMyDevices` procedure noted in
cross-component impact.

**Validation** through `@tanstack/react-form` with zod schemas matching the contract's own bounds
(title 3–160, body 10–10,000), and error messages written as sentences rather than constraint text —
"Please add a few more details so we can help" beats "String must contain at least 10 character(s)".

Keep the existing "please don't include passwords" note, promoted to an `alert` so it reads as
guidance rather than fine print.

**Done when:** a submitted request carries `recordType`, `impact`, `urgency` and, where applicable,
`deviceId`; the dashboard shows a derived priority that matches the matrix; and the words *impact*,
*urgency*, *priority*, *incident* and *service request* appear nowhere in the portal's rendered text.

### D — Following a request
**Files:** `routes/_auth/tickets/$ticketId.tsx`, new `features/tickets/components/progress-timeline.tsx`,
`features/tickets/copy.ts`, `features/tickets/api/queries.ts`.

This closes **P1** and is the milestone that makes the product's promise visible to the person it was
made to.

**Sources:** shadcn **`progress`** or a stepped indicator built from **`separator`** + **`badge`**,
**`spinner`** for the active step, **`item`** for timeline rows, the existing `Card`.

- **Poll while active.** `refetchInterval` of 5s while the ticket status is `routing` or `resolving`,
  stopped otherwise and paused when the tab is hidden. Five seconds, not two: the dashboard is an
  operator tool watching a run, the portal is a person waiting, and a value updating twice a second
  reads as agitation.
- **A progress timeline in the employee's language.** Four fixed stages — *Received*, *Finding the
  right help*, *Working on it*, *Done* — derived from ticket **status**, plus a small number of
  approved progress markers described below. Each stage shows as pending, active or complete, with the
  active one carrying a spinner and a plain sentence.
- **Approved progress markers, not transcript.** The timeline may say *"Checked your computer's network
  settings"* or *"Looked at the checkout service"*. It may never say `device.read_state`,
  `cluster.read_pods`, or anything the model wrote. The mapping is a lookup from a **surface-safe
  marker code** the API supplies to a sentence in `copy.ts`. If a marker has no mapping, the timeline
  shows nothing rather than falling back to the raw value — a missing sentence is better than a leaked
  one. See cross-component impact: this needs the API to send markers, not steps.
- **Honest waiting.** When a run is exhausted or has failed, the employee is told a person is now
  looking at it — not shown an error. When nothing has happened for a while, say so rather than showing
  a spinner indefinitely.
- **P2** — "I still need help" is only offered from `resolved` (the fix did not work) and `escalated`
  (adding information). While Axel is working, the secondary action is *"Add more detail"*, not
  escalate. An employee should not be invited to give up on a process that is thirty seconds old.

**Done when:** opening a scenario-1 ticket in the portal and watching without touching the keyboard
shows the stages advance and the ticket reach *Done*, with no tool name, no JSON and no model text
anywhere on screen at any point.

### E — Resolution and confirmation
**Files:** `routes/_auth/tickets/$ticketId.tsx`, new
`features/tickets/components/resolution-card.tsx`, `features/tickets/api/mutations.ts`.

Resolution is technical and closure is confirmed, and the portal is where that distinction becomes real
— Axel resolves, and the person who reported it decides whether that is true.

**Sources:** the existing `Card`, shadcn **`alert-dialog`** for the reopen confirmation,
**`textarea`** for the follow-up note.

- A `resolved` ticket shows **what changed, in one or two plain sentences** from the ticket's
  `resolution` field, with the two clear choices already sketched in the current code: *This solved it*
  → `close`, and *This didn't fix it* → `escalate` with a required short note about what is still
  wrong. The note matters: an escalation with no new information is a worse ticket than the original.
- A `closed` ticket can be reopened within a window, behind an `alert-dialog`, mapping to the `reopen`
  action.
- An `escalated` ticket says a person is now handling it and gives an expectation about what happens
  next, rather than showing a status word and nothing else.
- Timestamps distinguish *fixed at* from *confirmed closed at*, because the employee can see both and
  the difference is meaningful to them.

**Done when:** the resolved → closed and resolved → escalated paths both work from the portal, an
escalation from resolved carries the employee's note through to the dashboard, and a closed ticket can
be reopened once.

### F — My requests
**Files:** `routes/_auth/home.tsx`.

The list is already good; this is a targeted pass rather than a rebuild.

- Surface the stage from milestone D's timeline on each card, so the list answers "what is happening"
  without opening anything.
- A quiet, non-scary marker on requests needing the employee's attention — awaiting confirmation, or a
  question from IT.
- Separate active from finished, with finished collapsed by default. An employee's list is short; it
  does not need filters, sorting or pagination, and adding them would import the dashboard's problem
  into a surface that does not have it.
- Keep the existing empty and loading states.

**Done when:** a resolved request is visibly distinguishable from an in-progress one in the list, and
finished requests do not crowd active ones.

### G — Copy, accessibility and states
**Files:** `features/tickets/copy.ts`, across `routes/` and `components/`.

- **One copy module.** Every status label, stage name, progress marker sentence and empty-state line
  lives in `features/tickets/copy.ts`. A grep of that file is the review surface for the plain-language
  rule — if a tool name can appear on this surface, it is visible in one file.
- Written for someone who is stressed and not technical: no jargon, no blame, no false certainty. "We
  couldn't load this right now" is already the right register; extend it.
- A11y: every status conveyed by more than colour, live regions announcing stage changes, visible
  focus, labelled controls, an accessible name on every icon-only button, and a check that the timeline
  is comprehensible to a screen reader in order.
- Designed loading, empty and error states on every route, using the existing `LoadingCards`,
  `ErrorState` and `Empty`.
- Responsive: this is the surface most likely to be opened on a phone by someone whose laptop is
  broken. That is not a hypothetical for a device-support product — it is the expected case for
  scenario 2, and the request-detail page must be fully usable at 375px.

**Done when:** a review of `copy.ts` accounts for every string the employee can see, the request page
is usable at 375px, and a screen reader announces each stage transition once.

---

## 5. Cross-component impact

| Needed from `api` | Why | Status |
|---|---|---|
| `createTicket` accepts `recordType`, `impact`, `urgency`, `deviceId` | Milestone C's form has nowhere to send its answers | `api.md` milestone B |
| `updateTicket.action` gains `resolve`, `reopen` | Milestone E's confirmation loop | `api.md` milestones B, C |
| `resolvedAt` distinct from `closedAt` on the ticket output | Milestone E shows both | `api.md` milestones A, B |
| `listMyDevices` procedure | Milestone C's device attachment — the signed-in user's enrolled devices with hostname and last-seen, nothing more | Requested by this plan, accepted into `api.md` milestone B |
| `tickets.progress_marker` and a `getMyTicket` shape that omits `runs` | Milestone D, and the fix for **P10** — a closed enum of markers (`gathering_evidence`, `checking_device`, `checking_service`, `applying_fix`, `verifying_fix`, `handing_to_person`) set as the run progresses, and a portal ticket query that returns no `agent_runs` or `agent_steps` at all | Requested by this plan, accepted into `api.md` milestones A, B and D |

The last one deserves its own note. Today `getTicket` returns every run with every step, including
model reasoning and raw tool output, to whichever client asks — and the portal asks. Nothing renders
it, so the rule holds visually, but the data is in the browser. Since authorization is out of scope by
decision, the fix is not a permission check: it is a **differently shaped procedure**, so the portal
cannot receive what it must not show. Marker codes are a small, closed vocabulary the API sets, and
they carry no model output at all — which is what makes them safe to render. This is requested from
`api.md` rather than planned here, because the contract is not this component's to change.

Nothing in this plan edits `src/sdk/contracts/`, which is generated and overwritten. Nothing here edits
files outside `axioma/portal/`.

| Forced on others | Detail |
|---|---|
| `dashboard` | The employee's escalation note from milestone E should be visible on the ticket's activity tab. Owned by `dashboard.md`. |
| `api` | The three procedure/shape requests above. |

---

## 6. Decisions taken

**The employee never sees the model's vocabulary, and the client never receives it.** Two separate
commitments. The first is copy: no *impact*, *urgency*, *priority*, *incident*, *service request*, tool
name or JSON on this surface. The second is data: the portal's ticket query returns no steps, so the
rule survives a future component that forgets it. A rule enforced only by a component choosing not to
read a field is not enforced.

**Three plain questions, mapped client-side to the ITSM fields.** Asking an employee to pick an impact
level produces noise; asking who else is affected produces an answer. The mapping is explicit and lives
in one file, so a change in wording cannot silently change the data. Every option maps to exactly one
enum value — no inference, no free text.

**Priority is never shown or entered here.** It is derived on the server from two answers the employee
gave without knowing what they feed. Showing the result would only invite argument about it.

**Progress markers, not a transcript.** The dashboard shows the full ordered transcript because its
reader is debugging an agent. The portal's reader wants to know whether their laptop will work before
their next meeting. A closed vocabulary of six markers, each with a hand-written sentence, gives real
progress with no leak surface, and an unmapped marker renders nothing rather than falling back to a raw
value.

**Poll at five seconds, not two.** The dashboard watches a run; the portal reassures a person. Faster
updates make a page feel anxious rather than responsive, and there is nothing an employee does with a
sub-five-second change.

**Escalation is offered only when it makes sense.** From `resolved` when the fix did not work, and from
`escalated` when there is more to say. Never during an active run. Offering it while Axel is working
converts autonomous resolution into a button an impatient person presses.

**An escalation from the portal requires a note.** An escalation with no new information produces a
worse ticket than the original and wastes the IT staff member's first two minutes.

**Keep `components/ticket-ui.tsx`'s idea, formalise it as `copy.ts`.** The existing `statusCopy` map is
already the right pattern. Making it the single home for all human-facing strings turns the
plain-language rule into something reviewable in one file rather than a property of the whole codebase.

**No filters, no sorting, no pagination on the request list.** An employee has a handful of requests.
Importing the dashboard's table machinery here would add weight to solve a problem this surface does not
have.

**Mobile is a first-class case, not a courtesy.** Scenario 2 is an employee whose laptop cannot reach an
internal site. The device they open the portal on is quite possibly their phone.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| The progress-marker mechanism does not exist and is requested from `api.md`, so milestone D is blocked on a change another plan owns. | Milestone D degrades cleanly: the four stages derive from ticket **status** alone, which already exists, and markers refine them when available. Build the status-driven timeline first and layer markers in. |
| The plain-language rule is easy to state and easy to break — one debug render of `step.toolOutput` during development can ship. | Two mechanisms rather than one good intention: the portal's query returns no steps, and every visible string comes from `copy.ts`. Add a lint rule or a review checklist item forbidding `toolOutput`, `toolInput` and `reasoning` identifiers anywhere in this project. |
| Three extra questions on the request form add friction to the one action the product depends on employees taking. | All three are single-click radio groups with sensible defaults pre-selected, above the fold, and the form can be submitted without changing any of them. Measure nothing; just do not make them required text. |
| Device attachment shows an employee a machine they do not recognise, or nothing at all when enrolment has not happened. | The field is absent entirely when the employee has no enrolled device, and shows hostname plus last-seen so an unfamiliar name is still identifiable. Enrolment is owned by `cli.md` milestone C. |
| Polling every open request page multiplies API load once several employees are watching tickets at once. | Poll only the detail route, only while the status is active, only when the tab is visible, at five seconds. The list page does not poll. |
| Copy written by an engineer reads like copy written by an engineer. | Concentrating every string in `copy.ts` makes a single review pass by someone else possible and cheap. That review is a task in milestone G, not an aspiration. |

---

## 8. Definition of done

1. `pnpm check` and `pnpm check-types` pass.
2. `/` redirects by session state; no scaffold content remains anywhere in the app.
3. Signed-out pages show no authenticated chrome, and `/login` opens on sign-in.
4. A submitted request carries record type, impact, urgency and — where the employee has one —
   a device, and the dashboard shows a derived priority consistent with the matrix.
5. The words *impact*, *urgency*, *priority*, *incident* and *service request* appear nowhere in
   rendered text, and every visible string originates in `copy.ts`.
6. The portal's ticket query returns no agent runs or steps; no tool name, tool input, tool output or
   model reasoning is present in any network response this client makes.
7. Watching a scenario-1 ticket without interacting shows the stages advance and reach *Done*.
8. Escalation is offered only from `resolved` and `escalated`, and requires a note.
9. Resolved → closed, resolved → escalated, and closed → reopened all work from the portal, with *fixed
   at* and *confirmed closed at* shown separately.
10. Every route has a designed loading, empty and error state, and the request detail page is fully
    usable at 375px.
11. Forms are built with `@tanstack/react-form`; no form uses raw `useState` for field values.
