import assert from "node:assert/strict";
import test from "node:test";
import { createRouterClient, ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { devices, user } from "@/db/schema";
import type { Capability } from "@/shared";
import { devicesRouter } from "./devices";

const context = (userId: string, capabilities: Capability[] = []) =>
	({
		auth: null,
		session: null,
		userId,
		capabilities: new Set(capabilities),
	}) as never;

/** Two real accounts, because `devices.owner_id` is a foreign key. */
const twoUsers = async () => {
	const rows = await db.select({ id: user.id }).from(user).limit(2);
	assert.ok(rows[0] && rows[1], "the database needs two users seeded");
	return [rows[0].id, rows[1].id] as const;
};

const claimedDevice = async (ownerId: string) => {
	const id = `test-device-${crypto.randomUUID()}`;
	await db.insert(devices).values({
		id,
		ownerId,
		hostname: `host-${id.slice(-8)}`,
	});
	return id;
};

test("releasing a computer clears its owner and leaves it enrolled", async () => {
	const [ownerId] = await twoUsers();
	const deviceId = await claimedDevice(ownerId);
	const client = createRouterClient(devicesRouter, {
		context: context(ownerId),
	});

	try {
		const released = await client.releaseMyDevice({ deviceId });
		assert.equal(released.deviceId, deviceId);

		const [row] = await db
			.select({ ownerId: devices.ownerId, revokedAt: devices.revokedAt })
			.from(devices)
			.where(eq(devices.id, deviceId));
		assert.equal(row?.ownerId, null);
		// Releasing is not revoking. The machine stays enrolled and keeps dialling
		// out; only the binding to a person is gone.
		assert.equal(row?.revokedAt, null);

		const mine = await client.listMyDevices();
		assert.equal(
			mine.some((device) => device.id === deviceId),
			false,
		);
	} finally {
		await db.delete(devices).where(eq(devices.id, deviceId));
	}
});

test("releasing someone else's computer is not found and changes nothing", async () => {
	const [ownerId, strangerId] = await twoUsers();
	const deviceId = await claimedDevice(ownerId);
	const stranger = createRouterClient(devicesRouter, {
		context: context(strangerId),
	});

	try {
		await assert.rejects(
			() => stranger.releaseMyDevice({ deviceId }),
			(error) => error instanceof ORPCError && error.code === "NOT_FOUND",
		);
		const [row] = await db
			.select({ ownerId: devices.ownerId })
			.from(devices)
			.where(eq(devices.id, deviceId));
		assert.equal(row?.ownerId, ownerId);
	} finally {
		await db.delete(devices).where(eq(devices.id, deviceId));
	}
});

test("releasing a computer twice is not found the second time", async () => {
	const [ownerId] = await twoUsers();
	const deviceId = await claimedDevice(ownerId);
	const client = createRouterClient(devicesRouter, {
		context: context(ownerId),
	});

	try {
		await client.releaseMyDevice({ deviceId });
		await assert.rejects(
			() => client.releaseMyDevice({ deviceId }),
			(error) => error instanceof ORPCError && error.code === "NOT_FOUND",
		);
	} finally {
		await db.delete(devices).where(eq(devices.id, deviceId));
	}
});
