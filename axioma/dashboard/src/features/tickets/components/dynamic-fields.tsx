import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { client } from "@/utils/orpc";

export { serializeDynamicFields } from "./serialize-dynamic-fields";

type Definition = Awaited<
	ReturnType<typeof client.listFieldDefinitions>
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
	onSave,
	pending,
}: {
	definitions: Definition[];
	values: Values;
	onChange: (values: Values) => void;
	onSave: () => void;
	pending: boolean;
}) {
	if (definitions.length === 0) return null;
	const set = (key: string, value: unknown) =>
		onChange({ ...values, [key]: value });

	return (
		<section className="rounded-xl border bg-card p-4 shadow-sm">
			<h2 className="font-semibold text-xs uppercase tracking-wider">
				Custom fields
			</h2>
			<div className="mt-3 space-y-3">
				{definitions.map((definition) => {
					const config = definition.config as Config;
					const id = `custom-field-${definition.key}`;
					const value = values[definition.key];
					const common = {
						id,
						name: definition.key,
						className:
							"h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
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
											event.target.value === ""
												? ""
												: event.target.valueAsNumber,
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
									type={
										definition.fieldType === "date" ? "date" : "datetime-local"
									}
									value={
										definition.fieldType === "datetime" &&
										typeof value === "string"
											? value.slice(0, 16)
											: typeof value === "string"
												? value
												: ""
									}
									onChange={(event) => set(definition.key, event.target.value)}
								/>
							);
							break;
						case "dropdown":
						case "multiselect":
							control = (
								<select
									{...common}
									multiple={definition.fieldType === "multiselect"}
									className={
										definition.fieldType === "multiselect"
											? `${common.className} h-auto min-h-20 py-2`
											: common.className
									}
									value={
										definition.fieldType === "multiselect"
											? Array.isArray(value)
												? (value as string[])
												: []
											: typeof value === "string"
												? value
												: ""
									}
									onChange={(event) =>
										set(
											definition.key,
											definition.fieldType === "multiselect"
												? Array.from(
														event.target.selectedOptions,
														(option) => option.value,
													)
												: event.target.value,
										)
									}
								>
									{definition.fieldType === "dropdown" ? (
										<option value="">Select an option</option>
									) : null}
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
									className="flex items-center gap-2 text-xs"
								>
									<input
										id={id}
										name={definition.key}
										type="checkbox"
										checked={value === true}
										onChange={(event) =>
											set(definition.key, event.target.checked)
										}
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
						<div key={definition.id} className="space-y-1.5">
							<Label htmlFor={id} className="text-xs">
								{definition.label}
							</Label>
							{control}
						</div>
					);
				})}
				<Button type="button" size="sm" disabled={pending} onClick={onSave}>
					{pending ? "Saving…" : "Save custom fields"}
				</Button>
			</div>
		</section>
	);
}
