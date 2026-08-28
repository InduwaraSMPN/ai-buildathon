import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Device actions.
 *
 * A fixed set. The caller names an action and supplies typed parameters; this
 * file builds the argument list. No command string crosses the boundary, so a
 * ticket cannot talk the agent into running something arbitrary.
 */
type ActionName = "flush_dns" | "reset_resolver" | "restart_service";

const SERVICE_ALLOWLIST = new Set(["Dnscache", "Dhcp", "WlanSvc"]);

export async function runAction(
	input: unknown,
): Promise<{ ok: boolean; detail?: string }> {
	const { action, parameters } = input as {
		action: ActionName;
		parameters: Record<string, string>;
	};

	switch (action) {
		case "flush_dns": {
			const { stdout } = await run("ipconfig", ["/flushdns"], {
				windowsHide: true,
			});
			return { ok: true, detail: stdout.trim() };
		}

		case "reset_resolver": {
			const { stdout } = await run("netsh", ["winsock", "reset"], {
				windowsHide: true,
			});
			return { ok: true, detail: stdout.trim() };
		}

		case "restart_service": {
			const name = parameters.serviceName;
			if (!name || !SERVICE_ALLOWLIST.has(name)) {
				return {
					ok: false,
					detail: `service not allowlisted: ${name ?? "(missing)"}`,
				};
			}
			await run("sc", ["stop", name], { windowsHide: true }).catch(
				() => undefined,
			);
			const { stdout } = await run("sc", ["start", name], {
				windowsHide: true,
			});
			return { ok: true, detail: stdout.trim() };
		}

		default:
			return { ok: false, detail: `unknown action: ${String(action)}` };
	}
}
