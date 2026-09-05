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
	// Enrolment binds a machine to the gateway; claiming binds it to a person.
	// The employee reads the code off their own screen, so it is accepted in any
	// case and with or without the grouping hyphen.
	claimDevice: oc
		.input(z.object({ code: z.string().trim().min(4).max(32) }))
		.output(z.object({ deviceId: z.string(), hostname: z.string() })),
	// Claiming in reverse, and the employee's to perform. `revokeDevice` is not
	// the counterpart to it: that is IT-only and ends the enrolment, where this
	// only unbinds the owner and leaves the machine enrolled and connected. The
	// id is `min(1)` rather than `uuid()` because it comes straight back from
	// `listMyDevices`, which also carries seeded rows whose ids are not uuids.
	releaseMyDevice: oc
		.input(z.object({ deviceId: z.string().min(1) }))
		.output(z.object({ deviceId: z.string(), hostname: z.string() })),
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
