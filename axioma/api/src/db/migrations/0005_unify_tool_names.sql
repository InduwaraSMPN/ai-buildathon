UPDATE "agent_steps"
SET "tool_name" = replace("tool_name", '.', '_')
WHERE "tool_name" IN (
	'cluster.read_pods',
	'cluster.read_deployment',
	'cluster.patch_image',
	'device.read_state',
	'device.run_action',
	'device.computer_use',
	'cmdb.record_observation'
);--> statement-breakpoint
UPDATE "device_commands"
SET "tool" = replace("tool", '.', '_')
WHERE "tool" IN (
	'cluster.read_pods',
	'cluster.read_deployment',
	'cluster.patch_image',
	'device.read_state',
	'device.run_action',
	'device.computer_use',
	'cmdb.record_observation'
);
