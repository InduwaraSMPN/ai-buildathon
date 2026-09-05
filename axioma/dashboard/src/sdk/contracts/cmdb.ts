// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";

const cmdbObject = z.object({
	id: z.string(),
	classId: z.string(),
	externalId: z.string(),
	name: z.string(),
	sourceTicketId: z.string().nullable(),
	sourceRunId: z.string().nullable(),
	sourceStepId: z.string().nullable(),
	observedAt: z.date(),
});

const cmdbProperty = z.object({
	id: z.string(),
	classId: z.string(),
	propertyKey: z.string(),
	label: z.string(),
	propertyType: z.string(),
	targetClassId: z.string().nullable(),
	isRequired: z.boolean(),
	spreadsImpact: z.boolean(),
});

const cmdbClass = z.object({
	id: z.string(),
	key: z.string(),
	label: z.string(),
	parentClassId: z.string().nullable(),
	properties: z.array(cmdbProperty).optional(),
});

/**
 * One configuration item, whole: what it is, what is recorded about it, what it
 * is wired to, and where every one of those facts came from. Search emits a
 * deep link per object, so there has to be a single call that answers it.
 */
const cmdbObjectDetail = cmdbObject.extend({
	classKey: z.string(),
	classLabel: z.string(),
	properties: z.array(
		z.object({
			id: z.string(),
			propertyKey: z.string(),
			label: z.string(),
			propertyType: z.string(),
			value: z.unknown(),
		}),
	),
	relationships: z.array(
		z.object({
			id: z.string(),
			verb: z.string(),
			direction: z.enum(["outgoing", "incoming"]),
			objectId: z.string(),
			objectName: z.string(),
		}),
	),
});

export const cmdbContract = {
	listCmdbClasses: oc.output(z.array(cmdbClass)),
	createCmdbClass: oc
		.input(
			z.object({
				key: z.string().min(1),
				label: z.string().min(1),
				parentClassId: z.string().nullable().optional(),
				properties: z
					.array(cmdbProperty.omit({ id: true, classId: true }))
					.default([]),
			}),
		)
		.output(cmdbClass),
	updateCmdbClass: oc
		.input(
			z.object({
				id: z.string(),
				label: z.string().min(1).optional(),
				parentClassId: z.string().nullable().optional(),
			}),
		)
		.output(cmdbClass),
	deleteCmdbClass: oc
		.input(z.object({ id: z.string() }))
		.output(z.object({ deleted: z.boolean() })),
	listCmdbObjects: oc
		.input(
			z.object({
				classId: z.string().optional(),
				limit: z.number().int().min(1).max(100).default(50),
			}),
		)
		.output(z.array(cmdbObject)),
	getCmdbObject: oc
		.input(z.object({ id: z.string() }))
		.output(cmdbObjectDetail.nullable()),
	cmdbImpact: oc
		.input(
			z.object({
				objectId: z.string(),
				maxDepth: z.number().int().min(0).max(10).default(5),
			}),
		)
		.output(
			z.array(
				z.object({
					objectId: z.string(),
					depth: z.number().int(),
					viaRelationshipId: z.string().optional(),
					object: cmdbObject.nullable(),
				}),
			),
		),
	listTicketCmdbObjects: oc
		.input(z.object({ ticketId: z.string() }))
		.output(z.array(cmdbObject)),
	linkTicketCmdbObject: oc
		.input(z.object({ ticketId: z.string(), objectId: z.string() }))
		.output(z.object({ linked: z.literal(true) })),
	unlinkTicketCmdbObject: oc
		.input(z.object({ ticketId: z.string(), objectId: z.string() }))
		.output(z.object({ deleted: z.boolean() })),
	listCmdbRelationshipTypes: oc.output(
		z.array(
			z.object({
				id: z.string(),
				key: z.string(),
				verb: z.string(),
				inverseVerb: z.string(),
				impactDirection: z.enum(["forward", "reverse", "both", "none"]),
			}),
		),
	),
	createCmdbRelationshipType: oc
		.input(
			z.object({
				key: z.string().min(1),
				verb: z.string().min(1),
				inverseVerb: z.string().min(1),
				impactDirection: z
					.enum(["forward", "reverse", "both", "none"])
					.default("none"),
			}),
		)
		.output(
			z.object({
				id: z.string(),
				key: z.string(),
				verb: z.string(),
				inverseVerb: z.string(),
				impactDirection: z.enum(["forward", "reverse", "both", "none"]),
			}),
		),
	createCmdbObjectRelationship: oc
		.input(
			z.object({
				typeId: z.string(),
				sourceObjectId: z.string(),
				targetObjectId: z.string(),
				propertyId: z.string().nullable().optional(),
			}),
		)
		.output(z.object({ ok: z.literal(true), relationship: z.unknown() })),
};
