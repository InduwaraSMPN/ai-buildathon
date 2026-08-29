# Chat F — ticket creation

Last updated: 2026-08-29
Branch: main

## Done
- Verified the five current production paths before editing: portal, catalogue and recurrence used the shared core; inbound email and external channel still inserted tickets directly. The latter two also lacked consistent initial audit/event behavior, and channel attached a literal `P3` SLA.
- All five adapters now use `axioma/api/src/server/tickets/create.ts`; no adapter directly inserts `tickets`.
- The core owns normalization/defaults, strict service/subcategory consistency, explicit initial status, rules/firings and rule-attributed audit, number/history, priority, ticket insert, and atomic SLA/OLA attachment.
- Search indexing and `ticket.created` dispatch run after commit and fail soft. Email provider-message deduplication, channel message/thread idempotency, catalogue form/approval atomicity, and recurrence occurrence claiming remain in their adapters.
- Added a five-source table-driven database test proving number/history, valid status, service classification, real-priority SLA/OLA stopwatches, audit, search document, and `ticket.created` workflow execution.
- No migration was needed.

## Coordination / blockers
- Resumed on `main` after reading current ownership status. B, C and E changes already coexist in this uncommitted shared working tree, so there is no separate branch tip to rebase onto. If those sessions land additional commits later, Chat F must still rebase then.
- Resolved the D1 bypass at the shared dispatch boundary: `startTicketRun` now reads persisted rule firings and records/skips a run when `route_human` was applied. Rules remain evaluated once in the shared creation service rather than being duplicated in adapters.
- No current code or gate blockers remain.

## Gates
- PASS — API `npx biome check .`, `npx tsc --noEmit`, `npm test`: 136 tests passed. Biome reports only non-failing existing warnings and its configuration deprecation notice.
- PASS — focused `npx tsx --test src/server/tickets/create.test.ts`: 1 test passed.
- PASS — agent `uv run ruff check .`, `uv run pytest -q`: 42 tests passed.
- PASS — CLI `go vet ./...`, `go build ./...`, `go test ./...` (5 packages).
- PASS — dashboard `npx biome check .`, `npx tsc --noEmit`.
- PASS — portal `npx biome check .`, `npx tsc --noEmit`.
- PASS — `git diff --check`.
