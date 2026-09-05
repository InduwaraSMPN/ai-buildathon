// Product constants: single source of truth for printable product numbers.

export const facts = {
	tools: 12,
	deviceActions: 17,
	guiSteps: 5,
	facets: 11,
	maxToolCalls: 15,
	maxModelTurns: 14,
	runDeadlineSeconds: 300,
	changeVerificationMinutes: 5,
	directoryShrinkBrakePercent: 40,
	processAllowlist: 8,
	measured: {
		checkoutFixSeconds: 30,
		checkoutFixToolCalls: 8,
		refusalSeconds: 20,
		laptopFixSeconds: 57,
		laptopFixToolCalls: 8,
		uiAutomationTokens: 1200,
		screenFacetSeconds: 3.6,
		screenFacetKb: 2.9,
		remeasure: true,
	},
} as const;

export type Facts = typeof facts;
