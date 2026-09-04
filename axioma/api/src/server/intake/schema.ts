import { z } from "zod";
import { drafted } from "@/contracts/intake";
import { IMPACT_LEVELS, URGENCY_LEVELS } from "@/shared";

/**
 * Dynamic and catalogue field values travel as an explicit key/value list, not
 * as an open-ended record. Strict structured outputs reject a schema containing
 * `propertyNames` and require `additionalProperties: false` on every object —
 * both of which an arbitrary-key record violates. A list of pairs carries the
 * same data and survives strict validation.
 */
export const fieldEntry = z.object({
	key: z.string(),
	value: z.string().nullable(),
});

export const incidentDraftSchema = z.object({
	intent: z.enum(["incident", "catalogue_request", "knowledge_answer"]),
	assistantMessage: z.string(),
	clarifyingQuestion: z.string().nullable(),
	title: drafted(z.string()),
	body: drafted(z.string()),
	impact: drafted(z.enum(IMPACT_LEVELS)),
	urgency: drafted(z.enum(URGENCY_LEVELS)),
	deviceId: drafted(z.string()),
	customFields: drafted(z.array(fieldEntry)),
	subcategoryId: z.string().nullable(),
	subcategoryConfirmed: z.boolean().nullable(),
});

// catalogueFormValuesSchema JSON Schema is passed with fillFormContext in routers/intake.ts Call B
export const catalogueFormValuesSchema = z.object({
	formValues: z.array(fieldEntry),
});

/** Collapses the wire list back into the record the write paths expect. */
export function entriesToRecord(
	entries: readonly z.infer<typeof fieldEntry>[] | null | undefined,
): Record<string, string> {
	const record: Record<string, string> = {};
	for (const entry of entries ?? []) {
		if (entry.value !== null) record[entry.key] = entry.value;
	}
	return record;
}

/**
 * Walks every object in a JSON Schema, including those nested under anyOf /
 * oneOf / allOf / items, and returns a description of each strict-mode breach.
 */
export function strictSchemaViolations(node: unknown, path = "$"): string[] {
	const found: string[] = [];
	if (node === null || typeof node !== "object") return found;
	const shape = node as Record<string, unknown>;

	if ("propertyNames" in shape)
		found.push(`${path}: propertyNames is rejected by strict mode`);

	if (shape.type === "object") {
		if (shape.additionalProperties !== false)
			found.push(`${path}: additionalProperties must be false`);
		const properties = (shape.properties ?? {}) as Record<string, unknown>;
		const names = Object.keys(properties);
		const required = Array.isArray(shape.required)
			? (shape.required as string[])
			: [];
		const missing = names.filter((name) => !required.includes(name));
		if (missing.length)
			found.push(
				`${path}: required must list every property (${missing.join(", ")})`,
			);
		for (const [name, child] of Object.entries(properties))
			found.push(...strictSchemaViolations(child, `${path}.${name}`));
	}

	for (const key of ["anyOf", "oneOf", "allOf", "items"] as const) {
		const child = shape[key];
		if (Array.isArray(child))
			for (const [index, entry] of child.entries())
				found.push(
					...strictSchemaViolations(entry, `${path}.${key}[${index}]`),
				);
		else if (child)
			found.push(...strictSchemaViolations(child, `${path}.${key}`));
	}
	return found;
}

/**
 * Strict structured outputs are rejected before generation — with nothing but an
 * opaque HTTP 400 from the gateway — when a schema carries `propertyNames`,
 * leaves an object open, or omits any property from `required`. The gateway
 * enforces all three, so assert them here at module load, where the failure
 * names the offending schema and path.
 */
function toStrictJsonSchema(schema: z.ZodType<unknown>, name: string) {
	const raw = z.toJSONSchema(schema, { target: "draft-7" }) as Record<
		string,
		unknown
	>;
	const { $schema: _schema, ...rest } = raw;
	const violations = strictSchemaViolations(rest);
	if (violations.length)
		throw new Error(
			`${name} JSON Schema is not valid for strict structured outputs:\n  ${violations.join("\n  ")}`,
		);
	return rest;
}

export const incidentDraftJsonSchema = toStrictJsonSchema(
	incidentDraftSchema,
	"incidentDraft",
);

export const catalogueFormValuesJsonSchema = toStrictJsonSchema(
	catalogueFormValuesSchema,
	"catalogueFormValues",
);

export type IncidentDraftOutput = z.infer<typeof incidentDraftSchema>;
export type CatalogueFormValuesOutput = z.infer<
	typeof catalogueFormValuesSchema
>;
