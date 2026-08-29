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
				]),
			)
			.min(1),
		target: z.string().min(1).max(253).optional(),
	})
	.refine((input) => !input.facets.includes("reachability") || input.target, {
		message: "target is required for the reachability facet",
		path: ["target"],
	});

export const deviceActionInput = z
	.object({
		device_id: z.string().min(1),
		action: z.enum([
			"flush_dns",
			"renew_dhcp_lease",
			"clear_proxy_override",
			"reset_credential_cache",
			"restart_user_process",
		]),
		parameters: z.record(z.string(), z.string()).default({}),
	})
	.refine(
		(input) =>
			input.action !== "restart_user_process" ||
			Boolean(input.parameters.process_name),
		{
			message: "process_name is required for restart_user_process",
			path: ["parameters", "process_name"],
		},
	);

export const deviceComputerUseInput = z.object({
	device_id: z.string().min(1),
	objective: z.string().min(1),
	timeout_seconds: z.number().int().min(10).max(600).default(120),
});
