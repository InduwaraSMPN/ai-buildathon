import assert from "node:assert/strict";
import test from "node:test";
import {
	assertCabVoteAuthorized,
	canChangeProceed,
	changeApproval,
} from "./changes";

const required = (vote?: "approve" | "reject" | "abstain") => ({
	isRequired: true,
	vote,
});

test("standard changes are preapproved", () => {
	assert.equal(changeApproval("standard", []), "approved");
	assert.equal(canChangeProceed("standard", [required()]), true);
});

test("a CAB-required change with no required members remains pending", () => {
	assert.equal(changeApproval("normal", []), "pending_approval");
	assert.equal(changeApproval("emergency", [], false), "approved");
});

test("normal changes wait until every required member approves", () => {
	assert.equal(
		canChangeProceed("normal", [required("approve"), required()]),
		false,
	);
	assert.equal(
		canChangeProceed("normal", [required("approve"), required("abstain")]),
		false,
	);
	assert.equal(
		canChangeProceed("normal", [required("approve"), required("approve")]),
		true,
	);
});

test("majority approval accepts more than half of required members", () => {
	assert.equal(
		changeApproval(
			"normal",
			[required("approve"), required("approve"), required()],
			true,
			"majority",
		),
		"approved",
	);
});

test("non-required votes do not hold approval, but any rejection blocks it", () => {
	assert.equal(
		canChangeProceed("normal", [required("approve"), { isRequired: false }]),
		true,
	);
	assert.equal(
		changeApproval("normal", [
			required("approve"),
			{ isRequired: false, vote: "reject" },
		]),
		"rejected",
	);
});

test("CAB voting requires an explicit boolean or capability", () => {
	assert.doesNotThrow(() => assertCabVoteAuthorized(true));
	assert.doesNotThrow(() => assertCabVoteAuthorized({ canVote: true }));
	assert.throws(() => assertCabVoteAuthorized(false), /Not authorized/);
	assert.throws(
		() => assertCabVoteAuthorized({ canVote: false }),
		/Not authorized/,
	);
});
