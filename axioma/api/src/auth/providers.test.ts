import assert from "node:assert/strict";
import test from "node:test";
import { aesGcmEncryptSecret, aesGcmProviderSecretLoader } from "./crypto";

// 32 bytes of 'k' base64-encoded — valid key material for the AES-256-GCM scheme.
const KEY = Buffer.alloc(32, 0x6b).toString("base64");

function parseEnvelope(encrypted: string): [string, string, string, string] {
	const parts = encrypted.split(":");
	assert.equal(parts.length, 4);
	return parts as [string, string, string, string];
}

test("encrypt then decrypt returns the original plaintext", () => {
	const encrypt = aesGcmEncryptSecret(KEY);
	const decrypt = aesGcmProviderSecretLoader(KEY);
	for (const plain of [
		"prod",
		"kubeconfig:\napiVersion: v1\nclusters: []",
		"a-token-with-slash/and+equals==",
	]) {
		assert.equal(decrypt(encrypt(plain)), plain);
	}
});

test("encrypted output is a v1 envelope in the expected format", () => {
	const [version, iv, ciphertext, tag] = parseEnvelope(
		aesGcmEncryptSecret(KEY)("hello"),
	);
	assert.equal(version, "v1");
	// 12-byte IV and 16-byte GCM tag, base64url-encoded.
	assert.equal(Buffer.from(iv, "base64url").length, 12);
	assert.equal(Buffer.from(tag, "base64url").length, 16);
	assert.ok(ciphertext.length > 0);
});

test("a fresh IV is used per call so identical input yields distinct ciphertext", () => {
	const encrypt = aesGcmEncryptSecret(KEY);
	assert.notEqual(encrypt("hello"), encrypt("hello"));
});

test("a tampered tag fails to decrypt", () => {
	const [version, iv, ciphertext, tag] = parseEnvelope(
		aesGcmEncryptSecret(KEY)("hello"),
	);
	const flipped = Buffer.from(tag, "base64url");
	flipped[0] = (flipped[0] ?? 0) ^ 0xff;
	const tampered = [
		version,
		iv,
		ciphertext,
		flipped.toString("base64url"),
	].join(":");
	assert.throws(
		() => aesGcmProviderSecretLoader(KEY)(tampered),
		/unable to authenticate|Unsupported state/i,
	);
});

test("an invalid key length is rejected", () => {
	assert.throws(() => aesGcmEncryptSecret("tooshort"), /32-byte key/);
	assert.throws(() => aesGcmProviderSecretLoader("tooshort"), /32-byte key/);
});
