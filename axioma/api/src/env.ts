import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		AXIOMA_PROVIDER_ENCRYPTION_KEY: z.string().optional(),
		AXIOMA_MAIL_OUTBOUND_URL: z.url().optional(),
		AXIOMA_MAIL_OUTBOUND_TOKEN: z.string().optional(),
		AXIOMA_MAIL_INBOUND_TOKEN: z.string().min(16).optional(),
		AXIOMA_DIRECTORY_SOURCE_URL: z.url().optional(),
		AXIOMA_DIRECTORY_SOURCE_TOKEN: z.string().optional(),
		AXIOMA_DIRECTORY_STAFF_ATTRIBUTE: z
			.enum(["department", "jobTitle"])
			.default("department"),
		AXIOMA_DIRECTORY_STAFF_VALUE: z.string().default("IT"),
		AXIOMA_BOOTSTRAP_ADMIN_EMAIL: z
			.string()
			.trim()
			.toLowerCase()
			.pipe(z.email())
			.optional(),
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
