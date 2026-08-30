export type DynamicFieldDefinition = {
	key: string;
	fieldType: string;
};

export function serializeDynamicFields(
	definitions: readonly DynamicFieldDefinition[],
	values: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		definitions.flatMap((definition) => {
			const value = values[definition.key];
			if (
				value === "" ||
				(Array.isArray(value) && value.length === 0) ||
				value === undefined
			)
				return [];
			return [
				[
					definition.key,
					definition.fieldType === "datetime" && typeof value === "string"
						? new Date(value).toISOString()
						: value,
				],
			];
		}),
	);
}
