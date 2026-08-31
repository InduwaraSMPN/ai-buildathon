// Runtime configuration injected by /config.js before the bundle loads. The
// container entrypoint writes that file from the deployment's values, so one
// built image serves any environment. Absent in development, where the
// build-time VITE_* variables answer instead.
declare global {
	interface Window {
		__AXIOMA_CONFIG__?: Record<string, string | undefined>;
	}
}

export function runtimeConfig(key: string): string | undefined {
	if (typeof window === "undefined") return undefined;
	const value = window.__AXIOMA_CONFIG__?.[key]?.trim();
	return value ? value : undefined;
}
