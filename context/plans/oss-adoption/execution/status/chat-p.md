# Chat P — preflight

Last updated: 2026-08-29
Branch: main

## Done
- P1 — LANDED. `authorization-policy.test.ts` now exercises every composed `appRouter` procedure anonymously and as an authenticated user with no capabilities; unscoped builders are checked through module exports. The source-reading Tier 4 tests were removed because their route-existence assertions duplicated contract typing and their actual behavior is covered by focused scheduling, status, contract, and document tests. Brief 0 is unblocked on P1.
- P2 — the five live constraints are declared, `0015_snapshot.json` is a current baseline, `drizzle-kit check` passes, a clean database applies all 16 migrations, and generation from the baseline reports `No schema changes, nothing to migrate`. `pnpm db:check` now repeats the metadata, clean-replay, ledger, and five-constraint checks. Existing SQL and `_journal.json` are unchanged; no 0016 migration was needed.
- P3 — the agent owns run limits; its sibling-checkout source parser and the unused API duplicate were removed. `knowledge_search.limit` is default 8 / maximum 20 on both sides with executable tests.

## Blocked
- API full Biome gate — blocked by five pre-existing formatting/import errors in `channel-ingestion.test.ts`, `routers/tier4.ts`, `software-compliance.ts`, and `tier3-integration.test.ts`; all owned files pass Biome. Already ran the full gate and isolated owned paths. Unblocks when those unrelated files are formatted.
- Dashboard Biome gate — blocked by four pre-existing formatting errors in `queue-columns.tsx`, `ticket-detail.tsx`, `routes/_auth/assets.tsx`, and `routes/_auth/software-licences.tsx`. TypeScript passes. Unblocks when the unrelated files are formatted.
- Portal Biome gate — blocked by the pre-existing formatting error in `dynamic-request-form.tsx`. TypeScript passes. Unblocks when the unrelated file is formatted.

## Handed off
- None.

## Decisions taken
- Agent owns run limits because it alone enforces them; the unused API duplicate is removed rather than replaced with another cross-component coupling.
- The API's `knowledge_search.limit` contract wins: default 8, maximum 20.

## Device action parity
- Match confirmed across agent, API validation, gRPC forwarding, and CLI: `flush_dns`, `renew_dhcp_lease`, `clear_proxy_override`, `reset_credential_cache`, `restart_user_process`. gRPC forwards the validated name and keeps no separate allow-list.

## Gates
- Migration — pass: `pnpm db:check`; clean 0000–0015 replay, 16-row ledger, five constraints, valid metadata. Reviewed generation: no schema changes.
- api — owned Biome pass; `npx tsc --noEmit` pass; `npm test` pass (130/130). Full Biome blocked as listed above.
- agent — `uv run ruff check .` pass; `uv run pytest -q` pass (40/40).
- cli — `go vet ./...`, `go build ./...`, `go test ./...` pass (3 tested packages, 2 without tests).
- dashboard — `npx tsc --noEmit` pass; Biome blocked as listed above.
- portal — `npx tsc --noEmit` pass; Biome blocked as listed above.
