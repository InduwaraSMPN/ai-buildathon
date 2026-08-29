import { oc } from "@orpc/contract";
import { z } from "zod";

const createLinkDocumentSchema = z.object({
	displayName: z.string().trim().min(1).max(255),
	url: z
		.url()
		.refine(
			(url) => ["http:", "https:"].includes(new URL(url).protocol),
			"Only HTTP(S) links are supported",
		),
});

const documentSchema = z.discriminatedUnion("kind", [
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

const documentTargetSchema = z.object({
	targetType: z.enum(["ticket", "case_note"]),
	targetId: z.string().min(1),
});

export const documentsContract = {
	listDocuments: oc.input(documentTargetSchema).output(z.array(documentSchema)),
	createLinkDocument: oc
		.input(createLinkDocumentSchema.extend(documentTargetSchema.shape))
		.output(documentSchema),
	unlinkDocument: oc
		.input(
			z.object({
				documentId: z.string().min(1),
				...documentTargetSchema.shape,
			}),
		)
		.output(z.object({ deleted: z.boolean() })),
};
