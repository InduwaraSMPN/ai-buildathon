import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type ProviderSecretLoader = (encrypted: string) => string;

/**
 * Shared AES-256-GCM secret scheme, the single encryption path for auth-provider
 * secrets and environment connection credentials: `v1:iv:ciphertext:tag` with
 * base64url segments, key from `AXIOMA_PROVIDER_ENCRYPTION_KEY` (base64-encoded
 * 32 bytes). Kept free of any DB/env dependency so it is testable in isolation.
 */
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

export function aesGcmEncryptSecret(
	key: string,
): (plainText: string) => string {
	const decodedKey = Buffer.from(key, "base64");
	if (decodedKey.length !== 32)
		throw new Error(
			"AXIOMA_PROVIDER_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
		);
	return (plainText) => {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", decodedKey, iv);
		const ciphertext = Buffer.concat([
			cipher.update(plainText, "utf8"),
			cipher.final(),
		]);
		const tag = cipher.getAuthTag();
		return `v1:${iv.toString("base64url")}:${ciphertext.toString("base64url")}:${tag.toString("base64url")}`;
	};
}
