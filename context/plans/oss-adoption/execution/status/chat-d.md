# Chat D — Tier 3

## Done
- Shared action module added at `axioma/api/src/server/automation/actions.ts`; rules and workflows now consume the same action vocabulary, with a set-comparison test.
- Context API-key `UNAUTHORIZED` errors now map to HTTP 401 while preserving 429 retry handling.
- Inbound email rule firings now also write T1.J audit rows.
- CMDB relationship type/object relationship procedures added and wired through the existing validated insert helper.
- Problem/change search projections and reconciliation loaders added.
- Saved-view writes now use `ticket.read.all`, preserving ownership checks.
- Command-menu labels aligned with the server search object types.

## Verification
- API TypeScript gate currently blocked by unrelated concurrent edits in `src/server/routers/mail.ts` and `src/db/schema/tickets.ts` (syntax errors); no gate is reported passing.

## Remaining
- D1 production dispatch guard is now in the shared run helper and portal intake; settlement metrics, persistent API-key rate-limit tables/OpenAPI capability metadata, dashboard editable custom fields, Axel corrective-observation recovery, and seed migrations still need implementation.
- Workflow scheduled emissions are swept from the existing heartbeat; unsupported mutating workflow actions still need explicit dispatch semantics or removal.

## Handed off
- Concurrent edits from other Tier sessions are present in the working tree; do not overwrite them.
