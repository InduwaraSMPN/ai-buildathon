# Axiōma end-to-end validation report

## Post-fix regression — 2026-08-30

**Result: all seven staged fixes passed focused regression checks.** The earlier route, mailbox, reporter-field, change-creation, first-tool, form-attachment, and public-asset blockers are resolved.

| Fix | Post-fix evidence |
|---|---|
| 1 — route shadowing | Browser-created problem navigated to `/problems/ad937fa0-c7b9-46ce-8cf0-7756559c34e9` and rendered `PRB-2026-00002`. Knowledge navigated to `/knowledge/e8206ca8-fbad-457d-a82b-e80a715f4600` and rendered its populated editor. Change navigated to `/changes/58bdf368-9b32-468e-af15-e08d6a28c618` and rendered `CHG-2026-00001`. |
| 2 — mailbox origins | `/mailboxes` rendered. Network captured 200 for `listMailboxes` and `listTicketOrigins`; the dropdown contained Chat, Email, Monitoring, Phone, and Portal. |
| 3 — reporter field endpoint | Portal `/tickets/new` rendered without the old error banner. Network showed `listTicketFieldDefinitions` 200 and no UI call to `listFieldDefinitions`; direct reporter access to the staff endpoint remained 403. |
| 4 — create change | Browser submitted a normal change, navigated to detail, persisted `pending_approval`, required CAB membership, and a `draft → pending_approval` human transition. CAB approval changed it to `approved`. |
| 5 — firstTool | Real Axel run `b05c7f05-2fa8-4735-969f-3ea86d9892bd` invoked three tools, including `ticket_read_messages`; all steps had `error=NULL`. DB recorded exactly one `routing → resolving` `firstTool` transition. |
| 6 — form attachment | Browser created and published `E2E Regression Form`, attached it to General, and portal immediately rendered its mandatory typed `Details` field. DB confirmed `service_subcategories.form_id`; fixture was removed afterward. |
| 7 — favicon/robots | Portal and dashboard `/favicon.svg` and `/robots.txt` returned 200. Browser network requested `/favicon.svg` as `image/svg+xml`. |

### Continuous B regression

`INC-2026-00099` provided one uninterrupted evidence chain covering numbering, P4 SLA/OLA creation, staff/person/team assignment, public/private/reporter messages, payload privacy, pending/resume and stopwatch state, a real multi-tool Axel run, close, 5/5 CSAT, and human-attributed reopen. Axel ended in `escalated`, so the manual resolution-code picker could not be used on that same ticket; a post-terminal resolve correctly returned 409. This is a deterministic-testability limitation when combining the real autonomous agent with the strictly ordered manual flow, not a recurrence of Fix 5.

### Previously blocked practices

- Change creation/detail, required CAB vote, and PIR persistence now work.
- Catalogue form attachment now works end to end.
- Mailbox administration and populated origins now work.
- Problem and knowledge detail routes now render.
- PIR values can currently be recorded before `completed`; the original “completion refused without PIR” ordering was therefore not fully demonstrated.

### Post-fix quality and gates

- Portal Lighthouse: Accessibility **100**, Best Practices **96**, SEO **100**. `robots.txt` now passes; the remaining console audit failure is browser-extension noise. Lighthouse still exits 1 after writing results because Windows denies temporary Chrome-profile cleanup (`EPERM`).
- Dashboard Lighthouse again failed before emitting a report due to that Windows cleanup issue.
- API TypeScript/Biome passed; **147/147 tests passed**.
- Dashboard and portal TypeScript/Biome passed.
- CLI vet, tests, and build passed.
- Agent Ruff and **43/43 pytest tests** passed with explicit `--basetemp`.
- Contract mirror check and `db:check` passed; migration baseline remains 28.

### Regression cleanup

Temporary problems, changes/CAB rows, forms and attachments, rules, teams, devices, documents, CI/search rows, organization records, and accounts were removed. `Escalated` remains restored. Evidence tickets `INC-2026-00098` and `INC-2026-00099` remain intentionally under the plan's keep-created-product-data policy.

---

## Original pre-fix run

Date: 2026-08-29  
Environment: live Tilt development stack (`api:3000`, `portal:3001`, `dashboard:3002`, `web:3003`, PostgreSQL `axioma`)  
Browser: Chromium through browser-skill; database assertions through dbhub.

## Executive result

**Overall: FAIL — important end-to-end paths work, but the acceptance condition that all A–F journeys pass was not met.**

The core reporter-to-staff ticket loop, status-as-data, real agent execution, authentication failure handling, catalogue persistence, and most authorization boundaries worked. Several product routes are incomplete or broken, and the portal makes an unauthorized dynamic-field request on every incident form load.

## Journey matrix

| Journey | Result | Evidence |
|---|---|---|
| A1 | PASS | Anonymous dashboard `/` redirected to `/login?redirect=%2Fhome`, not a blank shell. |
| A2 | PASS | Reporter signed into portal and reached `/home`. Better Auth `/api/auth/sign-in/email` returned 200. |
| A3 | PASS | Admin signed into dashboard and reached `/home`. |
| A4 | PASS | Reporter attempting dashboard was redirected to portal `/home`. |
| A5 | PASS | Sign-out returned to login and protected routes stopped resolving in the tested context. |
| B1 | PASS | Portal created `INC-2026-00085` (`92275164-500f-4310-a40d-f345709f8dd1`). DB contains matching `ticket_number_history`. |
| B2 | PASS | Dashboard queue showed the ticket and exposed Status and Service facets; there was no Category facet. |
| B3 | PASS | Detail showed General / General, derived P4, and SLA/OLA targets. DB contained four stopwatches for the ticket. |
| B4 | PARTIAL | Assignment controls loaded and staff assignment options were available, but a complete person+team assignment was not retained because test organization data was later cleaned. |
| B5 | PASS | Staff added public and private messages; DB distinguishes `public` and `private`. |
| B6 | PASS | Reporter response included public staff replies and reporter reply, while excluding the private body, `runs`, and `steps`. |
| B7 | PASS | Ticket was put on hold with `reporter-information`; DB showed `pending` and all stopwatches `running=false`. |
| B8 | PARTIAL | Resume succeeded and stopwatches resumed. Resolve from `open` was correctly rejected with 409 because the lifecycle requires an intermediate state; a full resolution-code UI flow was not completed. |
| B9 | SKIPPED | CSAT requires a normally resolved/closed ticket. The test ticket had been agent-escalated and was used for reopen coverage. |
| B10 | PARTIAL | Overview loaded resolution-code and CSAT aggregates, but no new CSAT response was created. |
| B11 | PASS | Staff closed and reopened the ticket. DB records `closed → open`, action `reopen`, actor type `human`, and the admin actor ID. |
| C1 | PASS | `New laptop request` rendered a typed mandatory `Preferred model` input rather than free text only. |
| C2 | PASS (API-assisted UI precondition) | Catalogue request produced `REQ-2026-00023`; DB links a `form_submissions` row containing `model=ThinkPad T14`, service `svc-access`, subcategory `ss-account`. |
| C3 | FAIL | Dashboard can author and publish a form, but provides no UI to attach it to a subcategory; therefore portal appearance without a DB edit cannot be completed. |
| D1 | PASS | Captured `getMyTicket` body: private text absent, `runs` absent, `steps` absent, public reply present. |
| D2 | PASS (staged) | With one published public and one published staff article staged, `listPublicKnowledge` returned only `E2E Public Boundary`; `INTERNAL_SECRET_BODY` was absent. Fixtures were removed. |
| D3 | PASS | Reporter requests to staff-only dashboard routes redirected to the portal. |
| D4 | PASS | `.exe` upload returned 400 (`Document extension is not allowed: .exe`). With independently managed reporter/staff cookie jars, direct reporter GET of a private-note file returned 404. An earlier 200 was explained by a temporarily inherited IT Analyst team role and was not a clean reporter test. |
| D5 | PASS | Anonymous RPC returned 401; malformed bearer token returned 401 rather than 500. |
| E1 | PARTIAL | Problem creation worked and generated `PRB-2026-00001`; detail navigation/linking/workaround publication was not reachable reliably. |
| E2 | FAIL | Changes list has no create control, so normal change/CAB voting is unreachable from the browser. |
| E3 | FAIL | No browser-created change exists; PIR journey is unreachable from the UI. |
| E4 | FAIL | Knowledge draft creation worked, but clicking/navigating to the article detail did not render the editor, so publishing could not be completed. |
| E5 | PASS (API-assisted) | Typed catalogue submission created a `waiting_for_approval` row; admin approval returned 200 and DB persisted `approved` with decision note. |
| F1 | PASS | Fresh `e2e-promote@example.test` signup created a reporter; authenticated admin `setUserKind` promoted it and automatically granted IT Analyst. Dashboard access was also demonstrated earlier by promoting the existing reporter through the Roles UI. Test account was removed afterward. |
| F2 | PASS | Role/team capability changes affected following requests without restart. |
| F3 | PASS | Removing the last `admin.roles` holder returned 409; DB retained the capability. |
| F4 | PASS | Created department and team, assigned reporter membership and IT Analyst team role, and linked department; DB verified all rows. Fixtures and temporary grants were removed. |
| F5 | FAIL | `/mailboxes` renders `Mailboxes unavailable — Not Found`; frontend calls `listTicketOrigins`, which is not exported by `appRouter`. |
| G1 | PASS (staged) | DB-staged service and resolved incident appeared unauthenticated at `/status`; calculated uptime was 99.40% / 99.86% / 99.95%. Fixture removed. |
| G2 | PASS | Marketing site on 3003 rendered. Only browser-extension noise appeared in its console. |
| H1 | PASS | Renamed `escalated` label to `Escalated E2E Renamed`; both portal and dashboard displayed it while behavior remained keyed by status. Label restored to `Escalated`. |
| H2 | SKIPPED | Browser-skill sessions shared the localhost cookie jar, contrary to the requested isolated contexts; two simultaneous staff identities could not be established reliably. |
| H3 | PASS (CI staged) | After `reconcileSearch`, global search returned a ticket, knowledge article, problem, and staged CMDB CI in one result set. Fixtures/index rows removed. |
| H4 | PASS | Portal detail under mobile emulation measured `innerWidth=498`, document/body `scrollWidth=498`; core controls remained accessible. |

## Agent and inventory evidence

- The real Axel worker was connected through gRPC.
- Two real runs were persisted for `INC-2026-00085`, with 14 total ordered steps.
- A run completed as `escalated`, including tool calls, observations, reasoning, decision, terminal step, token counts, and evidence.
- The run exposed a workflow defect: `ticket_read_messages` failed with `Cannot apply firstTool to ticket in resolving state`.
- Staged `e2e-laptop` inventory rendered in dashboard Device detail: owner, Windows 11, ThinkPad T14 hardware, one NVMe disk, and one installed application. All inventory fixtures were removed.

## Performance and quality

| Check | Result |
|---|---|
| Dashboard queue navigation | 451 ms total; DCL 400 ms; initial `listTickets` 89 ms. Subsequent polls observed at 46–55 ms. |
| Ticket detail navigation | 586 ms total; DCL 534 ms. |
| Ticket detail fan-out | Requests started together at ~1420–1424 ms, not serially. Slowest observed was `listTicketSla` at 213 ms; assignment options 196 ms; service records 180 ms. |
| Capability overhead | No browser-visible latency regression established at this data volume. Authenticated detail requests remained below 213 ms. |
| Portal Lighthouse mobile | Accessibility 100, Best Practices 96, SEO 91. Failures: browser console errors and invalid/missing `robots.txt`. Lighthouse wrote its report, then exited 1 because Windows denied temporary Chrome-profile cleanup. |
| Dashboard Lighthouse | No result: repeated Chrome launcher cleanup failure (`EPERM`) before a report was emitted. |
| Console | FAIL: real portal 403s from `listFieldDefinitions`; missing favicon 404s. Browser-extension `chrome-extension://invalid` and message-port noise were classified separately. |

## Defects

### Critical

1. **Portal incident form calls staff-only endpoint** — `portal/src/features/tickets/components/request-form.tsx:126-129`, `api/src/server/routers/automation.ts:43-46`  
   Every reporter opening `/tickets/new` receives repeated 403 responses for `listFieldDefinitions`, displays “We couldn’t load the additional details,” and pollutes the console. Expose a reporter-safe active-field query or authorize this read for `ticket.create`/`ticket.read.own`.

### High

2. **Mailbox administration route cannot load** — `dashboard/src/routes/_auth/mailboxes.tsx:32-34`, `api/src/server/routers/index.ts:96-100`  
   The UI calls `listTicketOrigins`, but that implemented contract procedure is not exported from `appRouter`; `/mailboxes` returns “Not Found.” Export `mailRouter.listTicketOrigins`.

3. **Changes cannot be created from the dashboard** — `dashboard/src/routes/_auth/changes.tsx:10-22`, `dashboard/src/features/changes/components/changes.tsx:52-67`  
   Only listing/detail UI exists, making CAB and PIR journeys unreachable. Add the existing `createChange` procedure to this screen.

4. **Knowledge detail navigation does not reach the editor** — `dashboard/src/routes/_auth/knowledge.tsx:28-32`, `dashboard/src/routes/_auth/knowledge.$articleId.tsx:6-30`  
   Clicking an article and direct navigation left the list view rendered, preventing publish/edit. Correct generated-route matching/navigation.

5. **Problem detail navigation does not render** — `dashboard/src/routes/_auth/problems.tsx:34`, `dashboard/src/routes/_auth/problems.$problemId.tsx:6-18`  
   Created problems remain on the list and the direct detail URL renders the list. Correct route generation/matching.

### Medium

6. **Forms UI cannot attach forms to service subcategories** — `dashboard/src/routes/_auth/forms.tsx:27-72`  
   It supports create and publish only, so C3 cannot be completed without direct database/API work.

7. **Agent ticket-read sequencing conflict** — observed real run step error; ticket reaches `resolving` before `ticket_read_messages`, which then rejects `firstTool`. Align agent tool transition semantics with run state.

8. **Missing browser metadata assets** — both applications request absent `favicon.ico`; portal Lighthouse also reports invalid/missing `robots.txt`.

### Tooling/environment limitation

9. **Browser sessions are not cookie-isolated** — separately started browser-skill sessions shared localhost authentication. Identity-sensitive checks were rerun sequentially or with separate curl cookie jars. This is test-harness behavior, not attributed to Axiōma.

## Static and migration verification

- API: Biome completed with warnings only; TypeScript passed; **145/145 tests passed**.
- Dashboard TypeScript: passed.
- Portal TypeScript: passed.
- CLI: `go vet ./...` and `go build ./...` passed.
- Agent: Ruff passed.
- Database: `pnpm db:check` passed; **clean 28-migration snapshot baseline**.
- Git working tree was clean before this report was added.

## Fix verification update — 2026-08-30

All seven findings above have been fixed in the tree:

- Problem, knowledge, and change list routes are index siblings of their detail routes.
- `listTicketOrigins` is exported by the application router.
- The portal uses an authenticated, ticket-only field-definition procedure; the staff procedure remains capability-gated.
- The changes page can create a CAB change and defaults the current staff user as its CAB member.
- `firstTool` is looked up from the transition table and applied only when that transition exists.
- Published forms can be attached to or detached from a service subcategory in the forms UI.
- Both Vite apps now serve favicon and robots metadata; dashboard crawling is disallowed.

Static verification passed: API Biome (existing warnings only), TypeScript, **146/146 tests**, contract-copy check, and the clean **28-migration** baseline; dashboard and portal Biome, TypeScript, and production builds; CLI vet/build/tests; agent Ruff and **43/43 tests**. The agent tests needed a repository-local pytest temp directory because Windows denied cleanup of the global `pytest-current` link.

A fresh browser A–H rerun was not recorded in this update because the Tilt HTTP services were not running and no Chromium browser was connected to browser-skill. The original journey outcomes above remain historical rather than being relabelled without browser evidence.

## Cleanup

Removed all temporary status, mailbox, device/inventory, CMDB, form, problem, organization, document, search-index, and promotion-account fixtures. Restored the original reporter kind/Employee-only role and restored the `escalated` label. Product-created evidence tickets `INC-2026-00085` and `REQ-2026-00023` remain intentionally, consistent with the plan’s stated default.
