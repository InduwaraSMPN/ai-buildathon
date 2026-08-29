import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@/db";
import * as schema from "@/db/schema/auth";
import { env } from "@/env";
import { assignDefaultRole } from "@/server/authorization";
import { type OidcProvider, oidcAuthOptions } from "./oidc";
import {
	aesGcmProviderSecretLoader,
	loadEnabledOidcProviders,
} from "./providers";

export function createAuth(providers: readonly OidcProvider[] = []) {
	const db = createDb();

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",

			schema: schema,
		}),
		trustedOrigins: env.CORS_ORIGIN.split(","),
		user: {
			additionalFields: {
				kind: {
					type: "string",
					required: false,
					defaultValue: "reporter",
					input: false,
				},
			},
		},
		databaseHooks: {
			user: {
				create: {
					after: async (created) =>
						assignDefaultRole(
							created.id,
							created.kind === "staff" ? "staff" : "reporter",
						),
				},
			},
		},
		emailAndPassword: {
			enabled: true,
		},
		...oidcAuthOptions(providers),
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		advanced: {
			defaultCookieAttributes: {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			},
		},
	});
}

const providerKey = env.AXIOMA_PROVIDER_ENCRYPTION_KEY;
export const auth = createAuth(
	providerKey
		? await loadEnabledOidcProviders(aesGcmProviderSecretLoader(providerKey))
		: [],
);
