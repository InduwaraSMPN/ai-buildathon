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
	appendUserTurn,
	discardDraft,
	draftWithRepair,
	loadDraft,
	mergeDraftPatch,
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
	type CatalogueFormValuesOutput,
	catalogueFormValuesJsonSchema,
	catalogueFormValuesSchema,
	entriesToRecord,
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

/** Null only when both calls reported nothing, so "unknown" stays distinct from zero. */
const sumTokens = (
	first: number | null | undefined,
	second: number | null | undefined,
): number | null =>
	first == null && second == null ? null : (first ?? 0) + (second ?? 0);

const asId = (value: unknown): string | null =>
	typeof value === "string" && value ? value : null;

function buildIncidentValues(
	parsed: IncidentDraftOutput,
	subcategoryId: string | null,
	allowedCustomFields: ReadonlySet<string>,
	allowedDevices: ReadonlySet<string>,
): {
	values: Record<string, unknown>;
	sources: Record<string, "ai" | "user">;
	blank: Array<{ path: string; confidence: "high" | "low" }>;
} {
	const values: Record<string, unknown> = {};
	const sources: Record<string, "ai" | "user"> = {};
	// A field the model was unsure of is left empty rather than guessed at.
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
	// `tickets.device_id` is the sole authorization anchor for every device tool
	// call, so the model may only name a machine this employee already owns —
	// an id it invented, or one a pasted message talked it into, is dropped.
	take(
		"deviceId",
		parsed.deviceId.value !== null && !allowedDevices.has(parsed.deviceId.value)
			? { value: null, confidence: parsed.deviceId.confidence }
			: parsed.deviceId,
	);
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
		// The cap and the append are one statement, so two messages sent at once
		// can no longer both find the draft under the cap and both append.
		const appended = await appendUserTurn(
			draft.id,
			context.userId,
			input.body,
			env.AXIOMA_INTAKE_MAX_TURNS,
		);
		if (!appended) {
			yield {
				type: "error",
				code: "MAX_TURNS_EXCEEDED",
				message: "Maximum intake conversation turns exceeded",
			} as const;
			return;
		}
		// The turn just appended is carried separately as the model's `message`,
		// so the prompt's conversation is everything that came before it.
		const transcript = appended.slice(0, -1);
		const userTurns = transcript.filter(
			(entry) => entry.role === "user",
		).length;

		// The escape hatch to a real ticket stays one click away at all times: a
		// confident knowledge answer changes what the employee is shown, never
		// what they are allowed to do. So deflection runs once, on the opening
		// turn, and never short-circuits the draft the employee came for.
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
				// The composer offers a per-image opt-out and forwards the ids the
				// employee unticked as `excludedAttachments`. Those documents are
				// dropped here, so a screenshot they held back is never read.
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
			} catch (error) {
				// Reading the attachments is best-effort — the draft is still worth
				// having without them — but a bare catch made a misconfigured blob
				// store indistinguishable from a draft with nothing attached, so the
				// assistant drafted blind and nobody found out.
				console.error(
					`[intake] attachment read failed for draft ${draft.id}:`,
					error instanceof Error ? error.message : error,
				);
				visionImageParts = [];
				yield {
					type: "error",
					code: "ATTACHMENT_READ_FAILED",
					message:
						"I could not open the files you attached, so this draft is based on your message alone.",
				} as const;
			}
		}

		// The user turn is assembled once and shared by the first call and the
		// repair retry. Every element must be a content-part object: a bare
		// string inside a content array is rejected by the gateway before
		// generation, which previously broke the whole non-vision path.
		const turnContent = [
			textPart(classifyContext(catalogue, input.body)),
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
		// AXIOMA_INTAKE_TIMEOUT_MS, which defaults to 45 seconds. A wait that
		// long reads as a hang unless the client can say what is happening, so
		// the stage is announced before the call rather than after it and the
		// employee is never left in front of a bare spinner.
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
			new Set(ownedDevices.map((device) => device.id)),
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
		// The model's output is a patch, not the whole draft. Writing `values` and
		// `fieldSources` wholesale discarded every key this turn had no opinion
		// about — `subcategoryConfirmed` and the catalogue's `formValues` among
		// them — and reset the employee's corrections to whatever the model had
		// just said, under a `user` label that was no longer true.
		const stored = await readDraft(draft.id, context.userId);
		const current = {
			values: (stored.values ?? {}) as Record<string, unknown>,
			sources: (stored.fieldSources ?? {}) as Record<string, "ai" | "user">,
		};
		// A key the employee has already corrected is theirs, so the model's
		// opinion of it is dropped rather than folded in.
		const corrected = (key: string) => current.sources[key] === "user";
		const merged = mergeDraftPatch(current, {
			values: Object.fromEntries(
				Object.entries(values).filter(([key]) => !corrected(key)),
			),
			sources: Object.fromEntries(
				Object.entries(sources).filter(([key]) => !corrected(key)),
			),
		});
		await db
			.update(ticketDrafts)
			.set({
				intent: parsed.intent,
				aiDraft,
				values: merged.values,
				fieldSources: merged.sources,
				subcategoryId: asId(merged.values.subcategoryId),
				formId: asId(merged.values.formId),
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
			// The conversation is the evidence that lands on the ticket — an
			// analyst who opens a ticket saying only "hi" has nothing to work
			// with — so the assistant's half of it has to be stored, not merely
			// streamed to the browser and lost.
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
			// The effective value, not the model's: a key the employee corrected
			// keeps their answer, and the client has to be told which one won.
			yield {
				type: "field",
				path,
				value: merged.values[path],
				confidence: "high",
			} as const;
		}
		for (const { path, confidence } of blank)
			yield { type: "field", path, value: null, confidence } as const;
		// Nothing here streams, so the turn ends with a single terminal `complete`
		// and no deltas — the same shape TanStack AI documents for its own
		// non-streaming adapters, which is why the client renderer has to cope
		// with `partial` staying empty for the whole turn.
		yield {
			type: "complete",
			draft: toDraftSummary(await readDraft(draft.id, context.userId)),
		} as const;
	}),
	getIntakeDraft: capabilityProcedure("ticket.create").getIntakeDraft.handler(
		async ({ context, input }) => {
			try {
				// A submitted draft is retained rather than deleted, so that the
				// employee's corrections can still be diffed against the model's
				// original output, and it therefore has to stay readable here.
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
