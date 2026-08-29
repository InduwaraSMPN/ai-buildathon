import { ORPCError } from "@orpc/server";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { deviceCommands, devices, user } from "@/db/schema";
import { capabilityProcedure, reporterProcedure } from "../orpc";

export const devicesRouter = {
	listDevices: capabilityProcedure("device.read").listDevices.handler(
		async () => {
			const rows = await db
				.select({
					id: devices.id,
					ownerId: devices.ownerId,
					ownerName: user.name,
					ownerEmail: user.email,
					hostname: devices.hostname,
					username: devices.username,
					platform: devices.platform,
					release: devices.release,
					agentVersion: devices.agentVersion,
					connected: devices.connected,
					lastSeenAt: devices.lastSeenAt,
					enrolledAt: devices.enrolledAt,
				})
				.from(devices)
				.leftJoin(user, eq(devices.ownerId, user.id))
				.orderBy(desc(devices.lastSeenAt));
			return Promise.all(
				rows.map(async (device) => ({
					...device,
					lastCommand:
						(
							await db
								.select({
									id: deviceCommands.id,
									tool: deviceCommands.tool,
									status: deviceCommands.status,
									createdAt: deviceCommands.createdAt,
									completedAt: deviceCommands.completedAt,
								})
								.from(deviceCommands)
								.where(eq(deviceCommands.deviceId, device.id))
								.orderBy(desc(deviceCommands.createdAt))
								.limit(1)
						)[0] ?? null,
				})),
			);
		},
	),
	listMyDevices: reporterProcedure.listMyDevices.handler(({ context }) =>
		db
			.select({
				id: devices.id,
				hostname: devices.hostname,
				connected: devices.connected,
				lastSeenAt: devices.lastSeenAt,
			})
			.from(devices)
			.where(eq(devices.ownerId, context.userId))
			.orderBy(desc(devices.lastSeenAt)),
	),
	enrollDevice: capabilityProcedure("device.enroll").enrollDevice.handler(
		async ({ context, input }) => {
			const now = new Date();
			const enrolled = await db
				.update(devices)
				.set({
					ownerId: context.userId,
					enrolmentCode: null,
					enrolmentCodeExpiresAt: null,
					enrolledAt: now,
				})
				.where(
					and(
						eq(devices.enrolmentCode, input.code),
						gt(devices.enrolmentCodeExpiresAt, now),
						sql`${devices.ownerId} is null or ${devices.ownerId} = ${context.userId}`,
					),
				)
				.returning({
					id: devices.id,
					hostname: devices.hostname,
					connected: devices.connected,
					lastSeenAt: devices.lastSeenAt,
				});
			if (!enrolled[0])
				throw new ORPCError("NOT_FOUND", {
					message: "Enrolment code is invalid or expired",
				});
			return enrolled[0];
		},
	),
	listDeviceCommands: capabilityProcedure(
		"device.command",
	).listDeviceCommands.handler(({ input }) =>
		db
			.select()
			.from(deviceCommands)
			.where(eq(deviceCommands.deviceId, input.deviceId))
			.orderBy(desc(deviceCommands.sequence))
			.limit(input.limit),
	),
};
