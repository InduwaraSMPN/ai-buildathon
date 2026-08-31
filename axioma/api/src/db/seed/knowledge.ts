/**
 * Knowledge seed — folders, articles, versions, tags, article-tag links, ACL.
 */

import { db } from "@/db";
import {
	knowledgeAcl,
	knowledgeArticles,
	knowledgeArticleTags,
	knowledgeArticleVersions,
	knowledgeFolders,
	knowledgeTags,
} from "@/db/schema/knowledge";
import {
	DEMO_USERS,
	daysFromEpoch,
	KNOWLEDGE_ARTICLES,
	KNOWLEDGE_FOLDERS,
	KNOWLEDGE_TAGS,
} from "./data";

export async function seedKnowledge(): Promise<void> {
	await db.transaction(async (tx) => {
		// Tags first
		for (const tag of KNOWLEDGE_TAGS) {
			await tx
				.insert(knowledgeTags)
				.values({ id: tag.id, name: tag.name })
				.onConflictDoNothing();
		}

		// Folders — parents first
		const orderedFolders = [...KNOWLEDGE_FOLDERS].sort((a, b) => {
			if (a.parentId === null && b.parentId !== null) return -1;
			if (a.parentId !== null && b.parentId === null) return 1;
			return 0;
		});
		for (const folder of orderedFolders) {
			const createdAt = daysFromEpoch(2, 9);
			await tx
				.insert(knowledgeFolders)
				.values({
					id: folder.id,
					parentId: folder.parentId,
					name: folder.name,
					description: folder.description,
					createdAt,
					updatedAt: createdAt,
				})
				.onConflictDoNothing();
		}

		// Articles + versions
		for (let i = 0; i < KNOWLEDGE_ARTICLES.length; i++) {
			const art = KNOWLEDGE_ARTICLES[i]!;
			const author = DEMO_USERS[i % DEMO_USERS.length]!;
			const createdAt = daysFromEpoch(3 + i, 9);
			const updatedAt = daysFromEpoch(3 + i, 10);
			const publishedAt =
				art.status === "published" ? daysFromEpoch(4 + i, 9) : null;
			const nextReviewAt =
				art.status === "published" ? daysFromEpoch(90 + i, 9) : null;

			await tx
				.insert(knowledgeArticles)
				.values({
					id: art.id,
					folderId: art.folderId,
					authorId: author.id,
					title: art.title,
					body: art.body,
					summary: art.summary,
					status: art.status,
					audience: art.audience,
					isRestricted: art.isRestricted,
					currentVersion: art.id === "demo-kb-article-01" ? 2 : 1,
					publishedAt,
					nextReviewAt,
					createdAt,
					updatedAt,
				})
				// Upsert rather than skip, so edits to the fixtures (audience,
				// status, copy) propagate to rows an earlier run already created.
				.onConflictDoUpdate({
					target: knowledgeArticles.id,
					set: {
						title: art.title,
						body: art.body,
						summary: art.summary,
						status: art.status,
						audience: art.audience,
						isRestricted: art.isRestricted,
						publishedAt,
						nextReviewAt,
						updatedAt,
					},
				});

			// Versions — for 01 we have 2 versions, others 1
			const versions =
				art.id === "demo-kb-article-01"
					? [
							{
								version: 1,
								title: art.title,
								body: art.body.replace(
									"Keychain / Credential Manager",
									"Keychain",
								),
								changeNote: "Initial version",
							},
							{
								version: 2,
								title: art.title,
								body: art.body,
								changeNote: "Added Windows Credential Manager steps",
							},
						]
					: [
							{
								version: 1,
								title: art.title,
								body: art.body,
								changeNote: "Initial version",
							},
						];

			for (const v of versions) {
				const versionId = `demo-kb-version-${art.id}-${v.version}`;
				await tx
					.insert(knowledgeArticleVersions)
					.values({
						id: versionId,
						articleId: art.id,
						version: v.version,
						title: v.title,
						body: v.body,
						summary: art.summary,
						authorId: author.id,
						changeNote: v.changeNote,
						createdAt: v.version === 1 ? createdAt : daysFromEpoch(20, 10),
					})
					.onConflictDoNothing();
			}

			// Tags linkage
			for (const tagId of art.tags) {
				await tx
					.insert(knowledgeArticleTags)
					.values({ articleId: art.id, tagId })
					.onConflictDoNothing();
			}
		}

		// ACL — restricted articles get grants to staff teams/roles
		// Article 11 (split-tunnel) restricted to Platform Engineering team
		await tx
			.insert(knowledgeAcl)
			.values({
				id: "demo-kb-acl-01",
				articleId: "demo-kb-article-11",
				principalType: "team",
				principalId: "demo-team-platform",
				permission: "read",
			})
			.onConflictDoNothing();

		// Article 13 (data classification draft) restricted to staff role — use role id?
		// ACL principalId can be role id; grant to platform-engineer role
		await tx
			.insert(knowledgeAcl)
			.values({
				id: "demo-kb-acl-02",
				articleId: "demo-kb-article-13",
				principalType: "role",
				principalId: "platform-engineer",
				permission: "read",
			})
			.onConflictDoNothing();

		// Folder 03 restricted folder ACL
		await tx
			.insert(knowledgeAcl)
			.values({
				id: "demo-kb-acl-03",
				folderId: "demo-kb-folder-03",
				principalType: "team",
				principalId: "demo-team-platform",
				permission: "read",
			})
			.onConflictDoNothing();
	});

	console.log("[seed:knowledge] seeded folders, articles, versions, tags, ACL");
}
