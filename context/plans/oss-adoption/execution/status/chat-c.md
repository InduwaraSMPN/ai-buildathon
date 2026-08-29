# Chat C — Tier 2

## In progress
- Added form CRUD contracts/router handlers and a fresh-database published laptop form seed in migration 0024.
- Added CAB/PIR mutation wiring and status transition audit writes for human and agent paths.
- Added ACL filtering for authenticated knowledge reads.
- Added read-only `ticket_read_messages` API/agent registry path, public-only by construction.

## Done
- Dashboard form authoring/publishing route, knowledge create/edit routes, problem creation, CAB voting, and editable PIR controls are mounted.
- Vector search is intentionally lexical-only for this tier: embeddings remain reserved for a future provider-backed migration; `knowledge_search` reports `mode: lexical` and the decision is explicit.
- `ticket_read_messages` uses the agent's snake_case wire shape and returns public entries only.
- API typecheck, dashboard build/typecheck, targeted API tests (135 pass), and agent tests (42 pass) pass.

## Handed off
- C7 legacy category/subcategory retirement belongs to brief B/shared ticket ownership; no shared ticket files were changed.
- Catalogue family/service/subcategory authoring beyond form attachment remains migration-owned and is handed off as optional budget work.
