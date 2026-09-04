import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import {
	COMMAND_STATUSES,
	DEVICE_CONNECTION_STATES,
	DEVICE_PROPOSAL_STATUSES,
} from "@/shared";
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
		credentialHash: text("credential_hash"),
		credentialRotatedAt: timestamp("credential_rotated_at"),
		revokedAt: timestamp("revoked_at"),
		// Whether this machine may run a proposed command at all. Off unless an
		// operator turns it on, and the device refuses independently as well.
		executionEnabled: boolean("execution_enabled").notNull().default(false),

		// Enrolment binds a machine to the gateway; it does not say whose machine
		// it is. The employee claims it by typing this short code — shown on their
		// own screen by `axel-cli status` after the daemon connects — into the
		// portal, which is what fills `owner_id` and makes the device visible to
		// `listMyDevices`, to the intake composer, and to the agent's device tools.
		// Stored hashed, like every other bearer value in this schema.
		claimCodeHash: text("claim_code_hash"),
		claimCodeExpiresAt: timestamp("claim_code_expires_at"),

		connected: text("connected", { enum: DEVICE_CONNECTION_STATES })
			.notNull()
			.default("offline"),
		lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
		enrolledAt: timestamp("enrolled_at"),
	},
	(t) => [
		index("devices_owner_idx").on(t.ownerId),
		index("devices_connected_idx").on(t.connected),
		uniqueIndex("devices_claim_code_uidx").on(t.claimCodeHash),
	],
);

export const deviceEnrolmentTokens = pgTable(
	"device_enrolment_tokens",
	{
		id: text("id").primaryKey(),
		tokenHash: text("token_hash").notNull(),
		createdBy: text("created_by").references(() => user.id, {
			onDelete: "set null",
		}),
		expiresAt: timestamp("expires_at").notNull(),
		usedAt: timestamp("used_at"),
		usedByDeviceId: text("used_by_device_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("device_enrolment_tokens_hash_uidx").on(t.tokenHash)],
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
		// Set only for a command a human authorised. Its absence is what makes
		// "who approved this" answerable: nothing else in this row can say.
		proposalId: text("proposal_id"),

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

/**
 * A command Axel proposes and a human authorises.
 *
 * Axel never executes: it writes one of these and the run escalates, because a
 * run holds a lease measured in seconds and a person decides in hours. Approval
 * dispatches the command outside any run, from `command` on this row rather than
 * from anything the model said afterwards, and `digest` is checked again at that
 * moment so an edited proposal cannot ride an old approval.
 */
export const deviceCommandProposals = pgTable(
	"device_command_proposals",
	{
		id: text("id").primaryKey(),
		deviceId: text("device_id")
			.notNull()
			.references(() => devices.id, { onDelete: "cascade" }),
		ticketId: text("ticket_id").notNull(),
		runId: text("run_id").references(() => agentRuns.id, {
			onDelete: "set null",
		}),
		stepId: text("step_id").references(() => agentSteps.id, {
			onDelete: "set null",
		}),

		// The argument vector, never a command line. No shell is involved.
		command: jsonb("command").notNull(),
		digest: text("digest").notNull(),
		// Whoever started the run that proposed this, copied at proposal time so
		// the check survives the run being deleted. Null for auto-dispatch.
		requestedById: text("requested_by_id").references(() => user.id, {
			onDelete: "set null",
		}),
		reason: text("reason").notNull(),

		status: text("status", { enum: DEVICE_PROPOSAL_STATUSES })
			.notNull()
			.default("proposed"),
		// The proposal is the audit record and survives the approver's account;
		// only the personal link is dropped. RESTRICT would have blocked the
		// deletion outright rather than preserving anything.
		approvedById: text("approved_by_id").references(() => user.id, {
			onDelete: "set null",
		}),
		decidedAt: timestamp("decided_at"),
		decisionNote: text("decision_note"),
		// An undecided proposal goes stale. Stale authorisation is not
		// authorisation, so it expires rather than waiting indefinitely.
		expiresAt: timestamp("expires_at").notNull(),
		dispatchedCommandId: text("dispatched_command_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("device_command_proposals_status_idx").on(t.status, t.createdAt),
		index("device_command_proposals_device_idx").on(t.deviceId, t.status),
		index("device_command_proposals_ticket_idx").on(t.ticketId),
		index("device_command_proposals_run_idx").on(t.runId),
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
