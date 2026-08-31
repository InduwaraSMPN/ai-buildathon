import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "VITE_",
	client: {
		// Optional on purpose: a container image is built with no .env, and a
		// required schema would make createEnv throw at module load in the browser
		// before runtime config could answer. lib/api-url.ts enforces the
		// requirement instead, where the error can name both the runtime knob and
		// this build-time variable.
		VITE_SERVER_URL: z.url().optional(),
		VITE_PORTAL_URL: z.url().optional(),
	},
	runtimeEnv: (
		import.meta as ImportMeta & { env: Record<string, string | undefined> }
	).env,
	emptyStringAsUndefined: true,
});
