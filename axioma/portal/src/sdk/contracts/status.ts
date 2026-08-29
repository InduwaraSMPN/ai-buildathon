// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { z } from "zod";

export const statusDaySchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	availability: z.number().min(0).max(1),
});

export const serviceStatusSchema = z.object({
	id: z.string(),
	name: z.string(),
	days: z.array(statusDaySchema),
	uptime: z.object({
		7: z.number().min(0).max(1),
		30: z.number().min(0).max(1),
		90: z.number().min(0).max(1),
	}),
});

export type ServiceStatus = z.infer<typeof serviceStatusSchema>;
