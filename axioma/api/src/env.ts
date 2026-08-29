import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.string().min(1),
		KUBECONFIG: z.string().optional(),
		AXIOMA_K8S_CONTEXT: z.string().optional(),
		AXIOMA_AUTO_DISPATCH: z
			.enum(["true", "false"])
			.default("true")
			.transform((value) => value === "true"),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
