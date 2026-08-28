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

		connected: text("connected").notNull().default("offline"),
		lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
		enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
	},
	(t) => [
		index("devices_owner_idx").on(t.ownerId),
		index("devices_connected_idx").on(t.connected),
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
		runId: text("run_id"),
		stepId: text("step_id"),

		sequence: integer("sequence").notNull(),
		tool: text("tool").notNull(),
		input: jsonb("input"),

		// pending -> dispatched -> succeeded | failed | timed_out
		status: text("status").notNull().default("pending"),
		output: jsonb("output"),
		error: text("error"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		dispatchedAt: timestamp("dispatched_at"),
		completedAt: timestamp("completed_at"),
	},
	(t) => [
		uniqueIndex("device_commands_seq_idx").on(t.deviceId, t.sequence),
		index("device_commands_status_idx").on(t.deviceId, t.status),
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
