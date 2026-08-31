// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { z } from "zod";
import { CAPABILITIES, IMPACT_LEVELS, PRIORITIES } from "../shared";

export const id = z.string().trim().min(1);

export const nullableId = id.nullable();

export const impact = z.enum(IMPACT_LEVELS);

export const priority = z.enum(PRIORITIES);

export const jsonRecord = z.record(z.string(), z.unknown());

export const capability = z.enum(CAPABILITIES);

export { STATE_TYPES } from "../shared";
