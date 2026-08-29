import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, suppliers } from "@/db/schema";
import { capabilityProcedure } from "../orpc";

export const suppliersRouter = {
	listSuppliers: capabilityProcedure("admin.settings").listSuppliers.handler(
		() =>
			db
				.select({
					id: suppliers.id,
					name: suppliers.name,
					contactName: suppliers.contactName,
					contactEmail: suppliers.contactEmail,
					active: suppliers.active,
				})
				.from(suppliers)
				.orderBy(asc(suppliers.name))
				.then((rows) =>
					rows.map(({ contactName, contactEmail, active, ...row }) => ({
						...row,
						contact: contactName ?? contactEmail,
						status: active ? ("active" as const) : ("inactive" as const),
					})),
				),
	),
	listContracts: capabilityProcedure("admin.settings").listContracts.handler(
		() =>
			db
				.select({
					id: contracts.id,
					name: contracts.name,
					supplierName: suppliers.name,
					startsOn: contracts.startsOn,
					endsOn: contracts.endsOn,
					active: contracts.active,
				})
				.from(contracts)
				.innerJoin(suppliers, eq(contracts.supplierId, suppliers.id))
				.orderBy(asc(contracts.name))
				.then((rows) =>
					rows.map(({ active, ...row }) => ({
						...row,
						status: active ? ("active" as const) : ("inactive" as const),
					})),
				),
	),
};
