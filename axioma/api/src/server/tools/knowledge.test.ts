import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeArticles, searchDocuments, tickets, user } from "@/db/schema";
import {
	decodeStoredText,
	knowledgeFetch,
	knowledgeFetchInput,
	knowledgeSearch,
	knowledgeSearchInput,
	publicKnowledgeItem,
	reciprocalRankFusion,
} from "./knowledge";

const suffix = crypto.randomUUID();
const context = (ticketId: string) =>
	({ ticketId }) as Parameters<typeof knowledgeSearch>[1];
const dependencies = (
	createEmbedding: (query: string) => Promise<number[] | null>,
) => ({
	db,
	createEmbedding,
	embeddingModel: "phase4-test",
});

async function cleanup(ids: string[]) {
	for (const id of ids) {
		await db.delete(searchDocuments).where(eq(searchDocuments.objectId, id));
		await db.delete(knowledgeArticles).where(eq(knowledgeArticles.id, id));
		await db.delete(tickets).where(eq(tickets.id, id));
		await db.delete(user).where(eq(user.id, id));
	}
}

test("knowledge search uses the shared limit contract", () => {
	assert.equal(
		knowledgeSearchInput.parse({ query: "VPN DNS failure" }).limit,
		8,
	);
	assert.equal(
		knowledgeSearchInput.parse({ query: "VPN DNS failure", limit: 20 }).limit,
		20,
	);
	assert.equal(
		knowledgeSearchInput.safeParse({ query: "VPN DNS failure", limit: 21 })
			.success,
		false,
	);
});

test("knowledge fetch accepts only corpus source and id", () => {
	assert.deepEqual(
		knowledgeFetchInput.parse({ source: "article", id: "kb-1" }),
		{
			source: "article",
			id: "kb-1",
		},
	);
	assert.equal(
		knowledgeFetchInput.safeParse({ source: "ticket", id: "x" }).success,
		false,
	);
});

test("closure and prior outcomes are authorized by invariants, not current ticket", async () => {
	const source = await readFile(
		new URL("./knowledge.ts", import.meta.url),
		"utf8",
	);
	assert.match(source, /join ticket_statuses ts[\s\S]*ts\.is_closed = true/);
	assert.match(source, /ka\.audience in \('public', 'employees'\)/);
	assert.doesNotMatch(source, /t\.status in \('resolved', 'closed'\)/);
	assert.doesNotMatch(source, /ar\.ticket_id =/);
	assert.match(source, /'deidentified-resolved-ticket'/);
	assert.match(source, /'deidentified-agent-outcome'/);
});

test("real knowledge search crosses employee boundaries only through a deidentified closed resolution", async () => {
	const caller = `phase4-caller-${suffix}`;
	const other = `phase4-other-${suffix}`;
	const current = `phase4-current-${suffix}`;
	const resolved = `phase4-resolved-${suffix}`;
	await db.insert(user).values([
		{ id: caller, name: "Caller", email: `${caller}@example.test` },
		{ id: other, name: "Other", email: `${other}@example.test` },
	]);
	await db.insert(tickets).values([
		{
			id: current,
			reporterId: caller,
			title: "Current",
			body: "Current",
			status: "open",
			serviceId: "svc-general",
			serviceSubcategoryId: "ss-general",
		},
		{
			id: resolved,
			reporterId: other,
			title: "Private employee title",
			body: "Private employee body",
			status: "closed",
			serviceId: "svc-general",
			serviceSubcategoryId: "ss-general",
			resolution: "Rotate the frobnicator certificate",
			resolutionCode: "fixed",
		},
	]);
	await db.insert(searchDocuments).values({
		objectType: "resolved_ticket",
		objectId: resolved,
		title: "De-identified certificate precedent",
		body: "frobnicator certificate rotation fixed the outage",
		sourceUpdatedAt: new Date(),
	});
	try {
		const result = await knowledgeSearch(
			{ query: "frobnicator certificate", limit: 8 },
			context(current),
			dependencies(async () => null),
		);
		assert.equal(result.mode, "lexical");
		assert.deepEqual(result.items, [
			{
				source: "resolved_ticket",
				id: resolved,
				reference: "deidentified-resolved-ticket",
				title: "De-identified certificate precedent",
				excerpt: "frobnicator certificate rotation fixed the outage",
			},
		]);
		assert(!JSON.stringify(result).includes("Private employee"));
	} finally {
		await cleanup([current, resolved, caller, other]);
	}
});

test("restricted articles are excluded from real search and fetch", async () => {
	const ticketId = `phase4-context-${suffix}`;
	const articleId = `phase4-restricted-${suffix}`;
	await db.insert(knowledgeArticles).values({
		id: articleId,
		title: "Restricted quasar recovery",
		body: "quasar recovery secret",
		status: "published",
		audience: "employees",
		isRestricted: true,
	});
	await db.insert(searchDocuments).values({
		objectType: "knowledge_article",
		objectId: articleId,
		title: "Restricted quasar recovery",
		body: "quasar recovery secret",
		sourceUpdatedAt: new Date(),
	});
	try {
		const result = await knowledgeSearch(
			{ query: "quasar recovery", limit: 8 },
			context(ticketId),
			dependencies(async () => null),
		);
		assert.deepEqual(result.items, []);
		assert.equal(
			await knowledgeFetch(
				{ source: "article", id: articleId },
				context(ticketId),
			),
			null,
		);
	} finally {
		await cleanup([articleId]);
	}
});

test("real vector path retrieves a paraphrase absent from lexical matches", async () => {
	const ticketId = `phase4-vector-context-${suffix}`;
	const articleId = `phase4-vector-${suffix}`;
	const vector = Array(1536).fill(0) as number[];
	vector[0] = 1;
	await db.insert(knowledgeArticles).values({
		id: articleId,
		title: "Restore name resolution",
		body: "Clear the workstation resolver cache and renew its lease.",
		status: "published",
		audience: "employees",
		isRestricted: false,
	});
	await db.insert(searchDocuments).values({
		objectType: "knowledge_article",
		objectId: articleId,
		title: "Restore name resolution",
		body: "Clear the workstation resolver cache and renew its lease.",
		embedding: vector,
		embeddingModel: "phase4-test",
		sourceUpdatedAt: new Date(),
	});
	try {
		const result = await knowledgeSearch(
			{ query: "websites fail by hostname", limit: 8 },
			context(ticketId),
			dependencies(async () => vector),
		);
		assert.equal(result.mode, "hybrid");
		assert.equal(result.items[0]?.id, articleId);
	} finally {
		await cleanup([articleId]);
	}
});

test("provider failure falls back to real lexical retrieval", async () => {
	const ticketId = `phase4-fallback-context-${suffix}`;
	const articleId = `phase4-fallback-${suffix}`;
	await db.insert(knowledgeArticles).values({
		id: articleId,
		title: "Nebula printer recovery",
		body: "Restart the nebula print queue.",
		status: "published",
		audience: "public",
		isRestricted: false,
	});
	await db.insert(searchDocuments).values({
		objectType: "knowledge_article",
		objectId: articleId,
		title: "Nebula printer recovery",
		body: "Restart the nebula print queue.",
		sourceUpdatedAt: new Date(),
	});
	try {
		const result = await knowledgeSearch(
			{ query: "nebula printer", limit: 8 },
			context(ticketId),
			dependencies(async () => null),
		);
		assert.equal(result.mode, "lexical");
		assert.equal(result.items[0]?.id, articleId);
	} finally {
		await cleanup([articleId]);
	}
});

test("authorized fetch returns article bodies beyond the search excerpt limit", async () => {
	const ticketId = `phase4-fetch-context-${suffix}`;
	const articleId = `phase4-fetch-${suffix}`;
	const body = `Authorized long body: ${"x".repeat(700)}`;
	await db.insert(knowledgeArticles).values({
		id: articleId,
		title: "Long authorized article",
		body,
		status: "published",
		audience: "employees",
		isRestricted: false,
	});
	try {
		const result = await knowledgeFetch(
			{ source: "article", id: articleId },
			context(ticketId),
		);
		assert(result && "body" in result);
		assert.equal(result.body, body);
		assert(result.body.length > 500);
	} finally {
		await cleanup([articleId]);
	}
});

test("knowledge migration contains the projection vector columns", async () => {
	const migration = await readFile(
		new URL("../../db/migrations/0000_baseline.sql", import.meta.url),
		"utf8",
	);
	assert.match(migration, /search_documents.*embedding/s);
	assert.match(migration, /embedding_model/);
	assert.match(migration, /vector_cosine_ops/);
});

test("knowledge search output never returns projection access metadata", () => {
	const item = publicKnowledgeItem({
		source: "resolved_ticket",
		id: "ticket-1",
		reference: "ticket-1",
		title: "De-identified resolved ticket",
		excerpt: "fixed\nRenewed certificate",
		access: { reporterId: "must-not-leak" },
	} as Parameters<typeof publicKnowledgeItem>[0] & { access: unknown });
	assert.deepEqual(Object.keys(item), [
		"source",
		"id",
		"reference",
		"title",
		"excerpt",
	]);
});

test("RRF lets a semantic paraphrase contribute without replacing lexical evidence", () => {
	const fused = reciprocalRankFusion(
		[{ source: "article", id: "literal", rank: 1 }],
		[
			{ source: "article", id: "paraphrase", rank: 0.9 },
			{ source: "article", id: "literal", rank: 0.8 },
		],
	);
	assert.equal(fused[0]?.id, "literal");
	assert(fused.some(({ id }) => id === "paraphrase"));
});

test("stored document text accepts only strict UTF-8 safe text media", () => {
	const content = new TextEncoder().encode(
		"Full diagnostic log\nrestart resolver",
	);
	assert.equal(
		decodeStoredText("text/plain; charset=utf-8", content),
		"Full diagnostic log\nrestart resolver",
	);
	assert.equal(decodeStoredText("application/pdf", content), null);
	assert.equal(decodeStoredText("text/plain", new Uint8Array([0xff])), null);
});

test("document fetch keeps live ticket/public-note SQL access and never fetches URLs", async () => {
	const source = await readFile(
		new URL("./knowledge.ts", import.meta.url),
		"utf8",
	);
	assert.match(source, /targetType} = 'ticket'.*ctx\.ticketId/s);
	assert.match(source, /targetType} = 'case_note'.*visibility} = 'public'/s);
	assert.match(source, /documentStorage\.read\(item\.sha256\)/);
	assert.doesNotMatch(source, /fetch\(.*(?:documents\.url|item\.url)/s);
});
