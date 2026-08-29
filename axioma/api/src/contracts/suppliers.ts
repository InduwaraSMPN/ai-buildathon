import { oc } from "@orpc/contract";
import { z } from "zod";

export const suppliersContract = {
	listSuppliers: oc.output(
		z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				contact: z.string().nullable(),
				status: z.enum(["active", "inactive"]),
			}),
		),
	),
	listContracts: oc.output(
		z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				supplierName: z.string(),
				startsOn: z.string(),
				endsOn: z.string().nullable(),
				status: z.enum(["active", "inactive"]),
			}),
		),
	),
};
