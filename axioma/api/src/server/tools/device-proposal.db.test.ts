import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	agentRuns,
	deviceCommandProposals,
	deviceCommands,
	devices,
	roleCapabilities,
	tickets,
	user,
} from "@/db/schema";
import { grpcGateway } from "../grpc";
import {
	assertProposalDispatchable,
	commandDigest,
	proposeDeviceCommand,
} from "./device-proposal";

/**
 * The acceptance items that only a real database can answer. Everything here
 * asserts a property the plan names, not an implementation detail.
 */

const id = () => crypto.randomUUID();

async function seedDevice(executionEnabled: boolean) {
	const deviceId = id();
	await db.insert(devices).values({
		id: deviceId,
		hostname: `host-${deviceId.slice(0, 8)}`,
		executionEnabled,
	});
	return deviceId;
}

async function seedTicket() {
	const reporterId = id();
	await db.insert(user).values({
		id: reporterId,
		name: "Proposal test reporter",
		email: `${reporterId}@example.invalid`,
		emailVerified: false,
	});
	const ticketId = id();
	// Every other column carries a default; status defaults to a seeded key.
	await db.insert(tickets).values({
		id: ticketId,
		reporterId,
		title: "Device command proposal test",
		body: "Seeded by device-proposal.db.test.ts",
	});
	return ticketId;
}

test("the analyst who runs Axel cannot authorise its proposals", async () => {
	// The separation of duty this phase relies on, asserted against the seeded
	// grants rather than against the migration text.
	const analyst = await db
		.select()
		.from(roleCapabilities)
		.where(
			and(
				eq(roleCapabilities.roleId, "it-analyst"),
				eq(roleCapabilities.capability, "device.approve"),
			),
		);
	assert.equal(analyst.length, 0, "it-analyst can approve device commands");
	const platform = await db
		.select()
		.from(roleCapabilities)
		.where(
			and(
				eq(roleCapabilities.roleId, "platform-engineer"),
				eq(roleCapabilities.capability, "device.approve"),
			),
		);
	assert.equal(platform.length, 1, "nobody can approve device commands");
});

test("a device that has not opted in cannot even be proposed against", async () => {
	const deviceId = await seedDevice(false);
	const ticketId = await seedTicket();
	await assert.rejects(
		() =>
			proposeDeviceCommand(
				{
					device_id: deviceId,
					command: ["ipconfig", "/flushdns"],
					reason: "A reason long enough to satisfy the schema bound.",
				},
				{ ticketId, runId: "", stepId: "" },
			),
		/does not allow proposed commands/,
	);
	const rows = await db
		.select()
		.from(deviceCommandProposals)
		.where(eq(deviceCommandProposals.deviceId, deviceId));
	assert.equal(rows.length, 0, "a refused proposal still wrote a row");
});

test("proposing writes a pending row and nothing else", async () => {
	const deviceId = await seedDevice(true);
	const ticketId = await seedTicket();
	const command = ["ipconfig", "/flushdns"];
	const result = await proposeDeviceCommand(
		{
			device_id: deviceId,
			command,
			reason: "The resolver cache is stale and no typed action covers it.",
		},
		{ ticketId, runId: "", stepId: "" },
	);
	const [row] = await db
		.select()
		.from(deviceCommandProposals)
		.where(eq(deviceCommandProposals.id, result.proposal_id));
	assert.ok(row, "no proposal row was written");
	// Awaiting a person: unapproved, unconsumed, and bound to this exact vector.
	assert.equal(row.status, "proposed");
	assert.equal(row.approvedById, null);
	assert.equal(row.dispatchedCommandId, null);
	assert.equal(row.digest, commandDigest(command));
	assert.ok(row.expiresAt.getTime() > Date.now());
	// And it is linked to the ticket, so the escalation can carry it.
	assert.equal(row.ticketId, ticketId);
});

test("a proposal does not touch the ticket or its runs", async () => {
	// The finding that reshaped this stage: the run must not block on a human.
	// Reusing the approvals table would have frozen the ticket here.
	const deviceId = await seedDevice(true);
	const ticketId = await seedTicket();
	const before = await db
		.select()
		.from(tickets)
		.where(eq(tickets.id, ticketId));
	await proposeDeviceCommand(
		{
			device_id: deviceId,
			command: ["ipconfig", "/flushdns"],
			reason: "A reason long enough to satisfy the schema bound.",
		},
		{ ticketId, runId: "", stepId: "" },
	);
	const after = await db.select().from(tickets).where(eq(tickets.id, ticketId));
	assert.deepEqual(after[0]?.status, before[0]?.status, "ticket status moved");
	const runs = await db
		.select()
		.from(agentRuns)
		.where(eq(agentRuns.ticketId, ticketId));
	assert.equal(runs.length, 0, "proposing created or altered a run");
});

test("a device proposal never lands in the catalogue approvals queue", async () => {
	const deviceId = await seedDevice(true);
	const ticketId = await seedTicket();
	await proposeDeviceCommand(
		{
			device_id: deviceId,
			command: ["ipconfig", "/flushdns"],
			reason: "A reason long enough to satisfy the schema bound.",
		},
		{ ticketId, runId: "", stepId: "" },
	);
	// approvals is what gates ticket resolution and blocks agent dispatch. A
	// device proposal must not appear there, or a rejection would brick the
	// ticket — the failure the earlier design was abandoned for.
	const rows = await db.execute(
		`select count(*)::int as count from approvals where ticket_id = '${ticketId}'` as never,
	);
	const count = (rows as unknown as Array<{ count: number }>)[0]?.count ?? 0;
	assert.equal(count, 0, "a device proposal created a catalogue approval");
});

/**
 * `device_commands` had no actor column at all before this phase, so "who
 * authorised this command" was unanswerable. The row is written before the
 * device is even looked up, which is what lets this be asserted without one.
 */
test("a dispatched command records the approval that authorised it", async () => {
	const deviceId = await seedDevice(true);
	const proposalId = id();
	// Not awaited: with no device connected the call waits for its timeout. The
	// row we care about is written before that wait begins.
	const pending = grpcGateway
		.dispatchDeviceTool(
			"",
			"device_run_command",
			{
				device_id: deviceId,
				command: ["ipconfig", "/flushdns"],
				proposal_id: proposalId,
			},
			undefined,
			proposalId,
		)
		.catch(() => undefined);

	let row: { proposalId: string | null; tool: string } | undefined;
	for (let attempt = 0; attempt < 40 && !row; attempt++) {
		[row] = await db
			.select({
				proposalId: deviceCommands.proposalId,
				tool: deviceCommands.tool,
			})
			.from(deviceCommands)
			.where(eq(deviceCommands.deviceId, deviceId));
		if (!row) await new Promise((resolve) => setTimeout(resolve, 50));
	}
	assert.ok(row, "no device command row was written");
	assert.equal(
		row.proposalId,
		proposalId,
		"the command does not name its approval",
	);
	assert.equal(row.tool, "device_run_command");

	// Clears the pending timeout so the suite does not wait it out.
	await grpcGateway.close();
	await pending;
});

/**
 * The regression this design exists for. Reusing the `approvals` table would
 * have left a rejected proposal blocking `startTicketRun` and every resolve,
 * close and assign on that ticket, permanently and with no way back. Assert the
 * property directly: after a rejection and after an expiry, the ticket carries
 * nothing that any guard reads.
 */
test("a rejected or expired proposal leaves the ticket fully operable", async () => {
	const deviceId = await seedDevice(true);
	const ticketId = await seedTicket();
	const propose = async () =>
		(
			await proposeDeviceCommand(
				{
					device_id: deviceId,
					command: ["ipconfig", "/flushdns"],
					reason: "A reason long enough to satisfy the schema bound.",
				},
				{ ticketId, runId: "", stepId: "" },
			)
		).proposal_id;

	for (const [outcome, patch] of [
		["rejected", { status: "rejected" as const, decidedAt: new Date() }],
		["expired", { status: "expired" as const }],
	]) {
		const proposalId = await propose();
		await db
			.update(deviceCommandProposals)
			.set(patch as never)
			.where(eq(deviceCommandProposals.id, proposalId));

		// The two guards that froze tickets in the abandoned design read the
		// approvals table. A device proposal must leave no trace there.
		const approvals = await db.execute(
			`select count(*)::int as count from approvals where ticket_id = '${ticketId}'` as never,
		);
		assert.equal(
			(approvals as unknown as Array<{ count: number }>)[0]?.count ?? 0,
			0,
			`a ${outcome} proposal created a catalogue approval`,
		);

		// The ticket itself is untouched, so nothing blocks resolve or close.
		const [ticket] = await db
			.select()
			.from(tickets)
			.where(eq(tickets.id, ticketId));
		assert.ok(ticket, `the ${outcome} proposal removed the ticket`);
		assert.equal(ticket.resolution, null);

		// And the proposal is terminal: it cannot later be dispatched.
		const [row] = await db
			.select()
			.from(deviceCommandProposals)
			.where(eq(deviceCommandProposals.id, proposalId));
		assert.ok(row, `the ${outcome} proposal row vanished`);
		assert.throws(() =>
			assertProposalDispatchable({
				status: row.status,
				expiresAt: row.expiresAt,
				approvedById: row.approvedById,
				command: row.command,
				digest: row.digest,
				executionEnabled: true,
				dispatchedCommandId: row.dispatchedCommandId,
			}),
		);
	}

	// A second proposal on the same ticket is allowed — the per-ticket unique
	// index that made the earlier design collide does not exist here.
	assert.notEqual(await propose(), await propose());
});

/**
 * Separation of duty, now enforced rather than delegated to role design. The
 * capability split keeps analysts out; this closes the remaining case, where one
 * person holds both roles and could approve what their own run proposed.
 */
test("a proposal records who set its run going", async () => {
	const deviceId = await seedDevice(true);
	const ticketId = await seedTicket();
	const starterId = id();
	await db.insert(user).values({
		id: starterId,
		name: "Run starter",
		email: `${starterId}@example.invalid`,
		emailVerified: false,
	});
	const runId = id();
	await db
		.insert(agentRuns)
		.values({ id: runId, ticketId, startedById: starterId });

	const proposed = await proposeDeviceCommand(
		{
			device_id: deviceId,
			command: ["ipconfig", "/flushdns"],
			reason: "A reason long enough to satisfy the schema bound.",
		},
		{ ticketId, runId, stepId: "" },
	);
	const [row] = await db
		.select()
		.from(deviceCommandProposals)
		.where(eq(deviceCommandProposals.id, proposed.proposal_id));
	assert.ok(row, "no proposal row was written");
	assert.equal(
		row.requestedById,
		starterId,
		"the proposal does not know who caused it",
	);

	// An auto-dispatched run has no human behind it, and must not be blocked.
	const autoRunId = id();
	await db.insert(agentRuns).values({ id: autoRunId, ticketId });
	const auto = await proposeDeviceCommand(
		{
			device_id: deviceId,
			command: ["ipconfig", "/all"],
			reason: "A reason long enough to satisfy the schema bound.",
		},
		{ ticketId, runId: autoRunId, stepId: "" },
	);
	const [autoRow] = await db
		.select()
		.from(deviceCommandProposals)
		.where(eq(deviceCommandProposals.id, auto.proposal_id));
	assert.ok(autoRow, "no proposal row for the auto-dispatched run");
	assert.equal(autoRow.requestedById, null);
});
