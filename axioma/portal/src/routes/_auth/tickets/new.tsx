import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeading, PageShell } from "@/components/ticket-ui";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestForm } from "@/features/tickets/components/request-form";

export const Route = createFileRoute("/_auth/tickets/new")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: "New request · Axioma" }] }),
});

function RouteComponent() {
	return (
		<PageShell>
			<Link
				to="/home"
				className={buttonVariants({
					variant: "ghost",
					size: "sm",
					className: "mb-6 -ml-2",
				})}
			>
				<ArrowLeft aria-hidden="true" /> Back to requests
			</Link>
			<PageHeading
				eyebrow="New support request"
				title="What can we help with?"
				description="Share what’s getting in your way. Clear details help us get you to the right solution sooner."
			/>
			<Card className="max-w-3xl rounded-xl">
				<CardHeader className="border-b">
					<CardTitle className="text-base">Request details</CardTitle>
				</CardHeader>
				<CardContent>
					<RequestForm />
				</CardContent>
			</Card>
		</PageShell>
	);
}
