// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";
import { id, nullableId, priority } from "./shared";

export const problemSchema = z.object({
	id: z.string(),
	problemNumber: z.string(),
	title: z.string(),
	description: z.string(),
	status: z.string(),
	priority,
	assigneeId: nullableId,
	rootCause: z.string().nullable(),
	workaround: z.string().nullable(),
	isKnownError: z.boolean(),
	serviceId: nullableId,
	createdAt: z.date(),
	updatedAt: z.date(),
});

const problemDetailSchema = problemSchema.extend({
	ticketIds: z.array(z.string()),
	resolutionOffer: z.string().nullable(),
});

export const problemsContract = {
	listProblems: oc.output(z.array(problemSchema)),
	getProblem: oc.input(z.object({ id })).output(problemDetailSchema.nullable()),
	createProblem: oc
		.input(
			z.object({
				title: z.string().trim().min(3).max(160),
				description: z.string().trim().min(1).max(10_000),
				priority: priority.default("P3"),
				assigneeId: id.optional(),
				serviceId: id.optional(),
				ticketIds: z.array(id).max(100).default([]),
			}),
		)
		.output(problemDetailSchema),
	updateProblem: oc
		.input(
			z.object({
				id,
				title: z.string().trim().min(3).max(160).optional(),
				description: z.string().trim().min(1).max(10_000).optional(),
				status: z.string().trim().min(1).optional(),
				priority: priority.optional(),
				assigneeId: nullableId.optional(),
				rootCause: z.string().trim().max(10_000).nullable().optional(),
				workaround: z.string().trim().max(10_000).nullable().optional(),
				isKnownError: z.boolean().optional(),
				serviceId: nullableId.optional(),
			}),
		)
		.output(problemDetailSchema),
	linkProblemTickets: oc
		.input(z.object({ problemId: id, ticketIds: z.array(id).min(1).max(100) }))
		.output(problemDetailSchema),
	closeProblem: oc
		.input(z.object({ id, resolution: z.string().trim().min(1).max(10_000) }))
		.output(
			z.object({
				problem: problemDetailSchema,
				incidentOffers: z.array(
					z.object({
						ticketId: z.string(),
						currentResolution: z.string().nullable(),
						resolutionOffer: z.string(),
					}),
				),
			}),
		),
};
