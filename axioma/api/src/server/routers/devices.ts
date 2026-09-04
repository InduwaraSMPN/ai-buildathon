import { ORPCError } from "@orpc/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
	deviceCommands,
	deviceEnrolmentTokens,
	devices,
	user,
} from "@/db/schema";
import {
	hashDeviceSecret,
	issueEnrolmentToken,
	normaliseClaimCode,
} from "../device-auth";
import { grpcGateway } from "../grpc";
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
					revokedAt: devices.revokedAt,
					credentialHash: devices.credentialHash,
				})
				.from(devices)
				.leftJoin(user, eq(devices.ownerId, user.id))
				.orderBy(desc(devices.lastSeenAt));
			return Promise.all(
				rows.map(async ({ credentialHash, ...device }) => ({
					...device,
					credentialStatus: device.revokedAt
						? ("revoked" as const)
						: credentialHash
							? ("active" as const)
							: ("missing" as const),
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
	createDeviceEnrolmentToken: capabilityProcedure(
		"device.enroll",
	).createDeviceEnrolmentToken.handler(async ({ context }) => {
		const token = issueEnrolmentToken();
		const expiresAt = new Date(Date.now() + 10 * 60_000);
		await db.insert(deviceEnrolmentTokens).values({
			id: crypto.randomUUID(),
			tokenHash: hashDeviceSecret(token),
			createdBy: context.userId,
			expiresAt,
		});
		return { token, expiresAt };
	}),
	/**
	 * The employee-facing half of enrolment. `registerDevice` in the gateway
	 * inserts a device with no `owner_id`, because a laptop dialling in cannot
	 * say who is sitting at it — so until this runs the machine is invisible to
	 * `listMyDevices`, to the intake composer's device picker, and to the agent's
	 * owned-device lookup. The code is single-use: it is cleared on success, so a
	 * screenshot of it in a chat thread is worthless afterwards.
	 */
	claimDevice: reporterProcedure.claimDevice.handler(
		async ({ context, input }) => {
			const code = normaliseClaimCode(input.code);
			if (!code) throw new ORPCError("NOT_FOUND");
			const [claimed] = await db
				.update(devices)
				.set({
					ownerId: context.userId,
					claimCodeHash: null,
					claimCodeExpiresAt: null,
				})
				.where(
					and(
						eq(devices.claimCodeHash, hashDeviceSecret(code)),
						isNull(devices.ownerId),
						isNull(devices.revokedAt),
						gt(devices.claimCodeExpiresAt, new Date()),
					),
				)
				.returning({ id: devices.id, hostname: devices.hostname });
			if (!claimed)
				throw new ORPCError("NOT_FOUND", {
					message: "That code is not valid for a device waiting to be claimed",
				});
			return { deviceId: claimed.id, hostname: claimed.hostname };
		},
	),
	rotateDeviceCredential: capabilityProcedure(
		"device.enroll",
	).rotateDeviceCredential.handler(async ({ input }) => ({
		delivered: await grpcGateway.rotateDeviceCredential(input.deviceId),
	})),
	revokeDevice: capabilityProcedure("device.enroll").revokeDevice.handler(
		async ({ input }) => {
			const revokedAt = await grpcGateway.revokeDevice(input.deviceId);
			if (!revokedAt)
				throw new ORPCError("NOT_FOUND", { message: "Device not found" });
			return { revokedAt };
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
