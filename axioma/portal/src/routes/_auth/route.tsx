import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import Header from "@/components/header";
import { RouteError } from "@/components/route-error";
import { SkipLink } from "@/components/skip-link";
import { LoadingCards, PageShell } from "@/components/ticket-ui";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.error) throw session.error;
		if (!session.data) throw redirect({ to: "/login" });
		const privateData = await client.privateData();
		return { session, privateData, capabilities: privateData.capabilities };
	},
	errorComponent: RouteError,
	pendingComponent: AuthPending,
});

function AuthLayout() {
	return (
		<div className="grid min-h-full grid-rows-[auto_1fr]">
			<SkipLink />
			<Header />
			<Outlet />
		</div>
	);
}

function AuthPending() {
	return (
		<div className="grid min-h-full grid-rows-[auto_1fr]">
			<SkipLink />
			<Header />
			<PageShell>
				<LoadingCards />
			</PageShell>
		</div>
	);
}
