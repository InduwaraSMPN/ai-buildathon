export const attachmentCopy = {
	title: "Attachments",
	loading: "Loading attachments…",
	loadError: "Could not load attachments. Try again.",
	empty: "No attachments",
	linkUrlPrompt: "Link URL",
	linkNamePrompt: "Link name",
	addLink: "Add link",
	attachFiles: "Attach files",
	uploaded: "Attachments uploaded",
	uploadFailed: "We couldn’t upload your attachments. Please try again.",
} as const;

export const requestFormCopy = {
	summaryLabel: "Short summary",
	incidentDetailsLabel: "What’s happening?",
	setupDetailsLabel: "What do you need?",
	incidentSummaryPlaceholder: "Example: I can’t connect to the office Wi-Fi",
	setupSummaryPlaceholder: "Example: Set up access to the design tools",
	incidentDetailsPlaceholder:
		"Tell us what you expected, what happened instead, and when it started.",
	setupDetailsPlaceholder: "Tell us what you need and who it is for.",
	summaryTooShort: "Please add a short summary so we know what you need.",
	summaryTooLong: "Please keep the summary to 160 characters or fewer.",
	detailsTooShort: "Please add a few more details so we can help.",
	detailsTooLong: "Please shorten the details to 10,000 characters or fewer.",
	detailsError: "Please check the summary and details.",
	requestTypeLegend: "What kind of help do you need?",
	affectedPeopleLegend: "Who else is affected?",
	timingLegend: "How soon do you need this?",
	privacyTitle: "Keep sensitive information private",
	privacyDescription:
		"Please don’t include passwords, access codes, or other sensitive information.",
	devicesLoading: "Checking for your computers…",
	devicesError: "We couldn’t check your computers right now.",
	extraDetailsLoading: "Loading additional details…",
	extraDetailsError: "We couldn’t load the additional details.",
	deviceLabel: "Is this about one of your computers?",
	recentDevice: "Use my most recently seen computer",
	lastSeen: "last seen",
	catalogueLoading: "Loading available requests…",
	catalogueError: "We couldn’t load the available requests.",
	catalogueLabel: "What would you like us to set up?",
	cataloguePlaceholder: "Choose a request",
	catalogueEmpty: "There are no setup requests available right now.",
	catalogueUnavailable:
		"This request does not have an online form yet. Please choose another request.",
	tryAgain: "Try again",
	cancel: "Cancel",
	send: "Send request",
	sending: "Sending…",
	sent: "Request sent",
	sendError: "We couldn’t send your request. Please try again.",
} as const;

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
	pending: {
		label: "Waiting for your reply",
		detail: "Support needs a little more information from you.",
	},
	resolved: { label: "Resolved", detail: "A solution is ready for you." },
	escalated: {
		label: "With a specialist",
		detail: "A specialist is taking a closer look.",
	},
	closed: { label: "Closed", detail: "This request is complete." },
};

export const approvalStatusCopy: Record<
	string,
	{ label: string; detail: string }
> = {
	waiting_for_approval: {
		label: "Waiting for approval",
		detail: "We’ll start once the right person has approved your request.",
	},
	approved: { label: "Approved", detail: "Your request can now move forward." },
	rejected: {
		label: "Couldn’t be approved",
		detail: "The approver did not approve this request.",
	},
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
	pending: "Waiting for your reply",
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
	pending: "We’re waiting for your reply before work can continue.",
	escalated:
		"A specialist is now looking at your request. They’ll use the details here and follow up when there’s an update.",
};

export const isFinishedTicket = (status: string) => status === "closed";

export const getTicketStage = (status: string) => stages[status] ?? "In review";

export const getProgressMarkerCopy = (marker: string | null) =>
	marker ? progressMarkerCopy[marker] : undefined;
