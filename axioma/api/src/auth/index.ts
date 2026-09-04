import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@/db";
import * as schema from "@/db/schema/auth";
import { allowedOrigins, env } from "@/env";
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
		trustedOrigins: allowedOrigins(),
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
			// Every configured provider asserts a verified email and is listed as a
			// trusted provider, which is what lets an OIDC identity link onto an
			// existing row. Open local sign-up would turn that into pre-registration
			// account takeover: register the victim's address with a password of
			// your choosing, and their first SSO login links onto your account. So
			// once an identity provider exists, it is the only way to get an
			// account; a deployment with no provider keeps local sign-up, because
			// otherwise there would be no way in at all.
			disableSignUp: providers.length > 0,
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
