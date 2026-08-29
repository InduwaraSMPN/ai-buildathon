import { oc } from "@orpc/contract";
import { z } from "zod";

const statusDaySchema = z.object({
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

export const statusContract = {
	readStatus: oc
		.input(z.object({ days: z.number().int().min(1).max(90).default(90) }))
		.output(z.array(serviceStatusSchema)),
	upsertStatusService: oc
		.input(
			z.object({
				id: z.string().min(1),
				name: z.string().trim().min(1),
				description: z.string().nullable().optional(),
				active: z.boolean().default(true),
			}),
		)
		.output(z.object({ id: z.string() })),
	upsertImpactLevel: oc
		.input(
			z.object({
				key: z.string().min(1),
				label: z.string().trim().min(1),
				countsAsDowntime: z.boolean(),
			}),
		)
		.output(z.object({ key: z.string() })),
	createStatusIncident: oc
		.input(
			z.object({
				serviceId: z.string().min(1),
				impactLevel: z.string().min(1),
				title: z.string().trim().min(1),
				plannedMaintenance: z.boolean().default(false),
				startedAt: z.coerce.date(),
				resolvedAt: z.coerce.date().nullable().optional(),
			}),
		)
		.output(z.object({ id: z.string() })),
	updateStatusIncident: oc
		.input(
			z.object({
				id: z.string().min(1),
				impactLevel: z.string().min(1).optional(),
				title: z.string().trim().min(1).optional(),
				plannedMaintenance: z.boolean().optional(),
				startedAt: z.coerce.date().optional(),
				resolvedAt: z.coerce.date().nullable().optional(),
			}),
		)
		.output(z.object({ id: z.string() })),
};
