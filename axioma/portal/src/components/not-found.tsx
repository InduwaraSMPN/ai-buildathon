import { Link } from "@tanstack/react-router";

import { PageHeading, PageShell } from "@/components/ticket-ui";
import { buttonVariants } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";

export function NotFound() {
	return (
		<PageShell>
			<PageHeading
				eyebrow="404"
				title="Page not found"
				description="The page you were looking for doesn't exist or has been moved."
			/>
			<Empty className="border">
				<EmptyHeader>
					<EmptyTitle>We couldn’t find that page</EmptyTitle>
					<EmptyDescription>
						Check the URL or return to your requests.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Link to="/home" className={buttonVariants()}>
						Back to home
					</Link>
					<Link
						to="/help-articles"
						className={buttonVariants({ variant: "outline" })}
					>
						Browse help articles
					</Link>
				</EmptyContent>
			</Empty>
		</PageShell>
	);
}

// For route-level `notFoundComponent` if loader throws `notFound()`.
export function NotFoundInline() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyTitle>Page not found</EmptyTitle>
				<EmptyDescription>
					The page you were looking for doesn’t exist.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Link to="/home" className={buttonVariants()}>
					Back to home
				</Link>
			</EmptyContent>
		</Empty>
	);
}
