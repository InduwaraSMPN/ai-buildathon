import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { client } from "@/utils/orpc";

type Definition = Awaited<
	ReturnType<typeof client.listTicketFieldDefinitions>
>[number];
type Values = Record<string, unknown>;
type Config = {
	maxLength?: number;
	min?: number;
	max?: number;
	options?: string[];
	referenceType?: string;
};

export function DynamicFields({
	definitions,
	values,
	onChange,
}: {
	definitions: Definition[];
	values: Values;
	onChange: (values: Values) => void;
}) {
	const set = (key: string, value: unknown) =>
		onChange({ ...values, [key]: value });

	return definitions.map((definition) => {
		const config = definition.config as Config;
		const id = `custom-field-${definition.key}`;
		const value = values[definition.key];
		const common = {
			id,
			name: definition.key,
			className:
				"h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
		};
		let control: React.ReactNode;

		switch (definition.fieldType) {
			case "textarea":
				control = (
					<Textarea
						id={id}
						name={definition.key}
						value={typeof value === "string" ? value : ""}
						maxLength={config.maxLength}
						onChange={(event) => set(definition.key, event.target.value)}
					/>
				);
				break;
			case "integer":
				control = (
					<Input
						{...common}
						type="number"
						step={1}
						min={config.min}
						max={config.max}
						value={typeof value === "number" ? value : ""}
						onChange={(event) =>
							set(
								definition.key,
								event.target.value === "" ? "" : event.target.valueAsNumber,
							)
						}
					/>
				);
				break;
			case "date":
			case "datetime":
				control = (
					<Input
						{...common}
						type={definition.fieldType === "date" ? "date" : "datetime-local"}
						value={typeof value === "string" ? value : ""}
						onChange={(event) => set(definition.key, event.target.value)}
					/>
				);
				break;
			case "dropdown":
				control = (
					<select
						{...common}
						value={typeof value === "string" ? value : ""}
						onChange={(event) => set(definition.key, event.target.value)}
					>
						<option value="">Select an option</option>
						{config.options?.map((option) => (
							<option key={option} value={option}>
								{option}
							</option>
						))}
					</select>
				);
				break;
			case "multiselect":
				control = (
					<select
						{...common}
						multiple
						className={`${common.className} h-auto min-h-24 py-2`}
						value={Array.isArray(value) ? (value as string[]) : []}
						onChange={(event) =>
							set(
								definition.key,
								Array.from(
									event.target.selectedOptions,
									(option) => option.value,
								),
							)
						}
					>
						{config.options?.map((option) => (
							<option key={option} value={option}>
								{option}
							</option>
						))}
					</select>
				);
				break;
			case "checkbox":
				return (
					<label
						key={definition.id}
						htmlFor={id}
						className="flex items-center gap-3 text-sm"
					>
						<input
							id={id}
							name={definition.key}
							type="checkbox"
							checked={value === true}
							onChange={(event) => set(definition.key, event.target.checked)}
							className="size-4 accent-primary"
						/>
						{definition.label}
					</label>
				);
			case "reference":
			case "text":
				control = (
					<Input
						{...common}
						type="text"
						value={typeof value === "string" ? value : ""}
						maxLength={config.maxLength}
						placeholder={
							definition.fieldType === "reference"
								? `Enter ${config.referenceType ?? "record"} reference`
								: undefined
						}
						onChange={(event) => set(definition.key, event.target.value)}
					/>
				);
		}

		return (
			<div key={definition.id} className="space-y-2">
				<Label htmlFor={id}>{definition.label}</Label>
				{control}
			</div>
		);
	});
}

export function serializeDynamicFields(
	definitions: Definition[],
	values: Values,
): Values {
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
