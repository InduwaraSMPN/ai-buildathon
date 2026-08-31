// GENERATED — do not edit.
// Mirrored from axioma-api/src/contracts by `pnpm contracts:publish`.
// Change the contract in the api repo and re-run that command.

import { oc } from "@orpc/contract";
import { z } from "zod";
import { COMMAND_STATUSES, DEVICE_CONNECTION_STATES } from "../shared";

const commandStatus = z.enum(COMMAND_STATUSES);

const deviceCommand = z.object({
	id: z.string(),
	deviceId: z.string(),
	runId: z.string().nullable(),
	stepId: z.string().nullable(),
	sequence: z.number().int(),
	tool: z.string(),
	input: z.unknown().nullable(),
	status: commandStatus,
	output: z.unknown().nullable(),
	error: z.string().nullable(),
	createdAt: z.date(),
	dispatchedAt: z.date().nullable(),
	completedAt: z.date().nullable(),
});

const deviceConnection = z.enum(DEVICE_CONNECTION_STATES);

const lastCommand = z
	.object({
		id: z.string(),
		tool: z.string(),
		status: commandStatus,
		createdAt: z.date(),
		completedAt: z.date().nullable(),
	})
	.nullable();

const device = z.object({
	id: z.string(),
	ownerId: z.string().nullable(),
	ownerName: z.string().nullable(),
	ownerEmail: z.string().nullable(),
	hostname: z.string(),
	username: z.string().nullable(),
	platform: z.string().nullable(),
	release: z.string().nullable(),
	agentVersion: z.string().nullable(),
	connected: deviceConnection,
	lastSeenAt: z.date(),
	enrolledAt: z.date().nullable(),
	revokedAt: z.date().nullable(),
	credentialStatus: z.enum(["active", "missing", "revoked"]),
	lastCommand,
});

export const devicesContract = {
	listDevices: oc.output(z.array(device)),
	listMyDevices: oc.output(
		z.array(
			z.object({
				id: z.string(),
				hostname: z.string(),
				connected: deviceConnection,
				lastSeenAt: z.date(),
			}),
		),
	),
	createDeviceEnrolmentToken: oc.output(
		z.object({ token: z.string(), expiresAt: z.date() }),
	),
	rotateDeviceCredential: oc
		.input(z.object({ deviceId: z.string().uuid() }))
		.output(z.object({ delivered: z.boolean() })),
	revokeDevice: oc
		.input(z.object({ deviceId: z.string().uuid() }))
		.output(z.object({ revokedAt: z.date() })),
	listDeviceCommands: oc
		.input(
			z.object({
				deviceId: z.string().min(1),
				limit: z.number().int().min(1).max(100).default(20),
			}),
		)
		.output(z.array(deviceCommand)),
};
