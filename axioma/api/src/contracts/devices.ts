import { oc } from "@orpc/contract";
import { z } from "zod";

const commandStatus = z.enum([
	"pending",
	"dispatched",
	"succeeded",
	"failed",
	"timed_out",
]);

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

const deviceConnection = z.enum(["online", "offline"]);

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
	enrollDevice: oc
		.input(z.object({ code: z.string().trim().min(4).max(64) }))
		.output(
			z.object({
				id: z.string(),
				hostname: z.string(),
				connected: deviceConnection,
				lastSeenAt: z.date(),
			}),
		),
	listDeviceCommands: oc
		.input(
			z.object({
				deviceId: z.string().min(1),
				limit: z.number().int().min(1).max(100).default(20),
			}),
		)
		.output(z.array(deviceCommand)),
};
