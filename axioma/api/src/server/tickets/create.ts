import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	serviceSubcategories,
	ticketAudit,
	ticketCreationClaims,
	ticketNumberCounters,
	ticketNumberHistory,
	ticketRuleFirings,
	ticketRules,
	ticketStatuses,
	tickets,
} from "@/db/schema";
import type { Impact, Priority, RecordType, Urgency } from "@/shared";
import { derivePriority } from "@/shared";
import { writeDynamicFieldValues } from "../dynamic-fields";
import { evaluateTicketRules } from "../rules";
import { indexTicket } from "../search/projections";
import { attachTicketStopwatches } from "../sla/runtime";
import { formatTicketNumber } from "../ticket-records";
import { fireEvent } from "../workflows/runtime";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type TicketCreationSource =
	| "portal"
	| "catalogue"
	| "email"
	| "channel"
	| "recurrence"
	/** Synced from a customer's incumbent ITSM by a connector. */
	| "itsm";

export interface CreateTicketInput {
	source: TicketCreationSource;
	reporterId: string;
	title: string;
	body: string;
	serviceId?: string | null;
	serviceSubcategoryId?: string | null;
	recordType?: RecordType;
	impact?: Impact;
	urgency?: Urgency;
	deviceId?: string | null;
	origin?: string | null;
	metadata?: Record<string, unknown>;
	idempotencyKey?: string;
	customFields?: Record<string, unknown>;
}

export interface CreatedTicket {
	ticketId: string;
	number: string;
	priority: Priority;
	settledActions: string[];
	created: boolean;
}

/**
 * Runs on the caller's transaction, never on the pool. Taking a second pool
 * client while the first is held inside `db.transaction` needs two of the ten
 * default slots per creation, so ten concurrent creations deadlock the pool
 * permanently — `pg.Pool` queues acquisitions with no timeout. Sharing `tx`
 * also keeps the counter's increment inside the transaction, so a rollback no
 * longer burns a number.
 */
async function allocateTicketNumber(
	tx: Transaction,
	recordType: RecordType,
): Promise<string> {
	const year = String(new Date().getUTCFullYear());
	const prefix = recordType === "incident" ? "INC" : "REQ";
	const [counter] = await tx
		.insert(ticketNumberCounters)
		.values({ prefix, year, lastValue: 1 })
		.onConflictDoUpdate({
			target: [ticketNumberCounters.prefix, ticketNumberCounters.year],
			set: { lastValue: sql`${ticketNumberCounters.lastValue} + 1` },
		})
		.returning({ value: ticketNumberCounters.lastValue });
	if (!counter) throw new Error("Could not allocate a ticket number");
	return formatTicketNumber(recordType, Number(year), counter.value);
}

const normalize = (input: CreateTicketInput) => ({
	...input,
	title: input.title.trim(),
	body: input.body.trim(),
	recordType: input.recordType ?? "incident",
	impact: input.impact ?? "medium",
	urgency: input.urgency ?? "medium",
	serviceId: input.serviceId ?? "svc-general",
	serviceSubcategoryId: input.serviceSubcategoryId ?? "ss-general",
});

/**
 * Core ticket creation. Adapters keep their own parsing, authorization and
 * deduplication; this function owns every shared creation invariant.
 */
export async function createTicketInTransaction(
	tx: Transaction,
	input: CreateTicketInput,
): Promise<CreatedTicket> {
	const normalized = normalize(input);
	if (!normalized.title || !normalized.body)
		throw new Error("Ticket title and body are required");

	let claimId: string | undefined;
	if (input.idempotencyKey) {
		const now = new Date();
		claimId = crypto.randomUUID();
		const [claimed] = await tx
			.insert(ticketCreationClaims)
			.values({
				id: claimId,
				reporterId: input.reporterId,
				idempotencyKey: input.idempotencyKey,
				expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
			})
			.onConflictDoUpdate({
				target: [
					ticketCreationClaims.reporterId,
					ticketCreationClaims.idempotencyKey,
				],
				set: {
					id: claimId,
					ticketId: null,
					expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
				},
				setWhere: sql`${ticketCreationClaims.expiresAt} <= ${now}`,
			})
			.returning({ id: ticketCreationClaims.id });
		if (!claimed) {
			const [existing] = await tx
				.select({
					ticketId: tickets.id,
					number: tickets.number,
					priority: tickets.priority,
				})
				.from(ticketCreationClaims)
				.innerJoin(tickets, eq(ticketCreationClaims.ticketId, tickets.id))
				.where(
					and(
						eq(ticketCreationClaims.reporterId, input.reporterId),
						eq(ticketCreationClaims.idempotencyKey, input.idempotencyKey),
					),
				)
				.limit(1);
			if (!existing?.number)
				throw new Error(
					"Ticket creation with this idempotency key is in progress",
				);
			return {
				...existing,
				number: existing.number,
				settledActions: [],
				created: false,
			};
		}
	}

	const [[subcategory], [defaultStatus]] = await Promise.all([
		tx
			.select({
				id: serviceSubcategories.id,
				serviceId: serviceSubcategories.serviceId,
			})
			.from(serviceSubcategories)
			.where(eq(serviceSubcategories.id, normalized.serviceSubcategoryId))
			.limit(1),
		tx
			.select({ key: ticketStatuses.key })
			.from(ticketStatuses)
			.where(eq(ticketStatuses.isDefault, true))
			.limit(1),
	]);
	if (!subcategory) throw new Error("Ticket service subcategory was not found");
	if (!defaultStatus) throw new Error("Default ticket status was not found");
	if (subcategory.serviceId !== normalized.serviceId)
		throw new Error("Ticket service and subcategory do not match");

	const rules = await tx
		.select()
		.from(ticketRules)
		.where(eq(ticketRules.enabled, true));
	const evaluation = evaluateTicketRules(
		{
			title: normalized.title,
			body: normalized.body,
			requesterId: normalized.reporterId,
			recordType: normalized.recordType,
			impact: normalized.impact,
			urgency: normalized.urgency,
			serviceId: normalized.serviceId,
			origin: normalized.origin,
		},
		rules,
	);
	const settled = evaluation.ticket;
	const priority = derivePriority(settled.impact, settled.urgency);
	const id = crypto.randomUUID();
	const number = await allocateTicketNumber(tx, settled.recordType);

	await tx.insert(tickets).values({
		id,
		number,
		reporterId: normalized.reporterId,
		deviceId: normalized.deviceId,
		title: normalized.title,
		body: normalized.body,
		recordType: settled.recordType,
		impact: settled.impact,
		urgency: settled.urgency,
		priority,
		status: defaultStatus.key,
		serviceId: normalized.serviceId,
		serviceSubcategoryId: normalized.serviceSubcategoryId,
		route: settled.route,
		teamId: settled.teamId,
		assigneeId: settled.assigneeId,
	});
	await tx.insert(ticketNumberHistory).values({ number, ticketId: id });
	const auditRows = evaluation.firings.flatMap((firing) =>
		firing.applied.map((action) => ({
			id: crypto.randomUUID(),
			ticketId: id,
			fieldName: action.type,
			oldValue: null,
			newValue: "value" in action ? action.value : true,
			actorId: `rule:${firing.ruleId}`,
		})),
	);
	if (evaluation.firings.length)
		await tx.insert(ticketRuleFirings).values(
			evaluation.firings.map((firing) => ({
				id: crypto.randomUUID(),
				ticketId: id,
				ruleId: firing.ruleId,
				rulePosition: firing.rulePosition,
				result: firing,
			})),
		);
	await tx.insert(ticketAudit).values(
		auditRows.length
			? auditRows
			: [
					{
						id: crypto.randomUUID(),
						ticketId: id,
						fieldName: "status",
						oldValue: null,
						// The default status is configurable, so naming it here rather
						// than hardcoding "open" keeps the audit row true after a rename.
						newValue: defaultStatus.key,
						actorId: `source:${normalized.source}`,
					},
				],
	);
	if (Object.keys(input.customFields ?? {}).length)
		await writeDynamicFieldValues(tx, "ticket", id, input.customFields ?? {});
	await attachTicketStopwatches(id, priority, new Date(), tx);
	if (claimId)
		await tx
			.update(ticketCreationClaims)
			.set({ ticketId: id })
			.where(eq(ticketCreationClaims.id, claimId));
	return {
		ticketId: id,
		number,
		priority,
		settledActions: evaluation.settledActions,
		created: true,
	};
}

/** Runs the core transaction and then applies post-commit effects. */
export async function createTicket(
	input: CreateTicketInput,
): Promise<CreatedTicket> {
	const created = await db.transaction((tx) =>
		createTicketInTransaction(tx, input),
	);
	if (created.created) void finalizeCreatedTicket(created, input);
	return created;
}

/**
 * SLA and OLA are committed atomically with the ticket. Search and workflow
 * dispatch run after commit and deliberately fail soft for reconciliation.
 */
export async function finalizeCreatedTicket(
	created: CreatedTicket,
	input: Pick<CreateTicketInput, "reporterId">,
): Promise<void> {
	try {
		await indexTicket(db, created.ticketId);
	} catch (error) {
		console.error("[tickets] search indexing failed", error);
	}
	try {
		await fireEvent({
			type: "ticket.created",
			source: "ticket",
			recordType: "ticket",
			recordId: created.ticketId,
			actorId: input.reporterId,
			payload: {
				number: created.number,
				settledActions: created.settledActions,
			},
		});
	} catch (error) {
		console.error("[tickets] ticket.created dispatch failed", error);
	}
}
