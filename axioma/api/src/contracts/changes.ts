import { oc } from "@orpc/contract";
import { z } from "zod";
import { id, priority } from "./shared";

const cabVote = z.enum(["approve", "reject", "abstain"]);

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

const changeType = z.enum(["standard", "normal", "emergency"]);

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
	implementationPlan: z.string().nullable(),
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
	pirReview: z.string().nullable(),
	pirWasSuccessful: z.boolean().nullable(),
	pirActualStartAt: z.date().nullable(),
	pirActualEndAt: z.date().nullable(),
	pirLessonsLearned: z.string().nullable(),
	pirFollowUp: z.string().nullable(),
	// Provenance. A change the agent raised names the run and the step that
	// completed it, so an auditor reading this record can reach the transcript
	// that produced it rather than taking the record on trust.
	sourceRunId: z.string().nullable(),
	sourceStepId: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const changeDetailSchema = changeSchema.extend({
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

export const changesContract = {
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
				pirActualStartAt: z.coerce.date().optional(),
				pirActualEndAt: z.coerce.date().optional(),
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
};
