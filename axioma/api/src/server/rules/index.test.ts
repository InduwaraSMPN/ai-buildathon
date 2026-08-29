import assert from "node:assert/strict";
import test from "node:test";
import {
	evaluateTicketRules,
	measureTokensPerTicket,
	type RuleTicket,
	routesToHuman,
	type TicketRule,
} from ".";

const ticket = (overrides: Partial<RuleTicket> = {}): RuleTicket => ({
	title: "Cannot connect to production VPN",
	body: "VPN access stopped after password reset",
	requesterId: "user-1",
	requesterDepartment: "engineering",
	recordType: "incident",
	impact: "medium",
	urgency: "medium",
	...overrides,
});

const rule = (overrides: Partial<TicketRule>): TicketRule => ({
	id: "rule-1",
	name: "VPN incidents",
	position: 10,
	enabled: true,
	criteria: [],
	actions: [],
	...overrides,
});

test("fully classifies a matching ticket without model work", () => {
	const result = evaluateTicketRules(ticket(), [
		rule({
			criteria: [
				{
					field: "requesterDepartment",
					operator: "equals",
					value: "engineering",
				},
				{ field: "title", operator: "contains", value: "vpn" },
			],
			actions: [
				{ type: "set_service", value: "svc-access" },
				{ type: "set_impact", value: "high" },
				{ type: "set_urgency", value: "high" },
				{ type: "set_record_type", value: "service_request" },
				{ type: "set_route", value: "identity" },
				{ type: "set_team", value: "identity-team" },
				{ type: "set_assignee", value: "analyst-1" },
			],
		}),
	]);

	assert.deepEqual(result.patch, {
		serviceId: "svc-access",
		impact: "high",
		urgency: "high",
		recordType: "service_request",
		route: "identity",
		teamId: "identity-team",
		assigneeId: "analyst-1",
	});
	assert.equal(result.firings[0]?.applied.length, 7);
	assert.deepEqual(result.firings[0]?.skipped, []);
});

test("returns partial settlement for Axel to complete", () => {
	const result = evaluateTicketRules(ticket(), [
		rule({
			criteria: [
				{ field: "body", operator: "contains", value: "password reset" },
			],
			actions: [{ type: "set_route", value: "identity" }],
		}),
	]);

	assert.deepEqual(result.patch, { route: "identity" });
	assert.equal(result.ticket.serviceId, undefined);
	assert.deepEqual(result.settledActions, ["set_route"]);
});

test("orders deterministically and applies first match per action", () => {
	const result = evaluateTicketRules(ticket(), [
		rule({
			id: "later",
			name: "Later",
			position: 20,
			actions: [{ type: "set_impact", value: "low" }],
		}),
		rule({
			id: "b",
			name: "Same position B",
			position: 10,
			actions: [{ type: "set_impact", value: "medium" }],
		}),
		rule({
			id: "a",
			name: "Same position A",
			position: 10,
			actions: [{ type: "set_impact", value: "high" }],
		}),
	]);

	assert.equal(result.patch.impact, "high");
	assert.deepEqual(
		result.firings.map((firing) => firing.ruleId),
		["a", "b", "later"],
	);
	assert.deepEqual(
		result.firings.slice(1).map((firing) => firing.skipped[0]?.reason),
		["action_already_set", "action_already_set"],
	);
});

test("later criteria see values settled by earlier rules", () => {
	const result = evaluateTicketRules(ticket(), [
		rule({
			id: "classify",
			position: 1,
			actions: [{ type: "set_service", value: "svc-access" }],
		}),
		rule({
			id: "route",
			position: 2,
			criteria: [
				{ field: "serviceId", operator: "equals", value: "svc-access" },
			],
			actions: [{ type: "set_route", value: "identity" }],
		}),
	]);
	assert.deepEqual(result.patch, {
		serviceId: "svc-access",
		route: "identity",
	});
});

test("detects whether applied rules route a ticket to a human", () => {
	const routed = evaluateTicketRules(ticket(), [
		rule({ actions: [{ type: "route_human" }] }),
	]);
	const automated = evaluateTicketRules(ticket(), [
		rule({ actions: [{ type: "set_service", value: "svc-access" }] }),
	]);
	assert.equal(routesToHuman(routed.firings), true);
	assert.equal(routesToHuman(automated.firings), false);
});

test("measures tokens per unique ticket including zero-run tickets", () => {
	assert.deepEqual(
		measureTokensPerTicket(
			["a", "b", "b", "c"],
			[
				{ ticketId: "a", promptTokens: 80, completionTokens: 20 },
				{ ticketId: "a", promptTokens: 30, completionTokens: null },
				{ ticketId: "b", promptTokens: null, completionTokens: 20 },
				{ ticketId: "outside", promptTokens: 999, completionTokens: 999 },
			],
		),
		{
			ticketCount: 3,
			promptTokens: 110,
			completionTokens: 40,
			totalTokens: 150,
			tokensPerTicket: 50,
		},
	);
	assert.equal(measureTokensPerTicket([], []).tokensPerTicket, null);
});
