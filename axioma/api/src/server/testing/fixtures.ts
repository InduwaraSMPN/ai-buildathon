/**
 * Fixture bookkeeping for the suites that write through `@/db`.
 *
 * `@/db` reads one `DATABASE_URL`, and in development that is the same database
 * the product demo is shown from. A suite that inserts and does not remove
 * therefore does not leave residue in a scratch schema — it publishes rows into
 * the demo, where they surface in the ticket queue and the device command
 * review page. This module makes forgetting hard: ids are minted here so the
 * rows are recognisable, every insert is recorded, and `withFixtures` removes
 * the lot from a `finally` whether the body passed or threw.
 */

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import {
	agentRuns,
	deviceCommandProposals,
	deviceCommands,
	devices,
	tickets,
	user,
} from "@/db/schema";

/**
 * Every generated fixture id carries this prefix, so residue from a run that
 * died before its cleanup could finish is identifiable by shape alone and
 * `scripts/purge-test-residue.mjs` can sweep it without guessing at demo rows.
 */
export const TEST_ID_PREFIX = "test-";

export const testId = (kind: string) =>
	`${TEST_ID_PREFIX}${kind}-${crypto.randomUUID()}`;

/**
 * The names and titles below are deliberately stated rather than randomised.
 * The purge script matches on them as a second predicate alongside the id
 * prefix, which keeps it able to recognise residue that predates this module.
 */
export const TEST_USER_NAME = "Proposal test reporter";
export const TEST_TICKET_TITLE = "Device command proposal test";

export interface Fixtures {
	/** Mints a tracked-shaped id without inserting anything. */
	id(kind: string): string;
	user(values?: { id?: string; name?: string }): Promise<string>;
	ticket(values?: {
		id?: string;
		reporterId?: string;
		title?: string;
		body?: string;
	}): Promise<string>;
	device(values?: { id?: string; executionEnabled?: boolean }): Promise<string>;
	run(values: { ticketId: string; startedById?: string }): Promise<string>;
	/** Records a row this module did not insert so cleanup still claims it. */
	trackDevice(id: string): void;
	trackTicket(id: string): void;
}

function createFixtures(): Fixtures & { cleanup(): Promise<void> } {
	const userIds: string[] = [];
	const ticketIds: string[] = [];
	const deviceIds: string[] = [];
	const runIds: string[] = [];

	const seedUser: Fixtures["user"] = async (values = {}) => {
		const id = values.id ?? testId("user");
		await db.insert(user).values({
			id,
			name: values.name ?? TEST_USER_NAME,
			// `.invalid` is reserved by RFC 2606, so a fixture address can never
			// collide with a real mailbox the mail suites might reach.
			email: `${id}@example.invalid`,
			emailVerified: false,
		});
		userIds.push(id);
		return id;
	};

	return {
		id: testId,

		user: seedUser,

		async ticket(values = {}) {
			const reporterId = values.reporterId ?? (await seedUser());
			const id = values.id ?? testId("ticket");
			// Every other column carries a default; status defaults to a seeded key.
			await db.insert(tickets).values({
				id,
				reporterId,
				title: values.title ?? TEST_TICKET_TITLE,
				body: values.body ?? "Seeded by a *.db.test.ts suite.",
			});
			ticketIds.push(id);
			return id;
		},

		async device(values = {}) {
			const id = values.id ?? testId("device");
			await db.insert(devices).values({
				id,
				hostname: `test-host-${id.slice(-8)}`,
				executionEnabled: values.executionEnabled ?? false,
			});
			deviceIds.push(id);
			return id;
		},

		async run(values) {
			const id = testId("run");
			await db.insert(agentRuns).values({
				id,
				ticketId: values.ticketId,
				startedById: values.startedById,
			});
			runIds.push(id);
			return id;
		},

		trackDevice(id) {
			deviceIds.push(id);
		},

		trackTicket(id) {
			ticketIds.push(id);
		},

		/**
		 * Deletes child rows before their parents. Most of these edges cascade,
		 * but `device_command_proposals.ticket_id` carries no foreign key at all,
		 * so a proposal outlives the ticket it names unless it is removed first.
		 */
		async cleanup() {
			if (deviceIds.length || ticketIds.length) {
				const claimed = [
					deviceIds.length
						? inArray(deviceCommandProposals.deviceId, deviceIds)
						: undefined,
					ticketIds.length
						? inArray(deviceCommandProposals.ticketId, ticketIds)
						: undefined,
				].filter((clause) => clause !== undefined);
				for (const clause of claimed) {
					await db.delete(deviceCommandProposals).where(clause);
				}
			}
			if (deviceIds.length) {
				await db
					.delete(deviceCommands)
					.where(inArray(deviceCommands.deviceId, deviceIds));
				await db.delete(devices).where(inArray(devices.id, deviceIds));
			}
			if (runIds.length) {
				await db.delete(agentRuns).where(inArray(agentRuns.id, runIds));
			}
			if (ticketIds.length) {
				await db.delete(tickets).where(inArray(tickets.id, ticketIds));
			}
			if (userIds.length) {
				await db.delete(user).where(inArray(user.id, userIds));
			}
		},
	};
}

/**
 * Runs one test body with a fixture set that is always torn down.
 *
 * Seeding happens inside the `try`, which is the part that is easy to get
 * wrong: a helper called before the `try` leaks everything it managed to insert
 * when a later insert throws.
 */
export async function withFixtures(
	body: (fixtures: Fixtures) => Promise<void>,
): Promise<void> {
	const fixtures = createFixtures();
	try {
		await body(fixtures);
	} finally {
		await fixtures.cleanup();
	}
}
