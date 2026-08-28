import { oc } from "@orpc/contract";
import { z } from "zod";

const ticketStatus = z.enum([
	"open",
	"routing",
	"resolving",
	"resolved",
	"escalated",
	"closed",
]);

const ticket = z.object({
	id: z.string(),
	reporterId: z.string(),
	reporterName: z.string(),
	deviceId: z.string().nullable(),
	title: z.string(),
	body: z.string(),
	status: z.string(),
	route: z.string().nullable(),
	resolution: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
	closedAt: z.date().nullable(),
});

const agentStep = z.object({
	id: z.string(),
	runId: z.string(),
	ordinal: z.number().int(),
	kind: z.string(),
	reasoning: z.string().nullable(),
	toolName: z.string().nullable(),
	toolInput: z.unknown().nullable(),
	toolOutput: z.unknown().nullable(),
	error: z.string().nullable(),
	createdAt: z.date(),
});

const agentRun = z.object({
	id: z.string(),
	ticketId: z.string(),
	status: z.string(),
	model: z.string().nullable(),
	outcome: z.string().nullable(),
	promptTokens: z.number().int().nullable(),
	completionTokens: z.number().int().nullable(),
	startedAt: z.date(),
	endedAt: z.date().nullable(),
	steps: z.array(agentStep),
});

export const appContract = {
	healthCheck: oc.output(z.string()),

	privateData: oc.output(
		z.object({
			message: z.string(),
			user: z
				.object({
					id: z.string(),
					name: z.string(),
					email: z.string(),
				})
				.nullish(),
		}),
	),

	createTicket: oc
		.input(
			z.object({
				title: z.string().trim().min(3).max(160),
				body: z.string().trim().min(10).max(10_000),
				deviceId: z.string().trim().min(1).optional(),
			}),
		)
		.output(ticket),

	listTickets: oc
		.input(
			z.object({
				scope: z.enum(["mine", "all"]),
				status: ticketStatus.optional(),
			}),
		)
		.output(z.array(ticket)),

	getTicket: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(ticket.extend({ runs: z.array(agentRun) }).nullable()),

	updateTicket: oc
		.input(
			z.object({
				id: z.string().min(1),
				action: z.enum(["close", "escalate"]),
				resolution: z.string().trim().max(10_000).optional(),
				route: z.string().trim().max(160).optional(),
			}),
		)
		.output(ticket),

	listDevices: oc.output(
		z.array(
			z.object({
				id: z.string(),
				ownerId: z.string().nullable(),
				ownerName: z.string().nullable(),
				hostname: z.string(),
				username: z.string().nullable(),
				platform: z.string().nullable(),
				release: z.string().nullable(),
				agentVersion: z.string().nullable(),
				connected: z.string(),
				lastSeenAt: z.date(),
				enrolledAt: z.date(),
			}),
		),
	),
};

export type AppContract = typeof appContract;
