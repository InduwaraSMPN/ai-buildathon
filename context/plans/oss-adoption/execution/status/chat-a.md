# Chat A — identity, authorization and database hygiene

Last updated: 2026-08-29
Branch: main

## In progress
- Final integration with concurrently edited Tier 1–4 files.

## Decisions
- Administration procedures use `admin.roles`, matching the existing identity administration surface.
- Directory staff mapping uses configurable `AXIOMA_DIRECTORY_STAFF_ATTRIBUTE` and `AXIOMA_DIRECTORY_STAFF_VALUE`; defaults are `department` and `IT`, following the existing department field.
- Administrator bootstrap runs at API startup because it is idempotent and works for every deployment without a separate seed command.

## Done
- A1: `setUserKind` is capability-gated and audited; both user kinds receive their seeded default role; directory sync maps configured `department` or `jobTitle` values to staff.
- A2: startup bootstrap promotes `AXIOMA_BOOTSTRAP_ADMIN_EMAIL` and idempotently grants Platform Engineer. Verified against the live database: `admin@gmail.com` is staff with Platform Engineer and one effective administrator exists.
- A3: role capability edits, role revocation, team replacement, kind changes, and directory sync enforce a serialized direct-plus-team last-administrator invariant with `LAST_ADMIN_REQUIRED` conflict semantics.
- A4/A5: people, departments, and teams can be listed/created/updated from the administration page; users can be placed on teams and roles can be assigned to users or teams.
- A6: assets, suppliers, mail templates, software licences, and workflows redirect to `/home` without `admin.settings`.
- A7: the dashboard receives the complete capability vocabulary from the API; runtime/contract/database CHECK parity tests exist.
- A8: migration `0018_foreign_key_indexes.sql` adds all regenerated missing FK indexes except the explicit `forms` table skip; the live query now returns only `forms.created_by_id`.

## Gates
- API changed-file Biome: pass.
- API TypeScript: pass.
- Targeted identity tests: 12/12 pass.
- `pnpm db:check`: pass (`Clean 21-migration snapshot baseline is valid`).
- Dashboard changed-file Biome and TypeScript: pass.
- CLI: `go vet`, `go build`, and all package tests pass.
- Agent pytest: 40/40 pass; Ruff is blocked by a concurrent pre-existing line-length error in `agent/axel/tools.py:165`.
- Full API tests are blocked by a concurrent `ACTION_TYPES is not defined` error in `server/rules/index.ts:50`; 113 tests pass before four importing suites fail.
- Portal TypeScript passes; full Biome remains blocked by formatting in `dynamic-request-form.tsx`.

## Handed off / skipped
- A8 intentionally skips `forms`, `mailboxes`, and `cmdb_relationship_types`, as required by the brief.
