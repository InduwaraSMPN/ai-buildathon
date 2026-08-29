# Chat E — tier 4

Last updated: 2026-08-29
Branch: main

## Done
- E1: Added `readDeviceInventory`, joining the existing device asset link to disks, hardware, software, and latest report time; rendered the summary in the device detail sheet.
- E2: Added mailbox list/upsert/delete procedures and inbound activity listing. Notification sends now select enabled templates by specificity and render ticket reference/url merge codes, with raw workflow text as fallback. Reference threading remains ticket-number based.
- E3: Added inbound mailbox activity to the existing mail log page.
- E4: Added origin foreign-key declarations for mailboxes, ticket mail provenance, and messaging threads; added migration `0032_chat_e_tier4.sql` with seeded portal/email/chat/monitoring/phone origins and compatibility backfill.
- E6: Moved status-page loading and failure copy into `portal/src/features/status/copy.ts`; raw server errors are no longer shown to employees.
- E6: Published contracts to dashboard, portal, agent, and CLI copies.

## E5 choice
- `dashboard_widgets` is kept and wired; its existing arrangement read/write path is used by overview.
- `sso_identities` duplicated Better Auth account linkage, so it is dropped forward-only.
- `status_incident_updates`, `contract_terms`, and `payment_schedules` had no application path, so they are dropped forward-only until their owning features need them.
- Empty `asset_types` and `asset_locations`, plus their unused nullable asset columns, are dropped forward-only; dynamic fields already provide declared asset metadata.
- These choices are recorded beside the removed declarations in schema source and in migration `0037_phase6_brief_e_remainder.sql`.

## E7 choice
- `assets.attributes` retains every normalized CSV source column as raw-row provenance (not byte-for-byte CSV).
- Import profiles may map declared CSV headers to active asset dynamic-field keys. Integer and checkbox values are converted; string-shaped field types remain strings. Multiselect import is rejected until an encoding is specified.
- The configured database had zero assets, asset import profiles/runs, and active asset dynamic fields, so there was no live sample payload to preserve beyond the existing normalized-row contract.

## Handed off / blockers
- E2 mailbox CRUD and the origin picker are implemented in the dashboard using existing mailbox procedures and `listTicketOrigins`.
- Optional Darwin/Linux inventory collectors were not added; current unsupported-platform fallback remains intentional.
- Full API/dashboard gates remain blocked by pre-existing unrelated failures; changed-scope typechecks pass. Full gate output is reported by the orchestrator.
