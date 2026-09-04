import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const DOCUMENT_KINDS = ["file", "link"] as const;
export const DOCUMENT_TARGET_TYPES = ["ticket", "case_note", "draft"] as const;

export const documents = pgTable(
	"documents",
	{
		id: text("id").primaryKey(),
		kind: text("kind", { enum: DOCUMENT_KINDS }).notNull(),
		displayName: text("display_name").notNull(),
		mediaType: text("media_type"),
		sha256: text("sha256"),
		storedFilename: text("stored_filename"),
		url: text("url"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("documents_sha256_uidx").on(t.sha256),
		uniqueIndex("documents_stored_filename_uidx").on(t.storedFilename),
		index("documents_created_at_idx").on(t.createdAt),
	],
);

/** Links are permissions: visibility is resolved from each target whenever the document is read. */
export const documentLinks = pgTable(
	"document_links",
	{
		id: text("id").primaryKey(),
		documentId: text("document_id")
			.notNull()
			.references(() => documents.id, { onDelete: "cascade" }),
		targetType: text("target_type", { enum: DOCUMENT_TARGET_TYPES }).notNull(),
		targetId: text("target_id").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("document_links_target_uidx").on(
			t.documentId,
			t.targetType,
			t.targetId,
		),
		index("document_links_target_idx").on(t.targetType, t.targetId),
	],
);
