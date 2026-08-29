import { useId } from "react";

export type RequestFormValue = string | number | boolean | string[];
export type RequestFormValues = Record<string, RequestFormValue>;

export type RequestFormField = {
	key: string;
	label: string;
	type:
		| "text"
		| "textarea"
		| "number"
		| "date"
		| "checkbox"
		| "select"
		| "multiselect";
	description?: string | null;
	required?: boolean;
	readOnly?: boolean;
	options?: Array<string | { label: string; value: string }>;
	min?: number;
	max?: number;
	step?: number;
	minLength?: number;
	maxLength?: number;
	placeholder?: string;
	condition?: unknown;
};

function isActive(condition: unknown, values: RequestFormValues): boolean {
	if (!condition || typeof condition !== "object" || Array.isArray(condition)) return true;
	const node = condition as Record<string, unknown>;
	if (Array.isArray(node.all)) return node.all.every((item) => isActive(item, values));
	if (Array.isArray(node.any)) return node.any.some((item) => isActive(item, values));
	if (node.not) return !isActive(node.not, values);
	if (typeof node.field !== "string") return true;
	const actual = values[node.field];
	return node.operator === "notEquals" || node.operator === "neq"
		? actual !== node.value
		: actual === node.value;
}

const controlClass =
	"h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60";

export function DynamicRequestForm({
	fields,
	values,
	onChange,
	onSubmit,
	submitLabel = "Send request",
	submitting = false,
	error,
}: {
	fields: RequestFormField[];
	values: RequestFormValues;
	onChange: (values: RequestFormValues) => void;
	onSubmit: (values: RequestFormValues) => void | Promise<void>;
	submitLabel?: string;
	submitting?: boolean;
	error?: string | null;
}) {
	const formId = useId();
	const set = (key: string, value: RequestFormValue) =>
		onChange({ ...values, [key]: value });

	return (
		<form
			className="space-y-6"
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit(values);
			}}
		>
			{fields.filter((field) => isActive(field.condition, values)).map((field) => {
				const id = `${formId}-${field.key}`;
				const descriptionId = field.description
					? `${id}-description`
					: undefined;
				const value = values[field.key];
				if (field.type === "checkbox") {
					return (
						<div key={field.key} className="space-y-1">
							<label htmlFor={id} className="flex items-start gap-3 text-sm">
								<input
									id={id}
									name={field.key}
									type="checkbox"
									checked={value === true}
									required={field.required}
									disabled={field.readOnly}
									aria-describedby={descriptionId}
									onChange={(event) => set(field.key, event.target.checked)}
									className="mt-0.5 size-4 accent-primary"
								/>
								<span>
									{field.label}
									{field.required ? <span aria-hidden="true"> *</span> : null}
								</span>
							</label>
							{field.description ? (
								<p
									id={descriptionId}
									className="pl-7 text-muted-foreground text-xs"
								>
									{field.description}
								</p>
							) : null}
						</div>
					);
				}

				const stringValue =
					typeof value === "string" || typeof value === "number" ? value : "";
				return (
					<div key={field.key} className="space-y-2">
						<label htmlFor={id} className="font-medium text-sm">
							{field.label}
							{field.required ? <span aria-hidden="true"> *</span> : null}
						</label>
						{field.description ? (
							<p id={descriptionId} className="text-muted-foreground text-xs">
								{field.description}
							</p>
						) : null}
						{field.type === "select" || field.type === "multiselect" ? (
							<select
								id={id}
								name={field.key}
								value={
									field.type === "multiselect" && Array.isArray(value)
										? value
										: stringValue
								}
								multiple={field.type === "multiselect"}
								required={field.required}
								disabled={field.readOnly}
								aria-describedby={descriptionId}
								onChange={(event) =>
									set(
										field.key,
										field.type === "multiselect"
											? [...event.target.selectedOptions].map(
													(option) => option.value,
												)
											: event.target.value,
									)
								}
								className={controlClass}
							>
								<option value="">Select an option</option>
								{field.options?.map((option) => {
									const item =
										typeof option === "string"
											? { label: option, value: option }
											: option;
									return (
										<option key={item.value} value={item.value}>
											{item.label}
										</option>
									);
								})}
							</select>
						) : field.type === "textarea" ? (
							<textarea
								id={id}
								name={field.key}
								value={stringValue}
								required={field.required}
								readOnly={field.readOnly}
								aria-describedby={descriptionId}
								minLength={field.minLength}
								maxLength={field.maxLength}
								placeholder={field.placeholder}
								onChange={(event) => set(field.key, event.target.value)}
								className={`${controlClass} min-h-28 py-2`}
							/>
						) : (
							<input
								id={id}
								name={field.key}
								type={field.type}
								value={stringValue}
								required={field.required}
								readOnly={field.readOnly}
								aria-describedby={descriptionId}
								min={field.min}
								max={field.max}
								step={field.step}
								minLength={field.minLength}
								maxLength={field.maxLength}
								placeholder={field.placeholder}
								onChange={(event) =>
									set(
										field.key,
										field.type === "number"
											? event.target.value === ""
												? ""
												: event.target.valueAsNumber
											: event.target.value,
									)
								}
								className={controlClass}
							/>
						)}
					</div>
				);
			})}
			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}
			<button
				type="submit"
				disabled={submitting}
				className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-foreground text-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
			>
				{submitting ? "Sending…" : submitLabel}
			</button>
		</form>
	);
}
