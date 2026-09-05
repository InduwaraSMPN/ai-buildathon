import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/features/home/components/home-page";
import { homeCopy } from "@/features/home/copy";

export const Route = createFileRoute("/_auth/home")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: homeCopy.pageTitle }] }),
});

function RouteComponent() {
	const { session } = Route.useRouteContext();
	return <HomePage name={session.data?.user.name} />;
}
