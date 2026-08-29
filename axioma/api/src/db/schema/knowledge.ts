import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	vector,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { tickets } from "./tickets";

export const knowledgeFolders = pgTable(
	"knowledge_folders",
	{
		id: text("id").primaryKey(),
		parentId: text("parent_id").references(
			(): AnyPgColumn => knowledgeFolders.id,
			{ onDelete: "set null" },
		),
		name: text("name").notNull(),
		description: text("description"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		index("knowledge_folders_parent_idx").on(t.parentId),
		uniqueIndex("knowledge_folders_parent_name_uidx").on(t.parentId, t.name),
	],
);

export const knowledgeArticles = pgTable(
	"knowledge_articles",
	{
		id: text("id").primaryKey(),
		folderId: text("folder_id").references(() => knowledgeFolders.id, {
			onDelete: "set null",
		}),
		authorId: text("author_id").references(() => user.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		body: text("body").notNull(),
		summary: text("summary"),
		// draft -> published -> archived
		status: text("status", { enum: ["draft", "published", "archived"] })
			.notNull()
			.default("draft"),
		// public -> employees -> staff
		audience: text("audience", { enum: ["public", "employees", "staff"] })
			.notNull()
			.default("employees"),
		isRestricted: boolean("is_restricted").notNull().default(false),
		currentVersion: integer("current_version").notNull().default(1),
		// OpenAI text-embedding-3-small dimensions; lexical search remains usable when null.
		embedding: vector("embedding", { dimensions: 1536 }),
		embeddingModel: text("embedding_model"),
		metadata: jsonb("metadata"),
		publishedAt: timestamp("published_at"),
		nextReviewAt: timestamp("next_review_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		index("knowledge_articles_folder_idx").on(t.folderId),
		index("knowledge_articles_publication_idx").on(
			t.status,
			t.audience,
			t.isRestricted,
		),
		index("knowledge_articles_lexical_idx").using(
			"gin",
			sql`to_tsvector('english', coalesce(${t.title}, '') || ' ' || coalesce(${t.body}, ''))`,
		),
	],
);

export const knowledgeArticleVersions = pgTable(
	"knowledge_article_versions",
	{
		id: text("id").primaryKey(),
		articleId: text("article_id")
			.notNull()
			.references(() => knowledgeArticles.id, { onDelete: "cascade" }),
		version: integer("version").notNull(),
		title: text("title").notNull(),
		body: text("body").notNull(),
		summary: text("summary"),
		authorId: text("author_id").references(() => user.id, {
			onDelete: "set null",
		}),
		changeNote: text("change_note"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("knowledge_article_versions_article_version_uidx").on(
			t.articleId,
			t.version,
		),
	],
);

export const knowledgeTags = pgTable("knowledge_tags", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
});

export const knowledgeArticleTags = pgTable(
	"knowledge_article_tags",
	{
		articleId: text("article_id")
			.notNull()
			.references(() => knowledgeArticles.id, { onDelete: "cascade" }),
		tagId: text("tag_id")
			.notNull()
			.references(() => knowledgeTags.id, { onDelete: "cascade" }),
	},
	(t) => [primaryKey({ columns: [t.articleId, t.tagId] })],
);

/** Restricted article/folder grants. `principalId` names a user, team, or role. */
export const knowledgeAcl = pgTable(
	"knowledge_acl",
	{
		id: text("id").primaryKey(),
		articleId: text("article_id").references(() => knowledgeArticles.id, {
			onDelete: "cascade",
		}),
		folderId: text("folder_id").references(() => knowledgeFolders.id, {
			onDelete: "cascade",
		}),
		principalType: text("principal_type", {
			enum: ["user", "team", "role"],
		}).notNull(),
		principalId: text("principal_id").notNull(),
		permission: text("permission", { enum: ["read", "edit", "manage"] })
			.notNull()
			.default("read"),
	},
	(t) => [
		check(
			"knowledge_acl_one_target_check",
			sql`(${t.articleId} is not null) <> (${t.folderId} is not null)`,
		),
		uniqueIndex("knowledge_acl_article_grant_uidx")
			.on(t.articleId, t.principalType, t.principalId, t.permission)
			.where(sql`${t.articleId} is not null`),
		uniqueIndex("knowledge_acl_folder_grant_uidx")
			.on(t.folderId, t.principalType, t.principalId, t.permission)
			.where(sql`${t.folderId} is not null`),
		index("knowledge_acl_article_idx").on(t.articleId),
		index("knowledge_acl_folder_idx").on(t.folderId),
		index("knowledge_acl_principal_idx").on(t.principalType, t.principalId),
	],
);

export const knowledgeGapClusters = pgTable(
	"knowledge_gap_clusters",
	{
		id: text("id").primaryKey(),
		label: text("label").notNull(),
		description: text("description"),
		keywords: text("keywords").array(),
		// open -> addressed -> dismissed
		status: text("status", { enum: ["open", "addressed", "dismissed"] })
			.notNull()
			.default("open"),
		articleId: text("article_id").references(() => knowledgeArticles.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [index("knowledge_gap_clusters_status_idx").on(t.status, t.createdAt)],
);

export const knowledgeGapTickets = pgTable(
	"knowledge_gap_tickets",
	{
		clusterId: text("cluster_id")
			.notNull()
			.references(() => knowledgeGapClusters.id, { onDelete: "cascade" }),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.clusterId, t.ticketId] }),
		index("knowledge_gap_tickets_ticket_idx").on(t.ticketId),
	],
);
