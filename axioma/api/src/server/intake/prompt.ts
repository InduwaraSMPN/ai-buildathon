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

/**
 * The prompt is rebuilt from nothing on every turn, so anything unbounded in it
 * makes turn N cost O(N): the whole transcript and the whole catalogue were
 * re-serialised each time, and a single message may be 10,000 characters.
 *
 * Sixteen entries is eight exchanges, well past the one or two clarifying
 * questions the intake flow is designed to ask; 1,500 characters keeps an
 * ordinary message whole while capping the worst case; and forty catalogue
 * lines is a shortlist the model can actually read, where a large customer's
 * full catalogue is not. Four-letter terms are the shortest worth matching a
 * category name against — "the" and "and" match everything and rank nothing.
 */
const MAX_TRANSCRIPT_ENTRIES = 16;
const MAX_TRANSCRIPT_ENTRY_CHARS = 1_500;
const MAX_CATALOGUE_OPTIONS = 40;
const MIN_MATCH_TERM_LENGTH = 4;

const truncated = (body: string) =>
	body.length > MAX_TRANSCRIPT_ENTRY_CHARS
		? `${body.slice(0, MAX_TRANSCRIPT_ENTRY_CHARS)}… (truncated)`
		: body;

/**
 * Narrows a large catalogue to the categories whose name or description shares
 * a word with what the employee just wrote. The fallback matters as much as the
 * filter: the model routes from this list and nothing else, so a message that
 * matches no wording still has to be shown a catalogue.
 */
function shortlistCatalogue(
	catalogue: readonly ServiceOption[],
	message: string,
): readonly ServiceOption[] {
	if (catalogue.length <= MAX_CATALOGUE_OPTIONS) return catalogue;
	const terms = new Set(
		message
			.toLowerCase()
			.split(/[^\p{L}\p{N}]+/u)
			.filter((word) => word.length >= MIN_MATCH_TERM_LENGTH),
	);
	const scored = terms.size
		? catalogue
				.map((option) => {
					const haystack =
						`${option.subcategory.name} ${option.subcategory.description ?? ""}`.toLowerCase();
					let score = 0;
					for (const term of terms) if (haystack.includes(term)) score += 1;
					return { option, score };
				})
				.filter((entry) => entry.score > 0)
				// Sorting is stable, so equally-matching categories keep the
				// alphabetical order the caller queried them in.
				.sort((first, second) => second.score - first.score)
				.map((entry) => entry.option)
		: [];
	return (scored.length ? scored : catalogue).slice(0, MAX_CATALOGUE_OPTIONS);
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

export function classifyContext(
	catalogue: readonly ServiceOption[],
	message: string,
): string {
	if (!catalogue.length)
		return "No catalogue categories are available for request routing.";
	// The id has to be in the prompt: subcategoryId is whitelisted against this
	// same list server-side, so a reply naming only the category is discarded and
	// the request never routes. Only id, name and description go out — never the
	// form's fields, which are fetched separately once a category is chosen.
	const lines = shortlistCatalogue(catalogue, message).map(
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
		.slice(-MAX_TRANSCRIPT_ENTRIES)
		.map(
			({ role, body }) =>
				`${role === "user" ? "Employee" : "Assistant"}: ${truncated(body)}`,
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
