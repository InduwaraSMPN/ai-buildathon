import { relations } from "drizzle-orm";
import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { COMMAND_STATUSES, DEVICE_CONNECTION_STATES } from "@/shared";
import { agentRuns, agentSteps } from "./agent";
import { user } from "./auth";

/**
 * A laptop running the CLI agent.
 *
 * `id` is the UUID the CLI generates on first run and persists to
 * `%LOCALAPPDATA%\axioma\device.json`, so it survives restarts and network
 * roaming. `connected` reflects whether a socket is currently held, and is
 * cleared by the ping sweep rather than by the client saying goodbye — a
 * laptop that sleeps never gets to say goodbye.
 */
export const devices = pgTable(
	"devices",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id").references(() => user.id, {
			onDelete: "set null",
		}),

		hostname: text("hostname").notNull(),
		username: text("username"),
		platform: text("platform"),
		release: text("release"),
		agentVersion: text("agent_version"),
		enrolmentCode: text("enrolment_code"),
		enrolmentCodeExpiresAt: timestamp("enrolment_code_expires_at"),

		connected: text("connected", { enum: DEVICE_CONNECTION_STATES })
			.notNull()
			.default("offline"),
		lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
		enrolledAt: timestamp("enrolled_at"),
	},
	(t) => [
		index("devices_owner_idx").on(t.ownerId),
		index("devices_connected_idx").on(t.connected),
		uniqueIndex("devices_enrolment_code_uidx").on(t.enrolmentCode),
	],
);

/**
 * A command dispatched to a device.
 *
 * `sequence` is per-device and monotonic. On reconnect the CLI reports the last
 * sequence it saw and the server replays anything after it, which is what makes
 * a sleeping laptop recoverable.
 */
export const deviceCommands = pgTable(
	"device_commands",
	{
		id: text("id").primaryKey(),
		deviceId: text("device_id")
			.notNull()
			.references(() => devices.id, { onDelete: "cascade" }),
		runId: text("run_id").references(() => agentRuns.id, {
			onDelete: "set null",
		}),
		stepId: text("step_id").references(() => agentSteps.id, {
			onDelete: "set null",
		}),

		sequence: integer("sequence").notNull(),
		tool: text("tool").notNull(),
		input: jsonb("input"),

		// pending -> dispatched -> succeeded | failed | timed_out
		status: text("status", { enum: COMMAND_STATUSES })
			.notNull()
			.default("pending"),
		output: jsonb("output"),
		error: text("error"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		dispatchedAt: timestamp("dispatched_at"),
		completedAt: timestamp("completed_at"),
	},
	(t) => [
		uniqueIndex("device_commands_seq_idx").on(t.deviceId, t.sequence),
		index("device_commands_status_idx").on(t.deviceId, t.status),
		index("device_commands_run_idx").on(t.runId),
		index("device_commands_step_idx").on(t.stepId),
	],
);

export const devicesRelations = relations(devices, ({ one, many }) => ({
	owner: one(user, {
		fields: [devices.ownerId],
		references: [user.id],
	}),
	commands: many(deviceCommands),
}));

export const deviceCommandsRelations = relations(deviceCommands, ({ one }) => ({
	device: one(devices, {
		fields: [deviceCommands.deviceId],
		references: [devices.id],
	}),
}));
