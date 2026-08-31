import assert from "node:assert/strict";
import test from "node:test";
import { calculateAgreement, type ProposalObservation } from "./agreement";

const observation = (
	proposed: string,
	actual: string,
	opened = true,
): ProposalObservation => ({ proposed, actual, opened });

test("unopened proposals are counted but not scored", () => {
	const report = calculateAgreement([
		observation("escalate", "escalate"),
		observation("escalate", "escalate", false),
		observation("patch", "patch", false),
	]);
	assert.equal(report.total, 3);
	assert.equal(report.opened, 1);
	assert.equal(report.scored, 1);
});

test("perfect agreement on a single class reports raw 1", () => {
	const report = calculateAgreement([
		observation("escalate", "escalate"),
		observation("escalate", "escalate"),
	]);
	assert.equal(report.rawAgreement, 1);
});

test("the kappa paradox is visible: high raw agreement, degenerate kappa", () => {
	// Nineteen of twenty agree, but almost everything is one class — the exact
	// shape Axel's action distribution has, and the reason raw agreement alone
	// would flatter it.
	const skewed = [
		...Array.from({ length: 19 }, () => observation("escalate", "escalate")),
		observation("patch", "escalate"),
	];
	const report = calculateAgreement(skewed);
	assert.ok((report.rawAgreement ?? 0) > 0.9);
	// Kappa collapses on the same data.
	assert.ok((report.cohensKappa ?? 1) < 0.2);
	// AC1 stays interpretable, which is why it is reported alongside.
	assert.ok((report.gwetsAC1 ?? 0) > 0.8);
});

test("kappa and AC1 agree when the distribution is balanced", () => {
	const balanced = [
		observation("escalate", "escalate"),
		observation("escalate", "escalate"),
		observation("patch", "patch"),
		observation("patch", "patch"),
	];
	const report = calculateAgreement(balanced);
	assert.equal(report.rawAgreement, 1);
	assert.equal(report.cohensKappa, 1);
	assert.equal(report.gwetsAC1, 1);
});

test("results are stratified by action class, never pooled", () => {
	const report = calculateAgreement([
		observation("escalate", "escalate"),
		observation("escalate", "escalate"),
		observation("patch", "escalate"),
	]);
	const escalate = report.byClass.find((row) => row.actionClass === "escalate");
	const patch = report.byClass.find((row) => row.actionClass === "patch");
	assert.equal(escalate?.rawAgreement, 1);
	// The class that actually disagrees is visible rather than averaged away.
	assert.equal(patch?.rawAgreement, 0);
});

test("no opened proposals yields nulls rather than a fabricated score", () => {
	const report = calculateAgreement([observation("patch", "patch", false)]);
	assert.equal(report.rawAgreement, null);
	assert.equal(report.cohensKappa, null);
	assert.equal(report.gwetsAC1, null);
});

test("an empty set does not divide by zero", () => {
	const report = calculateAgreement([]);
	assert.equal(report.total, 0);
	assert.equal(report.rawAgreement, null);
	assert.deepEqual(report.byClass, []);
});
