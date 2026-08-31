import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import Header from "@/components/header";
import { RouteError } from "@/components/route-error";
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
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-background focus:px-3 focus:py-2"
			>
				Skip to content
			</a>
			<Header />
			<Outlet />
		</div>
	);
}

function AuthPending() {
	return (
		<div className="grid min-h-full grid-rows-[auto_1fr]">
			<Header />
			<PageShell>
				<LoadingCards />
			</PageShell>
		</div>
	);
}
