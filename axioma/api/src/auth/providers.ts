import { createDecipheriv } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authProviders } from "@/db/schema";
import type { OidcProvider } from "./oidc";

export type ProviderSecretLoader = (encrypted: string) => string;

export function aesGcmProviderSecretLoader(key: string): ProviderSecretLoader {
	const decodedKey = Buffer.from(key, "base64");
	if (decodedKey.length !== 32)
		throw new Error(
			"AXIOMA_PROVIDER_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
		);
	return (encrypted) => {
		const [version, ivText, ciphertextText, tagText] = encrypted.split(":");
		if (version !== "v1" || !ivText || !ciphertextText || !tagText)
			throw new Error("Invalid encrypted provider secret format");
		const decipher = createDecipheriv(
			"aes-256-gcm",
			decodedKey,
			Buffer.from(ivText, "base64url"),
		);
		decipher.setAuthTag(Buffer.from(tagText, "base64url"));
		return Buffer.concat([
			decipher.update(Buffer.from(ciphertextText, "base64url")),
			decipher.final(),
		]).toString("utf8");
	};
}

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
