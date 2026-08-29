import { oc } from "@orpc/contract";
import { z } from "zod";
import { tier2Contract } from "./tier2";
import { tier4Contract } from "./tier4";

// Keep these values in sync with `src/shared/index.ts`; this file is published standalone.
const ticketStatus = z.string().min(1);
const ticketRoute = z.enum([
	"unassigned",
	"infrastructure",
	"device",
	"application",
	"identity",
	"human_triage",
]);
const resolutionCode = z.enum([
	"fixed",
	"workaround",
	"not_reproducible",
	"duplicate",
	"no_action_required",
	"rejected",
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
const jsonRecord = z.record(z.string(), z.unknown());
const dynamicFieldType = z.enum([
	"text",
	"textarea",
	"integer",
	"date",
	"datetime",
	"dropdown",
	"multiselect",
	"checkbox",
	"reference",
]);
const dynamicFieldDefinition = z.object({
	id: z.string(),
	key: z.string(),
	label: z.string(),
	fieldType: dynamicFieldType,
	objectType: z.string(),
	config: jsonRecord,
	displayOrder: z.number().int(),
	isActive: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
const cmdbProperty = z.object({
	id: z.string(),
	classId: z.string(),
	propertyKey: z.string(),
	label: z.string(),
	propertyType: z.string(),
	targetClassId: z.string().nullable(),
	isRequired: z.boolean(),
	spreadsImpact: z.boolean(),
});
const cmdbClass = z.object({
	id: z.string(),
	key: z.string(),
	label: z.string(),
	parentClassId: z.string().nullable(),
	properties: z.array(cmdbProperty).optional(),
});
const cmdbObject = z.object({
	id: z.string(),
	classId: z.string(),
	externalId: z.string(),
	name: z.string(),
	sourceTicketId: z.string().nullable(),
	sourceRunId: z.string().nullable(),
	sourceStepId: z.string().nullable(),
	observedAt: z.date(),
});
const ticketRule = z.object({
	id: z.string(),
	name: z.string(),
	position: z.number().int(),
	criteria: z.array(z.unknown()),
	actions: z.array(z.unknown()),
	enabled: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
const workflow = z.object({
	id: z.string(),
	name: z.string(),
	triggerEvent: z.string(),
	conditions: z.array(z.unknown()).readonly(),
	actions: z.array(z.unknown()).readonly(),
	isActive: z.boolean(),
	lastRunStatus: z.enum(["running", "succeeded", "failed"]).nullable(),
	lastRunAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
const savedView = z.object({
	id: z.string(),
	ownerType: z.enum(["user", "team"]),
	ownerId: z.string(),
	createdById: z.string(),
	name: z.string(),
	objectType: z.string().nullable(),
	filters: z.unknown(),
	sort: z.unknown().nullable(),
	columns: z.array(z.string()).nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
const searchResult = z.object({
	objectType: z.string(),
	objectId: z.string(),
	title: z.string(),
	body: z.string(),
	url: z.string().nullable(),
	metadata: jsonRecord,
	sourceUpdatedAt: z.date(),
	indexedAt: z.date(),
	rank: z.number(),
});
const webhookDelivery = z.object({
	id: z.string(),
	executionId: z.string().nullable(),
	messageFormatId: z.string().nullable(),
	url: z.string(),
	requestHeaders: z.record(z.string(), z.string()),
	requestBody: z.string(),
	status: z.enum(["pending", "delivering", "succeeded", "retrying", "failed"]),
	attemptCount: z.number().int(),
	maxAttempts: z.number().int(),
	nextAttemptAt: z.date().nullable(),
	responseStatus: z.number().int().nullable(),
	responseHeaders: z.record(z.string(), z.string()).nullable(),
	responseBody: z.string().nullable(),
	lastError: z.string().nullable(),
	createdAt: z.date(),
	completedAt: z.date().nullable(),
});
const notification = z.object({
	id: z.string(),
	recipientId: z.string(),
	actorId: z.string().nullable(),
	recordType: z.string(),
	recordId: z.string(),
	eventType: z.string(),
	eventCount: z.number().int(),
	title: z.string(),
	body: z.string(),
	metadata: jsonRecord,
	readAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
const deviceConnection = z.enum(["online", "offline"]);
const commandStatus = z.enum([
	"pending",
	"dispatched",
	"succeeded",
	"failed",
	"timed_out",
]);
const capability = z.enum([
	"ticket.read.own",
	"ticket.read.all",
	"ticket.create",
	"ticket.update",
	"ticket.resolve",
	"ticket.close",
	"ticket.escalate",
	"ticket.reclassify",
	"ticket.assign",
	"ticket.reopen",
	"run.start",
	"run.cancel",
	"run.read",
	"device.read",
	"device.enroll",
	"device.command",
	"stats.read",
	"problem.manage",
	"change.manage",
	"change.approve",
	"knowledge.read",
	"knowledge.manage",
	"approval.read",
	"approval.decide",
	"catalogue.manage",
	"admin.roles",
	"admin.settings",
]);
const apiKey = z.object({
	id: z.string(),
	userId: z.string(),
	name: z.string(),
	prefix: z.string(),
	capabilities: z.array(capability),
	expiresAt: z.date(),
	lastUsedAt: z.date().nullable(),
	revokedAt: z.date().nullable(),
	createdAt: z.date(),
});
const role = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	capabilities: z.array(capability),
});
const team = z.object({
	id: z.string(),
	name: z.string(),
	memberIds: z.array(z.string()),
	roleIds: z.array(z.string()),
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
const ticketAuditRow = z.object({
	id: z.string(),
	ticketId: z.string(),
	fieldName: z.string(),
	oldValue: z.unknown().nullable(),
	newValue: z.unknown().nullable(),
	actorId: z.string(),
	createdAt: z.date(),
});
const ticketTimeEntry = z.object({
	id: z.string(),
	ticketId: z.string(),
	userId: z.string(),
	minutes: z.number().int().positive(),
	note: z.string(),
	createdAt: z.date(),
});

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
	...tier2Contract,
	...tier4Contract,
	healthCheck: oc.output(z.string()),
	privateData: oc.output(
		z.object({
			message: z.string(),
			user: z
				.object({
					id: z.string(),
					name: z.string(),
					email: z.string(),
					kind: z.enum(["staff", "reporter"]),
				})
				.nullish(),
			capabilities: z.array(capability),
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
	listCmdbClasses: oc.output(z.array(cmdbClass)),
	createCmdbClass: oc
		.input(
			z.object({
				key: z.string().min(1),
				label: z.string().min(1),
				parentClassId: z.string().nullable().optional(),
				properties: z
					.array(cmdbProperty.omit({ id: true, classId: true }))
					.default([]),
			}),
		)
		.output(cmdbClass),
	updateCmdbClass: oc
		.input(
			z.object({
				id: z.string(),
				label: z.string().min(1).optional(),
				parentClassId: z.string().nullable().optional(),
			}),
		)
		.output(cmdbClass),
	deleteCmdbClass: oc
		.input(z.object({ id: z.string() }))
		.output(z.object({ deleted: z.boolean() })),
	listCmdbObjects: oc
		.input(
			z.object({
				classId: z.string().optional(),
				limit: z.number().int().min(1).max(100).default(50),
			}),
		)
		.output(z.array(cmdbObject)),
	cmdbImpact: oc
		.input(
			z.object({
				objectId: z.string(),
				maxDepth: z.number().int().min(0).max(10).default(5),
			}),
		)
		.output(
			z.array(
				z.object({
					objectId: z.string(),
					depth: z.number().int(),
					viaRelationshipId: z.string().optional(),
					object: cmdbObject.nullable(),
				}),
			),
		),
	listTicketCmdbObjects: oc
		.input(z.object({ ticketId: z.string() }))
		.output(z.array(cmdbObject)),
	linkTicketCmdbObject: oc
		.input(z.object({ ticketId: z.string(), objectId: z.string() }))
		.output(z.object({ linked: z.literal(true) })),
	unlinkTicketCmdbObject: oc
		.input(z.object({ ticketId: z.string(), objectId: z.string() }))
		.output(z.object({ deleted: z.boolean() })),
	listFieldDefinitions: oc
		.input(z.object({ objectType: z.string().min(1) }))
		.output(z.array(dynamicFieldDefinition)),
	createFieldDefinition: oc
		.input(
			dynamicFieldDefinition
				.omit({ id: true, createdAt: true, updatedAt: true })
				.partial({ config: true, displayOrder: true, isActive: true }),
		)
		.output(dynamicFieldDefinition),
	setFieldDefinitionActive: oc
		.input(z.object({ id: z.string(), active: z.boolean() }))
		.output(dynamicFieldDefinition),
	listTicketRules: oc.output(z.array(ticketRule)),
	createTicketRule: oc
		.input(
			ticketRule
				.omit({ id: true, createdAt: true, updatedAt: true })
				.partial({ enabled: true }),
		)
		.output(ticketRule),
	updateTicketRule: oc
		.input(
			ticketRule
				.omit({ createdAt: true, updatedAt: true })
				.partial()
				.required({ id: true }),
		)
		.output(ticketRule),
	deleteTicketRule: oc
		.input(z.object({ id: z.string() }))
		.output(z.object({ deleted: z.boolean() })),
	listWorkflows: oc.output(z.array(workflow)),
	createWorkflow: oc
		.input(
			workflow
				.omit({
					id: true,
					lastRunStatus: true,
					lastRunAt: true,
					createdAt: true,
					updatedAt: true,
				})
				.partial({ conditions: true, actions: true, isActive: true }),
		)
		.output(workflow),
	updateWorkflow: oc
		.input(
			workflow
				.omit({
					lastRunStatus: true,
					lastRunAt: true,
					createdAt: true,
					updatedAt: true,
				})
				.partial()
				.required({ id: true }),
		)
		.output(workflow),
	deleteWorkflow: oc
		.input(z.object({ id: z.string() }))
		.output(z.object({ deleted: z.boolean() })),
	listWebhookDeliveries: oc
		.input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
		.output(z.array(webhookDelivery)),
	retryWebhookDeliveries: oc
		.input(z.object({ limit: z.number().int().min(1).max(100).default(25) }))
		.output(z.object({ processed: z.number().int().nonnegative() })),
	listNotifications: oc.output(z.array(notification)),
	markNotificationRead: oc
		.input(z.object({ id: z.string() }))
		.output(notification),
	listSavedViews: oc.output(z.array(savedView)),
	createSavedView: oc
		.input(
			savedView
				.omit({ id: true, createdById: true, createdAt: true, updatedAt: true })
				.partial({
					ownerType: true,
					ownerId: true,
					objectType: true,
					sort: true,
					columns: true,
				}),
		)
		.output(savedView),
	updateSavedView: oc
		.input(
			savedView
				.omit({
					ownerType: true,
					ownerId: true,
					createdById: true,
					createdAt: true,
					updatedAt: true,
				})
				.partial()
				.required({ id: true }),
		)
		.output(savedView),
	deleteSavedView: oc
		.input(z.object({ id: z.string() }))
		.output(z.object({ deleted: z.boolean() })),
	reconcileSearch: oc
		.input(z.object({ since: z.coerce.date() }))
		.output(z.object({ indexed: z.number().int().nonnegative() })),
	listApiKeys: oc.output(z.array(apiKey)),
	createApiKey: oc
		.input(
			z.object({
				name: z.string().trim().min(1).max(160),
				capabilities: z.array(capability),
				expiresAt: z.coerce.date().optional(),
			}),
		)
		.output(z.object({ token: z.string(), apiKey })),
	updateApiKey: oc
		.input(
			z.object({
				id: z.string().min(1),
				name: z.string().trim().min(1).max(160).optional(),
				capabilities: z.array(capability).optional(),
				expiresAt: z.coerce.date().optional(),
			}),
		)
		.output(apiKey),
	revokeApiKey: oc.input(z.object({ id: z.string().min(1) })).output(apiKey),
	search: oc
		.input(
			z.object({
				query: z.string().min(1),
				objectTypes: z
					.array(
						z.enum([
							"ticket",
							"problem",
							"change",
							"knowledge_article",
							"cmdb_object",
							"asset",
						]),
					)
					.optional(),
				limit: z.number().int().min(1).max(100).default(25),
				offset: z.number().int().min(0).default(0),
			}),
		)
		.output(z.array(searchResult)),
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
	listRoles: oc.output(z.array(role)),
	getRole: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(role.nullable()),
	updateRoleCapabilities: oc
		.input(
			z.object({
				roleId: z.string().min(1),
				capabilities: z.array(capability),
			}),
		)
		.output(role),
	assignRole: oc
		.input(
			z.object({
				roleId: z.string().min(1),
				targetType: z.enum(["user", "team"]),
				targetId: z.string().min(1),
				assigned: z.boolean(),
			}),
		)
		.output(z.object({ assigned: z.boolean() })),
	listTeams: oc.output(z.array(team)),
	updateTeam: oc
		.input(
			z.object({
				id: z.string().min(1),
				name: z.string().trim().min(1).max(160),
				memberIds: z.array(z.string().min(1)),
				roleIds: z.array(z.string().min(1)),
			}),
		)
		.output(team),
};

export type AppContract = typeof appContract;
