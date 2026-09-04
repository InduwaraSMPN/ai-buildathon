import z from "zod";
import type {
	RequestFormField,
	RequestFormValues,
} from "@/features/request-catalogue/types";
import type { orpc } from "@/utils/orpc";
import { requestFormCopy } from "./copy";

export const requestDetailsSchema = z.object({
	title: z
		.string()
		.trim()
		.min(3, requestFormCopy.summaryTooShort)
		.max(160, requestFormCopy.summaryTooLong),
	body: z
		.string()
		.trim()
		.min(10, requestFormCopy.detailsTooShort)
		.max(10_000, requestFormCopy.detailsTooLong),
	selectedId: z.string(),
	values: z.record(
		z.string(),
		z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
	),
});

export const incidentSchema = requestDetailsSchema
	.pick({ title: true, body: true })
	.extend({
		affectedPeople: z.enum(["me", "team", "company"]),
		timing: z.enum(["whenever", "today", "blocked"]),
		deviceId: z.string(),
		customFields: z.record(z.string(), z.unknown()),
	});

export type IncidentValues = z.input<typeof incidentSchema>;
export type RequestFormValuesExport = RequestFormValues;

type CatalogueItem = Awaited<
	ReturnType<typeof orpc.listRequestCatalogue.call>
>[number];

function objectValue(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

export function catalogueFields(item: CatalogueItem): RequestFormField[] {
	return (item.form?.fields ?? [])
		.filter((field) => !field.isHidden && field.predefinedValue === null)
		.map((field) => {
			const validation = objectValue(field.validation);
			const options = Array.isArray(field.options)
				? field.options.filter(
						(option): option is string | { label: string; value: string } =>
							typeof option === "string" ||
							(option !== null &&
								typeof option === "object" &&
								typeof (option as Record<string, unknown>).label === "string" &&
								typeof (option as Record<string, unknown>).value === "string"),
					)
				: undefined;
			return {
				key: field.key,
				label: field.label,
				type: field.type,
				description: field.description,
				required: field.isMandatory,
				readOnly: field.isReadonly,
				condition: field.condition,
				options,
				min: typeof validation.min === "number" ? validation.min : undefined,
				max: typeof validation.max === "number" ? validation.max : undefined,
				step: validation.integer === true ? 1 : undefined,
				minLength:
					typeof validation.minLength === "number"
						? validation.minLength
						: undefined,
				maxLength:
					typeof validation.maxLength === "number"
						? validation.maxLength
						: undefined,
			} satisfies RequestFormField;
		});
}

export type { CatalogueItem };
