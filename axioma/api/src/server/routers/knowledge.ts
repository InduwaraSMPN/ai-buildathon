import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeArticles, knowledgeArticleVersions } from "@/db/schema";
import { capabilityProcedure, reporterProcedure } from "../orpc";

const publicKnowledgeFilter = and(
	eq(knowledgeArticles.status, "published"),
	eq(knowledgeArticles.audience, "public"),
	eq(knowledgeArticles.isRestricted, false),
);

const publicArticleSelection = {
	id: knowledgeArticles.id,
	title: knowledgeArticles.title,
	body: knowledgeArticles.body,
	summary: knowledgeArticles.summary,
	publishedAt: knowledgeArticles.publishedAt,
	updatedAt: knowledgeArticles.updatedAt,
};

const aclVisible = (userId: string) =>
	sql`(${knowledgeArticles.isRestricted} = false OR EXISTS (SELECT 1 FROM knowledge_acl acl WHERE acl.article_id = ${knowledgeArticles.id} AND acl.principal_type = 'user' AND acl.principal_id = ${userId} AND acl.permission IN ('read', 'edit', 'manage')))`;

const articleSelection = {
	id: knowledgeArticles.id,
	folderId: knowledgeArticles.folderId,
	title: knowledgeArticles.title,
	body: knowledgeArticles.body,
	summary: knowledgeArticles.summary,
	status: knowledgeArticles.status,
	audience: knowledgeArticles.audience,
	isRestricted: knowledgeArticles.isRestricted,
	currentVersion: knowledgeArticles.currentVersion,
	publishedAt: knowledgeArticles.publishedAt,
	nextReviewAt: knowledgeArticles.nextReviewAt,
	createdAt: knowledgeArticles.createdAt,
	updatedAt: knowledgeArticles.updatedAt,
};

export const knowledgeRouter = {
	listKnowledgeArticles: capabilityProcedure(
		"knowledge.read",
	).listKnowledgeArticles.handler(({ context }) =>
		db
			.select(articleSelection)
			.from(knowledgeArticles)
			.where(aclVisible(context.userId))
			.orderBy(desc(knowledgeArticles.updatedAt)),
	),
	getKnowledgeArticle: capabilityProcedure(
		"knowledge.read",
	).getKnowledgeArticle.handler(
		async ({ context, input }) =>
			(
				await db
					.select(articleSelection)
					.from(knowledgeArticles)
					.where(
						and(eq(knowledgeArticles.id, input.id), aclVisible(context.userId)),
					)
					.limit(1)
			)[0] ?? null,
	),
	createKnowledgeArticle: capabilityProcedure(
		"knowledge.manage",
	).createKnowledgeArticle.handler(async ({ context, input }) => {
		const id = crypto.randomUUID();
		return db.transaction(async (tx) => {
			const row = (
				await tx
					.insert(knowledgeArticles)
					.values({ id, ...input, authorId: context.userId })
					.returning(articleSelection)
			)[0];
			if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
			await tx.insert(knowledgeArticleVersions).values({
				id: crypto.randomUUID(),
				articleId: id,
				version: 1,
				title: input.title,
				body: input.body,
				summary: input.summary,
				authorId: context.userId,
			});
			return row;
		});
	}),
	updateKnowledgeArticle: capabilityProcedure(
		"knowledge.manage",
	).updateKnowledgeArticle.handler(
		async ({ context, input: { id, ...patch } }) => {
			const now = new Date();
			return db.transaction(async (tx) => {
				const current = (
					await tx
						.select()
						.from(knowledgeArticles)
						.where(eq(knowledgeArticles.id, id))
						.limit(1)
				)[0];
				if (!current) throw new ORPCError("NOT_FOUND");
				const contentChanged =
					patch.title !== undefined ||
					patch.body !== undefined ||
					patch.summary !== undefined;
				const nextVersion = contentChanged
					? current.currentVersion + 1
					: current.currentVersion;
				if (contentChanged)
					await tx.insert(knowledgeArticleVersions).values({
						id: crypto.randomUUID(),
						articleId: id,
						version: nextVersion,
						title: patch.title ?? current.title,
						body: patch.body ?? current.body,
						summary:
							patch.summary === undefined ? current.summary : patch.summary,
						authorId: context.userId,
					});
				const row = (
					await tx
						.update(knowledgeArticles)
						.set({
							...patch,
							currentVersion: nextVersion,
							...(patch.status === "published" ? { publishedAt: now } : {}),
							updatedAt: now,
						})
						.where(eq(knowledgeArticles.id, id))
						.returning(articleSelection)
				)[0];
				if (!row) throw new ORPCError("NOT_FOUND");
				return row;
			});
		},
	),
	listPublicKnowledge: reporterProcedure.listPublicKnowledge.handler(() =>
		db
			.select(publicArticleSelection)
			.from(knowledgeArticles)
			.where(publicKnowledgeFilter)
			.orderBy(desc(knowledgeArticles.publishedAt)),
	),
	getPublicKnowledgeArticle:
		reporterProcedure.getPublicKnowledgeArticle.handler(
			async ({ input }) =>
				(
					await db
						.select(publicArticleSelection)
						.from(knowledgeArticles)
						.where(
							and(eq(knowledgeArticles.id, input.id), publicKnowledgeFilter),
						)
						.limit(1)
				)[0] ?? null,
		),
};
