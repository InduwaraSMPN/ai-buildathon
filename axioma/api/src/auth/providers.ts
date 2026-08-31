import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authProviders } from "@/db/schema";
import type { ProviderSecretLoader } from "./crypto";
import type { OidcProvider } from "./oidc";

export type { ProviderSecretLoader } from "./crypto";
export { aesGcmEncryptSecret, aesGcmProviderSecretLoader } from "./crypto";

export async function loadEnabledOidcProviders(
	loadSecret: ProviderSecretLoader,
): Promise<OidcProvider[]> {
	const rows = await db
		.select({
			providerId: authProviders.providerId,
			name: authProviders.name,
			discoveryUrl: authProviders.discoveryUrl,
			clientId: authProviders.clientId,
			clientSecretEncrypted: authProviders.clientSecretEncrypted,
			scopes: authProviders.scopes,
		})
		.from(authProviders)
		.where(eq(authProviders.enabled, true));
	return rows.map(({ clientSecretEncrypted, ...provider }) => ({
		...provider,
		clientSecret: loadSecret(clientSecretEncrypted),
	}));
}
