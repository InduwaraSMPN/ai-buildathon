import { env } from "@/env";
import { runtimeConfig } from "@/lib/runtime-config";

// Runtime config wins over the build-time variable, so a container image built
// once can be pointed anywhere by rewriting /config.js. The trailing slash is
// required: without it `new URL("rpc", base)` would drop the last path segment.
function resolveBase(
	runtimeKey: string,
	buildValue: string | undefined,
	buildKey: string,
) {
	const base = runtimeConfig(runtimeKey) ?? buildValue;
	if (!base) {
		throw new Error(
			`Missing base URL: set "${runtimeKey}" in /config.js (window.__AXIOMA_CONFIG__) or ${buildKey} at build time.`,
		);
	}
	return `${base.replace(/\/$/, "")}/`;
}

const apiBase = () =>
	resolveBase("apiUrl", env.VITE_SERVER_URL, "VITE_SERVER_URL");

export const apiUrl = (path: string) => new URL(path, apiBase()).toString();

// The public website, not this app: the service status page is published there
// because it is readable without an account.
const siteBase = () => resolveBase("siteUrl", env.VITE_SITE_URL, "VITE_SITE_URL");

export const siteUrl = (path: string) => new URL(path, siteBase()).toString();
