import { oc } from "@orpc/contract";
import { z } from "zod";

const id = z.string().trim().min(1);
const nullableId = id.nullable();
const priority = z.enum(["P1", "P2", "P3", "P4"]);

export const serviceFamilySchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	isActive: z.boolean(),
});
export const serviceSchema = z.object({
	id: z.string(),
	familyId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	slaId: nullableId,
	olaId: nullableId,
	isActive: z.boolean(),
});
export const serviceSubcategorySchema = z.object({
	id: z.string(),
	serviceId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	approverOverrideId: nullableId,
	formId: nullableId,
	isActive: z.boolean(),
});
export const catalogueSchema = z.object({
	families: z.array(serviceFamilySchema),
	services: z.array(serviceSchema),
	subcategories: z.array(serviceSubcategorySchema),
});

export const problemSchema = z.object({
	id: z.string(),
	problemNumber: z.string(),
	title: z.string(),
	description: z.string(),
	status: z.string(),
	priority,
	assigneeId: nullableId,
	rootCause: z.string().nullable(),
	workaround: z.string().nullable(),
	isKnownError: z.boolean(),
	serviceId: nullableId,
	createdAt: z.date(),
	updatedAt: z.date(),
});
export const problemDetailSchema = problemSchema.extend({
	ticketIds: z.array(z.string()),
	resolutionOffer: z.string().nullable(),
});

const changeType = z.enum(["standard", "normal", "emergency"]);
const changeStatus = z.enum([
	"draft",
	"submitted",
	"pending_approval",
	"approved",
	"rejected",
	"scheduled",
	"in_progress",
	"completed",
	"failed",
	"cancelled",
]);
const cabVote = z.enum(["approve", "reject", "abstain"]);
export const changeSchema = z.object({
	id: z.string(),
	changeNumber: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	reasonForChange: z.string().nullable(),
	changeType,
	status: changeStatus,
	priority,
	impact: z.enum(["high", "medium", "low"]),
	testPlan: z.string().nullable(),
	rollbackPlan: z.string().nullable(),
	riskLikelihood: z.number().int().nullable(),
	riskImpactScore: z.number().int().nullable(),
	riskScore: z.number().int().nullable(),
	riskLevel: z.string().nullable(),
	cabRequired: z.boolean(),
	cabApprovalType: z.enum(["all", "majority"]),
	workStartAt: z.date().nullable(),
	workEndAt: z.date().nullable(),
	outageStartAt: z.date().nullable(),
	outageEndAt: z.date().nullable(),
	pirWasSuccessful: z.boolean().nullable(),
	pirActualStartAt: z.date().nullable(),
	pirActualEndAt: z.date().nullable(),
	pirLessonsLearned: z.string().nullable(),
	pirFollowUp: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
export const changeDetailSchema = changeSchema.extend({
	ticketIds: z.array(z.string()),
	cabMembers: z.array(
		z.object({
			id: z.string(),
			userId: z.string(),
			isRequired: z.boolean(),
			vote: cabVote.nullable(),
			voteComment: z.string().nullable(),
			voteAt: z.date().nullable(),
		}),
	),
});

const articleStatus = z.enum(["draft", "published", "archived"]);
const articleAudience = z.enum(["public", "employees", "staff"]);
export const knowledgeArticleSchema = z.object({
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
export const portalKnowledgeArticleSchema = knowledgeArticleSchema.pick({
	id: true,
	title: true,
	body: true,
	summary: true,
	publishedAt: true,
	updatedAt: true,
});

const formFieldType = z.enum([
	"text",
	"textarea",
	"number",
	"boolean",
	"date",
	"select",
	"multiselect",
]);
export const formFieldSchema = z.object({
	id: z.string(),
	key: z.string(),
	label: z.string(),
	description: z.string().nullable(),
	type: formFieldType,
	ordinal: z.number().int(),
	options: z.unknown().nullable(),
	validation: z.unknown().nullable(),
	condition: z.unknown().nullable(),
	isMandatory: z.boolean(),
	isHidden: z.boolean(),
	isReadonly: z.boolean(),
	predefinedValue: z.unknown().nullable(),
});
export const formSchema = z.object({
	id: z.string(),
	key: z.string(),
	version: z.number().int(),
	name: z.string(),
	description: z.string().nullable(),
	status: z.enum(["draft", "published", "archived"]),
	fields: z.array(formFieldSchema),
});
const approvalStatus = z.enum(["waiting_for_approval", "approved", "rejected"]);
export const approvalSchema = z.object({
	id: z.string(),
	requesterId: z.string(),
	approverId: z.string(),
	ticketId: z.string(),
	submissionId: nullableId,
	status: approvalStatus,
	requestNote: z.string().nullable(),
	decisionNote: z.string().nullable(),
	requestedAt: z.date(),
	decidedAt: z.date().nullable(),
});

export const tier2Contract = {
	listCatalogue: oc.output(catalogueSchema),
	listProblems: oc.output(z.array(problemSchema)),
	getProblem: oc.input(z.object({ id })).output(problemDetailSchema.nullable()),
	createProblem: oc
		.input(
			z.object({
				title: z.string().trim().min(3).max(160),
				description: z.string().trim().min(1).max(10_000),
				priority: priority.default("P3"),
				assigneeId: id.optional(),
				serviceId: id.optional(),
				ticketIds: z.array(id).max(100).default([]),
			}),
		)
		.output(problemDetailSchema),
	updateProblem: oc
		.input(
			z.object({
				id,
				title: z.string().trim().min(3).max(160).optional(),
				description: z.string().trim().min(1).max(10_000).optional(),
				status: z.string().trim().min(1).optional(),
				priority: priority.optional(),
				assigneeId: nullableId.optional(),
				rootCause: z.string().trim().max(10_000).nullable().optional(),
				workaround: z.string().trim().max(10_000).nullable().optional(),
				isKnownError: z.boolean().optional(),
				serviceId: nullableId.optional(),
			}),
		)
		.output(problemDetailSchema),
	linkProblemTickets: oc
		.input(z.object({ problemId: id, ticketIds: z.array(id).min(1).max(100) }))
		.output(problemDetailSchema),
	closeProblem: oc
		.input(z.object({ id, resolution: z.string().trim().min(1).max(10_000) }))
		.output(
			z.object({
				problem: problemDetailSchema,
				incidentOffers: z.array(
					z.object({
						ticketId: z.string(),
						currentResolution: z.string().nullable(),
						resolutionOffer: z.string(),
					}),
				),
			}),
		),
	getTicketServiceRecords: oc.input(z.object({ ticketId: id })).output(
		z.object({
			problems: z.array(
				problemSchema.pick({
					id: true,
					problemNumber: true,
					title: true,
					workaround: true,
					isKnownError: true,
				}),
			),
			changes: z.array(
				changeSchema.pick({
					id: true,
					changeNumber: true,
					title: true,
					status: true,
					changeType: true,
				}),
			),
		}),
	),
	listChanges: oc.output(z.array(changeSchema)),
	getChange: oc.input(z.object({ id })).output(changeDetailSchema.nullable()),
	createChange: oc
		.input(
			z.object({
				title: z.string().trim().min(3).max(160),
				description: z.string().trim().max(10_000).optional(),
				reasonForChange: z.string().trim().min(1).max(10_000),
				changeType: z.enum(["normal", "emergency"]),
				testPlan: z.string().trim().min(1).max(10_000),
				rollbackPlan: z.string().trim().min(1).max(10_000),
				cabMemberIds: z.array(id).max(100).default([]),
				ticketIds: z.array(id).max(100).default([]),
			}),
		)
		.output(changeDetailSchema),
	updateChange: oc
		.input(
			z.object({
				id,
				status: changeStatus.optional(),
				pirWasSuccessful: z.boolean().optional(),
				pirLessonsLearned: z.string().trim().max(10_000).optional(),
				pirFollowUp: z.string().trim().max(10_000).optional(),
			}),
		)
		.output(changeDetailSchema),
	voteOnChange: oc
		.input(
			z.object({
				changeId: id,
				vote: cabVote,
				comment: z.string().trim().max(2_000).optional(),
			}),
		)
		.output(changeDetailSchema),
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
	listRequestCatalogue: oc.output(
		z.array(
			z.object({
				subcategory: serviceSubcategorySchema,
				form: formSchema.nullable(),
			}),
		),
	),
	createCatalogueRequest: oc
		.input(
			z.object({
				subcategoryId: id,
				formId: id,
				values: z.record(z.string(), z.unknown()),
				title: z.string().trim().min(3).max(160),
				body: z.string().trim().min(10).max(10_000),
			}),
		)
		.output(
			z.object({ ticketId: z.string(), approval: approvalSchema.nullable() }),
		),
	listApprovals: oc.output(z.array(approvalSchema)),
	decideApproval: oc
		.input(
			z.object({
				id,
				decision: z.enum(["approved", "rejected"]),
				note: z.string().trim().max(2_000).optional(),
			}),
		)
		.output(approvalSchema),
	getMyApprovalStatus: oc
		.input(z.object({ ticketId: id }))
		.output(
			approvalSchema
				.pick({ status: true, requestedAt: true, decidedAt: true })
				.nullable(),
		),
};
