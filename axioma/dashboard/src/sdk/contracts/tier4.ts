// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	createLinkDocumentSchema,
	documentSchema,
	documentTargetSchema,
} from "./documents";
import { serviceStatusSchema } from "./status";

const csvRow = z.record(z.string(), z.string());
const assetImportInput = z.object({
	profileId: z.string().trim().min(1),
	identityColumns: z.array(z.string().trim().min(1)).min(1).max(10),
	csv: z.string().min(1),
	fileName: z.string().trim().max(255).optional(),
});
const assetPreview = z.object({
	headers: z.array(z.string()),
	accepted: z.array(
		z.object({
			rowNumber: z.number().int(),
			identityKey: z.string(),
			values: csvRow,
		}),
	),
	rejected: z.array(
		z.object({ rowNumber: z.number().int(), reason: z.string(), row: csvRow }),
	),
});
const assetHistoryEntry = z.object({
	id: z.string(),
	assetId: z.string(),
	action: z.string(),
	actorId: z.string().nullable(),
	changes: z.unknown(),
	createdAt: z.date(),
});
const importRun = z.object({
	id: z.string(),
	profileId: z.string().nullable(),
	fileName: z.string().nullable(),
	totalRows: z.number().int(),
	acceptedRows: z.number().int(),
	rejectedRows: z.number().int(),
	createdAt: z.date(),
});
const importRejection = z.object({
	id: z.string(),
	runId: z.string(),
	rowNumber: z.number().int(),
	reason: z.string(),
	row: z.unknown(),
});
const licenceEntitlement = z.object({
	id: z.string(),
	productId: z.string(),
	productName: z.string(),
	publisher: z.string().nullable(),
	licenceKey: z.string().nullable(),
	seatCount: z.number().int().positive(),
	validFrom: z.date().nullable(),
	expiresAt: z.date().nullable(),
	allocatedSeats: z.number().int().nonnegative(),
});
const schedule = z.object({
	ticketId: z.string(),
	workStartAt: z.date().nullable(),
	workEndAt: z.date().nullable(),
	workAllDay: z.boolean(),
	snoozedUntil: z.date().nullable(),
	updatedAt: z.date(),
});
const scheduledTicket = schedule.extend({
	ticketNumber: z.string().nullable(),
	title: z.string(),
	status: z.string(),
	priority: z.enum(["P1", "P2", "P3", "P4"]),
});
const directoryPerson = z.object({
	externalId: z.string().trim().min(1),
	email: z.string().trim().toLowerCase().pipe(z.email()),
	name: z.string().min(1),
	jobTitle: z.string().nullable(),
	department: z.string().nullable(),
	managerExternalId: z.string().nullable(),
});
const directoryChange = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("create"), person: directoryPerson }),
	z.object({
		kind: z.literal("update"),
		userId: z.string(),
		person: directoryPerson,
	}),
	z.object({
		kind: z.literal("mark_leaver"),
		userId: z.string(),
		externalId: z.string(),
	}),
]);
const directoryPlan = z.object({
	previousCount: z.number().int().nonnegative(),
	foundCount: z.number().int().nonnegative(),
	createdCount: z.number().int().nonnegative(),
	updatedCount: z.number().int().nonnegative(),
	leaverCount: z.number().int().nonnegative(),
	changes: z.array(directoryChange),
});
const emailTemplate = z.object({
	id: z.string(),
	name: z.string(),
	subject: z.string(),
	textBody: z.string(),
	htmlBody: z.string().nullable(),
	enabled: z.boolean(),
});
const templateInput = emailTemplate.omit({ id: true });
const templateRule = z.object({
	id: z.string(),
	templateId: z.string(),
	scope: z.enum(["catch_all", "domain", "address"]),
	matchValue: z.string().nullable(),
	enabled: z.boolean(),
});
const recurrence = z.object({
	id: z.string(),
	sourceTicketId: z.string(),
	frequency: z.enum(["daily", "weekly", "monthly"]),
	interval: z.number().int().positive(),
	startsAt: z.date(),
	until: z.date().nullable(),
	enabled: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
const recurrenceInput = recurrence.pick({
	sourceTicketId: true,
	frequency: true,
	interval: true,
	startsAt: true,
	until: true,
	enabled: true,
});
const widget = z.object({
	widgetKey: z.string().trim().min(1),
	width: z.union([z.literal(1), z.literal(2)]).default(1),
	settings: z.unknown().nullable().optional(),
});

export const tier4Contract = {
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
	listAssets: oc.output(
		z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				assetTag: z.string().nullable(),
				status: z.string().nullable(),
				owner: z.string().nullable(),
				customFields: z.record(z.string(), z.unknown()),
			}),
		),
	),
	previewAssetImport: oc.input(assetImportInput).output(assetPreview),
	importAssets: oc.input(assetImportInput).output(
		z.object({
			runId: z.string(),
			inserted: z.number().int(),
			updated: z.number().int(),
			rejected: z.number().int(),
		}),
	),
	listAssetImportRuns: oc.output(z.array(importRun)),
	listAssetImportRejections: oc
		.input(z.object({ runId: z.string().min(1) }))
		.output(z.array(importRejection)),
	listAssetHistory: oc
		.input(z.object({ assetId: z.string().min(1) }))
		.output(z.array(assetHistoryEntry)),
	setAssetDynamicFields: oc
		.input(
			z.object({
				assetId: z.string().min(1),
				values: z.record(z.string(), z.unknown()),
			}),
		)
		.output(z.record(z.string(), z.unknown())),
	ingestChannelMessage: oc
		.input(
			z.object({
				channelKey: z.string().trim().min(1).max(100),
				channelKind: z.enum(["webchat", "sms", "social", "other"]),
				externalThreadId: z.string().trim().min(1).max(255),
				externalMessageId: z.string().trim().min(1).max(255),
				title: z.string().trim().min(1).max(160).optional(),
				body: z.string().trim().min(1).max(10_000),
				senderRef: z.string().trim().max(255).optional(),
				origin: z.string().trim().max(100).optional(),
				receivedAt: z.coerce.date().default(() => new Date()),
				raw: z.unknown().optional(),
			}),
		)
		.output(
			z.object({
				accepted: z.literal(true),
				duplicate: z.boolean(),
				ticketId: z.string(),
				threadId: z.string(),
				messageId: z.string(),
			}),
		),
	checkoutAsset: oc
		.input(
			z.object({
				assetId: z.string().min(1),
				custodianId: z.string().min(1),
				note: z.string().trim().max(2_000).optional(),
			}),
		)
		.output(assetHistoryEntry),
	checkinAsset: oc
		.input(
			z.object({
				assetId: z.string().min(1),
				note: z.string().trim().max(2_000).optional(),
			}),
		)
		.output(assetHistoryEntry),
	listSoftwareEntitlements: oc.output(z.array(licenceEntitlement)),
	createSoftwareEntitlement: oc
		.input(
			z.object({
				productName: z.string().trim().min(1).max(255),
				publisher: z.string().trim().max(255).optional(),
				identityKey: z.string().trim().min(1).max(255),
				licenceKey: z.string().trim().max(1_000).optional(),
				seatCount: z.number().int().positive(),
				validFrom: z.coerce.date().optional(),
				expiresAt: z.coerce.date().optional(),
			}),
		)
		.output(licenceEntitlement),
	allocateSoftwareLicence: oc
		.input(
			z
				.object({
					entitlementId: z.string().min(1),
					assetId: z.string().min(1).optional(),
					userId: z.string().min(1).optional(),
				})
				.refine((input) => Boolean(input.assetId) !== Boolean(input.userId), {
					message: "Exactly one allocation target is required",
				}),
		)
		.output(z.object({ id: z.string() })),
	revokeSoftwareAllocation: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(z.object({ revoked: z.boolean() })),
	readSoftwareCompliance: oc.output(
		z.object({
			summary: z.object({
				compliant: z.number().int().nonnegative(),
				unlicensed: z.number().int().nonnegative(),
				expired: z.number().int().nonnegative(),
				overAllocated: z.number().int().nonnegative(),
			}),
			installs: z.array(
				z.object({
					productId: z.string(),
					productName: z.string(),
					assetId: z.string(),
					assetName: z.string(),
					entitlementId: z.string().nullable(),
					status: z.enum([
						"compliant",
						"unlicensed",
						"expired",
						"over-allocated",
					]),
				}),
			),
		}),
	),
	setTicketSchedule: oc
		.input(
			z.object({
				ticketId: z.string().min(1),
				workStartAt: z.coerce.date().nullable(),
				durationMinutes: z.number().int().min(0).max(525_600),
				workAllDay: z.boolean().default(false),
			}),
		)
		.output(scheduledTicket),
	snoozeTicket: oc
		.input(
			z.object({
				ticketId: z.string().min(1),
				until: z.coerce.date().nullable(),
			}),
		)
		.output(scheduledTicket),
	listCalendar: oc
		.input(z.object({ from: z.coerce.date(), to: z.coerce.date() }))
		.output(z.array(scheduledTicket)),
	listRecurrences: oc.output(z.array(recurrence)),
	createRecurrence: oc.input(recurrenceInput).output(recurrence),
	updateRecurrence: oc
		.input(recurrenceInput.partial().extend({ id: z.string().min(1) }))
		.output(recurrence),
	deleteRecurrence: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(z.object({ deleted: z.boolean() })),
	triggerRecurrences: oc
		.input(
			z.object({
				now: z.coerce.date().default(() => new Date()),
				limit: z.number().int().min(1).max(1000).default(100),
			}),
		)
		.output(
			z.object({
				created: z.number().int().nonnegative(),
				skipped: z.number().int().nonnegative(),
			}),
		),
	getDashboardArrangement: oc.output(
		z.array(widget.extend({ position: z.number().int().nonnegative() })),
	),
	setDashboardArrangement: oc
		.input(z.object({ widgets: z.array(widget).max(100) }))
		.output(
			z.array(widget.extend({ position: z.number().int().nonnegative() })),
		),
	listAuthProviders: oc.output(
		z.array(z.object({ providerId: z.string(), name: z.string() })),
	),
	listEmailTemplates: oc.output(z.array(emailTemplate)),
	createEmailTemplate: oc.input(templateInput).output(emailTemplate),
	updateEmailTemplate: oc
		.input(templateInput.partial().extend({ id: z.string().min(1) }))
		.output(emailTemplate),
	deleteEmailTemplate: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(z.object({ deleted: z.boolean() })),
	listEmailTemplateRules: oc.output(z.array(templateRule)),
	setEmailTemplateRule: oc
		.input(
			templateRule.omit({ id: true }).extend({ id: z.string().optional() }),
		)
		.output(templateRule),
	deleteEmailTemplateRule: oc
		.input(z.object({ id: z.string().min(1) }))
		.output(z.object({ deleted: z.boolean() })),
	previewDirectorySync: oc
		.input(z.object({ providerId: z.string().min(1) }))
		.output(directoryPlan),
	applyDirectorySync: oc
		.input(z.object({ providerId: z.string().min(1) }))
		.output(directoryPlan),
	listDocuments: oc.input(documentTargetSchema).output(z.array(documentSchema)),
	createLinkDocument: oc
		.input(createLinkDocumentSchema.extend(documentTargetSchema.shape))
		.output(documentSchema),
	unlinkDocument: oc
		.input(
			z.object({
				documentId: z.string().min(1),
				...documentTargetSchema.shape,
			}),
		)
		.output(z.object({ deleted: z.boolean() })),
	listSuppliers: oc.output(
		z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				contact: z.string().nullable(),
				status: z.enum(["active", "inactive"]),
			}),
		),
	),
	listContracts: oc.output(
		z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				supplierName: z.string(),
				startsOn: z.string(),
				endsOn: z.string().nullable(),
				status: z.enum(["active", "inactive"]),
			}),
		),
	),
	listEmailSendLog: oc
		.input(
			z.object({
				ticketId: z.string().optional(),
				limit: z.number().int().min(1).max(100).default(50),
			}),
		)
		.output(
			z.array(
				z.object({
					id: z.string(),
					recipient: z.string(),
					subsystem: z.string(),
					ticketId: z.string().nullable(),
					templateId: z.string().nullable(),
					subject: z.string(),
					outcome: z.enum(["sent", "failed"]),
					providerMessageId: z.string().nullable(),
					providerText: z.string(),
					attemptedAt: z.date(),
				}),
			),
		),
};
