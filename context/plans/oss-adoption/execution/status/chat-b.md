# Chat B — status as data, SLA, breach, pending

Last updated: 2026-08-29

## Done in this session
- Removed the dead hardcoded transition map and `nextTicketStatus`; lifecycle tests now query `ticket_status_transitions`, assert 31 rows, and retain named conflict coverage.
- Added status facet labels and raised the status-filter contract cap; dashboard URL normalization now includes `pending`.
- Added ticket-number queue search matching.
- Added queue breach/warning badge from `escalationFlag` and reason.
- Added `listPendingReasons` contract/router/composition and seeded pending reasons plus default SLA/OLA notification rules in `api/src/db/migrations/0016_tier1_reference_data.sql`.
- SLA sweep now reads enabled notification rules, applies `threshold_percent`, records `rule_id`, and remains idempotent.
- Pending follow-up sweep now inserts a public reporter-facing message.
- gRPC cancel path resolves its terminal transition through the table; rerun lookup uses status state type before resolving the configured transition.

## Handed off / incomplete
- gRPC terminal persistence, orphan reconciliation, pending sweep, knowledge gaps, and frontend portal behavior still contain status-name literals and need a full state-type conversion.
- SLA countdown/attainment output and dashboard rendering are not yet implemented.
- Dashboard pend/unpend reason-picker controls are not yet implemented; only contract/action vocabulary and reason listing are present.
- Notification recipient delivery needs a concrete recipient dispatch path beyond `fireEvent`.
- Portal copy centralization, overview CSAT rendering, field-audit additions, private-note network test, and stopwatch closed-period test remain.
- Migration metadata/drift updates were not completed. Existing concurrent workspace changes include migrations from other briefs; do not renumber them without coordination.

## Validation
- `pnpm exec tsc --noEmit` is blocked by pre-existing/in-progress parse errors in `src/server/routers/mail.ts`.
- Database inspection confirmed 7 active status rows, 31 transition rows, and initially empty pending/rule tables.
