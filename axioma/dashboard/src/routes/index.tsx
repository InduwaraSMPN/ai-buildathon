import { createFileRoute, redirect } from "@tanstack/react-router";
import { LANDING } from "@/lib/navigation";

export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: LANDING });
	},
});
