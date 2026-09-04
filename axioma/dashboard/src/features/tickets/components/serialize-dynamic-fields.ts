// Extension-qualified because dynamic-fields.validation.mjs loads this module
// through Node, which does no extensionless resolution.
import { fromDateTimeLocal } from "../../../lib/datetime-local.ts";

export type DynamicFieldDefinition = {
	key: string;
	fieldType: string;
};

export function serializeDynamicFields(
	definitions: readonly DynamicFieldDefinition[],
	values: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		definitions.map((definition) => {
			const value = values[definition.key];
			return [
				definition.key,
				value === "" ||
				(Array.isArray(value) && value.length === 0) ||
				value === undefined
					? null
					: definition.fieldType === "datetime" && typeof value === "string"
						? fromDateTimeLocal(value).toISOString()
						: value,
			];
		}),
	);
}
