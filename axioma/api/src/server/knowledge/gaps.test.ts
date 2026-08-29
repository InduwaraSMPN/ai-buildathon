import assert from "node:assert/strict";
import test from "node:test";

import { normalizeKnowledgeText, planKnowledgeGaps } from "./gaps";

test("normalizes titles and clusters equivalent unresolved knowledge gaps", () => {
	const gaps = planKnowledgeGaps(
		[
			{ id: "ticket-2", title: " VPN—Login   Fáilure " },
			{ id: "ticket-1", title: "vpn login failure" },
		],
		[],
	);

	assert.equal(
		normalizeKnowledgeText(" VPN—Login   Fáilure "),
		"vpn login failure",
	);
	assert.deepEqual(gaps, [
		{
			id: "knowledge-gap-2b5d3ececafffa7c211c35b8",
			label: "vpn login failure",
			keywords: ["vpn", "login", "failure"],
			ticketIds: ["ticket-1", "ticket-2"],
		},
	]);
});

test("omits tickets whose title terms are covered by published knowledge", () => {
	assert.deepEqual(
		planKnowledgeGaps(
			[
				{ id: "covered", title: "Reset VPN password" },
				{ id: "gap", title: "Printer paper jam" },
			],
			[
				{
					title: "How to reset your VPN password",
					summary: null,
					body: "Follow these steps.",
				},
			],
		).map(({ label, ticketIds }) => ({ label, ticketIds })),
		[{ label: "Printer paper jam", ticketIds: ["gap"] }],
	);
});

test("cluster and link plans are deterministic across input order", () => {
	const tickets = [
		{ id: "b", title: "Email outage" },
		{ id: "a", title: "email outage" },
		{ id: "c", title: "Laptop battery" },
	];
	assert.deepEqual(
		planKnowledgeGaps(tickets, []),
		planKnowledgeGaps(tickets.toReversed(), []),
	);
});
