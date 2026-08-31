import { Link } from "@tanstack/react-router";

import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { buttonVariants } from "@/components/ui/button";
import { LANDING } from "@/lib/navigation";

export function NotFound() {
	return (
		<PageContainer
			title="Page not found"
			description="The page you were looking for doesn't exist or has been moved."
			action={
				<Link to={LANDING} className={buttonVariants()}>
					Back to overview
				</Link>
			}
		>
			<PageState
				kind="empty"
				title="We couldn't find that page"
				description="Check the URL or use the sidebar to navigate to a different section."
			/>
		</PageContainer>
	);
}
