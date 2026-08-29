import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { authClient } from "@/lib/auth-client";

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
		if (session.data) throw redirect({ to: "/home" });
	},
	component: RouteComponent,
});

function RouteComponent() {
	const [showSignIn, setShowSignIn] = useState(true);
	const { redirect } = Route.useSearch();
	const destination = redirect ?? "/home";

	return showSignIn ? (
		<SignInForm
			redirect={destination}
			onSwitchToSignUp={() => setShowSignIn(false)}
		/>
	) : (
		<SignUpForm
			redirect={destination}
			onSwitchToSignIn={() => setShowSignIn(true)}
		/>
	);
}
