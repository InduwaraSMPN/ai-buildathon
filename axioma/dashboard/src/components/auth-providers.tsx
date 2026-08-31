import {
	RiGoogleFill as Google,
	RiMicrosoftFill as Microsoft,
	RiShieldKeyholeFill as ShieldKeyhole,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldSeparator } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

/**
 * The identity providers this console expects to federate with, shown whether
 * or not anyone has configured them.
 *
 * A provider id is whatever an administrator typed into `auth_providers`, so
 * the row cannot key off exact ids. Each entry claims a set of spellings
 * instead, and a configured provider is matched to the entry that claims it.
 * Anything configured that no entry claims still gets a button of its own.
 */
const CATALOGUE = [
	{
		label: "Microsoft Entra ID",
		icon: Microsoft,
		claims: ["microsoft", "entra", "entraid", "azure", "azuread", "aad"],
	},
	{
		label: "Google",
		icon: Google,
		claims: ["google", "googleworkspace", "workspace", "gsuite"],
	},
	{ label: "Okta", icon: ShieldKeyhole, claims: ["okta"] },
] as const;

const normalise = (providerId: string) =>
	providerId.toLowerCase().replace(/[^a-z0-9]/g, "");

type Configured = { providerId: string; name: string };

/**
 * The "Or continue with" row on the auth card.
 *
 * Every provider is rendered every time. One an administrator has enabled in
 * `auth_providers` is live and starts an OIDC redirect; one nobody has
 * configured is disabled and says so on hover, which is the difference between
 * "this console cannot do that" and "nobody has switched it on yet".
 *
 * Better Auth 1.7 dropped its generic-oauth client plugin and registers each
 * configured OIDC connection as an ordinary social provider, so `signIn.social`
 * takes the provider id straight from the database row.
 */
export function AuthProviders({ redirect }: { redirect: string }) {
	const providers = useQuery(orpc.listAuthProviders.queryOptions());
	const [pending, setPending] = useState<string | null>(null);
	const configured = providers.data ?? [];

	const claimed = new Set<string>();
	const known = CATALOGUE.map((entry) => {
		const match = configured.find((provider) => {
			const id = normalise(provider.providerId);
			return entry.claims.some((claim) => id === claim || id.includes(claim));
		});
		if (match) claimed.add(match.providerId);
		return { ...entry, match };
	});
	const extra: Configured[] = configured.filter(
		(provider) => !claimed.has(provider.providerId),
	);

	async function signIn(providerId: string) {
		setPending(providerId);
		const { error } = await authClient.signIn.social({
			provider: providerId,
			callbackURL: new URL(redirect, window.location.origin).toString(),
		});
		if (error) {
			setPending(null);
			toast.error(error.message || error.statusText);
		}
	}

	return (
		<>
			<FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
				Or continue with
			</FieldSeparator>
			<Field className="grid grid-cols-3 gap-4">
				{known.map(({ label, icon: Icon, match }) => (
					<Button
						key={label}
						variant="outline"
						type="button"
						// The configured name wins: an administrator who called the
						// connection "Contoso SSO" should see that on hover, not our
						// catalogue label for the same vendor.
						title={
							match ? match.name : `${label} is not configured for this console`
						}
						disabled={!match || pending !== null}
						onClick={match ? () => signIn(match.providerId) : undefined}
					>
						{match && pending === match.providerId ? <Spinner /> : <Icon />}
						<span className="sr-only">
							{match
								? `Continue with ${match.name}`
								: `${label} — not configured`}
						</span>
					</Button>
				))}
				{/* The catalogue three are icon-only and fit a third of the row.
				 * A provider we have no mark for has to carry its written name,
				 * which does not, so it takes the whole row instead. */}
				{extra.map((provider) => (
					<Button
						key={provider.providerId}
						variant="outline"
						type="button"
						className="col-span-3"
						title={provider.name}
						disabled={pending !== null}
						onClick={() => signIn(provider.providerId)}
					>
						{pending === provider.providerId ? (
							<Spinner data-icon="inline-start" />
						) : (
							<ShieldKeyhole data-icon="inline-start" />
						)}
						<span className="truncate">{provider.name}</span>
					</Button>
				))}
			</Field>
		</>
	);
}
