import assert from "node:assert/strict";
import test from "node:test";
import {
	agentRunDocument,
	deidentifyKnowledgeText,
	knowledgeArticleDocument,
	resolvedTicketDocument,
} from "./projections";

// A person's name reaches this text because the reporter's name, job title,
// department and manager are deliberately in the model's context, so the model
// writes them into a resolution or an outcome. Every grammatical position that
// puts a name into IT prose has to be covered, not only the possessive one.
test("removes a person's name in every position it occurs in", () => {
	for (const [position, sentence] of [
		["possessive", "Restored Avery Chen's mailbox profile."],
		["role-prefixed", "Confirmed with reporter Avery Chen before acting."],
		["bare after a preposition", "Escalated to Avery Chen for a decision."],
		["bare after a verb", "Contacted Avery Chen and confirmed the fix."],
		["bare as the subject", "Avery Chen reported the same fault twice."],
	] as const) {
		const redacted = deidentifyKnowledgeText(sentence);
		assert.doesNotMatch(
			redacted,
			/Avery|Chen/,
			`${position}: name survived redaction in ${JSON.stringify(redacted)}`,
		);
		assert.match(redacted, /\[person\]/, position);
	}
});

// Redaction that eats the diagnosis is a different failure with the same cause.
// These are the capitalised pairs that actually occur in this domain's prose.
test("keeps technical terms that look like names", () => {
	for (const phrase of [
		"Reinstalled Active Directory certificate services.",
		"Windows Update was blocked by a stale policy.",
		"Cleared the Outlook Cache and restarted Microsoft Teams.",
		"Escalated to Network Operations for capacity.",
		"Group Policy refresh did not apply.",
	]) {
		const redacted = deidentifyKnowledgeText(phrase);
		assert.doesNotMatch(
			redacted,
			/\[person\]/,
			`over-redacted: ${JSON.stringify(redacted)}`,
		);
	}
});

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
			accessClass: "published_unrestricted",
			fetchId: "kb-1",
			status: "published",
			audience: "employees",
			isRestricted: false,
		},
		sourceUpdatedAt: updatedAt,
	});
});

test("resolved ticket projection is deliberately de-identified", () => {
	const now = new Date("2026-01-02T00:00:00Z");
	const projected = resolvedTicketDocument({
		id: "ticket-1",
		reporterId: "employee-secret",
		deviceId: null,
		title: "VPN stopped connecting",
		body: "Private employee narrative",
		recordType: "incident",
		impact: "medium",
		urgency: "medium",
		priority: "P3",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
		status: "resolved",
		route: null,
		resolution:
			"Renewed expired certificate after alice@example.test called +1 202-555-0119",
		resolutionCode: "fixed",
		escalationNote: "Private note",
		progressMarker: null,
		assigneeId: null,
		ownerId: null,
		teamId: null,
		mergedIntoId: null,
		number: "INC-123",
		pendingReasonId: null,
		pendingUntil: null,
		lastPendingAt: null,
		pendingFollowups: 0,
		escalationFlag: "none",
		escalationReason: null,
		version: 1,
		createdAt: now,
		updatedAt: now,
		resolvedAt: now,
		closedAt: null,
		reopenedAt: null,
		lastHumanTransitionAt: null,
	});
	const serialized = JSON.stringify(projected);
	assert.match(serialized, /Renewed expired certificate/);
	assert.match(serialized, /\[email\].*\[phone\]/);
	assert.doesNotMatch(
		serialized,
		/employee-secret|Private employee narrative|Private note|INC-123|VPN stopped connecting|alice@example\.test|202-555-0119/,
	);
	assert.equal(projected.title, "De-identified resolved ticket");
	assert.equal(projected.metadata.accessClass, "deidentified");
});

test("terminal run projection keeps useful de-identified outcome", () => {
	const now = new Date("2026-01-02T00:00:00Z");
	const projected = agentRunDocument({
		id: "run-1",
		ticketId: "ticket-secret",
		status: "resolved",
		startedById: null,
		model: null,
		outcome: "Cleared stale DNS cache for alice@example.test at 10.2.3.4",
		workerId: null,
		acceptedAt: null,
		leaseExpiresAt: null,
		environmentId: null,
		environmentKey: null,
		environmentSource: null,
		promptTokens: null,
		completionTokens: null,
		startedAt: now,
		endedAt: now,
	});
	const serialized = JSON.stringify(projected);
	assert.match(serialized, /Terminal run status: resolved/);
	assert.match(serialized, /Cleared stale DNS cache/);
	assert.match(serialized, /\[email\].*\[ip\]/);
	assert.doesNotMatch(
		serialized,
		/alice@example\.test|10\.2\.3\.4|ticket-secret/,
	);
});
