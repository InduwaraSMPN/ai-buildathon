import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRouterClient, ORPCError } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
	documentLinks,
	documents,
	forms,
	knowledgeArticles,
	searchDocuments,
	serviceSubcategories,
	ticketCreationClaims,
	ticketDrafts,
	ticketMessages,
	ticketNumberHistory,
	tickets,
	user,
	workflowExecutions,
} from "@/db/schema";
import { env } from "@/env";
import { requireDocumentWriteTarget } from "../documents/access";
import { deflectKnowledge } from "./deflection";
import { intakeRouter, loadCatalogueContext } from "../routers/intake";
import {
	discardDraft,
	draftWithRepair,
	mergeDraftPatch,
	patchDraft,
	readDraft,
	repairDraftOutput,
	startDraft,
	suppressLowConfidence,
	sweepIntakeDrafts,
	whitelistKeys,
	whitelistSubcategory,
} from "./index";
import {
	catalogueFormValuesJsonSchema,
	entriesToRecord,
	type IncidentDraftOutput,
	incidentDraftJsonSchema,
	incidentDraftSchema,
	strictSchemaViolations,
} from "./schema";
import {
	requireSubcategoryConfirmed,
	submitIntake,
	validateDraftText,
} from "./submit";
import { MAX_DRAFT_IMAGES, MAX_IMAGE_BYTES, readDraftImages } from "./vision";

const validDraft: IncidentDraftOutput = {
	intent: "incident",
	assistantMessage: "I've drafted a ticket for you.",
	clarifyingQuestion: null,
	title: { value: "Laptop won't boot", confidence: "high", reason: null },
	body: { value: "It freezes on boot", confidence: "high", reason: null },
	impact: { value: "high", confidence: "high", reason: null },
	urgency: { value: "low", confidence: "high", reason: null },
	deviceId: { value: "dev-1", confidence: "high", reason: null },
	customFields: { value: [], confidence: "high", reason: null },
	subcategoryId: null,
	subcategoryConfirmed: null,
};

test("incident draft schema accepts a valid output", () => {
	const result = incidentDraftSchema.safeParse(validDraft);
	assert.equal(result.success, true);
});

test("incident draft schema rejects missing required fields", () => {
	const result = incidentDraftSchema.safeParse({
		...validDraft,
		title: undefined,
	});
	assert.equal(result.success, false);
});

test("repairDraftOutput parses valid output, then strips unknown keys on retry", () => {
	assert.deepEqual(
		repairDraftOutput(validDraft, incidentDraftSchema),
		incidentDraftSchema.parse(validDraft),
	);
	const withUnknown = { ...validDraft, extra: "noise" };
	assert.doesNotThrow(() =>
		repairDraftOutput(withUnknown, incidentDraftSchema),
	);
	assert.deepEqual(
		repairDraftOutput(withUnknown, incidentDraftSchema),
		validDraft,
	);
});

test("repairDraftOutput throws when shape is irrecoverable", () => {
	assert.throws(
		() => repairDraftOutput("not an object", incidentDraftSchema),
		/parsed|JSON/i,
	);
	assert.throws(
		() =>
			repairDraftOutput(
				{ ...validDraft, title: { value: 42 } },
				incidentDraftSchema,
			),
		/parsed|JSON/i,
	);
});

test("whitelistSubcategory drops unknown ids", () => {
	const allowed = new Set(["ss-1", "ss-2"]);
	assert.equal(whitelistSubcategory("ss-1", allowed), "ss-1");
	assert.equal(whitelistSubcategory("ss-unknown", allowed), null);
	assert.equal(whitelistSubcategory(null, allowed), null);
});

test("suppressLowConfidence nulls low-confidence values", () => {
	const parsed: IncidentDraftOutput = {
		...validDraft,
		body: { value: "vague", confidence: "low", reason: "unspecified" },
	};
	const suppressed = suppressLowConfidence(parsed);
	assert.equal(suppressed.body.value, null);
	assert.equal(suppressed.title.value, "Laptop won't boot");
});

// Strict structured outputs are rejected before generation when the schema
// carries propertyNames or leaves an object open, and the gateway reports only
// an opaque HTTP 400. These assertions keep that failure out of production.
for (const [name, schema] of [
	["incident draft", incidentDraftJsonSchema],
	["catalogue form", catalogueFormValuesJsonSchema],
] as const) {
	test(`${name} JSON Schema is valid for strict structured outputs`, () => {
		assert.deepEqual(strictSchemaViolations(schema), []);
	});
}

test("strictSchemaViolations catches each rule the gateway enforces", () => {
	assert.deepEqual(
		strictSchemaViolations({
			type: "object",
			properties: { a: { type: "string" }, b: { type: "string" } },
			required: ["a"],
			additionalProperties: false,
		}),
		["$: required must list every property (b)"],
	);
	assert.deepEqual(
		strictSchemaViolations({ type: "object", properties: {}, required: [] }),
		["$: additionalProperties must be false"],
	);
	assert.deepEqual(
		strictSchemaViolations({
			type: "object",
			properties: {},
			required: [],
			additionalProperties: false,
			propertyNames: { type: "string" },
		}),
		["$: propertyNames is rejected by strict mode"],
	);
	// Nested breaches are reported with the path that reaches them.
	assert.deepEqual(
		strictSchemaViolations({
			type: "object",
			additionalProperties: false,
			required: ["list"],
			properties: {
				list: { type: "array", items: { type: "object", properties: {} } },
			},
		}),
		["$.list.items: additionalProperties must be false"],
	);
});

test("entriesToRecord collapses the wire list and drops null values", () => {
	assert.deepEqual(
		entriesToRecord([
			{ key: "asset_tag", value: "A-1" },
			{ key: "floor", value: null },
			{ key: "room", value: "3B" },
		]),
		{ asset_tag: "A-1", room: "3B" },
	);
	assert.deepEqual(entriesToRecord(null), {});
	assert.deepEqual(entriesToRecord(undefined), {});
});

test("whitelistKeys keeps only keys with an active definition", () => {
	assert.deepEqual(
		whitelistKeys(
			{ asset_tag: "A-1", invented_by_the_model: "x" },
			new Set(["asset_tag", "floor"]),
		),
		{ asset_tag: "A-1" },
	);
	assert.deepEqual(whitelistKeys({}, new Set(["asset_tag"])), {});
});

test("validateDraftText applies the manual path's bounds and trims", () => {
	assert.deepEqual(
		validateDraftText({
			title: "  Printer jam  ",
			body: "  The printer on floor three jams on every job.  ",
		}),
		{
			title: "Printer jam",
			body: "The printer on floor three jams on every job.",
		},
	);
	for (const values of [
		null,
		{},
		{ title: "hi", body: "a long enough body value" },
		{ title: "A valid title", body: "too short" },
		{ title: "x".repeat(161), body: "a long enough body value" },
		{ title: "A valid title", body: "x".repeat(10_001) },
		{ title: 42, body: "a long enough body value" },
	])
		assert.throws(
			() => validateDraftText(values),
			(error: unknown) =>
				error instanceof ORPCError && error.code === "BAD_REQUEST",
		);
});

test("mergeDraftPatch writes every supplied value and guards user edits", () => {
	// An unlabelled patch is still an edit: dropping it left `values` unable to
	// hold the effective post-edit values §3.5 diffs against.
	assert.deepEqual(
		mergeDraftPatch(
			{ values: { title: "AI title" }, sources: { title: "ai" } },
			{ values: { title: "Mine", impact: "high" }, sources: {} },
		),
		{
			values: { title: "Mine", impact: "high" },
			sources: { title: "user", impact: "user" },
		},
	);
	// An `ai` label never demotes a field the employee already corrected.
	assert.deepEqual(
		mergeDraftPatch(
			{ values: { title: "Mine" }, sources: { title: "user" } },
			{ values: { title: "AI title" }, sources: { title: "ai" } },
		),
		{ values: { title: "AI title" }, sources: { title: "user" } },
	);
	// A source can arrive without a value, which is how a revert is recorded.
	assert.deepEqual(
		mergeDraftPatch(
			{ values: { title: "AI title" }, sources: { title: "ai" } },
			{ values: {}, sources: { title: "user" } },
		),
		{ values: { title: "AI title" }, sources: { title: "user" } },
	);
});

test("draftWithRepair retries once, telling the model what failed", async () => {
	const notes: (string | undefined)[] = [];
	const attempt = await draftWithRepair(
		async (repairNote) => {
			notes.push(repairNote);
			return { content: notes.length === 1 ? "not json" : '{"ok":true}' };
		},
		(content) => JSON.parse(content) as { ok: boolean },
	);
	assert.deepEqual(attempt.parsed, { ok: true });
	assert.equal(notes.length, 2);
	assert.equal(notes[0], undefined);
	assert.match(String(notes[1]), /could not be parsed/);

	await assert.rejects(
		() =>
			draftWithRepair(
				async () => ({ content: "not json" }),
				(content) => JSON.parse(content) as unknown,
			),
		SyntaxError,
	);
});

test("catalogue context drops a subcategory whose form is unpublished", async () => {
	const suffix = crypto.randomUUID();
	const formId = `intake-form-${suffix}`;
	const target = (await loadCatalogueContext())[0];
	assert.ok(target, "the seeded catalogue has at least one subcategory");
	const subcategoryId = target.subcategory.id;
	const original = (
		await db
			.select({ formId: serviceSubcategories.formId })
			.from(serviceSubcategories)
			.where(eq(serviceSubcategories.id, subcategoryId))
	)[0];
	assert.ok(original);
	await db.insert(forms).values({
		id: formId,
		key: formId,
		version: 1,
		name: "Intake whitelist test",
	});

	try {
		await db
			.update(serviceSubcategories)
			.set({ formId })
			.where(eq(serviceSubcategories.id, subcategoryId));
		assert.equal(
			(await loadCatalogueContext()).some(
				(option) => option.subcategory.id === subcategoryId,
			),
			false,
			"an unpublished form must not be whitelisted for drafting",
		);
		await db
			.update(forms)
			.set({ status: "published", publishedAt: new Date() })
			.where(eq(forms.id, formId));
		assert.equal(
			(await loadCatalogueContext()).find(
				(option) => option.subcategory.id === subcategoryId,
			)?.form?.id,
			formId,
		);
	} finally {
		await db
			.update(serviceSubcategories)
			.set({ formId: original.formId })
			.where(eq(serviceSubcategories.id, subcategoryId));
		await db.delete(forms).where(eq(forms.id, formId));
	}
});

const READY_VALUES = {
	title: "Printer jam",
	body: "The printer on floor three jams on every job.",
};

async function seedDraft(
	reporterId: string,
	values: Record<string, unknown>,
): Promise<string> {
	const draft = await startDraft(reporterId);
	await db
		.update(ticketDrafts)
		.set({
			values,
			fieldSources: Object.fromEntries(
				Object.keys(values).map((key) => [key, "ai"]),
			),
			transcript: [
				{
					role: "user",
					body: "Printer is jammed on floor 3",
					createdAt: new Date(),
				},
				{
					role: "assistant",
					body: "I have drafted a ticket for you.",
					createdAt: new Date(),
				},
			],
		})
		.where(eq(ticketDrafts.id, draft.id));
	return draft.id;
}

async function cleanupIntake(
	reporterId: string,
	ticketIds: string[],
	documentIds: string[],
): Promise<void> {
	await db
		.delete(ticketCreationClaims)
		.where(eq(ticketCreationClaims.reporterId, reporterId));
	if (ticketIds.length) {
		await db
			.delete(workflowExecutions)
			.where(inArray(workflowExecutions.recordId, ticketIds));
		await db
			.delete(searchDocuments)
			.where(inArray(searchDocuments.objectId, ticketIds));
		await db
			.delete(ticketNumberHistory)
			.where(inArray(ticketNumberHistory.ticketId, ticketIds));
		await db.delete(tickets).where(inArray(tickets.id, ticketIds));
	}
	if (documentIds.length)
		await db.delete(documents).where(inArray(documents.id, documentIds));
	await db.delete(user).where(eq(user.id, reporterId));
}

test("submit creates a ticket, re-parents attachments, and writes one transcript", async () => {
	const suffix = crypto.randomUUID();
	const reporterId = `intake-submit-${suffix}`;
	const documentId = `intake-doc-${suffix}`;
	const idempotencyKey = crypto.randomUUID();
	const ticketIds: string[] = [];
	await db.insert(user).values({
		id: reporterId,
		name: "Intake submit test",
		email: `${reporterId}@example.test`,
	});
	await db.insert(documents).values({
		id: documentId,
		kind: "file",
		displayName: "screenshot.png",
		mediaType: "image/png",
		sha256: suffix.replaceAll("-", "").padEnd(64, "0"),
		storedFilename: `${suffix}.png`,
	});

	try {
		const draftId = await seedDraft(reporterId, READY_VALUES);
		await db.insert(documentLinks).values({
			id: `intake-link-${suffix}`,
			documentId,
			targetType: "draft",
			targetId: draftId,
		});

		const result = await submitIntake(draftId, reporterId, idempotencyKey);
		ticketIds.push(result.ticketId);
		assert.deepEqual(
			(
				await db
					.select()
					.from(documentLinks)
					.where(eq(documentLinks.documentId, documentId))
			).map((link) => [link.targetType, link.targetId]),
			[["ticket", result.ticketId]],
		);
		const messages = await db
			.select()
			.from(ticketMessages)
			.where(eq(ticketMessages.ticketId, result.ticketId));
		assert.equal(messages.length, 1);
		// Both halves of the conversation land on the ticket (§2.3).
		assert.match(String(messages[0]?.body), /Employee: Printer is jammed/);
		assert.match(String(messages[0]?.body), /Assistant: I have drafted/);

		// §3.5 retains the row, so it still has to read back after the flip.
		const submitted = await readDraft(draftId, reporterId);
		assert.equal(submitted.status, "submitted");
		assert.equal(submitted.ticketId, result.ticketId);

		// The same document arriving from a second draft would collide with
		// document_links_target_uidx once re-parented onto the same ticket.
		const replayDraftId = await seedDraft(reporterId, READY_VALUES);
		await db.insert(documentLinks).values({
			id: `intake-link-replay-${suffix}`,
			documentId,
			targetType: "draft",
			targetId: replayDraftId,
		});
		const replay = await submitIntake(
			replayDraftId,
			reporterId,
			idempotencyKey,
		);
		assert.equal(replay.ticketId, result.ticketId);
		assert.equal(
			(
				await db
					.select()
					.from(documentLinks)
					.where(eq(documentLinks.documentId, documentId))
			).length,
			1,
		);
		assert.equal(
			(
				await db
					.select()
					.from(ticketMessages)
					.where(eq(ticketMessages.ticketId, result.ticketId))
			).length,
			1,
			"an idempotent replay must not append a second transcript",
		);
	} finally {
		await cleanupIntake(reporterId, ticketIds, [documentId]);
	}
});

test("concurrent submits create one ticket and one transcript message", async () => {
	const suffix = crypto.randomUUID();
	const reporterId = `intake-race-${suffix}`;
	const ticketIds: string[] = [];
	await db.insert(user).values({
		id: reporterId,
		name: "Intake race test",
		email: `${reporterId}@example.test`,
	});

	try {
		const draftId = await seedDraft(reporterId, READY_VALUES);
		const [first, second] = await Promise.all([
			submitIntake(draftId, reporterId, crypto.randomUUID()),
			submitIntake(draftId, reporterId, crypto.randomUUID()),
		]);
		assert.equal(first.ticketId, second.ticketId);
		ticketIds.push(first.ticketId);
		assert.equal(
			(
				await db
					.select()
					.from(tickets)
					.where(eq(tickets.reporterId, reporterId))
			).length,
			1,
		);
		assert.equal(
			(
				await db
					.select()
					.from(ticketMessages)
					.where(eq(ticketMessages.ticketId, first.ticketId))
			).length,
			1,
		);
	} finally {
		await cleanupIntake(reporterId, ticketIds, []);
	}
});

test("submit refuses a draft that fails the ticket bounds and leaves it open", async () => {
	const suffix = crypto.randomUUID();
	const reporterId = `intake-bounds-${suffix}`;
	await db.insert(user).values({
		id: reporterId,
		name: "Intake bounds test",
		email: `${reporterId}@example.test`,
	});

	try {
		const draftId = await seedDraft(reporterId, {
			title: "hi",
			body: "short",
		});
		await assert.rejects(
			() => submitIntake(draftId, reporterId, crypto.randomUUID()),
			(error: unknown) =>
				error instanceof ORPCError && error.code === "BAD_REQUEST",
		);
		// The claim is rolled back with the rest of the transaction.
		assert.equal((await readDraft(draftId, reporterId)).status, "open");
		assert.equal(
			(
				await db
					.select()
					.from(tickets)
					.where(eq(tickets.reporterId, reporterId))
			).length,
			0,
		);
	} finally {
		await cleanupIntake(reporterId, [], []);
	}
});

test("patchDraft persists unlabelled values and syncs the routing columns", async () => {
	const suffix = crypto.randomUUID();
	const reporterId = `intake-patch-${suffix}`;
	await db.insert(user).values({
		id: reporterId,
		name: "Intake patch test",
		email: `${reporterId}@example.test`,
	});

	try {
		const draft = await startDraft(reporterId);
		const patched = await patchDraft(
			draft.id,
			reporterId,
			{ title: "Corrected title", impact: "high" },
			{},
		);
		assert.deepEqual(patched.values, {
			title: "Corrected title",
			impact: "high",
		});
		assert.deepEqual(patched.fieldSources, {
			title: "user",
			impact: "user",
		});

		const target = (await loadCatalogueContext())[0];
		assert.ok(target);
		const routed = await patchDraft(
			draft.id,
			reporterId,
			{ subcategoryId: target.subcategory.id },
			{},
		);
		assert.equal(routed.subcategoryId, target.subcategory.id);
		assert.equal(
			(await readDraft(draft.id, reporterId)).subcategoryId,
			target.subcategory.id,
		);
		await assert.rejects(
			() =>
				patchDraft(
					draft.id,
					reporterId,
					{ subcategoryId: `missing-${suffix}` },
					{},
				),
			(error: unknown) =>
				error instanceof ORPCError && error.code === "BAD_REQUEST",
		);
	} finally {
		await db.delete(user).where(eq(user.id, reporterId));
	}
});

test("discard and the TTL sweep clear draft links and their orphaned blobs", async () => {
	const suffix = crypto.randomUUID();
	const reporterId = `intake-sweep-${suffix}`;
	const orphanId = `intake-orphan-${suffix}`;
	const sharedId = `intake-shared-${suffix}`;
	const hex = suffix.replaceAll("-", "");
	await db.insert(user).values({
		id: reporterId,
		name: "Intake sweep test",
		email: `${reporterId}@example.test`,
	});
	await db.insert(documents).values([
		{
			id: orphanId,
			kind: "file",
			displayName: "orphan.png",
			mediaType: "image/png",
			sha256: `a${hex}`.padEnd(64, "0"),
			storedFilename: `${suffix}-a.png`,
		},
		{
			id: sharedId,
			kind: "file",
			displayName: "shared.png",
			mediaType: "image/png",
			sha256: `b${hex}`.padEnd(64, "0"),
			storedFilename: `${suffix}-b.png`,
		},
	]);

	try {
		const discarded = await startDraft(reporterId);
		const stale = await startDraft(reporterId);
		await db.insert(documentLinks).values([
			{
				id: `intake-sweep-a-${suffix}`,
				documentId: orphanId,
				targetType: "draft",
				targetId: discarded.id,
			},
			{
				id: `intake-sweep-b-${suffix}`,
				documentId: sharedId,
				targetType: "draft",
				targetId: discarded.id,
			},
			{
				id: `intake-sweep-c-${suffix}`,
				documentId: sharedId,
				targetType: "draft",
				targetId: stale.id,
			},
		]);

		await discardDraft(discarded.id, reporterId);
		assert.equal(
			(await db.select().from(documents).where(eq(documents.id, orphanId)))
				.length,
			0,
			"a document left with no links at all is removed",
		);
		assert.deepEqual(
			(
				await db
					.select()
					.from(documentLinks)
					.where(eq(documentLinks.documentId, sharedId))
			).map((link) => link.targetId),
			[stale.id],
			"a document another draft still holds survives",
		);

		// Discarded drafts were never swept, and the links had to go first.
		const expired = new Date(
			Date.now() - (env.AXIOMA_INTAKE_DRAFT_TTL_HOURS + 1) * 60 * 60_000,
		);
		await db
			.update(ticketDrafts)
			.set({ updatedAt: expired })
			.where(inArray(ticketDrafts.id, [discarded.id, stale.id]));
		await sweepIntakeDrafts();
		assert.equal(
			(
				await db
					.select()
					.from(ticketDrafts)
					.where(eq(ticketDrafts.reporterId, reporterId))
			).length,
			0,
		);
		assert.equal(
			(await db.select().from(documents).where(eq(documents.id, sharedId)))
				.length,
			0,
		);
	} finally {
		await db
			.delete(documents)
			.where(inArray(documents.id, [orphanId, sharedId]));
		await db.delete(user).where(eq(user.id, reporterId));
	}
});

test("the turn cap counts user turns, not transcript entries", async () => {
	const suffix = crypto.randomUUID();
	const reporterId = `intake-turns-${suffix}`;
	await db.insert(user).values({
		id: reporterId,
		name: "Intake turn cap test",
		email: `${reporterId}@example.test`,
	});

	try {
		const draft = await startDraft(reporterId);
		// The assistant does not always reply, so halving the entry count
		// undercounts the turns the employee has actually spent.
		const transcript = [
			...Array.from({ length: env.AXIOMA_INTAKE_MAX_TURNS }, (_, index) => ({
				role: "user",
				body: `turn ${index}`,
				createdAt: new Date(),
			})),
			{ role: "assistant", body: "one reply", createdAt: new Date() },
		];
		await db
			.update(ticketDrafts)
			.set({ transcript })
			.where(eq(ticketDrafts.id, draft.id));

		const client = createRouterClient(intakeRouter, {
			context: {
				auth: null,
				session: null,
				userId: reporterId,
				capabilities: new Set(["ticket.create"]),
			} as never,
		});
		const events = [];
		for await (const event of await client.sendIntakeMessage({
			draftId: draft.id,
			body: "one more message",
		}))
			events.push(event);
		assert.deepEqual(
			events.map((event) => event.type),
			["error"],
		);
		assert.equal(
			events[0]?.type === "error" ? events[0].code : null,
			"MAX_TURNS_EXCEEDED",
		);
	} finally {
		await db.delete(user).where(eq(user.id, reporterId));
	}
});

test("vision filters by size before capping the image count", async () => {
	const directory = await mkdtemp(join(tmpdir(), "axioma-intake-vision-"));
	const previous = process.env.AXIOMA_DOCUMENT_DIR;
	process.env.AXIOMA_DOCUMENT_DIR = directory;
	const key = (index: number) => index.toString(16).repeat(64).slice(0, 64);
	const image = (index: number) => ({
		sha256: key(index),
		mediaType: "image/png",
	});

	try {
		for (const index of [1, 2, 3])
			await writeFile(
				join(directory, key(index)),
				Buffer.alloc(MAX_IMAGE_BYTES + 1),
			);
		await writeFile(join(directory, key(4)), Buffer.from([1, 2, 3]));
		// Three oversized blobs ahead of a valid one used to consume the whole
		// count cap before any of them had been measured.
		assert.equal(
			(await readDraftImages([1, 2, 3, 4].map(image))).length,
			1,
		);

		for (const index of [1, 2, 3])
			await writeFile(join(directory, key(index)), Buffer.from([index]));
		assert.equal(
			(await readDraftImages([1, 2, 3, 4].map(image))).length,
			MAX_DRAFT_IMAGES,
		);
		assert.deepEqual(
			await readDraftImages([
				{ sha256: key(4), mediaType: "application/pdf" },
			]),
			[],
		);
	} finally {
		process.env.AXIOMA_DOCUMENT_DIR = previous;
		await rm(directory, { recursive: true, force: true });
	}
});

test("§3.3 routing confirmation is enforced on the server, not just the client", () => {
	const aiChosen = { subcategoryId: "sub-1" };
	const aiSource = { subcategoryId: "ai" };
	// The model picked the routing and nobody has confirmed it.
	assert.throws(
		() => requireSubcategoryConfirmed(aiChosen, aiSource),
		(error: unknown) =>
			error instanceof ORPCError && error.code === "BAD_REQUEST",
	);
	// The employee confirmed it.
	assert.doesNotThrow(() =>
		requireSubcategoryConfirmed(
			{ ...aiChosen, subcategoryConfirmed: true },
			aiSource,
		),
	);
	// The employee chose the subcategory themselves, which is already deliberate.
	assert.doesNotThrow(() =>
		requireSubcategoryConfirmed(aiChosen, { subcategoryId: "user" }),
	);
	// The incident path has no routing decision to confirm.
	assert.doesNotThrow(() => requireSubcategoryConfirmed({}, {}));
	assert.doesNotThrow(() => requireSubcategoryConfirmed(null, null));
	// A confirmation flag that is not literally `true` does not count.
	assert.throws(() =>
		requireSubcategoryConfirmed(
			{ ...aiChosen, subcategoryConfirmed: "yes" },
			aiSource,
		),
	);
});

test("submit refuses an unconfirmed AI-chosen subcategory and leaves the draft open", async () => {
	const suffix = crypto.randomUUID();
	const reporterId = `intake-confirm-${suffix}`;
	await db.insert(user).values({
		id: reporterId,
		name: "Intake confirmation test",
		email: `${reporterId}@example.test`,
	});

	try {
		// `seedDraft` labels every key `ai`, which is exactly the case the gate
		// guards: a routing decision the model made and nobody reviewed.
		const draftId = await seedDraft(reporterId, {
			title: "New starter laptop",
			body: "Please provision a laptop for the new starter joining on Monday.",
			subcategoryId: `sub-${suffix}`,
		});
		await assert.rejects(
			() => submitIntake(draftId, reporterId, crypto.randomUUID()),
			(error: unknown) =>
				error instanceof ORPCError && error.code === "BAD_REQUEST",
		);
		assert.equal((await readDraft(draftId, reporterId)).status, "open");
		assert.equal(
			(
				await db
					.select()
					.from(tickets)
					.where(eq(tickets.reporterId, reporterId))
			).length,
			0,
		);
	} finally {
		await cleanupIntake(reporterId, [], []);
	}
});

test("draft attachments are owner-scoped, not role-scoped", async () => {
	const suffix = crypto.randomUUID();
	const ownerId = `intake-owner-${suffix}`;
	const strangerId = `intake-stranger-${suffix}`;
	await db.insert(user).values([
		{
			id: ownerId,
			name: "Draft owner",
			email: `${ownerId}@example.test`,
		},
		{
			id: strangerId,
			name: "Draft stranger",
			email: `${strangerId}@example.test`,
		},
	]);

	try {
		const draftId = await seedDraft(ownerId, { title: "Laptop will not boot" });
		const target = { targetType: "draft", targetId: draftId } as const;

		// An analyst filing their own request is still the owner. `role` is derived
		// from `ticket.read.all`, so a role check here locked IT staff out of
		// attaching a screenshot to a draft they had just created themselves.
		await assert.doesNotReject(() =>
			requireDocumentWriteTarget(target, {
				userId: ownerId,
				role: "analyst",
			}),
		);
		await assert.doesNotReject(() =>
			requireDocumentWriteTarget(target, {
				userId: ownerId,
				role: "reporter",
			}),
		);
		// Ownership is what gates it: an analyst who does not own the draft is out,
		// which is the rule `canReadTarget` already applied on the read side.
		for (const role of ["analyst", "reporter"] as const)
			await assert.rejects(
				() => requireDocumentWriteTarget(target, { userId: strangerId, role }),
				(error: unknown) =>
					error instanceof ORPCError && error.code === "NOT_FOUND",
			);

		// A draft that is no longer open accepts no further attachments.
		await db
			.update(ticketDrafts)
			.set({ status: "submitted" })
			.where(eq(ticketDrafts.id, draftId));
		await assert.rejects(
			() =>
				requireDocumentWriteTarget(target, {
					userId: ownerId,
					role: "reporter",
				}),
			(error: unknown) =>
				error instanceof ORPCError && error.code === "NOT_FOUND",
		);
	} finally {
		await cleanupIntake(ownerId, [], []);
		await db.delete(user).where(eq(user.id, strangerId));
	}
});

test("deflection falls back to full text when the article index is empty", async () => {
	const suffix = crypto.randomUUID();
	const articleId = `intake-kb-${suffix}`;
	// A word that cannot collide with the seeded catalogue, so the assertion is
	// about this article and nothing else.
	const marker = "zorblatt";
	await db.insert(knowledgeArticles).values({
		id: articleId,
		title: `Fixing the ${marker} adapter`,
		body: `Unplug the ${marker} adapter, wait ten seconds, plug it back in.`,
		summary: `Restart the ${marker} adapter`,
		status: "published",
		audience: "public",
		isRestricted: false,
	});

	try {
		// `reconcileCoreSearchDocuments` is incremental, so a fresh install has no
		// `knowledge_article` rows at all and the indexed path returns nothing.
		await db
			.delete(searchDocuments)
			.where(eq(searchDocuments.objectId, articleId));
		const hits = await deflectKnowledge(`my ${marker} adapter stopped working`);
		assert.deepEqual(
			hits.map((article) => article.id),
			[articleId],
		);
		// An unrelated message must still deflect to nothing — the fallback is a
		// safety net, not a reason to show the employee an irrelevant article.
		assert.deepEqual(await deflectKnowledge("quarterly expense policy"), []);
		// A draft article is never portal-visible, on either path.
		await db
			.update(knowledgeArticles)
			.set({ status: "draft" })
			.where(eq(knowledgeArticles.id, articleId));
		assert.deepEqual(
			await deflectKnowledge(`my ${marker} adapter stopped working`),
			[],
		);
	} finally {
		await db
			.delete(searchDocuments)
			.where(eq(searchDocuments.objectId, articleId));
		await db
			.delete(knowledgeArticles)
			.where(eq(knowledgeArticles.id, articleId));
	}
});
