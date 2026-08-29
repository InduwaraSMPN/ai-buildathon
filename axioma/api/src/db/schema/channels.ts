import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { tickets } from "./tickets";

export const ticketOrigins = pgTable(
	"ticket_origins",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		name: text("name").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("ticket_origins_key_uidx").on(t.key)],
);

export const messagingChannels = pgTable(
	"messaging_channels",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		name: text("name").notNull(),
		kind: text("kind", {
			enum: ["webchat", "sms", "social", "other"],
		}).notNull(),
		defaultOriginId: text("default_origin_id").references(
			() => ticketOrigins.id,
			{
				onDelete: "set null",
			},
		),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("messaging_channels_key_uidx").on(t.key),
		index("messaging_channels_default_origin_id_idx").on(t.defaultOriginId),
	],
);

export const messagingThreads = pgTable(
	"messaging_threads",
	{
		id: text("id").primaryKey(),
		channelId: text("channel_id")
			.notNull()
			.references(() => messagingChannels.id, {
				onDelete: "cascade",
			}),
		externalThreadId: text("external_thread_id").notNull(),
		ticketId: text("ticket_id").references(() => tickets.id, {
			onDelete: "set null",
		}),
		originKey: text("origin_key")
			.notNull()
			.references(() => ticketOrigins.key, { onDelete: "restrict" }),
		participantRef: text("participant_ref"),
		openedAt: timestamp("opened_at").notNull(),
		lastMessageAt: timestamp("last_message_at").notNull(),
	},
	(t) => [
		uniqueIndex("messaging_threads_external_uidx").on(
			t.channelId,
			t.externalThreadId,
		),
		index("messaging_threads_ticket_idx").on(t.ticketId, t.lastMessageAt),
	],
);

export const channelMessages = pgTable(
	"channel_messages",
	{
		id: text("id").primaryKey(),
		threadId: text("thread_id")
			.notNull()
			.references(() => messagingThreads.id, {
				onDelete: "cascade",
			}),
		externalMessageId: text("external_message_id").notNull(),
		direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
		senderRef: text("sender_ref"),
		body: text("body").notNull(),
		raw: jsonb("raw"),
		receivedAt: timestamp("received_at").notNull(),
	},
	(t) => [
		uniqueIndex("channel_messages_external_uidx").on(
			t.threadId,
			t.externalMessageId,
		),
		index("channel_messages_thread_idx").on(t.threadId, t.receivedAt),
	],
);
