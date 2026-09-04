import { ORPCError } from "@orpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	devices,
	documentLinks,
	documents,
	formFields,
	forms,
	serviceFamilies,
	serviceSubcategories,
	services,
	ticketDrafts,
} from "@/db/schema";
import { env } from "@/env";
import { listActiveFieldDefinitions } from "../dynamic-fields";
import {
	appendMessage,
	discardDraft,
	draftWithRepair,
	loadDraft,
	patchDraft,
	readDraft,
	repairDraftOutput,
	startDraft,
	suppressLowConfidence,
	toDraftSummary,
	whitelistKeys,
	whitelistSubcategory,
} from "../intake";
import { deflectKnowledge } from "../intake/deflection";
import { callIntakeModel, type IntakeModelResult } from "../intake/model";
import {
	classifyContext,
	draftContext,
	fillFormContext,
	systemPrompt,
} from "../intake/prompt";
import {
	catalogueFormValuesJsonSchema,
	catalogueFormValuesSchema,
	entriesToRecord,
	type CatalogueFormValuesOutput,
	type IncidentDraftOutput,
	incidentDraftJsonSchema,
	incidentDraftSchema,
} from "../intake/schema";
import { submitIntake } from "../intake/submit";
import { readDraftImages } from "../intake/vision";
import { capabilityProcedure } from "../orpc";

export async function loadCatalogueContext(): Promise<
	Array<{
		subcategory: { id: string; name: string; description: string | null };
		form: { id: string; name: string } | null;
	}>
> {
	const rows = await db
		.select({
			subcategoryId: serviceSubcategories.id,
			subcategoryName: serviceSubcategories.name,
			subcategoryDescription: serviceSubcategories.description,
			formId: forms.id,
			formName: forms.name,
		})
		.from(serviceSubcategories)
		.innerJoin(services, eq(serviceSubcategories.serviceId, services.id))
		.innerJoin(serviceFamilies, eq(services.familyId, serviceFamilies.id))
		.leftJoin(
			forms,
			and(
				eq(serviceSubcategories.formId, forms.id),
				eq(forms.status, "published"),
			),
		)
		.where(
			and(
				eq(serviceSubcategories.isActive, true),
				eq(services.isActive, true),
				eq(serviceFamilies.isActive, true),
				// Identical to `listRequestCatalogue`: a subcategory whose form is not
				// published cannot be submitted, so whitelisting it would strand the
				// draft on a NOT_FOUND inside the submit transaction.
				sql`${serviceSubcategories.formId} is null or ${forms.id} is not null`,
			),
		)
		.orderBy(serviceSubcategories.name);
	return rows.map((row) => ({
		subcategory: {
			id: row.subcategoryId,
			name: row.subcategoryName,
			description: row.subcategoryDescription,
		},
		form: row.formId ? { id: row.formId, name: row.formName ?? "" } : null,
	}));
}

async function loadOwnedDevices(reporterId: string) {
	return db
		.select({ id: devices.id, hostname: devices.hostname })
		.from(devices)
		.where(eq(devices.ownerId, reporterId));
}

/** Every element of a chat content array must be a content-part object. */
const textPart = (text: string) => ({ type: "text" as const, text });

type TranscriptEntry = { role: "user" | "assistant"; body: string };

/** Null only when both calls reported nothing, so "unknown" stays distinct from zero. */
const sumTokens = (
	first: number | null | undefined,
	second: number | null | undefined,
): number | null =>
	first == null && second == null ? null : (first ?? 0) + (second ?? 0);

const transcriptOf = (draft: { transcript: unknown }): TranscriptEntry[] =>
	(draft.transcript ?? []) as TranscriptEntry[];

function buildIncidentValues(
	parsed: IncidentDraftOutput,
	subcategoryId: string | null,
	allowedCustomFields: ReadonlySet<string>,
): {
	values: Record<string, unknown>;
	sources: Record<string, "ai" | "user">;
	blank: Array<{ path: string; confidence: "high" | "low" }>;
} {
	const values: Record<string, unknown> = {};
	const sources: Record<string, "ai" | "user"> = {};
	// §3.2 leaves a field the model was unsure of empty rather than guessing.
	// The client still has to hear about it to build "Needs your input".
	const blank: Array<{ path: string; confidence: "high" | "low" }> = [];
	const take = (
		key: string,
		field: { value: unknown; confidence: "high" | "low" },
	) => {
		if (field.confidence === "high" && field.value !== null) {
			values[key] = field.value;
			sources[key] = "ai";
			return;
		}
		blank.push({ path: key, confidence: field.confidence });
	};
	take("title", parsed.title);
	take("body", parsed.body);
	take("impact", parsed.impact);
	take("urgency", parsed.urgency);
	take("deviceId", parsed.deviceId);
	// customFields arrives as a key/value list, which is what strict structured
	// outputs allow, and is stored as the record the write paths expect.
	if (
		parsed.customFields.confidence === "high" &&
		parsed.customFields.value !== null
	) {
		const record = whitelistKeys(
			entriesToRecord(parsed.customFields.value),
			allowedCustomFields,
		);
		if (Object.keys(record).length) {
			values.customFields = record;
			sources.customFields = "ai";
		}
	} else
		blank.push({
			path: "customFields",
			confidence: parsed.customFields.confidence,
		});
	if (subcategoryId) {
		values.subcategoryId = subcategoryId;
		sources.subcategoryId = "ai";
	}
	return { values, sources, blank };
}

export const intakeRouter = {
	startIntakeDraft: capabilityProcedure(
		"ticket.create",
	).startIntakeDraft.handler(async ({ context }) => startDraft(context.userId)),
	sendIntakeMessage: capabilityProcedure(
		"ticket.create",
	).sendIntakeMessage.handler(async function* ({ context, input }) {
		const draft = await loadDraft(input.draftId, context.userId);
		const excludedIds = new Set(input.excludedAttachments ?? []);
		const transcript = transcriptOf(draft);
		// Only user turns are counted: the transcript holds both roles, so
		// halving its length would let the cap drift with the assistant's replies.
		const userTurns = transcript.filter(
			(entry) => entry.role === "user",
		).length;
		if (userTurns >= env.AXIOMA_INTAKE_MAX_TURNS) {
			yield {
				type: "error",
				code: "MAX_TURNS_EXCEEDED",
				message: "Maximum intake conversation turns exceeded",
			} as const;
			return;
		}
		await appendMessage(draft.id, context.userId, "user", input.body);

		// §10 is "one click to a ticket, always": deflection runs once, on the
		// opening turn, and never short-circuits the draft the employee came for.
		if (userTurns === 0) {
			yield { type: "status", stage: "retrieving" } as const;
			const articles = await deflectKnowledge(input.body);
			if (articles.length) {
				yield {
					type: "message",
					delta: "I found help articles that might answer this:",
				} as const;
				yield {
					type: "deflection",
					articles: articles.map(({ id, title, summary }) => ({
						id,
						title,
						summary,
					})),
				} as const;
			}
		}

		yield { type: "status", stage: "classifying" } as const;
		const [catalogue, ownedDevices, fieldDefinitions] = await Promise.all([
			loadCatalogueContext(),
			loadOwnedDevices(context.userId),
			listActiveFieldDefinitions(db, "ticket"),
		]);

		let visionImageParts: unknown[] = [];
		if (env.AXIOMA_INTAKE_VISION) {
			yield { type: "status", stage: "reading_attachments" } as const;
			try {
				const linkedDocs = await db
					.select({
						id: documents.id,
						sha256: documents.sha256,
						mediaType: documents.mediaType,
					})
					.from(documentLinks)
					.innerJoin(documents, eq(documentLinks.documentId, documents.id))
					.where(
						and(
							eq(documentLinks.targetType, "draft"),
							eq(documentLinks.targetId, draft.id),
						),
					);
				// filter out user-excluded attachments (per-file read opt-out §7.3)
				const visibleDocs = excludedIds.size
					? linkedDocs.filter((d) => !excludedIds.has(d.id))
					: linkedDocs;
				if (visibleDocs.length) {
					const imageInputs = visibleDocs.map((doc) => ({
						sha256: doc.sha256 ?? "",
						mediaType: doc.mediaType,
						size: null as number | null,
					}));
					visionImageParts = await readDraftImages(imageInputs);
				}
			} catch {
				visionImageParts = [];
			}
		}

		// The user turn is assembled once and shared by the first call and the
		// repair retry. Every element must be a content-part object: a bare
		// string inside a content array is rejected by the gateway before
		// generation, which previously broke the whole non-vision path.
		const turnContent = [
			textPart(classifyContext(catalogue)),
			textPart(
				draftContext({
					message: input.body,
					transcript,
					devices: ownedDevices,
					fieldDefinitions: fieldDefinitions.map((definition) => ({
						key: definition.key,
						label: definition.label,
						type: definition.fieldType,
						config: definition.config,
					})),
				}),
			),
			...visionImageParts,
		];
		const draftOnce = (repairNote?: string) =>
			callIntakeModel({
				system: systemPrompt(),
				jsonSchema: {
					name: "intake_draft",
					schema: incidentDraftJsonSchema,
				},
				messages: [
					{
						role: "user",
						content: repairNote
							? [...turnContent, textPart(repairNote)]
							: turnContent,
					},
				],
			});

		// The model round trip below is the longest wait in the flow — up to
		// AXIOMA_INTAKE_TIMEOUT_MS. §9 is explicit that it must never be a bare
		// spinner, so the stage is announced before the call, not after it.
		yield { type: "status", stage: "drafting" } as const;

		let parsed: IncidentDraftOutput;
		let modelResult: IntakeModelResult;
		try {
			const attempt = await draftWithRepair(draftOnce, (content) =>
				repairDraftOutput(JSON.parse(content), incidentDraftSchema),
			);
			parsed = attempt.parsed;
			modelResult = attempt.result;
		} catch (error) {
			yield {
				type: "error",
				code: "MODEL_FAILED",
				message: error instanceof Error ? error.message : "Model failure",
			} as const;
			return;
		}

		const whitelistedSubcategoryId = whitelistSubcategory(
			parsed.subcategoryId,
			new Set(catalogue.map((option) => option.subcategory.id)),
		);
		const { values, sources, blank } = buildIncidentValues(
			parsed,
			whitelistedSubcategoryId,
			new Set(fieldDefinitions.map((definition) => definition.key)),
		);
		const matchedCatalogue = whitelistedSubcategoryId
			? (catalogue.find(
					(option) => option.subcategory.id === whitelistedSubcategoryId,
				) ?? null)
			: null;
		if (matchedCatalogue?.form) {
			values.formId = matchedCatalogue.form.id;
			sources.formId = "ai";
		}
		// Call B's usage is accounted alongside call A's: the catalogue path is the
		// more expensive of the two, and dropping this under-reported it silently.
		let catalogueResult: IntakeModelResult | null = null;
		if (matchedCatalogue?.form && whitelistedSubcategoryId) {
			try {
				const fields = await db
					.select()
					.from(formFields)
					.where(eq(formFields.formId, matchedCatalogue.form.id))
					.orderBy(asc(formFields.ordinal));
				if (fields.length) {
					const fillContext = fillFormContext(
						fields.map((field) => ({
							key: field.key,
							label: field.label,
							type: field.type,
							options: field.options as unknown as string[] | null,
							isMandatory: field.isMandatory ?? false,
							isHidden: field.isHidden ?? false,
							isReadonly: field.isReadonly ?? false,
						})),
					);
					const fillOnce = (repairNote?: string) => {
						const content = [
							textPart(fillContext),
							textPart(
								draftContext({
									message: input.body,
									transcript,
									devices: ownedDevices,
									fieldDefinitions: fieldDefinitions.map((definition) => ({
										key: definition.key,
										label: definition.label,
										type: definition.fieldType,
										config: definition.config,
									})),
								}),
							),
						];
						return callIntakeModel({
							system: systemPrompt(),
							jsonSchema: {
								name: "catalogue_form",
								schema: catalogueFormValuesJsonSchema,
							},
							messages: [
								{
									role: "user",
									content: repairNote
										? [...content, textPart(repairNote)]
										: content,
								},
							],
						});
					};
					// Call B gets the same one-shot repair retry as call A. Without it
					// a single malformed catalogue reply dropped every form value and
					// left the employee an empty catalogue form.
					const secondAttempt = await draftWithRepair<
						CatalogueFormValuesOutput,
						IntakeModelResult
					>(fillOnce, (content) =>
						repairDraftOutput(JSON.parse(content), catalogueFormValuesSchema),
					);
					const filled = secondAttempt.parsed;
					catalogueResult = secondAttempt.result;
					// `validateFormSubmission` rejects a key it does not own, and it
					// runs inside the submit transaction, so the model's answer is
					// narrowed to the keys that form actually accepts.
					const formValues = whitelistKeys(
						entriesToRecord(filled.formValues),
						new Set(
							fields
								.filter(
									(field) =>
										!field.isHidden &&
										!field.isReadonly &&
										field.predefinedValue === null,
								)
								.map((field) => field.key),
						),
					);
					if (Object.keys(formValues).length) {
						values.formValues = formValues;
						sources.formValues = "ai";
					}
				}
			} catch (error) {
				// Non-fatal by design: the subcategory and form are already routed, so
				// the employee still gets a usable draft with an empty form rather than
				// a dead end. But it used to be silent, which made an unfillable
				// catalogue form indistinguishable from one the model chose to leave
				// blank — so it is logged, and the client is told the form is on them.
				console.error(
					`[intake] catalogue form fill failed for draft ${draft.id}:`,
					error instanceof Error ? error.message : error,
				);
				yield {
					type: "error",
					code: "CATALOGUE_FILL_FAILED",
					message:
						"I routed your request but could not fill in its form. Please complete the fields below.",
				} as const;
			}
		}

		// aiDraft is the model's verbatim output — it is the baseline the
		// correction signal is diffed against, so suppression must not reach it.
		const aiDraft = structuredClone(parsed) as unknown as Record<
			string,
			unknown
		>;
		suppressLowConfidence(parsed);
		await db
			.update(ticketDrafts)
			.set({
				intent: parsed.intent,
				aiDraft,
				values,
				fieldSources: sources,
				subcategoryId: (values.subcategoryId as string | null) ?? null,
				formId: (values.formId as string | null) ?? null,
				model: modelResult.model,
				promptTokens: sumTokens(
					modelResult.promptTokens,
					catalogueResult?.promptTokens,
				),
				completionTokens: sumTokens(
					modelResult.completionTokens,
					catalogueResult?.completionTokens,
				),
				updatedAt: new Date(),
			})
			.where(eq(ticketDrafts.id, draft.id));

		if (parsed.assistantMessage) {
			// §2.3: the conversation is the evidence that lands on the ticket, so
			// the assistant's half of it has to be stored, not just streamed.
			await appendMessage(
				draft.id,
				context.userId,
				"assistant",
				parsed.assistantMessage,
			);
			yield { type: "message", delta: parsed.assistantMessage } as const;
		}
		for (const [path, value] of Object.entries(values)) {
			if (value === null || value === undefined) continue;
			if (!(path in sources)) continue;
			yield {
				type: "field",
				path,
				value,
				confidence: "high",
			} as const;
		}
		for (const { path, confidence } of blank)
			yield { type: "field", path, value: null, confidence } as const;
		// non-streaming: single terminal complete, partial stays empty (TanStack AI §2.8)
		yield {
			type: "complete",
			draft: toDraftSummary(await readDraft(draft.id, context.userId)),
		} as const;
	}),
	getIntakeDraft: capabilityProcedure("ticket.create").getIntakeDraft.handler(
		async ({ context, input }) => {
			try {
				// A submitted draft is retained by §3.5 and still has to read back.
				return toDraftSummary(await readDraft(input.draftId, context.userId));
			} catch (error) {
				if (error instanceof ORPCError && error.code === "NOT_FOUND")
					return null;
				throw error;
			}
		},
	),
	patchIntakeDraft: capabilityProcedure(
		"ticket.create",
	).patchIntakeDraft.handler(async ({ context, input }) =>
		patchDraft(input.draftId, context.userId, input.values, input.sources),
	),
	submitIntakeDraft: capabilityProcedure(
		"ticket.create",
	).submitIntakeDraft.handler(async ({ context, input }) =>
		submitIntake(input.draftId, context.userId, input.idempotencyKey),
	),
	discardIntakeDraft: capabilityProcedure(
		"ticket.create",
	).discardIntakeDraft.handler(async ({ context, input }) =>
		discardDraft(input.draftId, context.userId),
	),
	intakeCapabilities: capabilityProcedure(
		"ticket.create",
	).intakeCapabilities.handler(() => ({
		enabled: Boolean(env.AXIOMA_LLM_KEY),
		vision: env.AXIOMA_INTAKE_VISION,
	})),
};
