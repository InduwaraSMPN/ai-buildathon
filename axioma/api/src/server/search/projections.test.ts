import assert from "node:assert/strict";
import test from "node:test";
import { knowledgeArticleDocument } from "./projections";

test("projects knowledge articles into cross-record search", () => {
	const updatedAt = new Date("2026-01-02T00:00:00Z");
	const document = knowledgeArticleDocument({
		id: "kb-1",
		folderId: null,
		authorId: null,
		title: "Reset VPN",
		body: "Reconnect the client",
		summary: "VPN help",
		status: "published",
		audience: "employees",
		isRestricted: false,
		currentVersion: 1,
		embedding: null,
		embeddingModel: null,
		metadata: null,
		publishedAt: null,
		nextReviewAt: null,
		createdAt: updatedAt,
		updatedAt,
	});
	assert.deepEqual(document, {
		objectType: "knowledge_article",
		objectId: "kb-1",
		title: "Reset VPN",
		body: "VPN help\nReconnect the client",
		url: "/knowledge/kb-1",
		metadata: {
			status: "published",
			audience: "employees",
			isRestricted: false,
		},
		sourceUpdatedAt: updatedAt,
	});
});
