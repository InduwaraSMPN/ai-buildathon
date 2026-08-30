import type z from "zod";

export function createTicketFormSchemas(schema: typeof z) {
	return {
		reply: schema.object({
			body: schema
				.string()
				.trim()
				.min(1, "Please enter a reply.")
				.max(10_000, "Please keep your reply to 10,000 characters or fewer."),
		}),
		csat: schema.object({
			rating: schema
				.number()
				.int()
				.min(1, "Please select a rating.")
				.max(5, "Please select a rating from 1 to 5."),
			comment: schema
				.string()
				.max(2_000, "Please keep your feedback to 2,000 characters or fewer."),
		}),
		addDetail: schema.object({
			note: schema
				.string()
				.trim()
				.min(1, "Please add a note.")
				.max(2_000, "Please keep the note to 2,000 characters or fewer."),
		}),
	};
}

export async function submitThenReset<T>(
	submit: () => Promise<T>,
	reset: () => void,
	afterReset?: () => void,
) {
	const result = await submit();
	reset();
	afterReset?.();
	return result;
}
