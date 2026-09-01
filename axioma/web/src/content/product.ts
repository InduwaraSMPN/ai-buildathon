// Product page content: the ticket flow.

export const flow = [
	{
		number: "01",
		title: "The employee opens a ticket.",
		body: "The report starts in the portal. Axiōma attaches the context available for that employee, device, and prior history, rather than asking the report alone to explain the cause.",
		tag: "Portal",
	},
	{
		number: "02",
		title: "Axel routes by investigating.",
		body: "Axel reads the ticket, chooses relevant read tools, and gathers evidence. The work of deciding what to try also reveals which system or team owns the issue.",
		tag: "Agent run",
	},
	{
		number: "03",
		title: "The fix follows the problem.",
		body: "For infrastructure, Axel uses an available connector. For a laptop issue, it sends a typed action to axel-cli over the device’s live connection.",
		tag: "Infrastructure / device",
	},
	{
		number: "04",
		title: "The outcome carries its evidence.",
		body: "A fix is checked before closure. When no permitted fix is available, the ticket reaches IT staff with the transcript, observations, and proposed next step attached.",
		tag: "Closure / escalation",
	},
];
