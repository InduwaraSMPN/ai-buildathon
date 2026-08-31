import { createFileRoute, redirect } from "@tanstack/react-router";

import { RouteError } from "@/components/route-error";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.error) throw session.error;
		throw redirect({ to: session.data ? "/home" : "/login" });
	},
	errorComponent: RouteError,
});
