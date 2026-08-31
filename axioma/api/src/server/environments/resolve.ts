import type { EnvironmentSource } from "@/db/schema/environments";

export type ResolveEnvironmentInput = {
	/** The ticket and its structured environment linkage, if any. */
	ticket: { serviceId: string; environmentId?: string | null };
	/** Environment ids linked to the ticket's service (the allow-list). */
	serviceEnvironmentIds: ReadonlySet<string> | readonly string[];
	/** Environment linked to the affected CI (CMDB), if any. */
	cmdbEnvironmentId?: string | null;
	/** The configured default environment, if any. */
	defaultEnvironmentId?: string | null;
};

export type ResolvedEnvironment = {
	environmentId: string;
	source: EnvironmentSource;
};

/**
 * Authoritative server-side environment resolution, in the order
 * ticket → CMDB → default.
 *
 * Resolution is pure so it is testable in isolation and cannot be steered by
 * ticket prose. The caller fetches the inputs; this never reads attacker-chosen
 * text. A ticket that names an environment not linked to its service is rejected
 * rather than silently falling back.
 */
export function resolveEnvironment(
	input: ResolveEnvironmentInput,
): ResolvedEnvironment {
	const serviceEnvironments = new Set(input.serviceEnvironmentIds);
	const ticketEnvironmentId = input.ticket.environmentId ?? null;

	if (ticketEnvironmentId) {
		if (!serviceEnvironments.has(ticketEnvironmentId))
			throw new Error(
				`environment ${ticketEnvironmentId} is not linked to service ${input.ticket.serviceId}`,
			);
		return { environmentId: ticketEnvironmentId, source: "ticket" };
	}
	if (input.cmdbEnvironmentId) {
		return { environmentId: input.cmdbEnvironmentId, source: "cmdb" };
	}
	if (input.defaultEnvironmentId) {
		return { environmentId: input.defaultEnvironmentId, source: "default" };
	}
	throw new Error("no environment could be resolved for this ticket");
}
