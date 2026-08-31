-- ticket_statuses.colour was admin-editable presentation metadata seeded with
-- colour names ('blue', 'amber', 'green', 'red', 'slate'). Nothing ever read
-- it: both frontends derive a status's tone from state_type through the shared
-- status-tone map, which is keyed to semantic tokens rather than colour names.
-- The contract stopped exposing it; this drops the column behind it so the
-- schema stops promising a knob that turns nothing.
ALTER TABLE "ticket_statuses" DROP COLUMN IF EXISTS "colour";
