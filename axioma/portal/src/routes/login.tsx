import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { RouteError } from "@/components/route-error";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.error) throw session.error;
		if (session.data) throw redirect({ to: "/my-requests" });
	},
	component: RouteComponent,
	errorComponent: RouteError,
	head: () => ({ meta: [{ title: "Sign in · Axiōma" }] }),
});

function RouteComponent() {
	const [showSignIn, setShowSignIn] = useState(true);

	// No header bar here any more: the card is the whole page, and the wordmark
	// it used to carry now sits inside the card's own subtitle.
	return (
		<main className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
			<div className="w-full max-w-sm md:max-w-4xl">
				{showSignIn ? (
					<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
				) : (
					<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
				)}
			</div>
		</main>
	);
}
