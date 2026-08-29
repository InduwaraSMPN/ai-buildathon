// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";

// Keep these values in sync with `src/shared/index.ts`; this file is published standalone.
const ticketStatus = z.enum([
	"open",
	"routing",
	"resolving",
	"resolved",
	"escalated",
	"closed",
]);
const ticketRoute = z.enum([
	"unassigned",
	"infrastructure",
	"device",
	"application",
	"identity",
	"human_triage",
]);
const recordType = z.enum(["incident", "service_request"]);
const impact = z.enum(["high", "medium", "low"]);
const urgency = z.enum(["high", "medium", "low"]);
const priority = z.enum(["P1", "P2", "P3", "P4"]);
const category = z.enum(["infrastructure", "device", "access"]);
const progressMarker = z.enum([
	"gathering_evidence",
	"checking_device",
	"checking_service",
	"applying_fix",
	"verifying_fix",
	"handing_to_person",
]);
const runStatus = z.enum([
	"running",
	"resolved",
	"escalated",
	"failed",
	"exhausted",
]);
const stepKind = z.enum([
	"think",
	"tool_call",
	"observation",
	"decision",
	"terminal",
]);
const deviceConnection = z.enum(["online", "offline"]);
const commandStatus = z.enum([
	"pending",
	"dispatched",
	"succeeded",
	"failed",
	"timed_out",
]);

const ticket = z.object({
	id: z.string(),
	reporterId: z.string(),
	reporterName: z.string(),
	deviceId: z.string().nullable(),
	title: z.string(),
	body: z.string(),
	recordType,
	impact,
	urgency,
	priority,
	category: category.nullable(),
	subcategory: z.string().nullable(),
	status: ticketStatus,
	route: ticketRoute.nullable(),
	resolution: z.string().nullable(),
	escalationNote: z.string().nullable(),
	reporterNote: z.string().nullable(),
	progressMarker: progressMarker.nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
	resolvedAt: z.date().nullable(),
	closedAt: z.date().nullable(),
	reopenedAt: z.date().nullable(),
});

const agentStep = z.object({
	id: z.string(),
	runId: z.string(),
	ordinal: z.number().int(),
	kind: stepKind,
	reasoning: z.string().nullable(),
	toolName: z.string().nullable(),
	toolInput: z.unknown().nullable(),
	toolOutput: z.unknown().nullable(),
	error: z.string().nullable(),
	evidence: z.string().nullable(),
	createdAt: z.date(),
});
const runSummary = z.object({
	id: z.string(),
	ticketId: z.string(),
	status: runStatus,
	model: z.string().nullable(),
	outcome: z.string().nullable(),
	promptTokens: z.number().int().nullable(),
	completionTokens: z.number().int().nullable(),
	startedAt: z.date(),
	endedAt: z.date().nullable(),
});
const agentRun = runSummary.extend({ steps: z.array(agentStep) });
const lastCommand = z
	.object({
		id: z.string(),
		tool: z.string(),
		status: commandStatus,
		createdAt: z.date(),
		completedAt: z.date().nullable(),
	})
	.nullable();
const device = z.object({
	id: z.string(),
	ownerId: z.string().nullable(),
	ownerName: z.string().nullable(),
	ownerEmail: z.string().nullable(),
	hostname: z.string(),
	username: z.string().nullable(),
	platform: z.string().nullable(),
	release: z.string().nullable(),
	agentVersion: z.string().nullable(),
	connected: deviceConnection,
	lastSeenAt: z.date(),
	enrolledAt: z.date().nullable(),
	lastCommand,
});
const deviceCommand = z.object({
	id: z.string(),
	deviceId: z.string(),
	runId: z.string().nullable(),
	stepId: z.string().nullable(),
	sequence: z.number().int(),
	tool: z.string(),
	input: z.unknown().nullable(),
	status: commandStatus,
	output: z.unknown().nullable(),
	error: z.string().nullable(),
	createdAt: z.date(),
	dispatchedAt: z.date().nullable(),
	completedAt: z.date().nullable(),
});

export const appContract = {
	healthCheck: oc.output(z.string()),
	privateData: oc.output(
		z.object({
			message: z.string(),
			user: z
				.object({ id: z.string(), name: z.string(), email: z.string() })
				.nullish(),
		}),
	),
	createTicket: oc
		.input(
			z.object({
				title: z.string().trim().min(3).max(160),
				body: z.string().trim().min(10).max(10_000),
				recordType: recordType.default("incident"),
				impact,
				urgency,
				deviceId: z.string().trim().min(1).optional(),
			}),
		)
		.output(ticket),
	listTickets: oc
		.input(
			z.object({
				scope: z.enum(["mine", "all"]),
				status: z.array(ticketStatus).max(6).optional(),
				priority: z.array(priority).max(4).optional(),
				recordType: z.array(recordType).max(2).optional(),
				category: z.array(category.nullable()).max(4).optional(),
				route: z.array(ticketRoute.nullable()).max(7).optional(),
				deviceId: z.string().min(1).optional(),
				unassigned: z.boolean().optional(),
				escalatedSince: z.coerce.date().optional(),
				resolvedAt: z.boolean().optional(),
				autonomous: z.boolean().optional(),
				search: z.string().trim().max(160).optional(),
				limit: z.number().int().min(1).max(100).default(50),
				cursor: z.string().optional(),
				sortBy: z
					.enum(["priority", "updatedAt", "createdAt"])
					.default("priority"),
				sortDirection: z.enum(["asc", "desc"]).default("asc"),
			}),
		)
		.output(
			z.object({
				items: z.array(ticket),
				nextCursor: z.string().nullable(),
				facets: z.object({
					status: z.array(
						z.object({
							value: ticketStatus,
							count: z.number().int().nonnegative(),
						}),
					),
					priority: z.array(
						z.object({
							value: priority,
							count: z.number().int().nonnegative(),
						}),
					),
					recordType: z.array(
						z.object({
							value: recordType,
							count: z.number().int().nonnegative(),
						}),
					),
					category: z.array(
						z.object({
							value: category.nullable(),
							count: z.number().int().nonnegative(),
						}),
					),
					route: z.array(
						z.object({
							value: ticketRoute.nullable(),
							count: z.number().int().nonnegative(),
						}),
					),
				}),
			}),
		),
	getTicket: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(ticket.extend({ runs: z.array(agentRun) }).nullable()),
	getMyTicket: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(ticket.nullable()),
	updateTicket: oc
		.input(
			z.discriminatedUnion("action", [
				z.object({
					id: z.string().min(1),
					action: z.literal("close"),
					resolution: z.string().trim().max(10_000).optional(),
				}),
				z.object({
					id: z.string().min(1),
					action: z.literal("escalate"),
					note: z.string().trim().min(1).max(2_000),
					route: ticketRoute.optional(),
				}),
				z.object({
					id: z.string().min(1),
					action: z.literal("add_detail"),
					note: z.string().trim().min(1).max(2_000),
				}),
				z.object({
					id: z.string().min(1),
					action: z.literal("resolve"),
					resolution: z.string().trim().min(1).max(10_000),
				}),
				z.object({ id: z.string().min(1), action: z.literal("reopen") }),
				z.object({
					id: z.string().min(1),
					action: z.literal("reclassify"),
					recordType: recordType.optional(),
					impact: impact.optional(),
					urgency: urgency.optional(),
					category: category.nullable().optional(),
					subcategory: z.string().trim().max(160).nullable().optional(),
				}),
				z.object({
					id: z.string().min(1),
					action: z.literal("assign"),
					route: ticketRoute,
				}),
			]),
		)
		.output(ticket),
	startRun: oc
		.input(z.object({ ticketId: z.string().min(1) }))
		.output(runSummary),
	getRun: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(agentRun.nullable()),
	cancelRun: oc
		.input(
			z.object({
				id: z.string().min(1),
				reason: z.string().trim().min(1).max(500).default("run cancelled"),
			}),
		)
		.output(runSummary),
	listDevices: oc.output(z.array(device)),
	listMyDevices: oc.output(
		z.array(
			z.object({
				id: z.string(),
				hostname: z.string(),
				connected: deviceConnection,
				lastSeenAt: z.date(),
			}),
		),
	),
	enrollDevice: oc
		.input(z.object({ code: z.string().trim().min(4).max(64) }))
		.output(
			z.object({
				id: z.string(),
				hostname: z.string(),
				connected: deviceConnection,
				lastSeenAt: z.date(),
			}),
		),
	listDeviceCommands: oc
		.input(
			z.object({
				deviceId: z.string().min(1),
				limit: z.number().int().min(1).max(100).default(20),
			}),
		)
		.output(z.array(deviceCommand)),
	ticketStats: oc
		.input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
		.output(
			z.object({
				byStatus: z.record(ticketStatus, z.number().int().nonnegative()),
				byPriority: z.record(priority, z.number().int().nonnegative()),
				byRecordType: z.record(recordType, z.number().int().nonnegative()),
				openByPriority: z.record(priority, z.number().int().nonnegative()),
				awaitingConfirmation: z.number().int().nonnegative(),
				escalatedLast24h: z.number().int().nonnegative(),
				escalatedSince: z.date(),
				closedTotal: z.number().int().nonnegative(),
				autonomousClosed: z.number().int().nonnegative(),
				autonomousResolutionNumerator: z.number().int().nonnegative(),
				autonomousResolutionDenominator: z.number().int().nonnegative(),
				autonomousResolutionRate: z.number().min(0).max(1).nullable(),
				daily: z.array(
					z.object({
						date: z.string(),
						incidents: z.number().int().nonnegative(),
						serviceRequests: z.number().int().nonnegative(),
						resolved: z.number().int().nonnegative(),
						escalated: z.number().int().nonnegative(),
					}),
				),
				medianTimeToResolutionMs: z.number().nonnegative().nullable(),
			}),
		),
};

export type AppContract = typeof appContract;
