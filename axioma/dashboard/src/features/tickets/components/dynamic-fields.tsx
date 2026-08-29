import type { client } from "@/utils/orpc";

type Definition = Awaited<
	ReturnType<typeof client.listFieldDefinitions>
>[number];

export function DynamicFields({
	definitions,
	values,
}: {
	definitions: Definition[];
	values: Record<string, unknown>;
}) {
	const fields = definitions.flatMap((definition) => {
		const value = values[definition.key];
		return value === undefined ? [] : [{ definition, value }];
	});

	if (fields.length === 0) return null;

	return (
		<section className="rounded-xl border bg-card p-4 shadow-sm">
			<h2 className="font-semibold text-xs uppercase tracking-wider">
				Custom fields
			</h2>
			<dl className="mt-3 divide-y text-xs">
				{fields.map(({ definition, value }) => (
					<div
						key={definition.id}
						className="grid grid-cols-[110px_1fr] gap-3 py-2.5 first:pt-0 last:pb-0"
					>
						<dt className="text-muted-foreground">{definition.label}</dt>
						<dd className="min-w-0 break-words text-right">
							{formatValue(definition.fieldType, value)}
						</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

function formatValue(fieldType: Definition["fieldType"], value: unknown) {
	if (fieldType === "checkbox" && typeof value === "boolean")
		return value ? "Yes" : "No";
	if (fieldType === "multiselect" && Array.isArray(value))
		return value.join(", ");
	if (fieldType === "date" && typeof value === "string")
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: "medium",
			timeZone: "UTC",
		}).format(new Date(`${value}T00:00:00Z`));
	if (fieldType === "datetime" && typeof value === "string")
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(value));
	return typeof value === "string" || typeof value === "number"
		? String(value)
		: JSON.stringify(value);
}
