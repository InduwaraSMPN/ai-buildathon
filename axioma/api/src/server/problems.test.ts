import assert from "node:assert/strict";
import test from "node:test";

process.env.SKIP_ENV_VALIDATION = "true";

const { formatProblemNumber, offerIncidentResolutions, publishedWorkaround } =
	await import("./problems");

test("problem numbers use the shared yearly counter format", () => {
	assert.equal(formatProblemNumber(2026, 42), "PRB-2026-00042");
	assert.equal(formatProblemNumber(2026, 123456), "PRB-2026-123456");
	assert.throws(() => formatProblemNumber(2026, 0), RangeError);
});

test("only a published non-empty workaround is exposed", () => {
	assert.equal(
		publishedWorkaround({
			isKnownError: true,
			workaround: "Restart the gateway",
		}),
		"Restart the gateway",
	);
	assert.equal(
		publishedWorkaround({ isKnownError: false, workaround: "Draft" }),
		null,
	);
	assert.equal(
		publishedWorkaround({ isKnownError: true, workaround: "  " }),
		null,
	);
});

test("closing offers a resolution without overwriting incident resolutions", () => {
	const incidents = [
		{ ticketId: "i-1", currentResolution: null },
		{ ticketId: "i-2", currentResolution: "Already resolved differently" },
	] as const;
	const offers = offerIncidentResolutions(incidents, "Permanent fix deployed");
	assert.deepEqual(offers, [
		{
			ticketId: "i-1",
			currentResolution: null,
			resolutionOffer: "Permanent fix deployed",
		},
		{
			ticketId: "i-2",
			currentResolution: "Already resolved differently",
			resolutionOffer: "Permanent fix deployed",
		},
	]);
	assert.equal(incidents[1].currentResolution, "Already resolved differently");
});
