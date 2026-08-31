import assert from "node:assert/strict";
import test from "node:test";

import {
	backfillSearchEmbeddings,
	groupSearchResults,
	mayEmbed,
	normalizeSearchQuery,
	retainAuthorizedResults,
	SEARCH_OBJECT_TYPES,
	splitPrefixQuery,
} from "./index";
import { canAccessSavedView } from "./views";

test("normalizes Unicode, surrounding whitespace, and term separators", () => {
	assert.equal(
		normalizeSearchQuery("  ＡＰＩ\t gateway\n timeout  "),
		"API gateway timeout",
	);
	assert.equal(normalizeSearchQuery(" \n\t "), "");
});

test("splits the trailing token off for prefix matching", () => {
	assert.deepEqual(splitPrefixQuery("tic"), { head: "", prefix: "tic" });
	assert.deepEqual(splitPrefixQuery("gateway tim"), {
		head: "gateway",
		prefix: "tim",
	});
});

test("keeps websearch operator queries whole", () => {
	for (const query of ['"exact phrase"', "gateway OR proxy", "gateway -proxy"]) {
		assert.deepEqual(splitPrefixQuery(query), { head: query, prefix: null });
	}
	// A trailing token of only punctuation leaves nothing to prefix-match.
	assert.deepEqual(splitPrefixQuery("gateway :"), {
		head: "gateway :",
		prefix: null,
	});
});

test("groups mixed object types without losing result order", () => {
	const results = [
		{ objectType: "ticket", objectId: "2" },
		{ objectType: "device", objectId: "1" },
		{ objectType: "ticket", objectId: "1" },
	];
	assert.deepEqual(groupSearchResults(results), {
		ticket: [results[0], results[2]],
		device: [results[1]],
	});
});

test("authorization intersection cannot add unscoped results", () => {
	const results = [
		{ objectType: "ticket", objectId: "mine" },
		{ objectType: "ticket", objectId: "theirs" },
		{ objectType: "device", objectId: "mine" },
	];
	assert.deepEqual(
		retainAuthorizedResults(
			results,
			new Set(["ticket:mine", "device:mine", "ticket:missing"]),
		),
		[results[0], results[2]],
	);
});

test("search declares every currently searchable core object type", () => {
	assert.deepEqual(SEARCH_OBJECT_TYPES, [
		"ticket",
		"problem",
		"change",
		"knowledge_article",
		"cmdb_object",
		"asset",
		"known_error",
		"resolved_ticket",
		"agent_run",
		"document",
	]);
});

test("embeddings require explicit safe access metadata for every eligible type", () => {
	const document = {
		objectId: "1",
		title: "title",
		body: "secret",
		url: null,
		metadata: {},
		sourceUpdatedAt: new Date(),
	};
	const eligible = [
		{
			objectType: "knowledge_article" as const,
			metadata: {
				fetchId: "1",
				accessClass: "published_unrestricted",
				status: "published",
				isRestricted: false,
			},
		},
		{
			objectType: "known_error" as const,
			metadata: {
				fetchId: "1",
				accessClass: "published_unrestricted",
				isKnownError: true,
			},
		},
		{
			objectType: "resolved_ticket" as const,
			metadata: { fetchId: "1", accessClass: "deidentified" },
		},
		{
			objectType: "agent_run" as const,
			metadata: { fetchId: "1", accessClass: "deidentified" },
		},
		{
			objectType: "document" as const,
			metadata: { fetchId: "1", accessClass: "current_ticket_link" },
		},
	];

	for (const candidate of eligible) {
		assert.equal(mayEmbed({ ...document, ...candidate }), true);
		assert.equal(mayEmbed({ ...document, ...candidate, metadata: {} }), false);
		assert.equal(
			mayEmbed({
				...document,
				...candidate,
				metadata: { ...candidate.metadata, fetchId: "" },
			}),
			false,
		);
	}
	assert.equal(mayEmbed({ ...document, objectType: "ticket" }), false);
	assert.equal(
		mayEmbed({
			...document,
			objectType: "knowledge_article",
			metadata: {
				fetchId: "1",
				accessClass: "published_unrestricted",
				status: "published",
				isRestricted: true,
			},
		}),
		false,
	);
});

test("embedding backfill bounds a failed batch and advances its cursor", async () => {
	const row = {
		objectType: "resolved_ticket",
		objectId: "failed-1",
		title: "safe",
		body: "safe",
		url: null,
		metadata: { fetchId: "failed-1", accessClass: "deidentified" },
		embedding: null,
		embeddingModel: null,
		sourceUpdatedAt: new Date(),
		indexedAt: new Date(),
	};
	let selectedLimit = 0;
	const query = {
		from: () => query,
		where: () => query,
		orderBy: () => query,
		limit: (limit: number) => {
			selectedLimit = limit;
			return Promise.resolve([row]);
		},
	};
	const fakeDb = { select: () => query };
	const result = await backfillSearchEmbeddings(
		fakeDb as never,
		50_000,
		undefined,
		async () => null,
	);

	assert.equal(selectedLimit, 1_000);
	assert.deepEqual(result, {
		scanned: 1,
		updated: 0,
		failed: 1,
		nextCursor: { objectType: "resolved_ticket", objectId: "failed-1" },
	});
});

test("saved views are visible only to their user or a caller team", () => {
	const scope = { userId: "u1", teamIds: ["t1", "t2"] };
	assert.equal(
		canAccessSavedView({ ownerType: "user", ownerId: "u1" }, scope),
		true,
	);
	assert.equal(
		canAccessSavedView({ ownerType: "user", ownerId: "u2" }, scope),
		false,
	);
	assert.equal(
		canAccessSavedView({ ownerType: "team", ownerId: "t2" }, scope),
		true,
	);
	assert.equal(
		canAccessSavedView({ ownerType: "team", ownerId: "t3" }, scope),
		false,
	);
});
