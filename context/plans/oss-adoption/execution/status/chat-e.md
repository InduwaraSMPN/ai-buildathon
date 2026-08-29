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
- `sso_identities`, `status_incident_updates`, `asset_types`, `asset_locations`, `contract_terms`, and `payment_schedules` are deferred rather than given fake CRUD surfaces. They remain schema-only for a later focused feature, because dropping applied tables would destroy planned extension points without reducing current application behavior.

## Handed off / blockers
- E2 dashboard mailbox CRUD UI and origin dropdown remain to be completed if full CRUD hand-verification is required; API procedures are present. This is the only incomplete required surface.
- Optional Darwin/Linux inventory collectors were not added; current unsupported-platform fallback remains intentional.
- E7 raw import provenance vs Tier 3 dynamic-field mapping was not changed because the plan explicitly reserves that decision for the user and the dynamic-fields owner.
- Full API/dashboard gates remain blocked by pre-existing unrelated failures; changed-scope typechecks pass. Full gate output is reported by the orchestrator.
