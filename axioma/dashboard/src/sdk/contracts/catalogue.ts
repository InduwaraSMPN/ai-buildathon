// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";
import { id, nullableId } from "./shared";

const approvalStatus = z.enum(["waiting_for_approval", "approved", "rejected"]);

const approvalSchema = z.object({
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

const formFieldType = z.enum([
	"text",
	"textarea",
	"number",
	"boolean",
	"date",
	"select",
	"multiselect",
]);

const formFieldSchema = z.object({
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

const formSchema = z.object({
	id: z.string(),
	key: z.string(),
	version: z.number().int(),
	name: z.string(),
	description: z.string().nullable(),
	status: z.enum(["draft", "published", "archived"]),
	fields: z.array(formFieldSchema),
});

const serviceSubcategorySchema = z.object({
	id: z.string(),
	serviceId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	approverOverrideId: nullableId,
	formId: nullableId,
	isActive: z.boolean(),
});

const serviceFamilySchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	isActive: z.boolean(),
});

const serviceSchema = z.object({
	id: z.string(),
	familyId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	slaId: nullableId,
	olaId: nullableId,
	isActive: z.boolean(),
});

const catalogueSchema = z.object({
	families: z.array(serviceFamilySchema),
	services: z.array(serviceSchema),
	subcategories: z.array(serviceSubcategorySchema),
});

export const catalogueContract = {
	listCatalogue: oc.output(catalogueSchema),
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
