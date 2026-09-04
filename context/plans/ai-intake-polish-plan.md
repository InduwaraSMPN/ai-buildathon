# AI Intake — Polish & Hardening Plan

**Document role:** How we harden the landed `ai-intake-plan.md` implementation (Phases 0–4) to a clean, shippable state. It audits the current tree at `f839433` + 62 staged files, pulls current library docs via Context7, and lists the exact per-file edits required. No new product surface — only correctness, wiring, and CI gates.
**Status:** Superseded in part — read §12 first. The core spine (draft lifecycle → 2-call model → review → transactional submit → TTL sweep + orphan GC) lands and passes every gate. The seven gaps below were audited on 2026-09-04; several had already been fixed, two were fixed *against* this document's recommendation and correctly so, and the audit found nine further defects this plan did not anticipate. §12 records what is actually true. Where §§1–11 and §12 disagree, §12 is the one that was verified against the code.
**Related:** [ai-intake-plan.md](ai-intake-plan.md) · [idea.md](../idea/idea.md) · [architecture.md](../idea/architecture.md)
**Stack at HEAD:** `axioma/api` `@orpc/contract@1.15.0` (`eventIterator` alias), `zod@4.4.3` (`z.toJSONSchema`), `drizzle-orm` `pgTable`, `portal` `@tanstack/react-query@5`, `ui` Tailwind v4 + `oklch` + Base UI (no Radix), `tw-animate-css`.

---

## 1. What we are polishing

The employee flow already works: `/tickets/new` composer → `startIntakeDraft` → `sendIntakeMessage` (deflection short-circuit or classify→draft with `whitelistSubcategory`/`suppressLowConfidence`) → review (`Drafted from your description` + `Needs your input` + `AiLabel`/`Revert` + `SubcategoryConfirm` + `Approve and send` gated on `subcategoryConfirmed`) → `patch`+`submit` (`UPDATE document_links draft→ticket` + public `transcript` message in one `db.transaction`) → TTL sweep + `removeOrphanedIntakeBlobs` hourly, behind `intakeCapabilities` + `AXIOMA_INTAKE_VISION=false` + `hasKey` helm fix.

We now **wire what was staged but not plugged** and **remove what was stubbed but never used**, so a clean checkout passes every gate without `??` files and without `void` leaks.

### Remaining gaps (ordered, all non-blocking for demo but blocking for merge)

| # | Gap | Where | Impact |
|---|---|---|---|
| G1 | `eventIterator` deprecated alias in 3 contract files | `api/src/contracts/intake.ts:1,74` + mirrors `portal/.../intake.ts` + `dashboard/.../intake.ts` | Plan §3.8 requires `asyncIteratorObject` (v2 name). `1.15.0` still works via alias, but will break on next `@orpc` upgrade. |
| G2 | Missing `e2e-local.mjs` intake leg | `api/scripts/e2e-local.mjs:1` | Plan §7.1 single acceptance proof `start→message→submit→ticket+attachment` absent. |
| G3 | Streaming stubbed — `parseSse` dead, router non-streaming | `api/src/server/intake/model.ts:108` + `routers/intake.ts:212` | Plan §3.8 `asyncIteratorObject` streaming `partial` + terminal; currently yields `status` then awaits single `callIntakeModel` and yields `message/field/complete` once. `stream:true` + incremental `yield field` never exercised. |
| G4 | Vision per-attachment opt-out local only | `portal/src/features/intake/components/attachment-tray.tsx:179` `read` + `api/src/server/intake/vision.ts:28` `readDraftImages(draftId)` | Spec §7.3 per-file checkbox exists, but `readDraftImages` reads all `document_links where draft` unconditionally; `read` never leaves component (`onChange?` unused in composer). Also `readDraftImages(_draftId)` first param ignored. |
| G5 | Draft not recoverable after reload | `portal/src/routes/_auth/tickets/new.tsx:151` `useEffect startDraft if !draftId` | Refresh loses `draftId` + attachments orphaned until TTL; `getIntakeDraft` exists server-side but never called to rehydrate. |
| G6 | Deflection lexical `ilike` vs `server/search` semantic | `api/src/server/intake/deflection.ts:11` | Plan §7.1 requires reuse of `server/search` scoped `knowledge_article` + portal audience + embeddings; current `ilike title/body` weaker. |
| G7 | Minor drift | `portal/src/features/tickets/form-schema.ts` vs `portal/src/features/intake/types.ts` duplicated `IncidentValues`, `probe` timeout env name `AXIOMA_LLM_TIMEOUT_MS` vs `AXIOMA_INTAKE_TIMEOUT_MS`, `model.ts` stream token loss | Keeps `gap-*`/`Ri*`/no-`any` hygiene; not demo-blocking. |

All other §7 files already land and pass gates (see §7 audit below). G7 is polish; G1–G6 are the only file edits proposed.

---

## 2. What the research says

Four Context7 pulls on `HEAD` stack + 93-file audit.

**2.1 — oRPC streaming is contract-first, not TanStack AI.** Pull `dinwwwh/orpc` `async-iterator-object.mdx` + `migrations/from-v1.mdx` confirms: v2 `asyncIteratorObject` replaces v1 `eventIterator` (`@deprecated Use asyncIteratorObject instead` in `packages/contract/src/index.ts`). Server uses `os.output(asyncIteratorObject(z.object({message:z.string()}))).handler(async function*(){yield {message:'Hello'}})`, client iterates `const it = await client.streaming(); for await (const e of it) …`, and SSE is `Content-Type:text/event-stream` per `openapi/serializer.mdx` (`event: message\ndata: {...}`). We keep `@orpc/tanstack-query` and stay inside `appContract/portalContract` (`pnpm contracts:publish`) — no `@tanstack/ai-react` endpoint. Non-streaming adapters emit single `complete` (§2.8) — renderer handles `partial` staying empty. The fix is a 1-line import rename + `pnpm contracts:publish`; alias `eventIterator as asyncIteratorObject` already keeps `1.15.0` green (audit re-check) and will be replaced by literal `asyncIteratorObject` after upgrade to `2.0.0-beta.32`.

**2.2 — Zod 4.4.3 ships `z.toJSONSchema`.** Pull `colinhacks/zod` `json-schema.mdx` confirms: `z.toJSONSchema(schema,{target:"draft-7"})` returns `{type:'object', properties:{name:{type:'string'}}, required:['name'], additionalProperties:false}`. `nullable` becomes `type:["string","null"]` or `anyOf` when constraints present — exactly the `drafted<T>` nullable (not optional, §2.10 strict mode). We landed `incidentDraftJsonSchema = z.toJSONSchema(incidentDraftSchema,{target:"draft-7"})` stripping `$schema` and `catalogueFormValuesJsonSchema`; router now passes JSON Schema with `strict:true`. No `zod-to-json-schema` dep required. No further change.

**2.3 — Drizzle `pgTable` + index callback is correct.** Pull `drizzle-team/drizzle-orm-docs` `pg/sql-schema-declaration.mdx` + `relations-v2.mdx` confirms `pgTable("ticket_drafts",{...},(t)=>[index("ticket_drafts_reporter_status_idx").on(t.reporterId,t.status,t.updatedAt)])` + `text("reporter_id").notNull().references(()=>user.id,{onDelete:"cascade"})` + `status text enum` + `foreignKey` callback pattern match our `schema/intake.ts:26-67`. Migration `0001_skinny_mojo.sql` + `_journal.json` + `meta/0001_snapshot.json` already generated via `drizzle-kit generate`; `document_links.target_type text NOT NULL` with no CHECK is verified in `0000_baseline.sql:674` and `meta/0001_snapshot.json:7353` (`checkConstraints:{}`) — plan §5 “no SQL change” correct. No file edit; only `pnpm db:migrate` on target env.

**2.4 — TanStack Query cancellation is `queryFn({signal}) → fetch(...,{signal})`.** Pull `tanstack/query` `query-cancellation.mdx` (React/Vue/Angular) confirms `useQuery({queryFn:async ({signal})=>{ const r=await fetch('/todos',{signal}); return r.json() }})` + `queryClient.cancelQueries`. For oRPC `AsyncIterable`, there is no `queryFn` signal; the correct pattern is `client.sendIntakeMessage({draftId,body},{signal})` (or second arg) and `iterator.return()` on abort. We landed `mutations.ts:35-65` `withSignal` fallback + `abortHandler` → `void closer?.call(iterator)` + `removeEventListener` — research confirms this is the idiomatic oRPC+TanStack abort wiring. No further change; keep as landed.

**2.5 — Existing system constraints still hold.** `portal/src/components/ui` is GENERATED via `pnpm --dir ui mirror` (banner `Mirrored from axioma/ui/src`); new primitives `prompt-input.tsx`/`ai-label.tsx` use `InputGroup`/`Tooltip` + `Ri*` + token `border-border bg-card bg-info/10` (0 `lucide-react`/`framer-motion`/`bg-blue-600`/`space-x-1`); `design-system.validation.mjs` + `space-baseline.json` prefer `gap-*` (intake uses `gap-*` only, baseline stays `0`), `statusPaletteFiles` now `warning` token not `amber`, `groupedCallSites` already has `draft-review.tsx: SelectGroup:1`; `request-form.tsx` already `initialValues` + shared `form-schema.ts` so intake + manual validate identically; helm `hasKey` fix already lands `AXIOMA_INTAKE_VISION=false`.

---

## 3. Design decisions (polish)

**3.1 — Fix G1 by version-gated rename, not a big upgrade.** Keep `1.15.0` green now via `import {eventIterator as asyncIteratorObject} from "@orpc/contract"` (already landed) so `check-types` passes; schedule a one-shot upgrade to `2.0.0-beta.32` (`@orpc/*` all `2.0.0-beta.32`) that flips to literal `import {asyncIteratorObject}` where `eventIterator` becomes the deprecated alias. No `oRPC` dep churn in this polish PR.

**3.2 — G3: document non-streaming degradation, don’t ship fake streaming.** Either enable `stream:true` + incremental `field` yields (model-dependent, needs gateway SSE buffering probe from Phase 0) or delete dead `parseSse`/`stream` param and keep non-streaming `yield {type:"message",delta}` + `yield {type:"field"}` once (already landed for `field` events) and explicitly note in `model.ts` header that intake degrades to single terminal event per TanStack AI §2.8 (`renderer must handle partial staying empty` — `intake-conversation.tsx` already does). Polish PR chooses the latter: remove dead `if(input.stream===true) parseSse` or keep behind `stream` flag for future, but do not claim streaming that isn’t exercised. Keeps Hono/`@hono/node-server` no-buffer assumption verified by `field` events already yielding.

**3.3 — G4: wire `read` to server, not new table.** `attachment-tray.tsx` already emits `onChange` with `DraftAttachment[]` including `read`; composer should collect `read` map and include it in `sendIntakeMessage` input as `{draftId, body, excludedAttachments?: string[]}` or as a `patchIntakeDraft` flag. Minimal change: add `excludedAttachments: z.array(z.string()).optional()` to `sendIntakeMessage` input in `contracts/intake.ts`, filter `readDraftImages` by `excludedIds` set, and pass `excludeIds` from portal (`attachments.filter(a=>!a.read).map(a=>a.id)`). No new column.

**3.4 — G5: rehydrate via URL `draftId`, not `sessionStorage` alone.** `sessionStorage` carry for manual `initialValues` already lands (`new.tsx:199`); for draft recovery, also persist `draftId` in `?draftId=` search or `sessionStorage.getItem("intake_draft_id")` and on mount `if (savedDraftId) { const d = await orpc.getIntakeDraft.call({draftId:savedDraftId}); if(d) setState(applyDraft(...)) }` else `startDraft`. Keeps single route, back-button safe, and reload recovers attachments.

**3.5 — G6: leave lexical `ilike` for polish, flag semantic as Phase 5.** `server/search` requires embeddings + `portal audience` helper; lexical `ilike` already scoped `published` ∧ `audience∈{public,employees}` ∧ `!isRestricted` limit 3 and passes deflection UX (§2.2 “Create a request anyway” persistent). Polish PR keeps it, adds a `// TODO(search): swap to server/search hybrid` comment, and adds an E2E assertion that deflection still returns `title/summary` shape.

**3.6 — G2: add E2E leg as `scripts/e2e-local.mjs` scenario 11.** One scenario: `startIntakeDraft → sendIntakeMessage "laptop won’t boot" → assert `draft.values.title/body` + `fieldSources` + `intent=incident` → `patchIntakeDraft` edit → `submitIntakeDraft` → assert `ticketId` + `document_links target_type='ticket'` re-parent + `ticketMessages public transcript` row. Reuses existing `e2e-local.mjs` harness (no new infra).

**3.7 — G7 drift:** unify `IncidentValues` (hand-written `types.ts:18` vs `z.input<typeof incidentSchema>`) by re-exporting `type IncidentValues = z.input<typeof incidentSchema> & {customFields:…}` or keep mapping tables `impactToKey`/`timingToKey` as landed (already correct) and note duplication.

---

## 4. Architecture (unchanged, now fully wired)

```
portal /tickets/new
  │  startIntakeDraft ──────────────► API  intake router  ──► ticket_drafts row
  │  POST /api/documents (targetType=draft, targetId=draftId)
  │                                       └─► document_links (draft → blob)
  │  sendIntakeMessage  ────stream────►      ├─ deflection: knowledge_article (ilike, now scoped; future server/search)
  │                                          ├─ vision: FileBlobStore.read(sha256) gated AXIOMA_INTAKE_VISION + per-file read flag
  │                                          └─ 2 calls to AXIOMA_LLM_API_BASE (incident + catalogue fillFormContext)
  │  ◄─── status / message / deflection / field / complete (asyncIteratorObject, was eventIterator alias)
  │  patchIntakeDraft (user edits, fieldSources user-wins)
  │  submitIntakeDraft ─────────────►      ├─ createTicket | createCatalogueRequest
  │                                        ├─ re-parent document_links draft → ticket
  │                                        └─ transcript → ticket message (public, same tx)
  └─ navigate to /tickets/$ticketId   (manual ?mode=manual fallback shares form-schema.ts)
```

---

## 5. Data model (no change, now verified)

`ticket_drafts` 16 cols as landed (`id` PK, `reporter_id→user cascade`, `status open|submitted|discarded`, `intent incident|catalogue_request|knowledge_answer`, `transcript []`, `ai_draft`, `values {}`, `field_sources {}`, `subcategory_id→service_subcategories set null`, `form_id→forms set null`, `ticket_id→tickets set null`, `model`, `prompt_tokens`, `completion_tokens`, `created_at/updated_at now()`, index `(reporter_id,status,updated_at)`). `document_links.target_type text NOT NULL` no CHECK — `DOCUMENT_TARGET_TYPES = ["ticket","case_note","draft"]` widens only TS union. TTL sweep hourly (`sweepIntakeDrafts` `now - AXIOMA_INTAKE_DRAFT_TTL_HOURS*3600s`) mirrors `sweepKnowledgeGaps` (24h) with `unref` + shutdown `clearTimeout`; `removeOrphanedIntakeBlobs` dedupes `seen Set` and always deletes `documentLinks` rows, deletes `documents`+`FileBlobStore` only when orphan.

---

## 6. Contract (one rename)

```ts
// api/src/contracts/intake.ts (and mirrors portal/.../intake.ts, dashboard/.../intake.ts)
import { asyncIteratorObject, oc } from "@orpc/contract"; // was eventIterator as asyncIteratorObject on 1.15.0
export const intakeContract = {
  startIntakeDraft: oc.output(draftSummary),
  sendIntakeMessage: oc.input(z.object({draftId:id, body:z.string().trim().min(1).max(10_000), excludedAttachments: z.array(z.string()).optional()}))
    .output(asyncIteratorObject(intakeEvent)),
  getIntakeDraft: oc.input(z.object({draftId:id})).output(draftSummary.nullable()),
  patchIntakeDraft: oc.input(z.object({draftId:id, values:z.record(z.string(),z.unknown()), sources:z.record(z.string(),z.enum(["ai","user"]))})).output(draftSummary),
  submitIntakeDraft: oc.input(z.object({draftId:id, idempotencyKey:z.uuid()})).output(z.object({ticketId:z.string(), approval:z.object({id:z.string()}).nullable()})),
  discardIntakeDraft: oc.input(z.object({draftId:id})).output(z.object({deleted:z.boolean()})),
  intakeCapabilities: oc.output(z.object({enabled:z.boolean(), vision:z.boolean()})),
};
intakeEvent: status{retrieving|reading_attachments|drafting|classifying} | message{delta} | deflection{articles{id,title,summary}[]} | field{path,value,confidence:high|low} | complete{draft} | error{code,message}
drafted<T> = {value: T|null, confidence:high|low, reason:string|null} (nullable per §2.10)
```

`excludedAttachments` is the only input addition (for G4). `intakeCapabilities` already mirrors `portalIsFrontDoor` (`enabled: !!AXIOMA_LLM_KEY`).

---

## 7. Files to change (polish only)

### 7.1 `axioma/api` (G1–G6)

| File | Change |
|---|---|
| `src/contracts/intake.ts:1,74` | Rename `import {eventIterator as asyncIteratorObject}` → `import {asyncIteratorObject}` once `@orpc/contract` upgraded to `2.0.0-beta.32`; keep alias + comment until then. Add `excludedAttachments?: string[]` to `sendIntakeMessage` input. |
| `src/server/intake/schema.ts:19` | Keep `incidentDraftJsonSchema = z.toJSONSchema(...,{target:"draft-7"})` + `catalogueFormValuesJsonSchema`; add `catalogueFormValuesSchema` comment linking to `fillFormContext`. |
| `src/server/routers/intake.ts:132,175,212,349,453` | Already landed: `MAX_TURNS` guard `((transcript.length/2)>=env.AXIOMA_INTAKE_MAX_TURNS)→MAX_TURNS_EXCEEDED`, vision `if(env.AXIOMA_INTAKE_VISION){ yield reading_attachments; readDraftImages(draft.id, {excludedIds}) }`, `incidentDraftJsonSchema`/`catalogueFormValuesJsonSchema` with `repairDraftOutput` retry, token `model/promptTokens/completionTokens` persisted, `field` loop, Call B `fillFormContext` → `catalogueFormValuesJsonSchema`. **Polish:** add `excludedAttachments` param from input to `readDraftImages` filter, add `// non-streaming: single terminal complete, partial stays empty` comment above `yield complete`, and handle `signal` abort already via `iterator.return()`. |
| `src/server/intake/vision.ts:28,59` | Change `readDraftImages(draftId, {excludedIds?:Set<string>})` to skip `excludedIds` before `FileBlobStore.read`; keep `MAX_DRAFT_IMAGES 3`/`MAX_IMAGE_BYTES 2MB` + `image/png\|jpeg\|webp` guards; `removeOrphanedIntakeBlobs` already `await` + `delete documentLinks` + orphan check. |
| `src/server/intake/deflection.ts:11` | Add `// TODO(search): swap ilike to server/search hybrid when embeddings ready` comment; keep `ilike` scope `published` + portal audience + `limit 3`. |
| `src/server/intake/model.ts:108` | Keep `parseSse` for future `stream:true`; add header comment `// intake degrades to non-streaming: model called with stream:false, router yields single complete; parseSse kept for Phase 5`. |
| `scripts/e2e-local.mjs` | Add scenario `11: intake — start draft → POST /api/documents targetType=draft → sendIntakeMessage "laptop won’t boot" → assert draft `values.title` + `intent=incident` → patch `title` edit → submit → assert `tickets` row + `document_links target_type='ticket'` + `ticket_messages visibility='public'` transcript. |
| `src/env.ts` | No change (5 vars already defined and all 5 now read). |
| `src/index.ts` | No change (hourly sweep already `await`). |

### 7.2 `axioma/ui` (governed primitives — edit here, never in apps)

| File | Change |
|---|---|
| `src/components/ui/prompt-input.tsx` | No change — 8 exports (`PromptInput`/`Body`/`Attachments`/`Toolbar`/`Submit`/`Suggestion`/`Mic`/`Attach`) on `InputGroup`/`Tooltip` + `Ri*` + token `border-border bg-card`, no `lucide`/`framer`. |
| `src/components/ui/ai-label.tsx` | No change — `AiLabel` `border-info/30 bg-info/10 text-info` + `RiSparkling2Line`, `AiRevert ghost xs`. |
| `manifest.json` | No change — `portal 44` / `dashboard 53` already list `ai-label/prompt-input/attachment/kbd/scroll-area/tabs`. |

Then `pnpm --dir axioma/ui mirror` (regenerates mirrors under `portal/src` + `dashboard/src`). CI runs `--check`.

### 7.3 `axioma/portal` (G1, G4, G5)

| File | Change |
|---|---|
| `src/sdk/contracts/intake.ts` | Regenerated via `pnpm --dir axioma/api contracts:publish` — will pick up `asyncIteratorObject` rename + `excludedAttachments` input. Do not hand-edit. |
| `src/features/intake/api/mutations.ts:35` | Already `withSignal` + `abortHandler` `iterator.return()`; **polish:** change to forward `excludedAttachments` derived from `attachments.filter(a=>!a.read).map(a=>a.id)` when calling `client.sendIntakeMessage({draftId,body,excludedAttachments}, {signal})`. |
| `src/features/intake/components/attachment-tray.tsx:179` | Already functional `prev=>` + per-image `Checkbox` `readScreenshotsLabel` + `3/2MB/webp` guards; **polish:** actually call `onChange` in `intake-composer.tsx` to collect `read` map and pass to `sendIntakeMessage`; ensure `toggleRead` is visible. |
| `src/features/intake/components/intake-composer.tsx:84` | Pass `onChange` from `AttachmentTray` up to `IntakeRouter` (`excludedIds` state) so `handleMessage` can include it. |
| `src/routes/_auth/tickets/new.tsx:151` | Add draft rehydrate: `const saved = sessionStorage.getItem("intake_draft_id"); if(saved && !draftId){ const d=await orpc.getIntakeDraft.call({draftId:saved}); if(d) setState(applyDraft(...)) }` and on `startDraft` success `sessionStorage.setItem("intake_draft_id", draft.id)`. Also keep `sessionStorage intake_draft_values` carry for manual `initialValues` and `hasNewMessage` badge + `capabilities.isPending` spinner (already landed) + `abortRef` per-message abort (already `controller.signal` + `iterator.return()`). |
| `src/features/intake/components/draft-review.tsx:132` | No change — already `requestDetailsSchema.safeParse` + `FieldProvenance` around `DynamicFields`/`CatalogueField` + `warning` token + `SelectGroup`. |
| `src/features/intake/components/field-provenance.tsx:19` | No change — already `<AiLabel>`/`<AiRevert>`. |
| `src/features/intake/components/intake-conversation.tsx:111` | No change — already `aria-live="polite" aria-atomic="false" aria-busy` + `sr-only` 500 ms summary. Keep 500 ms (research §2.9 said 2–3 s, but 500 ms already passes SR; document deviation). |
| `src/features/intake/state/draft-reducer.ts:149` | No change — already `case "field"` with `low/null` + `user-wins`. |
| `src/features/tickets/form-schema.ts` + `request-form.tsx:43` | No change — shared `requestDetailsSchema`/`catalogueFields()` already used by both manual and intake; keep hand-written `IncidentValues` mapping tables (`impactToKey`) as landed. |
| `src/components/design-system.config.json` | No change — already `draft-review.tsx: SelectGroup:1`. |
| `src/components/design-system.space-baseline.json` | No change — intake uses `gap-*` only, baseline `0` correct per plan §7.3. |

### 7.4 `axioma/deploy`

| File | Change |
|---|---|
| `helm/axioma/values.yaml` | No change — `intake: model:"" vision:false timeoutMs:45000 maxTurns:20 draftTtlHours:72` (empty model delegates to `env.ts`). |
| `helm/axioma/templates/_helpers.tpl:257` | No change — already `if hasKey ... "vision"` (fixed). |
| `helm/axioma/templates/api.yaml` | No change — includes `axioma.api.env`. |
| `examples/values-full.yaml` + `values-minimal.yaml` | No change — `full` non-defaults `30000/6/24` to exercise wiring, `minimal` commented `model` + `false/45000/20/72`. |

### 7.5 Not changed

`axioma/agent`, `axioma/cli`, `axioma/web`, `axioma/portal/deploy/nginx.conf` (SPA does not proxy `/rpc`).

---

## 8. Sequencing (polish)

**Step 1 — Contract + schema (G1 + G4 input shape).** Edit `api/src/contracts/intake.ts` (`excludedAttachments` + `asyncIteratorObject` alias comment), `api/src/server/intake/schema.ts` comment for `catalogueFormValuesJsonSchema`, then `pnpm --dir api contracts:publish` (refreshes `portal` + `dashboard` contracts + `shared.ts`).

**Step 2 — Server wiring (G3, G4, G5 input).** Edit `vision.ts` (`excludedIds` filter), `routers/intake.ts` (pass `excludedIds` to `readDraftImages`, keep non-streaming `complete` + `field` loop + token persistence + `MAX_TURNS`; optionally upgrade `@orpc/contract` to `2.0.0-beta.32` then flip alias to literal and republish).

**Step 3 — Portal wiring (G4, G5).** Edit `attachment-tray.tsx` collector (`onChange`), `intake-composer.tsx` `excludedIds` state, `api/mutations.ts` forward `excludedAttachments`, `new.tsx` draft rehydrate (`getIntakeDraft` + `sessionStorage draftId`) + already landed manual `initialValues` carry + badge.

**Step 4 — E2E + docs (G2, G6).** Add `scripts/e2e-local.mjs` scenario 11 + `deflection.ts` `TODO(search)` + `model.ts` streaming comment; run `pnpm --dir api exec tsx --test src/server/intake/intake.test.ts` + `pnpm --dir api exec node scripts/probe-intake-model.mjs --check`.

**Step 5 — Optional upgrade.** `pnpm add -D @orpc/contract@2.0.0-beta.32 ...` + `import {asyncIteratorObject}` literal, republish.

Gates between steps: `pnpm --dir api check-types` + `pnpm --dir portal check-types` + `pnpm --dir portal validate` + `pnpm --dir api contracts:check`.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Upgrading `@orpc/contract` to `2.0.0-beta.32` breaks `1.15.0` peers | Keep alias `eventIterator as asyncIteratorObject` until all `@orpc/*` are bumped together; staged upgrade is step 5, not step 1. |
| `excludedAttachments` leaks draft IDs to model log | Input is `string[]` of `document.id` (not blob), never logged with base64; model prompt never persists excluded IDs. |
| `sessionStorage` draftId stale after TTL sweep | Rehydrate does `getIntakeDraft` and discards `null` (swept) — creates fresh `startDraft`. |
| Streaming `field` deltas flood SR live region | Keep current non-streaming `field` loop (all `high` fields at once) + `intake-conversation` 500 ms debounced summary + `aria-busy`; true per-field streaming is Phase 5. |
| Deflection `ilike` false positives on short queries | Keep `limit 3` + `published` + audience `!isRestricted`; `server/search` hybrid is Phase 5 when embeddings configured. |

---

## 10. Verification (polish gates)

```bash
# contracts stay inside mirror
pnpm --dir api contracts:publish
pnpm --dir api contracts:check # portal/dashboard copies fresh

# types + lint (intake-only)
pnpm --dir api check-types && pnpm --dir portal check-types
pnpm --dir api exec biome check src/server/intake src/contracts/intake.ts
pnpm --dir portal exec biome check src/features/intake src/routes/_auth/tickets/new.tsx

# unit
pnpm --dir api exec tsx --test src/server/intake/intake.test.ts # 6 pass
pnpm --dir portal validate # 29 pass (now includes draft-reducer 7 + catalogue + SelectGroup)
pnpm --dir dashboard validate # 26 pass

# e2e (after scenario 11)
pnpm --dir api exec node scripts/e2e-local.mjs # scenario 11: start→message→submit→ticket+re-parent+public message

# probe (manual, needs AXIOMA_LLM_API_BASE/KEY)
node api/scripts/probe-intake-model.mjs # json_schema ✓ tool-calling ✓ image_url (non-critical)
```

Helm reuse stays: static SPA `portal/dist` served by nginx does not proxy `/rpc` → browser calls `apiUrl("rpc")` directly, no nginx SSE buffering. Hono `@hono/node-server` path already `await`ed and `unref`ed.

---

## 11. Settled details (unchanged from ai-intake-plan.md §10)

| Question | Decision (polish) | Why |
|---|---|---|
| Transcript visibility | Public reporter message | `portalContract` has no private-note writer; employee sees own text. |
| Draft retention | 72 h (`AXIOMA_INTAKE_DRAFT_TTL_HOURS`) | Hourly `sweepIntakeDrafts` via `removeOrphanedIntakeBlobs`. |
| Voice | Visible, disabled, tooltip | `PromptInputMic` disabled + `TooltipContent "Voice input is coming soon"`. |
| Deflection strength | One click to ticket, always | `DeflectionCards` per-article pair + `createAnywayMessage` is persistent. |
| Suggestion chips | Top catalogue subcategories, fallback 3 hand-written | `listRequestCatalogue.slice(0,3)` + `FALLBACK_SUGGESTIONS`. |
| Iterator name | `asyncIteratorObject` via alias until `2.0.0-beta.32` | `check-types` stays green on `1.15.0`; step 5 flips literal. |
| Vision per-file opt-out transport | `excludedAttachments: string[]` on `sendIntakeMessage` input | No new table; server filters `readDraftImages` by ID set. |

Two degradations remain (already designed): non-strict tool calling if `json_schema` fails (probe proves), and filename+mediaType text fallback if `image_url` probe fails (flag stays `false`).

---

## 12. Audit of 2026-09-04 — what is actually true

This section was written after auditing the tree against both plan documents and executing
every gate. It supersedes §§1–11 wherever the two disagree.

### 12.1 Gates as measured

| Gate | This plan claimed | Measured |
|---|---|---|
| `api check-types` | pass | pass |
| `api test` (whole suite) | not stated | 371 pass, 0 fail |
| `api intake.test` | 6 pass | 26 pass |
| `portal check-types` | pass | pass |
| `portal validate` | 29 pass | 49 pass |
| `dashboard validate` | 26 pass | 26 pass |
| `api contracts:check` | — | fresh |
| `ui check` (mirror) | — | fresh |
| `e2e-local` scenario 11b | absent (G2) | present and passing end to end |
| Phase 0 probe | unknown | all three probes pass, including `image_url` |

### 12.2 The seven gaps, resolved

| # | Verdict |
|---|---|
| G1 | **Reversed deliberately, and the reversal is right.** `@orpc/contract@1.15.0` exports `eventIterator` and no `asyncIteratorObject` — verified in the installed `.d.mts`. The alias this plan asked for would have named a symbol the package does not have. §3.8 of the main plan already recorded this correction; §3.1, §6 and §11 here are stale. |
| G2 | **Done.** `scripts/e2e-local.mjs` scenario 11b, now also asserting `intent`, a non-empty `values.title` and `fieldSources.title === 'ai'` before the patch overwrites them. |
| G3 | **Resolved by deletion.** `parseSse` is gone rather than kept; `model.ts` documents the non-streaming degradation, and `routers/intake.ts` carries the matching note above `yield complete`. |
| G4 | **Done**, though not where this plan put it: the exclusion filter lives in the router, not inside `readDraftImages`. The vestigial `_draftId` parameter that §7.1 called out has now been removed. |
| G5 | **Done**, via `sessionStorage` rather than `?draftId=`. |
| G6 | **Exceeded.** Deflection was upgraded to the shared `server/search` index rather than annotated with a `TODO`, which is what the *main* plan §7.1 asked for. The `TODO(search)` comment §3.5 requested is correctly absent. See 12.3 for the defect this introduced. |
| G7 | **Done.** The probe reads `AXIOMA_INTAKE_TIMEOUT_MS`, and the duplicated `IncidentValues` is renamed `IntakeDraftValues` on the intake side. |

### 12.3 Defects the audit found that this plan did not anticipate

All fixed in the same pass. Listed most severe first.

1. **Deflection was silently dead on any install whose search index is not backfilled.**
   `reconcileCoreSearchDocuments` is incremental (`updatedAt >= since`), so on the live
   database `search_documents` held zero `knowledge_article` rows and `deflectKnowledge`
   returned `[]` for every message. §2.2 makes knowledge retrieval the first stage of
   intake, so this removed the whole stage with no error anywhere. `deflection.ts` now
   falls back to a ranked full-text query against `knowledge_articles` when the index
   yields nothing.
2. **`websearch_to_tsquery` ANDs bare terms, so employee prose almost never matched.** A
   sentence matched an article only if every word in it appeared there. The fallback ORs
   the terms and ranks them, with an absolute floor and a relative floor against the best
   hit so an unrelated message still deflects to nothing. The indexed path retains AND
   semantics; that is shared-search behaviour and out of scope here.
3. **§3.3's routing confirmation was never enforced server-side.** `subcategoryConfirmed`
   existed in the model output schema and was read by nothing. The single
   anti-rubber-stamping gate this design rests on was a client-side control, so a direct
   `submitIntakeDraft` call routed an unreviewed AI guess. `submit.ts` now refuses a draft
   whose `subcategoryId` came from the model unless the employee confirmed it.
4. **IT staff could not attach anything to their own draft.** `requireDocumentWriteTarget`
   rejected any draft write from a caller who was not a `reporter`, and the role is derived
   from `ticket.read.all` — which analysts hold. Every screenshot upload returned 404 for
   them. The rule is now ownership-based, which is what `canReadTarget` already enforced on
   the read side.
5. **A removed attachment still landed on the submitted ticket.** The tray's remove only
   filtered client state; `unlinkDocument` rejected `draft` at the contract boundary, and
   `submitIntake` re-parented every draft link regardless. `draft` is now a valid document
   target, `unlinkDocument` is on `portalContract`, the tray calls it and keeps the row
   visible if it fails, and unlinking now deletes the blob when nothing else references it.
6. **The `drafting` status stage was declared and never emitted.** The longest wait in the
   flow — the Call A round trip, up to `AXIOMA_INTAKE_TIMEOUT_MS` — was the one with no
   status event, which is exactly what §9 says must never be a bare spinner.
7. **Call B had no repair retry and swallowed its own failure.** One malformed catalogue
   reply dropped every form value silently, leaving an empty form indistinguishable from
   one the model chose to leave blank. Call B now gets the same one-shot repair as Call A,
   logs, and emits an error event telling the employee the form is theirs to complete. Its
   token usage is also now accounted; it was previously discarded, under-reporting the more
   expensive of the two paths.
8. **The 2 MB image cap only applied after the blob was fully read**, because the router
   hardcoded `size: null` (`documents` has no size column). The cap is now taken from the
   blob's `stat`, so an oversized screenshot never enters memory.
9. **The disabled microphone's tooltip could never open.** Base UI's `Button` emits the
   native `disabled` attribute, which together with `disabled:pointer-events-none` means
   the trigger receives neither hover nor focus. §3.1 and §10 both promise that tooltip. It
   now uses `focusableWhenDisabled` with `aria-disabled`.

Also fixed: the §2.9 live region was mounted only on the stage-3 form, so stage 2 announced
nothing, and it used `aria-atomic="true"` where §2.9 specifies `"false"`; attachments were
not rehydrated after a reload, silently resetting the per-file vision opt-out; the
Conversation tab badge had no accessible name; "Needs your input" computed the blank-field
list and then discarded it; `examples/values-full.yaml` had been rewritten LF to CRLF,
burying seven real lines under 394 of churn; three numeric Helm values were dropped when
set to `0`; `AXIOMA_INTAKE_VISION` could render as `"1"` and crashloop the pod against the
`z.enum(["true","false"])` check; and none of the five `AXIOMA_INTAKE_*` variables were
documented anywhere.

### 12.4 Corrections to this document's factual claims

- §5 says `ticket_drafts` has one index. It has two, as the main plan §5 requires; the
  second arrived in migration `0002` and serves the TTL sweep's `status AND updated_at`
  predicate. Confirmed against the live database.
- §7.2 says `prompt-input.tsx` has 8 exports and the portal manifest lists 44 files
  including `scroll-area.tsx`. It had 10 exports (9 after a dead one was removed), and the
  portal manifest lists 43 and correctly omits `scroll-area.tsx` — the main plan §7.2 made
  it conditional and `MessageScroller` proved sufficient.
- §7.3 says `intake-conversation.tsx` "already" has the
  `aria-live`/`aria-atomic="false"`/`aria-busy` region and debounces at 500 ms. It had no
  live region at all; the debounce is 2500 ms, which is what §2.9 actually asks for.
- §3.5 describes the deflection scope as `audience` in `{public, employees}`. It is
  `audience = 'public'`, mirroring `listPublicKnowledge`.
- §10 claims `api intake.test` is 6 tests and `portal validate` is 29. They are 26 and 49.

### 12.5 Still open

- **The flow has never been driven by a person in a browser.** Every claim above rests on
  unit tests, type checks, the design-system validators and the `e2e-local` leg.
- **`AXIOMA_INTAKE_VISION` remains `false`.** The Phase 0 probe now passes on `image_url`,
  which is the condition main-plan §3.7 set for turning it on, but enabling it sends
  screenshot pixels to the model provider and that is a deliberate decision to take rather
  than a default to flip.
- **`intakeCapabilities.enabled` is `Boolean(AXIOMA_LLM_KEY)` and does not consider the
  endpoint.** `AXIOMA_LLM_API_BASE` has a compiled-in default, so a deployment that sets a
  key while deliberately leaving the endpoint unset still enables intake against that
  default. The gate matches main-plan §6 as written, so it was left alone;
  `deploy/README.md` now describes the behaviour.
- **Embeddings return HTTP 403 with the current key**, so search runs lexical-only.
  Deflection tolerates this; semantic ranking does not exist until embeddings work.
