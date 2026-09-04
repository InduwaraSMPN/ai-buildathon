# AI-assisted ticket intake — implementation plan

**Document role:** How the portal's `/tickets/new` becomes an AI-drafted intake flow, what each file must change, and in what order.
**Status:** Built and verified. Phases 0–5 are implemented and the gates are green across
`api`, `portal`, `dashboard` and `ui`; §7's file lists are a record of what changed rather
than a forecast. Two corrections found during implementation are marked inline (§3.8 on
the oRPC helper name, §5 on the sweep index).

As of 2026-09-04 the `pnpm e2e:local -- --run` intake leg (scenario 11b) has been executed
against a live gateway and database and passes end to end: `drafted_intent=incident`,
`drafted_title_source=ai`, one ticket created, the attachment re-parented from the draft
to the ticket with no stranded link, one public transcript message, and the draft closed
as `submitted`. The Phase 0 gateway probe also passes on all three questions — the gateway
accepts `json_schema` structured outputs, non-strict tool calling, **and** `image_url`
content parts — so the §3.7 fallback is not needed. `AXIOMA_INTAKE_VISION` nonetheless
still defaults to `false`; turning it on is a deliberate data-residency decision, not an
automatic consequence of the probe passing.

The flow has still not been driven end to end by a person in a browser. See
[ai-intake-polish-plan.md](ai-intake-polish-plan.md) §12 for the audit that followed this
document and the defects it found.
**Related:** [idea.md](../idea/idea.md) · [architecture.md](../idea/architecture.md) · [demo-plan.md](demo-plan.md)

---

## 1. What we are building

An employee opens the portal, clicks **New request**, and lands on a conversational
composer instead of a form. They describe the problem in their own words and attach
screenshots. The system searches the knowledge base first and offers an answer if one
exists. If a ticket is still needed, it drafts the ticket — summary, details, impact,
urgency, device, dynamic fields, and where appropriate a catalogue subcategory and its
form — and presents that draft as a **real, editable form**. The employee corrects it,
either by editing fields directly or by telling the assistant what to change, and only
they press submit. Submission then runs through the existing `createTicket` /
`createCatalogueRequest` paths, so everything downstream — SLA, routing, Axel, the
dashboard — is untouched.

### Confirmed scope decisions

| Decision | Choice |
|---|---|
| Entry point | `/tickets/new` becomes the assistant. A visible "Fill in the form myself" escape hatch renders the existing `RequestForm` unchanged. |
| AI scope | Full: incident drafting **and** catalogue routing **and** knowledge deflection before ticket creation. |
| Attachments | New `draft` document target. Files upload against the draft, then the links are re-parented to the ticket at submit. |
| Vision | Server-side, behind a feature flag, **off until the gateway is verified** (see §3.7). |
| Agent involvement | None. Axel is run-scoped to an existing ticket over gRPC; intake is pre-ticket and lives in the API. |

---

## 2. What the research says

Nine searches, ~90 sources. The findings that actually changed the design:

**2.1 — The form should stay visible.** ServiceNow's Now Assist deliberately hides the
catalogue form and does conversational slot-filling instead. Their own customers asked
for the form back, because "the end user may submit the catalog which he is not asking
when compared to the form where he sees all questions," and ServiceNow shipped a
per-item "make this item non-conversational" flag as a result. Slot-filling also cannot
handle reference, lookup, attachment, or many-option fields — which is most of our
catalogue form field types. Freshservice's Freddy AI Agent does the opposite and matches
our brief exactly: chat first, then "Freddy uses the details it has already gathered to
prefill your request… requesters can review and make changes if needed."
**We follow Freshservice.**

**2.2 — Deflect before drafting, and make the escape hatch loud.** Every vendor puts
knowledge retrieval ahead of ticket creation: Freddy's cited article summaries, Jira
Service Management's "AI answers" versus "intent flows" split, ServiceNow's Genius
Results cards. Freshservice also keeps a plain "Search by keyword" tab beside the
assistant. "Create a ticket anyway" must be a persistent visible control, never
something the user has to argue past.

**2.3 — Carry the transcript into the ticket.** The loudest complaint about Jira's
portal virtual agent: "We have several tickets that just say 'hi'." The conversation is
evidence and must land on the ticket.

**2.4 — Provenance needs a reversible state, not a badge.** IBM Carbon for AI is the
only mature open spec here. Its useful part is the state machine: an AI-filled field
carries an AI treatment; the moment the user overrides it, the field reverts to the
default treatment and the AI label is replaced by a **"revert to AI"** action. The
documented critique is equally useful — because Carbon's AI variants keep their
decoration even when inactive, "it's difficult to distinguish which component is
currently active (because they all look active)." On a form where nearly every field is
AI-filled, per-field decoration becomes noise. GitLab's Pajamas offers the cheap
alternative: a plain "&lt;Verb&gt; by AI" label plus a check-this-please message. Material,
Fluent and Spectrum have no AI form pattern at all — there is no convention to conform
to.

**2.5 — Suppress low confidence rather than displaying it.** Freshservice only shows a
field suggestion when prediction confidence clears 60%; the requester never sees a
number. Zendesk does surface a numeric "Intent confidence", but only in the *agent*
view. Google PAIR and Microsoft HAX both endorse communicating capability, not
necessarily a percentage. Employees cannot calibrate a percentage.

**2.6 — A one-click submit on a fully AI-filled form produces rubber-stamping.** A
PRISMA review of 35 automation-bias studies found explanations "are often insufficient
to improve decision accuracy or mitigate [automation bias]. Instead, user engagement
emerges as the most feasible and impactful point of intervention." A 2026 systematic
review of human-in-the-loop AI warns that unlayered verification degrades into
"superficial approval-based behaviors." Design implication: put friction on the
highest-stakes field, not on all of them.

**2.7 — Log every correction.** Zendesk ships a canned report on "agents' manual updates
to the Intent ticket field… to discover trends in the types of tickets for which
intelligent triage isn't predicting the correct intent." Corrections are the only free
eval signal we will ever get.

**2.8 — Streaming a form field-by-field is idiomatic and documented.** OpenAI supports
streaming with structured outputs specifically so you can "display JSON fields one by
one." TanStack AI's `useChat({ outputSchema })` exposes a `partial` (`DeepPartial<T>`)
and a `final`, and its own headline example is "a form filling in field by field". Two
gotchas from those docs: on the streaming path the schema is used for TypeScript
inference only and validation does **not** run, so validate the completed object
yourself; and non-streaming adapters emit a single completion event with no deltas, so
the renderer must handle `partial` staying empty.

**2.9 — Accessibility of a streaming, self-filling form.** `aria-live="polite"` with
`aria-atomic="false"` so only new content is announced, `aria-busy="true"` while
streaming, never steal focus from the input, debounce announcements into 2–3 second
batches. An AI value arriving in a field is a change a sighted user sees and a screen
reader user does not — announce the *summary* ("6 fields filled, review before
sending"), not each field mutation.

**2.10 — Structured output mechanics.** The most common schema mistake for a
partial-fill form is making fields *optional* instead of *nullable*: strict mode
requires every property in `required`, so "the model could not determine this" must be
expressed as a nullable type. JSON mode is not structured outputs — it guarantees
parseable JSON, not schema conformance.

**2.11 — Vision is not yet standard, but the pattern is well-trodden.** No major ITSM
product ships screenshot-reading in requester intake today. Zendesk customers are still
filing ideas asking for it. ServiceNow's Virtual Agent accepts JPEG/PNG uploads and can
answer about them. Third-party layers (Macha for Zendesk, shipped April 2026) do exactly
what we would do: fetch the attachment, base64-encode it, send the pixels. The
documented DIY recipe — screenshot → vision model prompted to extract "error codes,
software state, visible settings, user interface context, and any text present" →
structured fields → ticket — is our exact use case, and error dialogs with legible text
are the highest-accuracy category. The real constraint is privacy: a screenshot of an
error dialog routinely captures the rest of the desktop.

---

## 3. Design decisions

### 3.1 — Three stages, one route

`/tickets/new` renders one of three stages. It is a single route, not a wizard with
URLs, so a mistaken back-button never loses the draft.

**Stage 1 — Compose.** Centred, quiet. Large prompt input, attachment tray, three
suggestion chips seeded from the top request-catalogue subcategories, a disabled
microphone button with a "Voice input is coming soon" tooltip. This is where the
21st.dev reference layout lands, rebuilt on our own primitives.

**Stage 2 — Triage.** The transcript appears. The assistant shows what it is doing
("Searching help articles…", "Reading your screenshot…", "Drafting your request…"), then
returns either knowledge-article cards with a "This solved it" / "Create a request
anyway" pair, or a clarifying question, or moves straight to stage 3.

**Stage 3 — Review.** Two panes on desktop: transcript on the left (narrow, scrollable),
the generated form on the right and dominant. Below `lg`, a two-tab layout — Conversation
/ Your request — with the form tab active by default and a badge on Conversation when a
new assistant message arrives. The form is the real form: same `Field`, `Input`,
`Textarea`, `RadioGroup`, `Select` and `CatalogueField` primitives the manual path uses,
because a second rendering of the same fields would drift.

### 3.2 — Provenance treatment

Form-level banner: **"Drafted from your description. Check it before sending."** Per
field, a small `AiLabel` marker appears only while the field still holds the AI value
and the user has not touched it. On first edit the marker is replaced by a ghost
**"Revert to draft"** button. Carbon's state machine, without Carbon's glow — the
decoration is a token-coloured marker, not a gradient, which also keeps the design-system
validator happy and avoids the "everything looks active" failure.

Low-confidence fields are **left empty**, not filled with a guess, and collected into a
single "Needs your input" summary line above the form. No percentages anywhere in the
portal. (Confidence can surface in the dashboard later, Zendesk-style, if we want it.)

### 3.3 — Anti-rubber-stamping friction

Submit is a distinct **"Approve and send"** action, and it is blocked until:

- `title` and `body` pass the existing zod bounds, and
- if the AI chose a **catalogue subcategory**, the user has explicitly confirmed that
  choice (it is the routing decision — the single highest-stakes field), and
- no mandatory catalogue field is still empty.

That is one deliberate interaction, not a checklist on every field. Everything else
stays a single click.

### 3.4 — The transcript lands on the ticket

Stored on the draft row and copied server-side at submit into one **public**
reporter-authored ticket message, inside the same transaction as the ticket insert.
Server-side rather than a follow-up client call, so a failed second request cannot leave
a ticket with no context.

Public rather than analyst-only: the portal contract has no private-note write path, so
private would need a new server-side writer, and the content is what the employee typed
in the first place — there is nothing there they cannot already see. If we later decide
the transcript should be analyst-only, that is a new write path plus a migration over
messages already written, so the call is worth revisiting before Phase 1 lands and not
after.

### 3.5 — Corrections become a signal

The draft row keeps `aiDraft` (the model's verbatim output) alongside `values` (the
effective values after the user's edits) and `fieldSources` (`ai` | `user` per key).
After submit the row is retained with `status = 'submitted'`. A diff query over those
three columns gives us Zendesk's "changes to intent" report for free, with no extra
table.

### 3.6 — Two model calls, not one

Feeding every published catalogue form's full field list into one prompt does not scale —
`listRequestCatalogue` returns each subcategory *with* its form and every field's
options, validation and conditions.

- **Call A — classify and draft.** Input: the user's message, the transcript, the
  device list, the ticket dynamic-field definitions, and the catalogue as
  *name + description only*. Output: intent, assistant message, optional clarifying
  question, the incident fields, and at most one `subcategoryId`.
- **Call B — fill the catalogue form.** Only when call A returned a subcategory. Input:
  that one form's fields. Output: values for those fields.

Call B is skipped for the incident path, which is the common case and the fast path.

### 3.7 — Vision: server-side, flagged, off by default

**Recommendation: build it, ship it behind `AXIOMA_INTAKE_VISION`, default off, and turn
it on only after the gateway probe in Phase 0 passes.**

Why server-side: the blob is already in `FileBlobStore` by the time drafting starts, so
the API reads it directly. No base64 round-trip through the browser, no bloated RPC
payload, and the raw image never enters our own request logs.

Why flagged: `axioma/agent/axel/config.py` sets `strict_function_calling: bool = False`
and the agent README says "Marketrix currently requires
`AXIOMA_STRICT_FUNCTION_CALLING=false`". That is direct evidence the gateway is **not**
at full OpenAI parity. Multimodal `image_url` content parts must be proven, not assumed.

Guards, all from the research: `image/png|jpeg|webp` only; at most 3 images per draft;
skip any image over 2 MB (no `sharp` dependency in phase 1 — revisit if we want
downscaling); prompt for *specific* elements (error codes, dialog text, application
name, visible settings) rather than "describe this image"; base64 never persisted; and an
explicit UI line — **"Axel will read your screenshots to fill in the form"** — beside the
existing "don't include passwords" notice, with a per-attachment opt-out.

If the probe fails, the same code path degrades to passing filenames and media types as
text context, and the flag simply stays off.

### 3.8 — Streaming over oRPC, not TanStack AI

Use oRPC's `eventIterator` for the draft procedure. Reasons:

- **No new dependency.** `@orpc/tanstack-query` is already in the portal and supports
  streamed procedures.
- **It stays inside the contract mirror.** `axioma/README.md` makes contracts the
  boundary; `@tanstack/ai-react` would need its own SSE endpoint outside `appContract`
  and outside `pnpm contracts:publish`, which is exactly the drift the mirror exists to
  prevent.
- **It degrades cleanly.** A non-streaming model yields one terminal event, which is the
  same case TanStack AI documents for its non-streaming adapters.

**Correction, verified against the installed package.** An earlier draft of this plan
named `asyncIteratorObject` as the current helper and called `eventIterator` a deprecated
alias. That is true of oRPC's main branch, not of the pinned version: `@orpc/contract@1.15.0`
exports `eventIterator` and nothing else. `eventIterator` is the correct name here, and
importing it under an `asyncIteratorObject` alias only obscures that.

Per §2.8 we validate the completed object with zod server-side regardless of what
streamed, and the client renderer must handle `partial` never arriving.

The portal is a static SPA served by nginx that does **not** proxy `/rpc` — the browser
calls the API origin directly via `apiUrl()`. So there is no nginx buffering problem for
SSE. Confirm the Hono/`@hono/node-server` path does not buffer (Phase 0).

### 3.9 — The 21st.dev component: take the layout, not the file

The pasted `ai-assistant-interface.tsx` cannot go into this repo as-is. Concretely, it
fails four of our own CI checks in `design-system.validation.mjs`:

| Rule | What breaks |
|---|---|
| `product source does not import lucide-react` | every icon in the file |
| `vendored ui primitives stay on token colours` | `bg-blue-600`, `text-gray-500`, `bg-white`, `border-gray-200`, … |
| `space utilities do not exceed the per-file baseline` | `space-x-1`; a new file's baseline is 0 |
| type scale | hand-set sizes |

Plus: `framer-motion` is not a portal dependency and nothing else in either frontend uses
it. And the supplied setup instructions target Tailwind v3 (`tailwind.config.ts`,
`@tailwind base`, HSL variables, `tailwindcss-animate`) while this repo is Tailwind v4
CSS-first with oklch tokens in `styles/globals.css`, and Base UI rather than Radix.

**What we do instead:** rebuild the same layout and interaction model as a governed
primitive, `axioma/ui/src/components/ui/prompt-input.tsx`, composing the primitives that
already exist — `InputGroup`/`InputGroupAddon`/`InputGroupButton`/`InputGroupTextarea`,
`Attachment`, `Item`, `Empty`, `Spinner`, `Tooltip` — with Remix Icon glyphs and semantic
tokens. Result looks like the reference, passes `pnpm validate`, and mirrors into the
dashboard for free. Motion comes from `tw-animate-css`, already imported.

The shadcn `tanstack-ai` helper referenced in the brief targets TanStack Start's server
routes; we are a Vite SPA talking to a separate Hono API, so it does not apply. Its
component vocabulary is worth reading for naming, nothing more.

---

## 4. Architecture

```
portal /tickets/new
  │  startIntakeDraft ──────────────► API  intake router  ──► ticket_drafts row
  │  POST /api/documents (targetType=draft, targetId=draftId)
  │                                       └─► document_links (draft → blob)
  │  sendIntakeMessage  ────stream────►      ├─ deflection: search(knowledge_article)
  │                                          ├─ vision: FileBlobStore.read(sha256)
  │                                          └─ 2 calls to AXIOMA_LLM_API_BASE
  │  ◄─── status / message / deflection / field / complete
  │  patchIntakeDraft (user edits, records fieldSources)
  │  submitIntakeDraft ─────────────►      ├─ createTicket | createCatalogueRequest
  │                                        ├─ re-parent document_links draft → ticket
  │                                        └─ transcript → ticket message
  └─ navigate to /tickets/$ticketId
```

The re-parenting step is the payoff of the draft-target decision: one
`UPDATE document_links SET target_type='ticket', target_id=$ticketId WHERE
target_type='draft' AND target_id=$draftId`. The blobs are never re-read, re-hashed or
re-uploaded.

No change to `axioma/agent`, `axioma/cli`, or `axioma/dashboard` behaviour. The dashboard
picks up the new UI primitives through the mirror but does not have to use them.

---

## 5. Data model

New table, one migration.

```
ticket_drafts
  id                text primary key
  reporter_id       text not null → user(id) on delete cascade
  status            text not null            -- 'open' | 'submitted' | 'discarded'
  intent            text                     -- 'incident' | 'catalogue_request' | 'knowledge_answer' | null
  transcript        jsonb not null default '[]'   -- [{role, body, createdAt}]
  ai_draft          jsonb                         -- last verbatim model output
  values            jsonb not null default '{}'   -- effective values after user edits
  field_sources     jsonb not null default '{}'   -- key → 'ai' | 'user'
  subcategory_id    text → service_subcategories(id)
  form_id           text → forms(id)
  ticket_id         text → tickets(id)
  model             text
  prompt_tokens     integer
  completion_tokens integer
  created_at        timestamp not null default now()
  updated_at        timestamp not null default now()

  index (reporter_id, status, updated_at)
  index (status, updated_at)          -- the TTL sweep's own predicate
```

The second index is not redundant with the first: the sweep selects on
`status AND updated_at` with no reporter, which a composite led by `reporter_id`
cannot serve.

`document_links.target_type` is a plain `text NOT NULL` column with **no CHECK
constraint** (verified in `0000_baseline.sql`). Adding `'draft'` therefore needs **no SQL
change to that table** — only the TypeScript union `DOCUMENT_TARGET_TYPES` widens.

Abandoned drafts are swept on the same pattern as `sweepKnowledgeGaps` in
`api/src/index.ts`: delete `ticket_drafts` older than `AXIOMA_INTAKE_DRAFT_TTL_HOURS`
(default 72) with `status = 'open'`, cascading their document links, and remove any blob
that no link references.

---

## 6. Contract

New `intakeContract`, added to both `appContract` and `portalContract`.

```ts
startIntakeDraft   (input: {})                          → DraftSummary
sendIntakeMessage  ({draftId, body})                    → eventIterator(IntakeEvent)
getIntakeDraft     ({draftId})                          → DraftSummary | null
patchIntakeDraft   ({draftId, values, sources})         → DraftSummary
submitIntakeDraft  ({draftId, idempotencyKey})          → {ticketId, approval | null}
discardIntakeDraft ({draftId})                          → {deleted: boolean}
intakeCapabilities ()                                   → {enabled: boolean, vision: boolean}
```

`startIntakeDraft` exists so attachments have a `targetId` before the first message.

Streamed event union:

```ts
| {type:'status',     stage:'retrieving'|'reading_attachments'|'drafting'|'classifying'}
| {type:'message',    delta: string}
| {type:'deflection', articles: {id, title, summary}[]}
| {type:'field',      path: string, value: unknown, confidence: 'high'|'low'}
| {type:'complete',   draft: DraftSummary}
| {type:'error',      code: string, message: string}
```

Model output schema — **nullable, never optional** (§2.10), with confidence carried per
field so we can suppress low-confidence values (§3.2):

```ts
const drafted = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    value: inner.nullable(),
    confidence: z.enum(['high','low']),
    reason: z.string().nullable(),
  });
```

`intakeCapabilities` mirrors the existing `portalIsFrontDoor` pattern and lets the portal
render the manual form directly when `AXIOMA_LLM_KEY` is unset, rather than showing an
assistant that cannot answer.

---

## 7. Files to change

### 7.1 — `axioma/api`

**New**

| File | Purpose |
|---|---|
| `src/db/schema/intake.ts` | `ticketDrafts` table, `INTAKE_DRAFT_STATUSES`, `INTAKE_INTENTS` |
| `src/db/migrations/00NN_ticket_drafts.sql` | generated by `pnpm db:generate` |
| `src/contracts/intake.ts` | `intakeContract`, `DraftSummary`, `IntakeEvent`, the drafted-value schemas |
| `src/server/intake/index.ts` | draft lifecycle: create, load, append message, patch, submit, discard, sweep |
| `src/server/intake/model.ts` | `fetch` to `AXIOMA_LLM_API_BASE/chat/completions`; SSE parse; one repair retry on zod failure; token accounting |
| `src/server/intake/schema.ts` | zod schema for model output plus the JSON Schema handed to the model |
| `src/server/intake/prompt.ts` | system prompt; context assembly for call A and call B |
| `src/server/intake/deflection.ts` | knowledge retrieval, reusing `server/search` scoped to `knowledge_article` and the portal audience |
| `src/server/intake/vision.ts` | read blobs via `FileBlobStore`, filter by media type and size, build `image_url` content parts |
| `src/server/intake/submit.ts` | transactional submit: create ticket or catalogue request, re-parent document links, write transcript message |
| `src/server/routers/intake.ts` | handlers on `capabilityProcedure('ticket.create')` |
| `src/server/intake/intake.test.ts` | schema validation, repair path, subcategory-id whitelisting, re-parenting, low-confidence suppression |
| `scripts/probe-intake-model.mjs` | Phase 0 throwaway: does the gateway accept `json_schema` and `image_url`? |

**Modified**

| File | Change |
|---|---|
| `src/db/schema/documents.ts` | `DOCUMENT_TARGET_TYPES` gains `'draft'` |
| `src/db/schema/index.ts` | export the intake schema |
| `src/server/documents/index.ts` | widen `DocumentTarget` |
| `src/server/documents/access.ts` | `canReadTarget` handles `draft` (owner only, `status='open'`); `requireDocumentWriteTarget` permits a reporter writing to their own draft |
| `src/server/documents/http.ts` | accept `targetType === 'draft'`; use `ticket.create` for draft targets rather than `ticket.update` |
| `src/contracts/index.ts` | add the intake procedures to `appContract` and `portalContract` |
| `src/server/routers/index.ts` | wire `intakeRouter` |
| `src/env.ts` | `AXIOMA_INTAKE_MODEL`, `AXIOMA_INTAKE_VISION`, `AXIOMA_INTAKE_TIMEOUT_MS`, `AXIOMA_INTAKE_MAX_TURNS`, `AXIOMA_INTAKE_DRAFT_TTL_HOURS` |
| `src/index.ts` | schedule the abandoned-draft sweep beside `scheduleKnowledgeGapSweep` |
| `scripts/e2e-local.mjs` | an intake leg: start draft → send message → submit → assert ticket and attachment |

### 7.2 — `axioma/ui` (governed primitives — edit here, never in the apps)

**New**

| File | Purpose |
|---|---|
| `src/components/ui/prompt-input.tsx` | `PromptInput`, `PromptInputBody`, `PromptInputAttachments`, `PromptInputToolbar`, `PromptInputSubmit`, `PromptInputSuggestion` — the rebuilt 21st.dev layout on `InputGroup` + `Attachment` |
| `src/components/ui/ai-label.tsx` | `AiLabel` marker and `AiRevert` ghost action — Carbon's provenance state machine on our tokens |

**Modified**

| File | Change |
|---|---|
| `manifest.json` | add both new files to **both** apps; add to the **portal** list: `components/ui/attachment.tsx`, `components/ui/tabs.tsx`, `components/ui/kbd.tsx` (and `scroll-area.tsx` only if `MessageScroller` proves insufficient) |

Then `pnpm --dir axioma/ui mirror`, which regenerates the copies under
`axioma/portal/src` and `axioma/dashboard/src`. CI runs `--check`.

### 7.3 — `axioma/portal`

**New**

| File | Purpose |
|---|---|
| `src/features/intake/copy.ts` | every user-facing string, matching the `requestFormCopy` convention |
| `src/features/intake/types.ts` | draft, event and field-source types derived from the mirrored contract |
| `src/features/intake/state/draft-reducer.ts` | pure reducer folding `IntakeEvent`s and user edits into draft state; owns `fieldSources` |
| `src/features/intake/state/draft-reducer.validation.mjs` | `node --test` cases: field overwrite protection, revert-to-AI, low-confidence suppression, out-of-order events |
| `src/features/intake/api/mutations.ts` | `startIntakeDraft`, `sendIntakeMessage` (async-iterator consumption + abort), `patchIntakeDraft`, `submitIntakeDraft`, `discardIntakeDraft` |
| `src/features/intake/components/intake-composer.tsx` | stage 1 |
| `src/features/intake/components/intake-conversation.tsx` | stage 2/3 transcript on `Message` + `MessageScroller` + `Bubble`, with the live region from §2.9 |
| `src/features/intake/components/deflection-cards.tsx` | knowledge cards, "This solved it" / "Create a request anyway" |
| `src/features/intake/components/draft-review.tsx` | stage 3 form; reuses `Field`, `Input`, `Textarea`, `RadioGroup`, `Select`, `DynamicFields`, `CatalogueField` |
| `src/features/intake/components/field-provenance.tsx` | wraps a field with `AiLabel` / "Revert to draft" |
| `src/features/intake/components/attachment-tray.tsx` | upload against the draft, per-file vision opt-out |
| `src/features/intake/components/subcategory-confirm.tsx` | the one deliberate confirmation from §3.3 |

**Modified**

| File | Change |
|---|---|
| `src/routes/_auth/tickets/new.tsx` | becomes the stage router; reads `?mode=manual`; falls back to `RequestForm` when `intakeCapabilities.enabled` is false |
| `src/features/tickets/components/request-form.tsx` | accept an optional `initialValues` prop so the escape hatch can carry a partial draft across; extract `catalogueFields()` and the two zod schemas into a shared module so intake and manual paths validate identically |
| `src/features/documents/api.ts` | `UploadDocumentsInput['targetType']` gains `'draft'` |
| `src/components/design-system.config.json` | register any new `SelectGroup` / `DropdownMenuGroup` call sites the new files introduce |
| `src/components/design-system.space-baseline.json` | only if a new file genuinely needs `space-y-*`; prefer `gap-*` and add nothing |
| `src/sdk/contracts/*` | regenerated by `pnpm --dir axioma/api contracts:publish` |
| `src/routeTree.gen.ts` | regenerated by the router plugin |

### 7.4 — `axioma/deploy`

| File | Change |
|---|---|
| `helm/axioma/values.yaml` | the five new `AXIOMA_INTAKE_*` values |
| `helm/axioma/templates/api.yaml` | pass them into the API deployment |
| `examples/*.yaml` | document the new values |

### 7.5 — Not changed

`axioma/agent`, `axioma/cli`, `axioma/web`, `axioma/portal/deploy/nginx.conf`
(the SPA does not proxy the API), and every existing ticket, SLA, routing or dashboard
behaviour.

---

## 8. Sequencing

**Phase 0 — Gateway probe.** *Blocking.* `scripts/probe-intake-model.mjs` answers three
questions against `AXIOMA_LLM_API_BASE`: does `response_format: {type:'json_schema'}`
work, does non-strict tool calling work as a fallback, and does an `image_url` content
part return a sensible answer for a screenshot? Also confirm SSE is not buffered through
`@hono/node-server`. Everything in §3.7 and §3.8 depends on the answers.

**Phase 1 — API, headless.** Schema, migration, contract, prompt, model call, submit
transaction, tests. Provable with `pnpm test` and `pnpm e2e:local` before any UI exists.

**Phase 2 — Primitives.** `prompt-input.tsx`, `ai-label.tsx`, manifest, mirror. Gate:
`pnpm --dir axioma/ui check` and `pnpm validate` in both apps.

**Phase 3 — Portal, incident path only.** Stages 1–3, manual escape hatch, no deflection,
no catalogue. This is the first demoable slice.

**Phase 4 — Deflection and catalogue routing.** Knowledge cards, call B, the subcategory
confirmation.

**Phase 5 — Vision, streaming polish, accessibility, telemetry.** Turn the vision flag on
if Phase 0 passed; live-region debouncing; the correction diff query.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Gateway is not OpenAI-parity — `strict_function_calling` is already forced off for Axel | Phase 0 probe; zod validation plus one repair retry regardless of which mechanism works |
| Catalogue context blows the prompt | Two calls (§3.6); call B sees exactly one form |
| Model invents a `subcategoryId` | Server-side whitelist against `listRequestCatalogue`; unknown ids dropped and the field left empty |
| Latency kills the feel | Target first field under 6 s; `AXIOMA_INTAKE_TIMEOUT_MS` default 45 000; status events from the first millisecond so nothing is ever a bare spinner (the demo-plan's own lesson) |
| Screenshots leak the whole desktop | Explicit notice, per-attachment opt-out, images never persisted as base64, flag defaults off |
| Design-system CI rejects the new UI | Build on governed primitives from the start; run `pnpm validate` in Phase 2, not at the end |
| Abandoned drafts accumulate blobs | TTL sweep on the `sweepKnowledgeGaps` pattern |
| Rubber-stamping | §3.3 — one deliberate confirmation on the routing decision |

---

## 10. Settled details

These were the last five judgement calls. All are now decided; each is recorded with the
reasoning so a later reader can tell a default from a deliberate choice, and none of them
blocks Phase 0.

| Question | Decision | Why, and how expensive to change |
|---|---|---|
| Transcript visibility | **Public reporter message** | The employee wrote it; there is nothing in it they cannot already see, and `portalContract` has no private-note writer. Reversing this later means a new write path plus a migration over messages already written — so revisit before Phase 1 lands, not after. |
| Draft retention | **72 hours** | `AXIOMA_INTAKE_DRAFT_TTL_HOURS`. One env var, changeable once we can see how often people abandon a draft and come back. |
| Voice input | **Visible, disabled, tooltip** | Fixed by the brief: the icon ships in the initial release, the capability does not. A visible-but-disabled control also sets the expectation that it is coming. |
| Deflection strength | **One click to a ticket, always** | §2.2 is unambiguous across every vendor: the escape hatch is persistent and visible, never something the user has to argue past. A confident knowledge answer changes what we show, never what they can do. |
| Suggestion chips | **Seeded from the top catalogue subcategories, hand-written fallback** | Real chips beat invented ones, and they stay correct as the catalogue changes. The fallback covers a fresh install with an empty catalogue. `listRequestCatalogue` exposes no popularity signal, so "top" is approximated as "actually fileable, then alphabetical". |
| §3.9 composition, partially | **Accepted as debt** | `prompt-input.tsx` composes `InputGroup`, `InputGroupTextarea`, `Tooltip` and `Spinner`, but its attachments row, toolbar and suggestion chips are hand-rolled shells rather than `InputGroupAddon` / `InputGroupButton` / `Item` / `Empty`. The rendered result is on-token and passes every validator; rewriting it buys governance tidiness at the cost of churning a layout that was reviewed and approved. Worth doing next time this file is opened, not on its own. |

Two things stay genuinely unknown until Phase 0 answers them, and both are already
designed to degrade rather than block: whether the gateway accepts `json_schema`
structured outputs (§3.9 fallback: non-strict tool calling, zod validation either way),
and whether it accepts `image_url` content parts (§3.7 fallback: filenames and media
types as text, flag stays off).
