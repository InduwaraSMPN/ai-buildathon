export const intakeCopy = {
	pageTitle: "New request · Axiōma",
	eyebrow: "New support request",
	backToRequests: "Back to requests",
	composerTitle: "What can we help with?",
	composerDescription:
		"Describe the problem in your own words. We’ll check for a known answer and draft the request for you to review before it’s sent.",
	composerPlaceholder: "Describe what’s getting in the way…",
	manualEscape: "Fill in the form myself",
	manualCardTitle: "Request details",
	submitHint: "Enter to send, Shift + Enter for a new line",
	/**
	 * §10 seeds the composer chips from the request catalogue; these are the
	 * deliberate hand-written stand-ins for an empty or still-loading catalogue.
	 */
	fallbackSuggestions: [
		"My laptop won’t turn on",
		"I need to request new software",
		"I can’t connect to the office Wi-Fi",
	],
	visionNotice: "Axel will read your screenshots to fill in the form",
	privacyDescription:
		"Don’t include passwords or access codes, even in screenshots.",
	statusLabel: {
		retrieving: "Searching help articles…",
		reading_attachments: "Reading your screenshot…",
		drafting: "Drafting your request…",
		classifying: "Understanding your request…",
	},
	deflectionSolved: "This solved it",
	deflectionContinue: "Create a request anyway",
	createAnywayMessage:
		"Please create a support request for this anyway, thanks.",
	bannerTitle: "Drafted from your description",
	bannerDescription: "Check it before sending.",
	needsInputHeading: "Needs your input",
	fieldFilledByAi: "Filled by AI",
	revertToDraft: "Revert to draft",
	confirmSubcategoryHeading: "Confirm where this request should go",
	confirmSubcategory:
		"This request will be routed to “{subcategory}”. Confirm before sending.",
	confirmSubcategoryAction: "Confirm and continue",
	approveAndSend: "Approve and send",
	sending: "Sending…",
	sendError: "We couldn’t send your request. Please try again.",
	conversationTab: "Conversation",
	requestTab: "Your request",
	newMessage: "New message",
	attachFiles: "Attach files",
	attachmentUploading: "Uploading…",
	attachmentRemoving: "Removing…",
	removeAttachment: "Remove attachment",
	removeAttachmentFailed: (name: string) =>
		`We couldn’t remove ${name}. It is still attached to this request.`,
	attachmentTypeRejected: (name: string) =>
		`${name} isn’t a supported image. Attach a PNG, JPEG, or WebP.`,
	attachmentTooLarge: (name: string) =>
		`${name} is too large. Attach an image under 2 MB.`,
	attachmentTooMany: (max: number) => `You can attach up to ${max} images.`,
	readScreenshotsLabel: "Let Axel read this screenshot",
	editFurther: "Add more detail",
	incidentFallbackSummary: "A few details were left blank",
	needsInputFields: (fields: string) => `Check these before sending: ${fields}`,
	requiresAttention: "Please check the highlighted fields before sending.",
	cancelError: "We couldn’t discard this request. Please try again.",
	startError: "We couldn’t start a new request. Please try again.",
	saveError: "We couldn’t save your changes. Please try again.",
	fieldsFilled: (filled: number) =>
		`${filled} ${filled === 1 ? "field" : "fields"} filled, review before sending.`,
	draftReady: "Draft ready. Review before sending.",
	articlesSuggested: (count: number) =>
		`${count} help ${count === 1 ? "article" : "articles"} suggested.`,
	unexpectedError: "Something went wrong. Please try again.",
} as const;
