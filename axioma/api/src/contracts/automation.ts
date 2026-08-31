import { oc } from "@orpc/contract";
import { z } from "zod";
import { capability, jsonRecord } from "./shared";

export const OVERVIEW_WIDGET_KEYS = [
	"priority",
	"confirmation",
	"escalations",
	"median-ttr",
	"csat",
	"resolution-rate",
] as const;

const widget = z.object({
	widgetKey: z.string().trim().min(1),
	width: z.union([z.literal(1), z.literal(2)]).default(1),
	settings: z.unknown().nullable().optional(),
});

const writableWidget = widget.extend({
	widgetKey: z.enum(OVERVIEW_WIDGET_KEYS),
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

const webhookDelivery = z.object({
	id: z.string(),
	executionId: z.string().nullable(),
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

export const automationContract = {
	listFieldDefinitions: oc
		.input(z.object({ objectType: z.string().min(1) }))
		.output(z.array(dynamicFieldDefinition)),
	listTicketFieldDefinitions: oc.output(z.array(dynamicFieldDefinition)),
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
	getDashboardArrangement: oc.output(
		z.array(widget.extend({ position: z.number().int().nonnegative() })),
	),
	setDashboardArrangement: oc
		.input(z.object({ widgets: z.array(writableWidget).max(100) }))
		.output(
			z.array(widget.extend({ position: z.number().int().nonnegative() })),
		),
};
