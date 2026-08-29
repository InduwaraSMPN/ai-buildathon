import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cmdbItems } from "@/db/schema";

export const recordObservationInput = z.object({
	kind: z.enum(["service", "deployment", "pod", "device", "dependency"]),
	external_id: z.string().min(1),
	name: z.string().min(1),
	attributes: z.record(z.string(), z.unknown()).nullable().optional(),
	relates_to_id: z.string().nullable().optional(),
	relation_kind: z.string().nullable().optional(),
});

export async function recordObservation(
	input: z.infer<typeof recordObservationInput>,
	ctx: { ticketId: string; runId: string; stepId: string },
) {
	const id = crypto.randomUUID();
	await db.insert(cmdbItems).values({
		id,
		kind: input.kind,
		externalId: input.external_id,
		name: input.name,
		attributes: input.attributes,
		relatesToId: input.relates_to_id,
		relationKind: input.relation_kind,
		sourceTicketId: ctx.ticketId,
		sourceRunId: ctx.runId,
		sourceStepId: ctx.stepId,
	});
	return { id };
}

export async function readContextForTicket(
	ticketId: string,
	deviceId?: string | null,
) {
	const rows = await db
		.select()
		.from(cmdbItems)
		.where(
			deviceId
				? sql`${cmdbItems.sourceTicketId} = ${ticketId} or (${cmdbItems.kind} = 'device' and ${cmdbItems.externalId} = ${deviceId})`
				: eq(cmdbItems.sourceTicketId, ticketId),
		)
		.orderBy(desc(cmdbItems.observedAt));
	const newest = new Map<string, (typeof rows)[number]>();
	for (const row of rows) {
		const key = `${row.kind}\0${row.externalId}`;
		if (!newest.has(key)) newest.set(key, row);
	}
	return [...newest.values()];
}
