import { z } from "zod";

export const deviceReadInput = z.object({
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
});

export const deviceActionInput = z.object({
	device_id: z.string().min(1),
	action: z.enum([
		"flush_dns",
		"renew_dhcp_lease",
		"clear_proxy_override",
		"reset_credential_cache",
		"restart_user_process",
	]),
	parameters: z.record(z.string(), z.string()).default({}),
});

export const deviceComputerUseInput = z.object({
	device_id: z.string().min(1),
	objective: z.string().min(1),
	timeout_seconds: z.number().int().min(10).max(600).default(120),
});
