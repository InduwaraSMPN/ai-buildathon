import { z } from "zod";

export const deviceReadInput = z
	.object({
		device_id: z.string().min(1),
		facets: z
			.array(
				z.enum([
					"resolver",
					"adapters",
					"reachability",
					"proxy",
					"identity",
					"processes",
					"certificates",
					"storage",
					"app_cache",
					"printing",
					"screen",
				]),
			)
			.min(1),
		target: z.string().min(1).max(253).optional(),
		// Which window the screen facet reads. Omitted means the foreground one.
		window: z.string().min(1).max(256).optional(),
	})
	.refine((input) => !input.facets.includes("reachability") || input.target, {
		message: "target is required for the reachability facet",
		path: ["target"],
	});

// The applications employees actually report as hung or stuck. The device holds
// the same allowlist and rejects anything unlisted, so caller input only ever
// selects a key here — it never becomes a command.
export const DEVICE_USER_PROCESSES = [
	"notepad",
	"explorer",
	"outlook",
	"teams",
	"onedrive",
	"msedge",
	"chrome",
	"slack",
] as const;

const userProcessKeys = new Set<string>(DEVICE_USER_PROCESSES);

// Tier two. Each drives one UI Automation pattern on a control the screen facet
// has already reported, so the model selects a name out of a set the device
// produced rather than supplying anything executable.
export const DEVICE_GUI_STEPS = [
	"gui_invoke_control",
	"gui_set_control_value",
	"gui_toggle_control",
	"gui_select_item",
	"gui_expand_control",
] as const;

export const deviceActionInput = z
	.object({
		device_id: z.string().min(1),
		action: z.enum([
			"flush_dns",
			"renew_dhcp_lease",
			"clear_proxy_override",
			"reset_credential_cache",
			"restart_user_process",
			"disable_proxy",
			"refresh_certificate_store",
			"clear_temp_files",
			"clear_outlook_cache",
			"clear_teams_cache",
			"clear_icon_cache",
			"clear_print_queue",
			"gui_invoke_control",
			"gui_set_control_value",
			"gui_toggle_control",
			"gui_select_item",
			"gui_expand_control",
		]),
		parameters: z.record(z.string(), z.string()).default({}),
	})
	// A GUI step names a control the screen facet reported. The device refuses a
	// name it cannot find, so this only catches the omission early.
	.refine(
		(input) =>
			!DEVICE_GUI_STEPS.includes(
				input.action as (typeof DEVICE_GUI_STEPS)[number],
			) || Boolean(input.parameters.control),
		{
			message: "control is required for a GUI step",
			path: ["parameters", "control"],
		},
	)
	.refine(
		(input) =>
			input.action !== "gui_set_control_value" ||
			input.parameters.value !== undefined,
		{
			message: "value is required for gui_set_control_value",
			path: ["parameters", "value"],
		},
	)
	.refine(
		(input) =>
			input.action !== "restart_user_process" ||
			userProcessKeys.has(input.parameters.process_name?.toLowerCase() ?? ""),
		{
			message: `process_name is required for restart_user_process and must be one of: ${DEVICE_USER_PROCESSES.join(", ")}`,
			path: ["parameters", "process_name"],
		},
	);

// Widening the action set widened how long one can take. The device clamps at
// maxCommandTimeout (300s); these stay well inside it.
const ACTION_TIMEOUT_SECONDS: Record<string, number> = {
	clear_temp_files: 120,
	refresh_certificate_store: 60,
	clear_outlook_cache: 60,
	clear_teams_cache: 60,
	clear_print_queue: 60,
	gui_invoke_control: 60,
	gui_set_control_value: 60,
	gui_toggle_control: 60,
	gui_select_item: 60,
	gui_expand_control: 60,
};

export const deviceActionTimeoutSeconds = (action: string) =>
	ACTION_TIMEOUT_SECONDS[action] ?? 30;

// Reads have the same problem. Walking a user temp directory measured at 28
// seconds against a 30-second budget on an ordinary laptop, so the facets that
// touch the filesystem or the print subsystem get their own allowance and a
// batch takes the longest one it asked for.
const FACET_TIMEOUT_SECONDS: Record<string, number> = {
	storage: 120,
	app_cache: 60,
	certificates: 60,
	printing: 60,
	screen: 90,
};

export const deviceReadTimeoutSeconds = (facets: readonly string[]) =>
	facets.reduce(
		(worst, facet) => Math.max(worst, FACET_TIMEOUT_SECONDS[facet] ?? 30),
		30,
	);

// The facet that observes each action's effect. device_run_action names
// device_read_state as its verifier, and the loop enforces that obligation
// before a run may resolve, so an action with no observing facet cannot exist.
export const DEVICE_ACTION_FACETS: Record<string, string[]> = {
	flush_dns: ["resolver"],
	renew_dhcp_lease: ["adapters"],
	clear_proxy_override: ["proxy"],
	reset_credential_cache: ["identity"],
	restart_user_process: ["processes"],
	disable_proxy: ["proxy"],
	refresh_certificate_store: ["certificates"],
	clear_temp_files: ["storage"],
	clear_outlook_cache: ["app_cache"],
	clear_teams_cache: ["app_cache"],
	clear_icon_cache: ["app_cache"],
	clear_print_queue: ["printing"],
	gui_invoke_control: ["screen"],
	gui_set_control_value: ["screen"],
	gui_toggle_control: ["screen"],
	gui_select_item: ["screen"],
	gui_expand_control: ["screen"],
};

export const deviceComputerUseInput = z.object({
	device_id: z.string().min(1),
	objective: z.string().min(1),
	timeout_seconds: z.number().int().min(10).max(600).default(120),
});
