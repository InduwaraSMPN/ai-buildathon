// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

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

// `draft` is here so an intake attachment can be listed back after a reload and
// unlinked when the employee removes it from the tray. Without it a removed
// screenshot stayed linked and `submitIntake` re-parented it onto the ticket
// anyway. Authorisation is unchanged: `canReadTarget` scopes a draft to its
// owning reporter while the draft is still open.
const documentTargetSchema = z.object({
	targetType: z.enum(["ticket", "case_note", "draft"]),
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
