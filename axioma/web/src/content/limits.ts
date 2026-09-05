// Honest limits: what Axiōma does not do.
// Plain declarative present tense, UK spelling.

export const limits: { title: string; body: string }[] = [
	{
		title: "Not proactive",
		body: "Nothing watches for problems. Every interaction starts with a ticket someone opens.",
	},
	{
		title: "One cluster field",
		body: "The cluster write surface is one field: the image tag or digest.",
	},
	{
		title: "No blast-radius limit",
		body: "There is no blast-radius limit inside the granted scope. The action set is small and chosen to be safe, which is not the same as the system being safe.",
	},
	{
		title: "No approval before cluster actions",
		body: "There is no approval step before a cluster action. Device commands have one.",
	},
	{
		title: "At-most-once delivery",
		body: "Device delivery is at-most-once. Retrying a dispatched action can apply it twice.",
	},
	{
		title: "One connector of each kind",
		body: "ServiceNow is the only ITSM connector. Kubernetes is the only infrastructure connector.",
	},
	{
		title: "Windows-only devices",
		body: "Managed devices are Windows laptops. No other device platform is supported.",
	},
	{
		title: "Unsigned binary",
		body: "axel-cli.exe is unsigned. SmartScreen warns and managed-device policy may block the installer.",
	},
	{
		title: "No platform resilience",
		body: "The chart carries no HA, no autoscaling, no backup, and no disaster recovery.",
	},
	{
		title: "Computer-use refused",
		body: "device_computer_use is refused on every device. GUI remediation ships through UI Automation only.",
	},
	{
		title: "No claims about Axiōma",
		body: "There is no performance, savings, or accuracy claim about Axiōma on this site.",
	},
];
