export const homeCopy = {
	pageTitle: "Home · Axiōma",
	greeting: (name: string) => `Good to see you, ${name}`,
	fallbackGreeting: "Good to see you",
	summary: (needsYou: number, moving: number) => {
		const needs = `${needsYou} ${needsYou === 1 ? "request needs" : "requests need"} something from you`;
		const progress = `${moving} ${moving === 1 ? "is" : "are"} moving`;
		return `${needs} and ${progress}.`;
	},
	requestsHeading: "My requests",
	needsYouHeading: "Needs you",
	waiting: (count: number) => `${count} waiting`,
	filtersLabel: "Filter requests",
	filters: {
		all: "All",
		needsYou: "Needs you",
		inProgress: "In progress",
		done: "Done",
	},
	viewAll: "View all requests",
	viewAllCount: (count: number) => `View all ${count} requests`,
	newRequest: "New request",
	emptyTitle: "No requests yet",
	emptyDescription:
		"When something gets in the way of your work, start here. We’ll keep every update in one place.",
	createFirst: "Create your first request",
	noFilteredRequests: "No requests in this group.",
	resolutionReady: "Resolution ready",
	waitingForReply: "Waiting for your reply",
	fixed: "Fixed",
	updated: "Updated",
	reply: "Reply",
	openRequest: (number: string) => `Open request ${number}`,
	staffAsked: "Support asked:",
	pendingFallback: "Support is waiting for your reply.",
	needsYouEmpty: "Nothing needs your attention right now.",
	updateError: "We couldn’t update this request. Please try again.",
} as const;

export type HomeFilter = keyof typeof homeCopy.filters;
