import { eq, gte } from "drizzle-orm";
import type { createDb } from "@/db";
import {
	assets,
	cmdbClasses,
	cmdbObjects,
	dynamicFields,
	dynamicFieldValues,
	knowledgeArticles,
	tickets,
} from "@/db/schema";
import {
	reconcileSearchDocuments,
	type SearchDocumentInput,
	upsertSearchDocument,
} from "./index";

type Db = ReturnType<typeof createDb>;

const ticketDocument = (
	ticket: typeof tickets.$inferSelect,
): SearchDocumentInput => ({
	objectType: "ticket",
	objectId: ticket.id,
	title: ticket.number ? `${ticket.number} ${ticket.title}` : ticket.title,
	body: [ticket.body, ticket.resolution, ticket.escalationNote]
		.filter(Boolean)
		.join("\n"),
	url: `/tickets/${ticket.id}`,
	metadata: {
		status: ticket.status,
		priority: ticket.priority,
		reporterId: ticket.reporterId,
	},
	sourceUpdatedAt: ticket.updatedAt,
});

const cmdbDocument = (
	object: typeof cmdbObjects.$inferSelect,
	classKey: string,
): SearchDocumentInput => ({
	objectType: "cmdb_object",
	objectId: object.id,
	title: object.name,
	body: `${classKey} ${object.externalId}`,
	url: `/cmdb/${object.id}`,
	metadata: {
		classId: object.classId,
		classKey,
		externalId: object.externalId,
	},
	sourceUpdatedAt: object.observedAt,
});

export const knowledgeArticleDocument = (
	article: typeof knowledgeArticles.$inferSelect,
): SearchDocumentInput => ({
	objectType: "knowledge_article",
	objectId: article.id,
	title: article.title,
	body: [article.summary, article.body].filter(Boolean).join("\n"),
	url: `/knowledge/${article.id}`,
	metadata: {
		status: article.status,
		audience: article.audience,
		isRestricted: article.isRestricted,
	},
	sourceUpdatedAt: article.updatedAt,
});

const assetDocument = (
	asset: typeof assets.$inferSelect,
	customFields: Record<string, unknown>,
): SearchDocumentInput => ({
	objectType: "asset",
	objectId: asset.id,
	title: asset.name,
	body: [
		asset.assetTag,
		asset.serialNumber,
		...Object.values(customFields).flatMap((value) =>
			Array.isArray(value) ? value : [value],
		),
	]
		.filter((value) => value !== null && value !== undefined)
		.map(String)
		.join(" "),
	url: "/assets",
	metadata: {
		...customFields,
		assetTag: asset.assetTag,
		serialNumber: asset.serialNumber,
	},
	sourceUpdatedAt: asset.updatedAt,
});

async function assetFields(db: Db, assetId: string) {
	const rows = await db
		.select({ key: dynamicFields.key, value: dynamicFieldValues.value })
		.from(dynamicFieldValues)
		.innerJoin(dynamicFields, eq(dynamicFieldValues.fieldId, dynamicFields.id))
		.where(eq(dynamicFieldValues.objectId, assetId));
	return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function indexAsset(db: Db, id: string): Promise<boolean> {
	const [asset] = await db
		.select()
		.from(assets)
		.where(eq(assets.id, id))
		.limit(1);
	if (!asset) return false;
	await upsertSearchDocument(
		db,
		assetDocument(asset, await assetFields(db, asset.id)),
	);
	return true;
}

export async function indexTicket(db: Db, id: string): Promise<boolean> {
	const [ticket] = await db
		.select()
		.from(tickets)
		.where(eq(tickets.id, id))
		.limit(1);
	if (!ticket) return false;
	await upsertSearchDocument(db, ticketDocument(ticket));
	return true;
}

export async function indexCmdbObject(db: Db, id: string): Promise<boolean> {
	const [row] = await db
		.select({ object: cmdbObjects, classKey: cmdbClasses.key })
		.from(cmdbObjects)
		.innerJoin(cmdbClasses, eq(cmdbObjects.classId, cmdbClasses.id))
		.where(eq(cmdbObjects.id, id))
		.limit(1);
	if (!row) return false;
	await upsertSearchDocument(db, cmdbDocument(row.object, row.classKey));
	return true;
}

export function reconcileCoreSearchDocuments(
	db: Db,
	since: Date,
): Promise<number> {
	return reconcileSearchDocuments(
		db,
		[
			{
				objectType: "ticket",
				loadChanged: async (changedSince) =>
					(
						await db
							.select()
							.from(tickets)
							.where(gte(tickets.updatedAt, changedSince))
					).map(ticketDocument),
			},
			{
				objectType: "cmdb_object",
				loadChanged: async (changedSince) =>
					(
						await db
							.select({ object: cmdbObjects, classKey: cmdbClasses.key })
							.from(cmdbObjects)
							.innerJoin(cmdbClasses, eq(cmdbObjects.classId, cmdbClasses.id))
							.where(gte(cmdbObjects.observedAt, changedSince))
					).map(({ object, classKey }) => cmdbDocument(object, classKey)),
			},
			{
				objectType: "asset",
				loadChanged: async (changedSince) =>
					Promise.all(
						(
							await db
								.select()
								.from(assets)
								.where(gte(assets.updatedAt, changedSince))
						).map(async (asset) =>
							assetDocument(asset, await assetFields(db, asset.id)),
						),
					),
			},
			{
				objectType: "knowledge_article",
				loadChanged: async (changedSince) =>
					(
						await db
							.select()
							.from(knowledgeArticles)
							.where(gte(knowledgeArticles.updatedAt, changedSince))
					).map(knowledgeArticleDocument),
			},
		],
		since,
	);
}
