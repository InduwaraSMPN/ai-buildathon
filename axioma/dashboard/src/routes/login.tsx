import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { authClient } from "@/lib/auth-client";
import { LANDING } from "@/lib/navigation";

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
		const redirect = search.redirect;
		return typeof redirect === "string" &&
			redirect.startsWith("/") &&
			!redirect.startsWith("//") &&
			!redirect.includes("\\")
			? { redirect }
			: {};
	},
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.data) throw redirect({ to: LANDING });
	},
	component: RouteComponent,
});

function RouteComponent() {
	const [showSignIn, setShowSignIn] = useState(true);
	const { redirect } = Route.useSearch();
	const destination = redirect ?? LANDING;

	return (
		<main className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
			<div className="w-full max-w-sm md:max-w-4xl">
				{showSignIn ? (
					<SignInForm
						redirect={destination}
						onSwitchToSignUp={() => setShowSignIn(false)}
					/>
				) : (
					<SignUpForm
						redirect={destination}
						onSwitchToSignIn={() => setShowSignIn(true)}
					/>
				)}
			</div>
		</main>
	);
}
