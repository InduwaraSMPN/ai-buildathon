export const statusCopy = {
	title: "Service status",
	summary: "See how our services have been running recently.",
	operational: "Available",
	disrupted: "Some disruption",
	uptime: "uptime",
	stripLabel: (serviceName: string) =>
		`${serviceName} availability over 90 days`,
	emptyTitle: "Status is not available yet",
	emptyDescription:
		"Service availability will appear here when reporting is connected.",
	backToSignIn: "Back to sign in",
	viewStatus: "Service status",
	period: (days: 7 | 30 | 90) => `Last ${days} days`,
	availabilityLabel: (date: string, availability: number) =>
		`${date}: ${(availability * 100).toFixed(2)}% available`,
} as const;
