import assert from "node:assert/strict";
import test from "node:test";
import { type ContractCoverage, resolveContractSla } from "./contracts";

const base: ContractCoverage = {
	contractId: "standard",
	serviceId: "email",
	slaId: "business-hours",
	active: true,
	startsOn: "2026-01-01",
	endsOn: null,
	timezone: "Europe/London",
	weekday: 1,
	startMinute: 9 * 60,
	endMinute: 17 * 60,
	priority: 0,
};

test("contract coverage resolves an SLA in its local service window", () => {
	assert.equal(
		resolveContractSla("email", new Date("2026-06-01T10:00:00.000Z"), [base]),
		"business-hours",
	);
	assert.equal(
		resolveContractSla("email", new Date("2026-06-01T17:00:00.000Z"), [base]),
		null,
	);
});

test("higher priority overlapping coverage wins regardless of input order", () => {
	const premium = {
		...base,
		contractId: "premium",
		slaId: "premium-sla",
		priority: 10,
	};
	const at = new Date("2026-06-01T10:00:00.000Z");
	assert.equal(resolveContractSla("email", at, [base, premium]), "premium-sla");
	assert.equal(resolveContractSla("email", at, [premium, base]), "premium-sla");
});

test("coverage uses local dates across UTC boundaries", () => {
	const tokyo = {
		...base,
		timezone: "Asia/Tokyo",
		weekday: 2,
		startsOn: "2026-06-02",
	};
	assert.equal(
		resolveContractSla("email", new Date("2026-06-02T00:30:00.000Z"), [tokyo]),
		"business-hours",
	);
});
