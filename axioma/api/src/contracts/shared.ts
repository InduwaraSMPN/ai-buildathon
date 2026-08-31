import { z } from "zod";
import { CAPABILITIES, IMPACT_LEVELS, PRIORITIES } from "../shared";

export const id = z.string().trim().min(1);

export const nullableId = id.nullable();

export const impact = z.enum(IMPACT_LEVELS);

export const priority = z.enum(PRIORITIES);

export const jsonRecord = z.record(z.string(), z.unknown());

export const capability = z.enum(CAPABILITIES);
