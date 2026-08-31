import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AuthPending, RouteError } from "@/components/route-state";
import { portalUrl } from "@/lib/api-url";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	pendingComponent: AuthPending,
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
				href: portalUrl("home"),
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
