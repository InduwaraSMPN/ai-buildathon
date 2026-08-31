import type { client } from "@/utils/orpc";

/** How the run's environment was chosen: a ticket/CMDB link, or the default fallback. */
export const ENVIRONMENT_SOURCES = ["ticket", "cmdb", "default"] as const;
export type EnvironmentSource = (typeof ENVIRONMENT_SOURCES)[number];

/** Human label for how a run's environment was resolved. */
export function environmentSourceLabel(
	source: EnvironmentSource | null | undefined,
): string {
	switch (source) {
		case "ticket":
			return "Linked to ticket";
		case "cmdb":
			return "From CMDB";
		case "default":
			return "Default fallback";
		default:
			return "";
	}
}

/**
 * A run attempt. The resolved environment is denormalised on the server
 * (`environmentKey`) plus how it was chosen (`environmentSource`); it is
 * surfaced here so the transcript/selector can show provenance even before the
 * generated contract adds the fields.
 */
export type AgentRun = NonNullable<
	Awaited<ReturnType<typeof client.getRun>>
> & {
	environmentKey?: string | null;
	environmentSource?: EnvironmentSource | null;
};
export type AgentRunSummary = Awaited<ReturnType<typeof client.startRun>>;
export type AgentStep = AgentRun["steps"][number];
export type StartRunInput = Parameters<typeof client.startRun>[0];
export type CancelRunInput = Parameters<typeof client.cancelRun>[0];
