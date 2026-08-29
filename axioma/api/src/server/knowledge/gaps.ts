import { createHash } from "node:crypto";
import { eq, inArray, isNotNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
	knowledgeArticles,
	knowledgeGapClusters,
	knowledgeGapTickets,
} from "@/db/schema/knowledge";
import { tickets } from "@/db/schema/tickets";
import { ticketStatuses } from "@/db/schema/vocabulary";

const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"for",
	"in",
	"is",
	"of",
	"on",
	"the",
	"to",
	"with",
]);

export type GapTicket = { id: string; title: string };
export type PublishedArticle = {
	title: string;
	body: string;
	summary?: string | null;
};

export function normalizeKnowledgeText(value: string): string {
	return value
		.normalize("NFKD")
		.toLocaleLowerCase("en-US")
		.replace(/\p{Mark}/gu, "")
		.replace(/[^\p{Letter}\p{Number}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

const keywords = (value: string) => [
	...new Set(
		normalizeKnowledgeText(value)
			.split(" ")
			.filter((word) => word.length > 1 && !STOP_WORDS.has(word)),
	),
];

export function planKnowledgeGaps(
	resolvedTickets: readonly GapTicket[],
	publishedArticles: readonly PublishedArticle[],
) {
	const articleWords = publishedArticles.map(
		(article) =>
			new Set(
				normalizeKnowledgeText(
					`${article.title} ${article.summary ?? ""} ${article.body}`,
				).split(" "),
			),
	);
	const groups = new Map<string, GapTicket[]>();

	for (const ticket of [...resolvedTickets].sort((a, b) =>
		a.id.localeCompare(b.id),
	)) {
		const key = normalizeKnowledgeText(ticket.title);
		const terms = keywords(ticket.title);
		if (
			!key ||
			(terms.length &&
				articleWords.some((words) => terms.every((word) => words.has(word))))
		) {
			continue;
		}
		groups.set(key, [...(groups.get(key) ?? []), ticket]);
	}

	// ponytail: Exact normalized-title clustering misses synonyms; replace with embeddings only when measured recall warrants it.
	return [...groups.entries()].map(([key, groupedTickets]) => ({
		id: `knowledge-gap-${createHash("sha256").update(key).digest("hex").slice(0, 24)}`,
		label: groupedTickets[0]?.title.trim() ?? key,
		keywords: keywords(key),
		ticketIds: groupedTickets.map(({ id }) => id),
	}));
}

/** Idempotently records unresolved knowledge gaps for resolved or closed tickets. */
export async function sweepKnowledgeGaps() {
	return db.transaction(async (tx) => {
		const [resolvedTickets, publishedArticles] = await Promise.all([
			tx
				.select({ id: tickets.id, title: tickets.title })
				.from(tickets)
				.where(
					or(
						inArray(
							tickets.status,
							tx
								.select({ key: ticketStatuses.key })
								.from(ticketStatuses)
								.where(
									inArray(ticketStatuses.stateType, ["resolved", "closed"]),
								),
						),
						isNotNull(tickets.resolvedAt),
					),
				),
			tx
				.select({
					title: knowledgeArticles.title,
					body: knowledgeArticles.body,
					summary: knowledgeArticles.summary,
				})
				.from(knowledgeArticles)
				.where(eq(knowledgeArticles.status, "published")),
		]);
		const gaps = planKnowledgeGaps(resolvedTickets, publishedArticles);
		let clustersCreated = 0;
		let linksCreated = 0;

		for (const gap of gaps) {
			const cluster = await tx
				.insert(knowledgeGapClusters)
				.values({ id: gap.id, label: gap.label, keywords: gap.keywords })
				.onConflictDoNothing({ target: knowledgeGapClusters.id })
				.returning({ id: knowledgeGapClusters.id });
			clustersCreated += cluster.length;

			const links = await tx
				.insert(knowledgeGapTickets)
				.values(
					gap.ticketIds.map((ticketId) => ({ clusterId: gap.id, ticketId })),
				)
				.onConflictDoNothing({
					target: [knowledgeGapTickets.clusterId, knowledgeGapTickets.ticketId],
				})
				.returning({ ticketId: knowledgeGapTickets.ticketId });
			linksCreated += links.length;
		}

		return { clustersCreated, linksCreated };
	});
}
