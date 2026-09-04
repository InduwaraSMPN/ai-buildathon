export interface ServiceOption {
	subcategory: { id: string; name: string; description: string | null };
	form: { id: string; name: string } | null;
}

export interface DeviceOption {
	id: string;
	hostname: string;
}

export interface FieldDefinitionOption {
	key: string;
	label: string;
	type: string;
	config?: { options?: string[] } | null;
}

export function systemPrompt(): string {
	return [
		"You are an AI support intake assistant for an IT service desk.",
		"Your job is to help an employee turn their description of a problem or request",
		"into a well-formed support ticket draft, asking clarifying questions only when",
		"strictly necessary.",
		"",
		"You should prefer deflecting to a knowledge article when one clearly answers the",
		"question, and otherwise aim to capture a concise title, a description, impact,",
		"urgency, and the affected device when evident.",
	].join("\n");
}

export function classifyContext(catalogue: readonly ServiceOption[]): string {
	if (!catalogue.length)
		return "No catalogue categories are available for request routing.";
	// The id has to be in the prompt: subcategoryId is whitelisted against this
	// same list server-side, so a reply naming only the category is discarded and
	// the request never routes. Only id, name and description go out — never the
	// form's fields, which are fetched separately once a category is chosen.
	const lines = catalogue.map(
		(option) =>
			`- id: ${option.subcategory.id} | name: ${option.subcategory.name} | ${
				option.subcategory.description ?? "no description"
			}`,
	);
	return [
		"Available catalogue categories (id, name, and description only):",
		...lines,
		"",
		"If this is a request for something to be set up, provided or installed, set",
		"subcategoryId to the matching id copied exactly from the list above. If none",
		"matches, or the employee is reporting a fault, set subcategoryId to null.",
	].join("\n");
}

export function draftContext(input: {
	message: string;
	transcript: readonly { role: "user" | "assistant"; body: string }[];
	devices: readonly DeviceOption[];
	fieldDefinitions: readonly FieldDefinitionOption[];
}): string {
	const transcriptLines = input.transcript
		.map(
			({ role, body }) =>
				`${role === "user" ? "Employee" : "Assistant"}: ${body}`,
		)
		.join("\n");
	const deviceLines = input.devices.length
		? input.devices
				.map((device) => `- ${device.id} (${device.hostname})`)
				.join("\n")
		: "None are currently enrolled.";
	const fieldLines = input.fieldDefinitions.length
		? input.fieldDefinitions
				.map(
					(def) =>
						`- ${def.key} (${def.label}, ${def.type}${
							def.config?.options?.length
								? `, options: ${def.config.options.join(", ")}`
								: ""
						})`,
				)
				.join("\n")
		: "No custom ticket fields are configured.";
	return [
		`Employee's latest message: ${input.message}`,
		"",
		"Conversation so far:",
		transcriptLines || "(none)",
		"",
		"Devices owned by the employee:",
		deviceLines,
		"",
		"Custom ticket field definitions:",
		fieldLines,
	].join("\n");
}

export function fillFormContext(
	formFields: readonly {
		key: string;
		label: string;
		type: string;
		options?: readonly string[] | null;
		isMandatory?: boolean;
		isHidden?: boolean;
		isReadonly?: boolean;
	}[],
): string {
	if (!formFields.length) return "No additional form fields are required.";
	return formFields
		.map(
			(field) =>
				`- ${field.key} (${field.label}, type ${field.type}${
					field.options?.length ? `, options: ${field.options.join(", ")}` : ""
				}${field.isMandatory ? ", mandatory" : ""}${
					field.isReadonly ? ", readonly" : ""
				})`,
		)
		.join("\n");
}
