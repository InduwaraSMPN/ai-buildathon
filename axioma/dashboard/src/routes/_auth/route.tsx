import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RouteError, RoutePending } from "@/components/route-state";
import { authClient } from "@/lib/auth-client";

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
		return { session };
	},
});

function AuthLayout() {
	return (
		<DashboardLayout>
			<Outlet />
		</DashboardLayout>
	);
}
