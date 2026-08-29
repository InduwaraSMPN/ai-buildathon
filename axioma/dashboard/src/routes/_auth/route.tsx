import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RouteError, RoutePending } from "@/components/route-state";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	pendingComponent: RoutePending,
	errorComponent: RouteError,
	beforeLoad: async ({ location }) => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
		const privateData = await client.privateData();
		if (privateData.user?.kind !== "staff") {
			throw redirect({
				href: new URL("/home", env.VITE_PORTAL_URL).toString(),
			});
		}
		return { session, privateData, capabilities: privateData.capabilities };
	},
});

function AuthLayout() {
	return (
		<DashboardLayout>
			<Outlet />
		</DashboardLayout>
	);
}
