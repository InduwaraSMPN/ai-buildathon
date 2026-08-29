import {
	createFileRoute,
	Outlet,
	redirect,
	useRouter,
} from "@tanstack/react-router";

import Header from "@/components/header";
import Loader from "@/components/loader";
import { ErrorState, PageShell } from "@/components/ticket-ui";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.error) throw session.error;
		if (!session.data) throw redirect({ to: "/login" });
		return { session };
	},
	errorComponent: AuthError,
	pendingComponent: Loader,
});

function AuthLayout() {
	return (
		<div className="grid min-h-full grid-rows-[auto_1fr]">
			<Header />
			<Outlet />
		</div>
	);
}

function AuthError() {
	const router = useRouter();
	return (
		<PageShell>
			<ErrorState retry={() => router.invalidate()} />
		</PageShell>
	);
}
