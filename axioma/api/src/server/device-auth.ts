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
