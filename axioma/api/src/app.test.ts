import assert from "node:assert/strict";
import test from "node:test";

test("app factory has no startup side effects and serves HTTP behavior", async () => {
	const signalListeners = ["SIGINT", "SIGTERM"].map((signal) =>
		process.listenerCount(signal),
	);
	const { createApp } = await import("./app");

	assert.deepEqual(
		["SIGINT", "SIGTERM"].map((signal) => process.listenerCount(signal)),
		signalListeners,
	);
	const app = createApp();
	const response = await app.request("/health");
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { status: "ok" });
	assert.notEqual(createApp(), app);
});
