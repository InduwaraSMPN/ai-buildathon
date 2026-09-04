import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "axen_";
const CREDENTIAL_PREFIX = "axdc_";

export function issueEnrolmentToken() {
	return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function issueDeviceCredential() {
	return `${CREDENTIAL_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashDeviceSecret(secret: string) {
	return createHash("sha256").update(secret).digest("hex");
}

export function validDeviceSecret(
	secret: string,
	hash: string | null | undefined,
) {
	if (!secret || !hash) return false;
	const actual = Buffer.from(hashDeviceSecret(secret), "hex");
	const expected = Buffer.from(hash, "hex");
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Constant-time comparison of the AgentChannel shared secret. Returns false
 * when the gateway has no token configured, so an operator who never set one
 * gets no agent channel rather than an open one.
 */
export function validAgentCredential(
	presented: string,
	expected: string | undefined,
) {
	if (!expected || !presented) return false;
	const a = Buffer.from(hashDeviceSecret(presented), "hex");
	const b = Buffer.from(hashDeviceSecret(expected), "hex");
	return timingSafeEqual(a, b);
}

const CLAIM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * A code an employee reads off their own screen and types into the portal, so
 * it avoids the character pairs people mistype (I/1, O/0) and is grouped for
 * legibility. Six letters and four digits of that alphabet is ~50 bits, which
 * is far beyond guessing against a 24-hour window and a per-device unique index.
 */
export function issueDeviceClaimCode() {
	const bytes = randomBytes(10);
	const code = Array.from(
		bytes,
		(byte) => CLAIM_ALPHABET[byte % CLAIM_ALPHABET.length],
	).join("");
	return `${code.slice(0, 6)}-${code.slice(6)}`;
}

/** Codes are compared after normalisation, because people type them by hand. */
export function normaliseClaimCode(value: string) {
	return value
		.trim()
		.toUpperCase()
		.replaceAll(/[^A-Z0-9]/g, "");
}
