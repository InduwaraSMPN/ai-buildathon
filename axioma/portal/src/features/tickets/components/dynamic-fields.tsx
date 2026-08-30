import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { client } from "@/utils/orpc";

export { serializeDynamicFields } from "./serialize-dynamic-fields";

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
						id={id}
						name={definition.key}
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
						id={id}
						name={definition.key}
						type={definition.fieldType === "date" ? "date" : "datetime-local"}
						value={typeof value === "string" ? value : ""}
						onChange={(event) => set(definition.key, event.target.value)}
					/>
				);
				break;
			case "dropdown":
				control = (
					<Select
						name={definition.key}
						value={typeof value === "string" && value ? value : null}
						onValueChange={(next) => set(definition.key, next ?? "")}
					>
						<SelectTrigger id={id} className="w-full">
							<SelectValue placeholder="Select an option" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{config.options?.map((option) => (
									<SelectItem key={option} value={option}>
										{option}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				);
				break;
			case "multiselect":
				control = (
					<NativeSelect
						id={id}
						name={definition.key}
						multiple
						className="w-full [&_[data-slot=native-select]]:min-h-24 [&_[data-slot=native-select]]:py-2"
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
							<NativeSelectOption key={option} value={option}>
								{option}
							</NativeSelectOption>
						))}
					</NativeSelect>
				);
				break;
			case "checkbox":
				return (
					<Field key={definition.id} orientation="horizontal">
						<Checkbox
							id={id}
							name={definition.key}
							checked={value === true}
							onCheckedChange={(checked) =>
								set(definition.key, checked === true)
							}
						/>
						<FieldContent>
							<FieldLabel htmlFor={id}>{definition.label}</FieldLabel>
						</FieldContent>
					</Field>
				);
			case "reference":
			case "text":
				control = (
					<Input
						id={id}
						name={definition.key}
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
			<Field key={definition.id}>
				<FieldLabel htmlFor={id}>{definition.label}</FieldLabel>
				{control}
			</Field>
		);
	});
}
