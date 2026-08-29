// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";
import { id, nullableId } from "./shared";

const articleStatus = z.enum(["draft", "published", "archived"]);

const articleAudience = z.enum(["public", "employees", "staff"]);

const knowledgeArticleSchema = z.object({
	id: z.string(),
	folderId: nullableId,
	title: z.string(),
	body: z.string(),
	summary: z.string().nullable(),
	status: articleStatus,
	audience: articleAudience,
	isRestricted: z.boolean(),
	currentVersion: z.number().int(),
	publishedAt: z.date().nullable(),
	nextReviewAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const portalKnowledgeArticleSchema = knowledgeArticleSchema.pick({
	id: true,
	title: true,
	body: true,
	summary: true,
	publishedAt: true,
	updatedAt: true,
});

export const knowledgeContract = {
	listKnowledgeArticles: oc.output(z.array(knowledgeArticleSchema)),
	getKnowledgeArticle: oc
		.input(z.object({ id }))
		.output(knowledgeArticleSchema.nullable()),
	createKnowledgeArticle: oc
		.input(
			z.object({
				title: z.string().trim().min(3).max(200),
				body: z.string().trim().min(1).max(100_000),
				summary: z.string().trim().max(1_000).optional(),
				folderId: id.optional(),
				audience: articleAudience.default("employees"),
				isRestricted: z.boolean().default(false),
			}),
		)
		.output(knowledgeArticleSchema),
	updateKnowledgeArticle: oc
		.input(
			z.object({
				id,
				title: z.string().trim().min(3).max(200).optional(),
				body: z.string().trim().min(1).max(100_000).optional(),
				summary: z.string().trim().max(1_000).nullable().optional(),
				status: articleStatus.optional(),
				audience: articleAudience.optional(),
				isRestricted: z.boolean().optional(),
			}),
		)
		.output(knowledgeArticleSchema),
	listPublicKnowledge: oc.output(z.array(portalKnowledgeArticleSchema)),
	getPublicKnowledgeArticle: oc
		.input(z.object({ id }))
		.output(portalKnowledgeArticleSchema.nullable()),
};
