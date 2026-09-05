// Impact estimate defaults, time split, and coverage map. Figures are
// third-party research and industry benchmarks; they describe the domain and
// do not measure Axiōma.

export const impactDefaults = {
	employees: 500,
	ticketsPerEmployeeMonth: 0.8,
	autoShare: 0.25,
	costPerTicket: 45,
	lostMinutesPerIncident: 28,
	loadedHourly: 48.78,
};

export const impactMeta = {
	autoShareNote:
		"Share of your tickets in classes Axel can close, see the coverage map; Axiōma has not measured its own rate",
	ticketsPerEmployeeMonthSource: "R10",
	ticketsPerEmployeeMonthNote:
		"0.4–1.1 tickets per seat per month; independent benchmark",
	costPerTicketSource: "R9",
	costPerTicketNote:
		"Midpoint of $22 (level-1) and $70 (desktop support), North America, 2019; independent benchmark",
	lostMinutesPerIncidentSource: "R14",
	lostMinutesPerIncidentNote:
		"About 28 minutes lost per IT issue; industry survey",
	loadedHourlySource: "R20",
	loadedHourlyNote:
		"Employer cost $48.78 per hour worked; government statistic",
};

export const timeSplit = [
	{ label: "After triage (diagnose+mitigate)", value: 70.2 },
	{ label: "Initial triage", value: 15.42 },
	{ label: "Reassignment", value: 14.38 },
];

export const coverage: {
	ticket: string;
	facet: string;
	action: string;
	verifyingRead: string;
}[] = [
	{
		ticket: "No DNS on laptop (stale resolver cache)",
		facet: "resolver",
		action: "flush_dns",
		verifyingRead: "device_read_state [resolver]",
	},
	{
		ticket: "No network after move (DHCP lease expired)",
		facet: "adapters",
		action: "renew_dhcp_lease",
		verifyingRead: "device_read_state [adapters]",
	},
	{
		ticket: "No internal sites (proxy to dead server)",
		facet: "proxy",
		action: "disable_proxy",
		verifyingRead: "device_read_state [proxy]",
	},
	{
		ticket: "Proxy bypass lost (stale per-user override)",
		facet: "proxy",
		action: "clear_proxy_override",
		verifyingRead: "device_read_state [proxy]",
	},
	{
		ticket: "Sign-in fails (Kerberos ticket cache stale)",
		facet: "identity",
		action: "reset_credential_cache",
		verifyingRead: "device_read_state [identity]",
	},
	{
		ticket: "App hung (allowlisted user process)",
		facet: "processes",
		action: "restart_user_process",
		verifyingRead: "device_read_state [processes]",
	},
	{
		ticket: "VPN warns (user certificate store stale)",
		facet: "certificates",
		action: "refresh_certificate_store",
		verifyingRead: "device_read_state [certificates]",
	},
	{
		ticket: "Disk full warning (user temp directory)",
		facet: "storage",
		action: "clear_temp_files",
		verifyingRead: "device_read_state [storage]",
	},
	{
		ticket: "Outlook stuck (RoamCache corrupt)",
		facet: "app_cache",
		action: "clear_outlook_cache",
		verifyingRead: "device_read_state [app_cache]",
	},
	{
		ticket: "Teams stuck (local cache corrupt)",
		facet: "app_cache",
		action: "clear_teams_cache",
		verifyingRead: "device_read_state [app_cache]",
	},
	{
		ticket: "Icons wrong (Explorer cache corrupt)",
		facet: "app_cache",
		action: "clear_icon_cache",
		verifyingRead: "device_read_state [app_cache]",
	},
	{
		ticket: "Cannot print (queued jobs stuck)",
		facet: "printing",
		action: "clear_print_queue",
		verifyingRead: "device_read_state [printing]",
	},
	{
		ticket: "GUI-only setting (accessible control)",
		facet: "screen",
		action:
			"gui_invoke_control, gui_set_control_value, gui_toggle_control, gui_select_item, gui_expand_control",
		verifyingRead: "device_read_state [screen]",
	},
	{
		ticket: "Checkout will not start (ImagePullBackOff)",
		facet: "cluster",
		action: "cluster_patch_image",
		verifyingRead: "cluster_read_deployment",
	},
	{
		ticket: "Reporting never starts (Pending Unschedulable)",
		facet: "cluster",
		action: "escalate with proposal, no write",
		verifyingRead: "cluster_read_pods",
	},
	{
		ticket: "Password reset: not a typed action today; proposal or human",
		facet: "identity",
		action: "Not a typed action today; proposal or human",
		verifyingRead: "Human approves; no verifying read",
	},
];

export const footnoteOrder: string[] = [
	"R1",
	"R2",
	"R13",
	"R14",
	"R9",
	"R17",
	"R19",
	"R20",
	"R5",
	"R6",
	"R3",
	"R8",
	"R12",
	"R4",
	"R10",
	"R11",
	"R21",
];
