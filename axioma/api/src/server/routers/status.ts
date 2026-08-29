import { ORPCError } from "@orpc/server";
import { and, asc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	changes,
	serviceImpactLevels,
	statusIncidents,
	statusServices,
} from "@/db/schema";
import { capabilityProcedure, publicProcedure } from "../orpc";
import { dailyAvailability, uptimeWindows } from "../status";

export const statusRouter = {
	readStatus: publicProcedure.readStatus.handler(async ({ input }) => {
		const end = new Date();
		const start = new Date(end.getTime() - input.days * 86_400_000);
		const [services, impacts, incidents, plannedChanges] = await Promise.all([
			db
				.select()
				.from(statusServices)
				.where(eq(statusServices.active, true))
				.orderBy(asc(statusServices.name)),
			db.select().from(serviceImpactLevels),
			db
				.select()
				.from(statusIncidents)
				.where(
					and(
						lte(statusIncidents.startedAt, end),
						or(
							sql`${statusIncidents.resolvedAt} is null`,
							gte(statusIncidents.resolvedAt, start),
						),
					),
				),
			db
				.select({
					startsAt: changes.outageStartAt,
					endsAt: changes.outageEndAt,
				})
				.from(changes)
				.where(
					and(
						inArray(changes.status, [
							"approved",
							"scheduled",
							"in_progress",
							"completed",
						]),
						lte(changes.outageStartAt, end),
						gte(changes.outageEndAt, start),
					),
				),
		]);
		const changeWindows = plannedChanges.filter(
			(window): window is { startsAt: Date; endsAt: Date } =>
				Boolean(window.startsAt && window.endsAt),
		);
		const impactConfig = Object.fromEntries(
			impacts.map((impact) => [impact.key, impact.countsAsDowntime]),
		);
		return services.map((service) => {
			const serviceIncidents = incidents.filter(
				(incident) => incident.serviceId === service.id,
			);
			return {
				id: service.id,
				name: service.name,
				days: dailyAvailability(
					serviceIncidents,
					impactConfig,
					end,
					input.days,
					true,
					changeWindows,
				),
				uptime: uptimeWindows(
					serviceIncidents,
					impactConfig,
					end,
					true,
					changeWindows,
				),
			};
		});
	}),
	upsertStatusService: capabilityProcedure(
		"admin.settings",
	).upsertStatusService.handler(async ({ input }) => {
		const [row] = await db
			.insert(statusServices)
			.values(input)
			.onConflictDoUpdate({ target: statusServices.id, set: input })
			.returning({ id: statusServices.id });
		return row!;
	}),
	upsertImpactLevel: capabilityProcedure(
		"admin.settings",
	).upsertImpactLevel.handler(async ({ input }) => {
		const [row] = await db
			.insert(serviceImpactLevels)
			.values(input)
			.onConflictDoUpdate({ target: serviceImpactLevels.key, set: input })
			.returning({ key: serviceImpactLevels.key });
		return row!;
	}),
	createStatusIncident: capabilityProcedure(
		"admin.settings",
	).createStatusIncident.handler(async ({ input }) => {
		if (input.resolvedAt && input.resolvedAt < input.startedAt)
			throw new ORPCError("BAD_REQUEST", {
				message: "Resolution cannot precede start",
			});
		const [row] = await db
			.insert(statusIncidents)
			.values({ id: crypto.randomUUID(), ...input })
			.returning({ id: statusIncidents.id });
		return row!;
	}),
	updateStatusIncident: capabilityProcedure(
		"admin.settings",
	).updateStatusIncident.handler(async ({ input: { id, ...input } }) => {
		const [current] = await db
			.select()
			.from(statusIncidents)
			.where(eq(statusIncidents.id, id))
			.limit(1);
		if (!current) throw new ORPCError("NOT_FOUND");
		if (
			(input.resolvedAt ?? current.resolvedAt) &&
			(input.resolvedAt ?? current.resolvedAt)! <
				(input.startedAt ?? current.startedAt)
		)
			throw new ORPCError("BAD_REQUEST", {
				message: "Resolution cannot precede start",
			});
		const [row] = await db
			.update(statusIncidents)
			.set(input)
			.where(eq(statusIncidents.id, id))
			.returning({ id: statusIncidents.id });
		return row!;
	}),
};
