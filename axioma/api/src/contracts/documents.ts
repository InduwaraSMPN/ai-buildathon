import { z } from "zod";

export const documentSchema = z.discriminatedUnion("kind", [
	z.object({
		id: z.string(),
		kind: z.literal("file"),
		displayName: z.string(),
		mediaType: z.string().nullable(),
		downloadUrl: z.string(),
	}),
	z.object({
		id: z.string(),
		kind: z.literal("link"),
		displayName: z.string(),
		url: z.url(),
	}),
]);

export const createLinkDocumentSchema = z.object({
	displayName: z.string().trim().min(1).max(255),
	url: z
		.url()
		.refine(
			(url) => ["http:", "https:"].includes(new URL(url).protocol),
			"Only HTTP(S) links are supported",
		),
});

export const documentTargetSchema = z.object({
	targetType: z.enum(["ticket", "case_note"]),
	targetId: z.string().min(1),
});
