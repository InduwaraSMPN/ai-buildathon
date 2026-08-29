import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	approvals,
	changeCabMembers,
	changeCabVotes,
	changes,
	changeTicketLinks,
	formFields,
	formSubmissions,
	forms,
	knowledgeArticles,
	knowledgeArticleVersions,
	serviceFamilies,
	serviceSubcategories,
	services,
	ticketNumberCounters,
	tickets,
	user,
} from "@/db/schema";
import { canChangeProceed, changeApproval } from "../changes";
import { validateFormSubmission } from "../forms";
import { capabilityProcedure, reporterProcedure } from "../orpc";
import {
	closeProblem,
	createProblem,
	getProblem,
	linkProblemTickets,
	listLinkedPublishedWorkarounds,
	listProblems,
	updateProblem,
} from "../problems";
import { attachTicketStopwatches } from "../sla/runtime";

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

const publicArticleSelection = {
	id: knowledgeArticles.id,
	title: knowledgeArticles.title,
	body: knowledgeArticles.body,
	summary: knowledgeArticles.summary,
	publishedAt: knowledgeArticles.publishedAt,
	updatedAt: knowledgeArticles.updatedAt,
};

async function getChange(id: string) {
	const change = (
		await db.select().from(changes).where(eq(changes.id, id)).limit(1)
	)[0];
	if (!change) return null;
	const [links, members] = await Promise.all([
		db
			.select({ ticketId: changeTicketLinks.ticketId })
			.from(changeTicketLinks)
			.where(eq(changeTicketLinks.changeId, id)),
		db
			.select({
				id: changeCabMembers.id,
				userId: changeCabMembers.userId,
				isRequired: changeCabMembers.isRequired,
				vote: changeCabVotes.vote,
				voteComment: changeCabVotes.comment,
				voteAt: changeCabVotes.votedAt,
			})
			.from(changeCabMembers)
			.leftJoin(
				changeCabVotes,
				eq(changeCabVotes.memberId, changeCabMembers.id),
			)
			.where(eq(changeCabMembers.changeId, id)),
	]);
	return {
		...change,
		ticketIds: links.map(({ ticketId }) => ticketId),
		cabMembers: members,
	};
}

async function requireChange(id: string) {
	const change = await getChange(id);
	if (!change) throw new ORPCError("NOT_FOUND");
	return change;
}

const publicKnowledgeFilter = and(
	eq(knowledgeArticles.status, "published"),
	eq(knowledgeArticles.audience, "public"),
	eq(knowledgeArticles.isRestricted, false),
);

export const tier2Router = {
	listCatalogue: capabilityProcedure("catalogue.manage").listCatalogue.handler(
		async () => {
			const [families, serviceRows, subcategories] = await Promise.all([
				db.select().from(serviceFamilies).orderBy(serviceFamilies.name),
				db.select().from(services).orderBy(services.name),
				db
					.select()
					.from(serviceSubcategories)
					.orderBy(serviceSubcategories.name),
			]);
			return { families, services: serviceRows, subcategories };
		},
	),
	listProblems: capabilityProcedure("problem.manage").listProblems.handler(() =>
		listProblems(),
	),
	getProblem: capabilityProcedure("problem.manage").getProblem.handler(
		({ input }) => getProblem(input.id),
	),
	createProblem: capabilityProcedure("problem.manage").createProblem.handler(
		({ input }) => createProblem(input),
	),
	updateProblem: capabilityProcedure("problem.manage").updateProblem.handler(
		({ input: { id, ...patch } }) => updateProblem(id, patch),
	),
	linkProblemTickets: capabilityProcedure(
		"problem.manage",
	).linkProblemTickets.handler(({ input }) =>
		linkProblemTickets(input.problemId, input.ticketIds),
	),
	closeProblem: capabilityProcedure("problem.manage").closeProblem.handler(
		({ input }) => closeProblem(input.id, input.resolution),
	),
	getTicketServiceRecords: capabilityProcedure(
		"ticket.read.all",
	).getTicketServiceRecords.handler(async ({ input }) => ({
		problems: (await listLinkedPublishedWorkarounds(input.ticketId)).map(
			(problem) => ({
				id: problem.problemId,
				problemNumber: problem.problemNumber,
				title: problem.title,
				workaround: problem.workaround,
				isKnownError: true,
			}),
		),
		changes: await db
			.select({
				id: changes.id,
				changeNumber: changes.changeNumber,
				title: changes.title,
				status: changes.status,
				changeType: changes.changeType,
			})
			.from(changeTicketLinks)
			.innerJoin(changes, eq(changeTicketLinks.changeId, changes.id))
			.where(eq(changeTicketLinks.ticketId, input.ticketId)),
	})),

	listChanges: capabilityProcedure("change.manage").listChanges.handler(() =>
		db.select().from(changes).orderBy(desc(changes.createdAt)),
	),
	getChange: capabilityProcedure("change.manage").getChange.handler(
		({ input }) => getChange(input.id),
	),
	createChange: capabilityProcedure("change.manage").createChange.handler(
		async ({ context, input }) => {
			const id = crypto.randomUUID();
			const year = String(new Date().getUTCFullYear());
			const cabRequired = true;
			await db.transaction(async (tx) => {
				const counter = (
					await tx
						.insert(ticketNumberCounters)
						.values({ prefix: "CHG", year, lastValue: 1 })
						.onConflictDoUpdate({
							target: [ticketNumberCounters.prefix, ticketNumberCounters.year],
							set: { lastValue: sql`${ticketNumberCounters.lastValue} + 1` },
						})
						.returning({ value: ticketNumberCounters.lastValue })
				)[0];
				if (!counter) throw new ORPCError("INTERNAL_SERVER_ERROR");
				await tx.insert(changes).values({
					id,
					changeNumber: `CHG-${year}-${String(counter.value).padStart(5, "0")}`,
					title: input.title,
					description: input.description,
					reasonForChange: input.reasonForChange,
					changeType: input.changeType,
					status: "pending_approval",
					testPlan: input.testPlan,
					rollbackPlan: input.rollbackPlan,
					cabRequired,
					requesterId: context.userId,
					createdById: context.userId,
				});
				const memberIds = [...new Set(input.cabMemberIds)];
				if (memberIds.length)
					await tx.insert(changeCabMembers).values(
						memberIds.map((userId) => ({
							id: crypto.randomUUID(),
							changeId: id,
							userId,
						})),
					);
				const ticketIds = [...new Set(input.ticketIds)];
				if (ticketIds.length)
					await tx.insert(changeTicketLinks).values(
						ticketIds.map((ticketId) => ({
							id: crypto.randomUUID(),
							changeId: id,
							ticketId,
						})),
					);
			});
			return requireChange(id);
		},
	),
	updateChange: capabilityProcedure("change.manage").updateChange.handler(
		async ({ input: { id, status, ...pir } }) => {
			const current = await requireChange(id);
			if (
				status === "in_progress" &&
				current.changeType !== "standard" &&
				!canChangeProceed(
					current.changeType,
					current.cabMembers,
					current.cabRequired,
					current.cabApprovalType,
				)
			)
				throw new ORPCError("CONFLICT", {
					message: "This change requires CAB approval before work starts",
				});
			if (
				status === "completed" &&
				!(pir.pirWasSuccessful ?? current.pirWasSuccessful) &&
				!(pir.pirLessonsLearned ?? current.pirLessonsLearned)
			)
				throw new ORPCError("BAD_REQUEST", {
					message: "A completed change requires a post-implementation review",
				});
			const patch = {
				...pir,
				...(status ? { status } : {}),
				updatedAt: new Date(),
			};
			const updated = await db
				.update(changes)
				.set(patch)
				.where(eq(changes.id, id))
				.returning({ id: changes.id });
			if (!updated[0]) throw new ORPCError("NOT_FOUND");
			return requireChange(id);
		},
	),
	voteOnChange: capabilityProcedure("change.approve").voteOnChange.handler(
		async ({ context, input }) => {
			const member = (
				await db
					.select()
					.from(changeCabMembers)
					.where(
						and(
							eq(changeCabMembers.changeId, input.changeId),
							eq(changeCabMembers.userId, context.userId),
						),
					)
					.limit(1)
			)[0];
			if (!member) throw new ORPCError("FORBIDDEN");
			const votedAt = new Date();
			await db
				.insert(changeCabVotes)
				.values({
					id: crypto.randomUUID(),
					memberId: member.id,
					vote: input.vote,
					comment: input.comment,
					votedAt,
				})
				.onConflictDoUpdate({
					target: changeCabVotes.memberId,
					set: { vote: input.vote, comment: input.comment, votedAt },
				});
			const detail = await requireChange(input.changeId);
			await db
				.update(changes)
				.set({
					status: changeApproval(
						detail.changeType,
						detail.cabMembers,
						detail.cabRequired,
						detail.cabApprovalType,
					),
					updatedAt: votedAt,
				})
				.where(eq(changes.id, input.changeId));
			return requireChange(input.changeId);
		},
	),

	listKnowledgeArticles: capabilityProcedure(
		"knowledge.read",
	).listKnowledgeArticles.handler(() =>
		db
			.select(articleSelection)
			.from(knowledgeArticles)
			.orderBy(desc(knowledgeArticles.updatedAt)),
	),
	getKnowledgeArticle: capabilityProcedure(
		"knowledge.read",
	).getKnowledgeArticle.handler(
		async ({ input }) =>
			(
				await db
					.select(articleSelection)
					.from(knowledgeArticles)
					.where(eq(knowledgeArticles.id, input.id))
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

	listRequestCatalogue: capabilityProcedure(
		"ticket.create",
	).listRequestCatalogue.handler(async () => {
		const rows = await db
			.select({ subcategory: serviceSubcategories, form: forms })
			.from(serviceSubcategories)
			.innerJoin(services, eq(serviceSubcategories.serviceId, services.id))
			.innerJoin(serviceFamilies, eq(services.familyId, serviceFamilies.id))
			.leftJoin(
				forms,
				and(
					eq(serviceSubcategories.formId, forms.id),
					eq(forms.status, "published"),
				),
			)
			.where(
				and(
					eq(serviceSubcategories.isActive, true),
					eq(services.isActive, true),
					eq(serviceFamilies.isActive, true),
					sql`${serviceSubcategories.formId} is null or ${forms.id} is not null`,
				),
			)
			.orderBy(serviceSubcategories.name);
		return Promise.all(
			rows.map(async ({ subcategory, form }) => ({
				subcategory,
				form: form
					? {
							...form,
							fields: await db
								.select()
								.from(formFields)
								.where(eq(formFields.formId, form.id))
								.orderBy(asc(formFields.ordinal)),
						}
					: null,
			})),
		);
	}),
	createCatalogueRequest: capabilityProcedure(
		"ticket.create",
	).createCatalogueRequest.handler(async ({ context, input }) => {
		const result = await db.transaction(async (tx) => {
			const selected = (
				await tx
					.select({
						subcategory: serviceSubcategories,
						form: forms,
						managerId: user.managerId,
					})
					.from(serviceSubcategories)
					.innerJoin(services, eq(serviceSubcategories.serviceId, services.id))
					.innerJoin(serviceFamilies, eq(services.familyId, serviceFamilies.id))
					.innerJoin(
						forms,
						and(
							eq(forms.id, input.formId),
							eq(forms.id, serviceSubcategories.formId),
							eq(forms.status, "published"),
						),
					)
					.innerJoin(user, eq(user.id, context.userId))
					.where(
						and(
							eq(serviceSubcategories.id, input.subcategoryId),
							eq(serviceSubcategories.isActive, true),
							eq(services.isActive, true),
							eq(serviceFamilies.isActive, true),
						),
					)
					.limit(1)
			)[0];
			if (!selected)
				throw new ORPCError("NOT_FOUND", {
					message: "Published request form not found",
				});
			const fields = await tx
				.select()
				.from(formFields)
				.where(eq(formFields.formId, selected.form.id))
				.orderBy(asc(formFields.ordinal));
			let values: Record<string, unknown>;
			try {
				values = validateFormSubmission(fields, input.values);
			} catch (error) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						error instanceof Error ? error.message : "Invalid form submission",
				});
			}
			const ticketId = crypto.randomUUID();
			const submissionId = crypto.randomUUID();
			const year = String(new Date().getUTCFullYear());
			const counter = (
				await tx
					.insert(ticketNumberCounters)
					.values({ prefix: "REQ", year, lastValue: 1 })
					.onConflictDoUpdate({
						target: [ticketNumberCounters.prefix, ticketNumberCounters.year],
						set: { lastValue: sql`${ticketNumberCounters.lastValue} + 1` },
					})
					.returning({ value: ticketNumberCounters.lastValue })
			)[0];
			if (!counter) throw new ORPCError("INTERNAL_SERVER_ERROR");
			await tx.insert(tickets).values({
				id: ticketId,
				number: `REQ-${year}-${String(counter.value).padStart(5, "0")}`,
				reporterId: context.userId,
				title: input.title,
				body: input.body,
				recordType: "service_request",
				serviceId: selected.subcategory.serviceId,
				serviceSubcategoryId: selected.subcategory.id,
			});
			await tx.insert(formSubmissions).values({
				id: submissionId,
				formId: selected.form.id,
				submitterId: context.userId,
				ticketId,
				values,
			});
			const approverId =
				selected.subcategory.approverOverrideId ?? selected.managerId;
			if (!approverId)
				throw new ORPCError("CONFLICT", {
					message: "This request needs an approver, but none is configured",
				});
			let approval = null;
			if (approverId) {
				approval =
					(
						await tx
							.insert(approvals)
							.values({
								id: crypto.randomUUID(),
								requesterId: context.userId,
								approverId,
								ticketId,
								submissionId,
							})
							.returning()
					)[0] ?? null;
				if (!approval) throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
			return { ticketId, approval };
		});
		await attachTicketStopwatches(result.ticketId, "P3");
		return result;
	}),
	listApprovals: capabilityProcedure("approval.read").listApprovals.handler(
		({ context }) =>
			db
				.select()
				.from(approvals)
				.where(eq(approvals.approverId, context.userId))
				.orderBy(desc(approvals.requestedAt)),
	),
	decideApproval: capabilityProcedure("approval.decide").decideApproval.handler(
		async ({ context, input }) => {
			const row = (
				await db
					.update(approvals)
					.set({
						status: input.decision,
						decisionNote: input.note,
						decidedAt: new Date(),
					})
					.where(
						and(
							eq(approvals.id, input.id),
							eq(approvals.approverId, context.userId),
							eq(approvals.status, "waiting_for_approval"),
						),
					)
					.returning()
			)[0];
			if (!row)
				throw new ORPCError("CONFLICT", {
					message:
						"Approval is missing, already decided, or belongs to another approver",
				});
			return row;
		},
	),
	getMyApprovalStatus: reporterProcedure.getMyApprovalStatus.handler(
		async ({ context, input }) => {
			return (
				(
					await db
						.select({
							status: approvals.status,
							requestedAt: approvals.requestedAt,
							decidedAt: approvals.decidedAt,
						})
						.from(approvals)
						.where(
							and(
								eq(approvals.ticketId, input.ticketId),
								eq(approvals.requesterId, context.userId),
							),
						)
						.limit(1)
				)[0] ?? null
			);
		},
	),
};
