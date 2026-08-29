import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { ErrorState, PageShell } from "@/components/ticket-ui";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.error) throw session.error;
		if (session.data) throw redirect({ to: "/home" });
	},
	component: RouteComponent,
	errorComponent: LoginError,
});

function LoginError() {
	const router = useRouter();
	return (
		<PageShell>
			<ErrorState retry={() => router.invalidate()} />
		</PageShell>
	);
}

function RouteComponent() {
	const [showSignIn, setShowSignIn] = useState(true);

	return (
		<div className="min-h-full bg-muted/20">
			<header className="border-b bg-background">
				<div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 font-semibold tracking-tight sm:px-6 lg:px-8">
					<span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<LifeBuoy className="size-4" aria-hidden="true" />
					</span>
					Axioma
				</div>
			</header>
			{showSignIn ? (
				<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
			) : (
				<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
			)}
		</div>
	);
}
