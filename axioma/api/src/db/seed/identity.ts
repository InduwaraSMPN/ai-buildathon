/**
 * Identity — auth providers, directory identities, directory sync history.
 *
 * Backs the Roles/identity admin screens. The provider secrets here are
 * synthetic and structurally valid only; nothing authenticates against them.
 */

import { createHash } from "node:crypto";
import { db } from "@/db";
import {
	authProviders,
	directoryIdentities,
	directorySyncRuns,
} from "@/db/schema/identity-providers";
import { DEMO_USERS, daysFromEpoch } from "./data";

function encryptSecret(secret: string): string {
	const iv = createHash("sha256").update(secret).digest("hex").slice(0, 32);
	const ct = Buffer.from(secret).toString("base64");
	const tag = createHash("sha256").update(ct).digest("hex").slice(0, 32);
	return `v1:${iv}:${ct}:${tag}`;
}

const PROVIDERS = [
	{
		id: "demo-auth-provider-entra",
		providerId: "entra-id",
		name: "Microsoft Entra ID",
		discoveryUrl:
			"https://login.microsoftonline.com/demo-tenant/v2.0/.well-known/openid-configuration",
		clientId: "demo-entra-client-id",
		enabled: true,
	},
	{
		id: "demo-auth-provider-okta",
		providerId: "okta",
		name: "Okta",
		discoveryUrl: "https://demo.okta.com/.well-known/openid-configuration",
		clientId: "demo-okta-client-id",
		enabled: false,
	},
] as const;

const SYNC_RUNS = [
	{
		id: "demo-dirsync-01",
		mode: "preview",
		status: "completed",
		previous: 0,
		found: 13,
		created: 13,
		updated: 0,
		leavers: 0,
		day: 2,
	},
	{
		id: "demo-dirsync-02",
		mode: "apply",
		status: "completed",
		previous: 0,
		found: 13,
		created: 13,
		updated: 0,
		leavers: 0,
		day: 2,
	},
	{
		id: "demo-dirsync-03",
		mode: "apply",
		status: "completed",
		previous: 13,
		found: 13,
		created: 0,
		updated: 4,
		leavers: 1,
		day: 14,
	},
	{
		// Rejected by the shrink guard — useful to show the safety brake working.
		id: "demo-dirsync-04",
		mode: "apply",
		status: "rejected",
		previous: 13,
		found: 6,
		created: 0,
		updated: 0,
		leavers: 0,
		day: 21,
	},
] as const;

export async function seedIdentity(): Promise<void> {
	await db.transaction(async (tx) => {
		for (const p of PROVIDERS) {
			await tx
				.insert(authProviders)
				.values({
					id: p.id,
					providerId: p.providerId,
					name: p.name,
					discoveryUrl: p.discoveryUrl,
					clientId: p.clientId,
					clientSecretEncrypted: encryptSecret(`demo-secret-${p.providerId}`),
					scopes: ["openid", "profile", "email"],
					enabled: p.enabled,
					createdAt: daysFromEpoch(1, 9),
					updatedAt: daysFromEpoch(1, 9),
				})
				.onConflictDoNothing();
		}

		// Every demo user came from the Entra directory; the real login accounts
		// are deliberately excluded because they were created by signup, not sync.
		for (let i = 0; i < DEMO_USERS.length; i++) {
			const u = DEMO_USERS[i]!;
			await tx
				.insert(directoryIdentities)
				.values({
					id: `demo-dir-identity-${String(i + 1).padStart(2, "0")}`,
					providerId: "demo-auth-provider-entra",
					userId: u.id,
					externalId: `entra-${String(i + 1).padStart(4, "0")}`,
					department: u.departmentId,
					// One leaver so the directory screen has a non-default state.
					leaver: i === DEMO_USERS.length - 1,
					lastSeenAt: daysFromEpoch(14, 6),
					createdAt: daysFromEpoch(2, 9),
					updatedAt: daysFromEpoch(14, 6),
				})
				.onConflictDoNothing();
		}

		for (const run of SYNC_RUNS) {
			await tx
				.insert(directorySyncRuns)
				.values({
					id: run.id,
					providerId: "demo-auth-provider-entra",
					mode: run.mode,
					status: run.status,
					previousCount: run.previous,
					foundCount: run.found,
					createdCount: run.created,
					updatedCount: run.updated,
					leaverCount: run.leavers,
					summary:
						run.status === "rejected"
							? {
									seeded: true,
									rejectedReason:
										"Directory shrank by more than the permitted threshold",
								}
							: { seeded: true, mode: run.mode },
					createdAt: daysFromEpoch(run.day, 6),
				})
				.onConflictDoNothing();
		}
	});

	console.log(
		"[seed:identity] seeded auth providers, directory identities, sync runs",
	);
}
