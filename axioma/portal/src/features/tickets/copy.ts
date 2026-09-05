import { STATE_TYPES, type StateType } from "@/sdk/shared";

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
	typeRejected: (name: string) =>
		`${name} isn’t a supported image. Attach a PNG, JPEG, or WebP.`,
	tooLarge: (name: string) =>
		`${name} is too large. Attach an image under 2 MB.`,
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

export const statusDetailCopy: Record<StateType, string> = {
	new: "Your request is in the queue and ready for review.",
	open: "Support is working on your request.",
	pending: "Support needs a little more information from you.",
	resolved: "A solution is ready for you.",
	closed: "This request is complete.",
	merged: "This request was merged into another request.",
	cancelled: "This request was cancelled.",
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

export const ticketStages = ["Received", "Working on it", "Done"] as const;

const stageIndexes: Record<StateType, number> = {
	new: 0,
	open: 1,
	pending: 1,
	resolved: 2,
	closed: 2,
	merged: 2,
	cancelled: 2,
};

export const getStageIndex = (stateType: string) =>
	isStateType(stateType) ? stageIndexes[stateType] : 0;

const stages: Record<StateType, string> = {
	new: ticketStages[0],
	open: ticketStages[1],
	pending: "Waiting for your reply",
	resolved: ticketStages[2],
	closed: "Finished",
	merged: ticketStages[2],
	cancelled: "Finished",
};

export const progressMarkerCopy: Record<string, string> = {
	gathering_evidence: "Gathering the details needed to help",
	checking_device: "Checking your computer’s settings",
	checking_service: "Checking the service involved",
	applying_fix: "Applying a fix",
	verifying_fix: "Making sure the fix worked",
	handing_to_person: "Sharing the details with a specialist",
};

export const isFinishedTicket = (stateType: string) => stateType === "closed";

export function isStateType(value: string): value is StateType {
	return (STATE_TYPES as readonly string[]).includes(value);
}

export const getTicketStage = (stateType: string) =>
	isStateType(stateType) ? stages[stateType] : fallbackStatusCopy.label;

export const getProgressMarkerCopy = (marker: string | null) =>
	marker ? progressMarkerCopy[marker] : undefined;

export const timelineCopy = {
	heading: "Request progress",
	complete: "Complete",
	current: "Current",
	upcoming: "Upcoming",
} as const;

export const conversationCopy = {
	replySent: "Reply sent",
	replyError: "We couldn’t send your reply. Please try again.",
	title: "Conversation",
	reporter: "You",
	staff: "Support",
	empty: "No replies yet. Send a message if you have more information.",
	replyLabel: "Reply to support",
	replyPlaceholder: "Add an update or answer support’s question…",
	sending: "Sending…",
	sendReply: "Send reply",
	feedbackSaved: "Thanks for your feedback",
	feedbackError: "We couldn’t save your feedback. Please try again.",
	feedbackThanks: "Thanks for rating your support experience.",
	feedbackTitle: "How was your support experience?",
	ratingLabel: "Support rating",
	feedbackLabel: "Feedback (optional)",
	feedbackPlaceholder: "Anything else you’d like us to know? (optional)",
	submitting: "Submitting…",
	submitFeedback: "Submit feedback",
	stars: (value: number) => `${value} out of 5 stars`,
} as const;

export const resolutionCopy = {
	closedTitle: "Request closed",
	fixed: "Fixed",
	confirmedClosed: "Confirmed closed",
	reopen: "Reopen request",
	reopenTitle: "Reopen this request?",
	reopenDescription: "We’ll move it back into the support queue.",
	keepClosed: "Keep closed",
	resolvedTitle: "What changed",
	escalatedTitle: "A specialist is helping",
	escalatedDescription:
		"A person is now handling your request. They’ll review the details and follow up when there’s an update.",
	resolvedNoteLabel: "What is still wrong?",
	escalatedNoteLabel: "What else should the specialist know?",
	notePlaceholder: "Add a short note",
	solved: "This solved it",
	closeTitle: "Close this request?",
	closeDescription:
		"Confirm that the solution worked and this request can be closed.",
	goBack: "Go back",
	close: "Close request",
	notFixed: "This didn’t fix it",
	sendDetail: "Send more detail",
} as const;

export const homeCopy = {
	pageTitle: "My requests · Axiōma",
	title: "My requests",
	description: "View and track all of your support requests.",
	newRequest: "New request",
	requests: "Your requests",
	request: "request",
	requestsPlural: "requests",
	emptyTitle: "No requests yet",
	emptyDescription:
		"When something gets in the way of your work, start here. We’ll keep every update in one place.",
	createFirst: "Create your first request",
	active: "Active requests",
	finished: "Finished requests",
	stage: "Stage:",
	resolutionReady: "Resolution ready",
	updated: "Updated",
} as const;

export const ticketUiCopy = {
	loading: "Loading requests",
	errorTitle: "We couldn’t load this right now",
	errorDescription: "Check your connection and try again.",
	tryAgain: "Try again",
} as const;

export const ticketDetailCopy = {
	updated: "Request updated",
	updateError: "We couldn’t update this request. Please try again.",
	pageTitle: "Request details · Axiōma",
	loading: "Loading request",
	notFound: "Request not found",
	notFoundDescription:
		"This request may have been removed or may not belong to your account.",
	back: "Back to requests",
	opened: "Opened",
	request: "Request",
	addDetail: "Add more detail",
	shared: "What you shared",
	approval: "Approval",
	information: "Request information",
	status: "Status",
	deviceAttached: "Device attached",
	yes: "Yes",
	lastUpdated: "Last updated",
	addDetailDescription:
		"Share anything else that could help with this request.",
	additionalDetail: "Additional detail",
	notePlaceholder: "Add a short note",
} as const;
