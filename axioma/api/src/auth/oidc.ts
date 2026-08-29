import {
	type GenericOAuthConfig,
	genericOAuth,
} from "better-auth/plugins/generic-oauth";

export type OidcProvider = {
	providerId: string;
	name: string;
	discoveryUrl: string;
	clientId: string;
	clientSecret: string;
	scopes?: string[];
};

export function oidcAuthOptions(providers: readonly OidcProvider[]) {
	const config = providers.map(
		(provider): GenericOAuthConfig => ({
			...provider,
			scopes: provider.scopes ?? ["openid", "profile", "email"],
			requireIdTokenVerification: true,
			requireEmailVerification: true,
			disableSignUp: true,
		}),
	);
	return {
		plugins: config.length ? [genericOAuth({ config })] : [],
		account: {
			// Better Auth persists OIDC issuer/subject linkage in the account table.
			accountLinking: {
				trustedProviders: config.map((provider) => provider.providerId),
			},
		},
	};
}
