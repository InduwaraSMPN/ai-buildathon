import {
	createHash,
	randomBytes,
	randomUUID,
	timingSafeEqual,
} from "node:crypto";
import { CAPABILITIES, type Capability } from "@/shared";

const TOKEN_PREFIX = "axk";
const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1_000;
const HASH_PREFIX = "sha256:";

export type ApiKeyRecord = {
	id: string;
	userId: string;
	name: string;
	prefix: string;
	secretHash: string;
	capabilities: Capability[];
	expiresAt: Date;
	revokedAt: Date | null;
};

export type ApiKeyInsert = Omit<ApiKeyRecord, "revokedAt"> & {
	revokedAt?: Date | null;
	createdAt?: Date;
};

export function createApiKey(
	input: {
		userId: string;
		name: string;
		capabilities: readonly string[];
		issuerCapabilities: Iterable<string>;
		expiresAt?: Date;
	},
	now = new Date(),
): { token: string; record: ApiKeyInsert } {
	if (!input.userId || !input.name.trim()) {
		throw new Error("API key userId and name are required");
	}
	if (!Number.isFinite(now.getTime())) throw new Error("Invalid current time");

	const capabilities = validateCapabilitySubset(
		input.capabilities,
		input.issuerCapabilities,
	);
	const expiresAt = input.expiresAt ?? new Date(now.getTime() + DEFAULT_TTL_MS);
	if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
		throw new Error("API key expiry must be in the future");
	}

	const prefix = randomBytes(9).toString("base64url");
	const secret = randomBytes(32).toString("base64url");
	return {
		token: `${TOKEN_PREFIX}_${prefix}.${secret}`,
		record: {
			id: randomUUID(),
			userId: input.userId,
			name: input.name.trim(),
			prefix,
			secretHash: hashSecret(secret),
			capabilities,
			expiresAt,
			revokedAt: null,
			createdAt: now,
		},
	};
}

export function validateCapabilitySubset(
	requested: readonly string[],
	issuerCapabilities: Iterable<string>,
): Capability[] {
	const vocabulary = new Set<string>(CAPABILITIES);
	const allowed = new Set(issuerCapabilities);
	const unique = new Set<Capability>();
	for (const capability of requested) {
		if (!capability || capability !== capability.trim()) {
			throw new Error("Capabilities must be non-empty, trimmed strings");
		}
		if (!vocabulary.has(capability))
			throw new Error(`Unknown capability: ${capability}`);
		const known = capability as Capability;
		if (!allowed.has(known)) {
			throw new Error(`Issuer lacks capability: ${capability}`);
		}
		if (unique.has(known)) {
			throw new Error(`Duplicate capability: ${capability}`);
		}
		unique.add(known);
	}
	return [...unique];
}

export function parseApiKey(
	token: string,
): { prefix: string; secret: string } | null {
	const match = /^axk_([A-Za-z0-9_-]{12})\.([A-Za-z0-9_-]{43})$/.exec(token);
	return match?.[1] && match[2] ? { prefix: match[1], secret: match[2] } : null;
}

export function verifyApiKeySecret(
	secret: string,
	storedHash: string,
): boolean {
	const actual = Buffer.from(hashSecret(secret));
	const expected = Buffer.from(storedHash);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashSecret(secret: string): string {
	return `${HASH_PREFIX}${createHash("sha256").update(secret).digest("hex")}`;
}

export type RateLimitResult =
	| { allowed: true; remaining: number; resetAt: Date }
	| { allowed: false; remaining: 0; resetAt: Date; retryAfterMs: number };
