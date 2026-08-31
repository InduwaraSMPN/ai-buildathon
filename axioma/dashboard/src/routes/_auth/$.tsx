import { createFileRoute } from "@tanstack/react-router";

import { NotFound } from "@/components/not-found";

export const Route = createFileRoute("/_auth/$")({
	component: NotFound,
	head: () => ({ meta: [{ title: "Page not found · Axiōma" }] }),
	beforeLoad: () => ({ breadcrumb: "Page not found" }),
});
