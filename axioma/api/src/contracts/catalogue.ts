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

/**
 * Every constraint validateFormFieldValue understands. Which keys are legal for
 * a given field type stays that function's business — this only stops an
 * unknown or unbounded constraint being stored in the first place. `pattern` is
 * compiled and run against portal-supplied text, so its length is capped here
 * as well as at the write boundary. `min`/`max` are numbers on a number field
 * and YYYY-MM-DD strings on a date field.
 */
const formFieldValidation = z.strictObject({
	minLength: z.number().int().min(0).max(100_000).optional(),
	maxLength: z.number().int().min(0).max(100_000).optional(),
	pattern: z.string().max(200).optional(),
	min: z.union([z.number(), z.string().max(10)]).optional(),
	max: z.union([z.number(), z.string().max(10)]).optional(),
	integer: z.boolean().optional(),
	minItems: z.number().int().min(0).max(1_000).optional(),
	maxItems: z.number().int().min(0).max(1_000).optional(),
});

const formFieldInput = z.object({
	key: z.string().trim().min(1).max(100),
	label: z.string().trim().min(1).max(200),
	description: z.string().trim().max(2_000).nullable().optional(),
	type: formFieldType,
	options: z.unknown().nullable().optional(),
	validation: formFieldValidation.nullable().optional(),
	condition: z.unknown().nullable().optional(),
	isMandatory: z.boolean().default(false),
	isHidden: z.boolean().default(false),
	isReadonly: z.boolean().default(false),
	predefinedValue: z.unknown().nullable().optional(),
});

const formInput = z.object({
	key: z.string().trim().min(1).max(100),
	name: z.string().trim().min(1).max(200),
	description: z.string().trim().max(2_000).nullable().optional(),
	fields: z.array(formFieldInput).max(100).default([]),
});

export const catalogueContract = {
	listForms: oc.output(z.array(formSchema)),
	createForm: oc.input(formInput).output(formSchema),
	updateForm: oc.input(formInput.extend({ id })).output(formSchema),
	publishForm: oc.input(z.object({ id })).output(formSchema),
	setSubcategoryForm: oc
		.input(z.object({ subcategoryId: id, formId: nullableId }))
		.output(serviceSubcategorySchema),
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
				idempotencyKey: z.uuid(),
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
