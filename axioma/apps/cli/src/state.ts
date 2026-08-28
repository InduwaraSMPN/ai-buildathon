import { exec } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(exec);

/**
 * Device state reads.
 *
 * Each facet is a fixed command with fixed arguments. Nothing here accepts a
 * command string from the caller — the caller names a facet, and this file owns
 * what that means.
 */
const FACET_COMMANDS = {
	resolver: "ipconfig /all",
	adapters: "netsh interface show interface",
	services: "sc query type= service state= all",
	reachability: "ping -n 2 127.0.0.1",
} as const;

type Facet = keyof typeof FACET_COMMANDS;

export async function readState(
	input: unknown,
): Promise<Record<string, unknown>> {
	const { facets } = input as { facets: Facet[] };
	const out: Record<string, unknown> = {};

	for (const facet of facets) {
		const command = FACET_COMMANDS[facet];
		if (!command) {
			out[facet] = { error: `unknown facet: ${facet}` };
			continue;
		}
		try {
			const { stdout } = await run(command, {
				timeout: 15_000,
				windowsHide: true,
			});
			out[facet] = { raw: stdout.trim() };
		} catch (error) {
			out[facet] = {
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	return out;
}
