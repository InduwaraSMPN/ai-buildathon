export const requestTypeOptions = [
	{ value: "not_working", label: "Something isn’t working" },
	{
		value: "setup",
		label: "I need something set up or installed",
	},
] as const;

export const affectedPeopleOptions = [
	{ value: "me", label: "Just me" },
	{ value: "team", label: "My team" },
	{ value: "company", label: "Lots of people across the company" },
] as const;

export const timingOptions = [
	{ value: "whenever", label: "When you get to it" },
	{ value: "today", label: "Today" },
	{ value: "blocked", label: "I’m blocked right now" },
] as const;

export const requestTypeValues = {
	not_working: "incident",
	setup: "service_request",
} as const;

export const affectedPeopleValues = {
	me: "low",
	team: "medium",
	company: "high",
} as const;

export const timingValues = {
	whenever: "low",
	today: "medium",
	blocked: "high",
} as const;

export const statusCopy: Record<string, { label: string; detail: string }> = {
	open: {
		label: "Received",
		detail: "Your request is in the queue and ready for review.",
	},
	routing: {
		label: "Finding the right help",
		detail: "We’re directing your request to the best support path.",
	},
	resolving: {
		label: "In progress",
		detail: "Support is actively working on your request.",
	},
	resolved: { label: "Resolved", detail: "A solution is ready for you." },
	escalated: {
		label: "With a specialist",
		detail: "A specialist is taking a closer look.",
	},
	closed: { label: "Closed", detail: "This request is complete." },
};

export const fallbackStatusCopy = {
	label: "In review",
	detail: "We’re reviewing the latest update.",
};

export const ticketStages = [
	"Received",
	"Finding the right help",
	"Working on it",
	"Done",
] as const;

const stages: Record<string, string> = {
	open: ticketStages[0],
	routing: ticketStages[1],
	resolving: ticketStages[2],
	resolved: ticketStages[3],
	escalated: "A specialist is looking",
	closed: "Finished",
};

export const progressMarkerCopy: Record<string, string> = {
	gathering_evidence: "Gathering the details needed to help",
	checking_device: "Checking your computer’s settings",
	checking_service: "Checking the service involved",
	applying_fix: "Applying a fix",
	verifying_fix: "Making sure the fix worked",
	handing_to_person: "Sharing the details with a specialist",
};

export const activeStatusCopy: Record<string, string> = {
	open: "Your request is ready for review.",
	routing: "We’re finding the right way to help.",
	resolving: "We’re working on your request now.",
	escalated:
		"A specialist is now looking at your request. They’ll use the details here and follow up when there’s an update.",
};

export const isFinishedTicket = (status: string) => status === "closed";

export const getTicketStage = (status: string) => stages[status] ?? "In review";

export const getProgressMarkerCopy = (marker: string | null) =>
	marker ? progressMarkerCopy[marker] : undefined;
