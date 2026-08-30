import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
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
import type {
	RequestFormField,
	RequestFormValue,
} from "@/features/request-catalogue/types";

export function CatalogueField({
	field,
	value,
	onChange,
}: {
	field: RequestFormField;
	value: RequestFormValue | undefined;
	onChange: (value: RequestFormValue) => void;
}) {
	const id = `catalogue-${field.key}`;
	const descriptionId = field.description ? `${id}-description` : undefined;
	const invalid = Boolean(
		field.required &&
			(field.type === "boolean"
				? value !== true
				: value === undefined ||
					value === "" ||
					(Array.isArray(value) && !value.length)),
	);
	const label = (
		<>
			{field.label}
			{field.required ? <span aria-hidden="true"> *</span> : null}
		</>
	);

	if (field.type === "boolean") {
		return (
			<Field
				orientation="horizontal"
				data-disabled={field.readOnly || undefined}
				data-invalid={invalid}
			>
				<Checkbox
					id={id}
					name={field.key}
					checked={value === true}
					required={field.required}
					disabled={field.readOnly}
					aria-invalid={invalid}
					aria-describedby={descriptionId}
					onCheckedChange={(checked) => onChange(checked === true)}
				/>
				<FieldContent>
					<FieldLabel htmlFor={id}>{label}</FieldLabel>
					{field.description ? (
						<FieldDescription id={descriptionId}>
							{field.description}
						</FieldDescription>
					) : null}
					{invalid ? <FieldError>This field is required.</FieldError> : null}
				</FieldContent>
			</Field>
		);
	}

	const stringValue =
		typeof value === "string" || typeof value === "number" ? value : "";
	const options = field.options?.map((option) =>
		typeof option === "string" ? { label: option, value: option } : option,
	);

	return (
		<Field data-invalid={invalid}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{field.description ? (
				<FieldDescription id={descriptionId}>
					{field.description}
				</FieldDescription>
			) : null}
			{field.type === "select" ? (
				<Select
					value={String(stringValue) || null}
					onValueChange={(next) => onChange(next ?? "")}
					disabled={field.readOnly}
					required={field.required}
					name={field.key}
				>
					<SelectTrigger
						id={id}
						className="w-full"
						aria-describedby={descriptionId}
						aria-invalid={invalid}
					>
						<SelectValue placeholder="Select an option" />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{options?.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			) : field.type === "multiselect" ? (
				<NativeSelect
					id={id}
					name={field.key}
					multiple
					value={Array.isArray(value) ? value : []}
					required={field.required}
					disabled={field.readOnly}
					aria-invalid={invalid}
					aria-describedby={descriptionId}
					className="w-full [&_[data-slot=native-select]]:min-h-24 [&_[data-slot=native-select]]:py-2"
					onChange={(event) =>
						onChange(
							[...event.target.selectedOptions].map((option) => option.value),
						)
					}
				>
					{options?.map((option) => (
						<NativeSelectOption key={option.value} value={option.value}>
							{option.label}
						</NativeSelectOption>
					))}
				</NativeSelect>
			) : field.type === "textarea" ? (
				<Textarea
					id={id}
					name={field.key}
					value={String(stringValue)}
					required={field.required}
					readOnly={field.readOnly}
					aria-describedby={descriptionId}
					aria-invalid={invalid}
					minLength={field.minLength}
					maxLength={field.maxLength}
					placeholder={field.placeholder}
					onChange={(event) => onChange(event.target.value)}
					className="min-h-28"
				/>
			) : (
				<Input
					id={id}
					name={field.key}
					type={field.type}
					value={stringValue}
					required={field.required}
					readOnly={field.readOnly}
					aria-describedby={descriptionId}
					aria-invalid={invalid}
					min={field.min}
					max={field.max}
					step={field.step}
					minLength={field.minLength}
					maxLength={field.maxLength}
					placeholder={field.placeholder}
					onChange={(event) =>
						onChange(
							field.type === "number"
								? event.target.value === ""
									? ""
									: event.target.valueAsNumber
								: event.target.value,
						)
					}
				/>
			)}
			{invalid ? <FieldError>This field is required.</FieldError> : null}
		</Field>
	);
}
