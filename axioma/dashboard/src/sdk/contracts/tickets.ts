// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";
import { id, impact, jsonRecord, nullableId, priority } from "./shared";

const runStatus = z.enum([
	"running",
	"resolved",
	"escalated",
	"failed",
	"exhausted",
]);

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

const changeType = z.enum(["standard", "normal", "emergency"]);

const changeStatus = z.enum([
	"draft",
	"submitted",
	"pending_approval",
	"approved",
	"rejected",
	"scheduled",
	"in_progress",
	"completed",
	"failed",
	"cancelled",
]);

const changeSchema = z.object({
	id: z.string(),
	changeNumber: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	reasonForChange: z.string().nullable(),
	changeType,
	status: changeStatus,
	priority,
	impact: z.enum(["high", "medium", "low"]),
	testPlan: z.string().nullable(),
	rollbackPlan: z.string().nullable(),
	riskLikelihood: z.number().int().nullable(),
	riskImpactScore: z.number().int().nullable(),
	riskScore: z.number().int().nullable(),
	riskLevel: z.string().nullable(),
	cabRequired: z.boolean(),
	cabApprovalType: z.enum(["all", "majority"]),
	workStartAt: z.date().nullable(),
	workEndAt: z.date().nullable(),
	outageStartAt: z.date().nullable(),
	outageEndAt: z.date().nullable(),
	pirWasSuccessful: z.boolean().nullable(),
	pirActualStartAt: z.date().nullable(),
	pirActualEndAt: z.date().nullable(),
	pirLessonsLearned: z.string().nullable(),
	pirFollowUp: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const problemSchema = z.object({
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

const resolutionCode = z.enum([
	"fixed",
	"workaround",
	"not_reproducible",
	"duplicate",
	"no_action_required",
	"rejected",
]);

const ticketTimeEntry = z.object({
	id: z.string(),
	ticketId: z.string(),
	userId: z.string(),
	minutes: z.number().int().positive(),
	note: z.string(),
	createdAt: z.date(),
});

const ticketAuditRow = z.object({
	id: z.string(),
	ticketId: z.string(),
	fieldName: z.string(),
	oldValue: z.unknown().nullable(),
	newValue: z.unknown().nullable(),
	actorId: z.string(),
	createdAt: z.date(),
});

const ticketLink = z.object({
	id: z.string(),
	ticketId: z.string(),
	targetTicketId: z.string(),
	relationType: z.enum([
		"duplicate_of",
		"related_to",
		"caused_by",
		"parent_of",
	]),
	createdBy: z.string(),
	createdAt: z.date(),
});

const presence = z.object({
	userId: z.string(),
	userName: z.string(),
	lastSeenAt: z.date(),
});

const csat = z.object({
	token: z.string(),
	rating: z.number().int().min(1).max(5).nullable(),
	comment: z.string().nullable(),
	respondedAt: z.date().nullable(),
});

const ticketMessage = z.object({
	id: z.string(),
	ticketId: z.string(),
	authorId: z.string().nullable(),
	authorType: z.enum(["reporter", "staff"]),
	body: z.string(),
	visibility: z.enum(["public", "private"]),
	createdAt: z.date(),
});

const portalTicketMessage = ticketMessage.omit({ visibility: true });

const stepKind = z.enum([
	"think",
	"tool_call",
	"observation",
	"decision",
	"terminal",
]);

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

const agentRun = runSummary.extend({ steps: z.array(agentStep) });

const ticketRoute = z.enum([
	"unassigned",
	"infrastructure",
	"device",
	"application",
	"identity",
	"human_triage",
]);

const category = z.enum(["infrastructure", "device", "access"]);

const ticketStatus = z.string().min(1);

const recordType = z.enum(["incident", "service_request"]);

const urgency = z.enum(["high", "medium", "low"]);

const progressMarker = z.enum([
	"gathering_evidence",
	"checking_device",
	"checking_service",
	"applying_fix",
	"verifying_fix",
	"handing_to_person",
]);

const ticket = z.object({
	id: z.string(),
	number: z.string().nullable(),
	mergedIntoId: z.string().nullable(),
	reporterId: z.string(),
	reporterName: z.string(),
	assigneeId: z.string().nullable(),
	assigneeName: z.string().nullable(),
	ownerId: z.string().nullable(),
	ownerName: z.string().nullable(),
	teamId: z.string().nullable(),
	teamName: z.string().nullable(),
	deviceId: z.string().nullable(),
	title: z.string(),
	body: z.string(),
	recordType,
	impact,
	urgency,
	priority,
	serviceId: z.string(),
	serviceSubcategoryId: z.string(),
	category: category.nullable(),
	subcategory: z.string().nullable(),
	status: ticketStatus,
	statusLabel: z.string(),
	statusStateType: z.string(),
	statusColour: z.string().nullable(),
	route: ticketRoute.nullable(),
	resolution: z.string().nullable(),
	resolutionCode: resolutionCode.nullable(),
	escalationNote: z.string().nullable(),
	escalationFlag: z.enum(["none", "warning", "breach"]),
	escalationReason: z.string().nullable(),
	progressMarker: progressMarker.nullable(),
	pendingReasonId: z.string().nullable(),
	pendingUntil: z.date().nullable(),
	lastPendingAt: z.date().nullable(),
	pendingFollowups: z.number().int().nonnegative(),
	createdAt: z.date(),
	updatedAt: z.date(),
	resolvedAt: z.date().nullable(),
	closedAt: z.date().nullable(),
	reopenedAt: z.date().nullable(),
	customFields: jsonRecord.default({}),
});

export const ticketsContract = {
	createTicket: oc
		.input(
			z.object({
				title: z.string().trim().min(3).max(160),
				body: z.string().trim().min(10).max(10_000),
				recordType: recordType.default("incident"),
				impact,
				urgency,
				deviceId: z.string().trim().min(1).optional(),
				serviceId: z.string().trim().min(1).optional(),
				serviceSubcategoryId: z.string().trim().min(1).optional(),
				customFields: jsonRecord.default({}),
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
				serviceId: z.array(z.string().min(1)).max(100).optional(),
				category: z.array(category.nullable()).max(4).optional(),
				route: z.array(ticketRoute.nullable()).max(7).optional(),
				assigneeId: z.string().min(1).optional(),
				teamId: z.string().min(1).optional(),
				myQueue: z.boolean().optional(),
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
					service: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
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
					assignee: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							count: z.number().int().nonnegative(),
						}),
					),
					team: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							count: z.number().int().nonnegative(),
						}),
					),
				}),
			}),
		),
	getTicket: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(
			ticket
				.extend({ runs: z.array(agentRun), messages: z.array(ticketMessage) })
				.nullable(),
		),
	getMyTicket: oc.input(z.object({ id: z.string().min(1) })).output(
		ticket
			.extend({
				messages: z.array(portalTicketMessage),
				csat: csat.nullable(),
			})
			.nullable(),
	),
	heartbeatTicketPresence: oc
		.input(z.object({ ticketId: z.string().min(1) }))
		.output(z.object({ lastSeenAt: z.date() })),
	listTicketPresence: oc
		.input(z.object({ ticketId: z.string().min(1) }))
		.output(z.array(presence)),
	submitTicketCsat: oc
		.input(
			z.object({
				token: z.string().min(16).max(256),
				rating: z.number().int().min(1).max(5),
				comment: z.string().trim().max(2_000).optional(),
			}),
		)
		.output(z.object({ accepted: z.literal(true) })),
	addTicketMessage: oc
		.input(
			z.object({
				ticketId: z.string().min(1),
				body: z.string().trim().min(1).max(10_000),
				visibility: z.enum(["public", "private"]),
			}),
		)
		.output(ticketMessage),
	addMyTicketMessage: oc
		.input(
			z.object({
				ticketId: z.string().min(1),
				body: z.string().trim().min(1).max(10_000),
			}),
		)
		.output(portalTicketMessage),
	listTicketLinks: oc
		.input(z.object({ ticketId: z.string().min(1) }))
		.output(z.array(ticketLink)),
	linkTickets: oc
		.input(
			z.object({
				ticketId: z.string().min(1),
				targetTicketId: z.string().min(1),
				relationType: ticketLink.shape.relationType,
			}),
		)
		.output(ticketLink),
	unlinkTickets: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(z.object({ deleted: z.boolean() })),
	mergeTickets: oc
		.input(
			z.object({
				sourceTicketId: z.string().min(1),
				targetTicketId: z.string().min(1),
			}),
		)
		.output(ticket),
	unmergeTicket: oc
		.input(z.object({ sourceTicketId: z.string().min(1) }))
		.output(ticket),
	listTicketAudit: oc
		.input(z.object({ ticketId: z.string().min(1) }))
		.output(z.array(ticketAuditRow)),
	listTicketTimeEntries: oc
		.input(z.object({ ticketId: z.string().min(1) }))
		.output(
			z.object({
				entries: z.array(ticketTimeEntry),
				totalMinutes: z.number().int().nonnegative(),
			}),
		),
	addTicketTimeEntry: oc
		.input(
			z.object({
				ticketId: z.string().min(1),
				minutes: z.number().int().positive().max(1440),
				note: z.string().trim().max(2000).default(""),
			}),
		)
		.output(ticketTimeEntry),
	lookupTicket: oc
		.input(z.object({ reference: z.string().trim().min(1) }))
		.output(ticket.nullable()),
	listTicketAssignmentOptions: oc.output(
		z.object({
			users: z.array(z.object({ id: z.string(), name: z.string() })),
			teams: z.array(z.object({ id: z.string(), name: z.string() })),
		}),
	),
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
					resolutionCode,
				}),
				z.object({ id: z.string().min(1), action: z.literal("reopen") }),
				z.object({
					id: z.string().min(1),
					action: z.literal("pend"),
					reasonId: z.string().min(1),
					until: z.date().optional(),
				}),
				z.object({ id: z.string().min(1), action: z.literal("unpend") }),
				z.object({
					id: z.string().min(1),
					action: z.literal("reclassify"),
					recordType: recordType.optional(),
					impact: impact.optional(),
					urgency: urgency.optional(),
					category: category.nullable().optional(),
					subcategory: z.string().trim().max(160).nullable().optional(),
				}),
				z
					.object({
						id: z.string().min(1),
						action: z.literal("assign"),
						route: ticketRoute.optional(),
						assigneeId: z.string().min(1).nullable().optional(),
						ownerId: z.string().min(1).nullable().optional(),
						teamId: z.string().min(1).nullable().optional(),
					})
					.refine(
						(input) =>
							input.route !== undefined ||
							input.assigneeId !== undefined ||
							input.ownerId !== undefined ||
							input.teamId !== undefined,
						{ message: "assignment field is required" },
					),
			]),
		)
		.output(ticket),
	ticketStats: oc
		.input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
		.output(
			z.object({
				byStatus: z.record(ticketStatus, z.number().int().nonnegative()),
				byPriority: z.record(priority, z.number().int().nonnegative()),
				byRecordType: z.record(recordType, z.number().int().nonnegative()),
				byResolutionCode: z.record(
					resolutionCode,
					z.number().int().nonnegative(),
				),
				openByPriority: z.record(priority, z.number().int().nonnegative()),
				awaitingConfirmation: z.number().int().nonnegative(),
				escalatedLast24h: z.number().int().nonnegative(),
				escalatedSince: z.date(),
				closedTotal: z.number().int().nonnegative(),
				autonomousClosed: z.number().int().nonnegative(),
				autonomousResolutionNumerator: z.number().int().nonnegative(),
				autonomousResolutionDenominator: z.number().int().nonnegative(),
				autonomousResolutionRate: z.number().min(0).max(1).nullable(),
				csat: z.object({
					responses: z.number().int().nonnegative(),
					average: z.number().min(1).max(5).nullable(),
					byRating: z.record(z.string(), z.number().int().nonnegative()),
				}),
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
	getTicketServiceRecords: oc.input(z.object({ ticketId: id })).output(
		z.object({
			problems: z.array(
				problemSchema.pick({
					id: true,
					problemNumber: true,
					title: true,
					workaround: true,
					isKnownError: true,
				}),
			),
			changes: z.array(
				changeSchema.pick({
					id: true,
					changeNumber: true,
					title: true,
					status: true,
					changeType: true,
				}),
			),
		}),
	),
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
};
