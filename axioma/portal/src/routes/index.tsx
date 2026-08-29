import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { ErrorState, PageShell } from "@/components/ticket-ui";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.error) throw session.error;
		throw redirect({ to: session.data ? "/home" : "/login" });
	},
	errorComponent: RootError,
});

function RootError() {
	const router = useRouter();
	return (
		<PageShell>
			<ErrorState retry={() => router.invalidate()} />
		</PageShell>
	);
}
