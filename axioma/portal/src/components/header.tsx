import { RiAddLine, RiArrowRightUpLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { statusCopy } from "@/features/status/copy";
import { siteUrl } from "@/lib/api-url";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { ModeToggle } from "./mode-toggle";
import { NotificationCenter } from "./notification-center";
import { buttonVariants } from "./ui/button";
import UserMenu from "./user-menu";

const navPill =
	"inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 font-medium text-muted-foreground text-sm outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:bg-foreground data-[status=active]:text-background data-[status=active]:hover:bg-foreground/90";

export default function Header() {
	const { data: session } = authClient.useSession();
	const frontDoor = useQuery({
		...orpc.portalIsFrontDoor.queryOptions(),
		enabled: Boolean(session),
	});
	const foreignFrontDoor = frontDoor.data?.foreign === true;

	return (
		<header className="sticky top-0 z-20 border-b bg-background">
			{/* Same column as PageShell in ticket-ui.tsx */}
			<div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 px-4 sm:px-6 md:flex-nowrap lg:px-8">
				{/* The shipped brand files rather than the inline wordmark: each
				    carries the approved fill for its ground (#008236 on light,
				    #016630 on dark), so the pair is swapped by theme. */}
				<Link
					to="/my-requests"
					aria-label="Axiōma"
					className="flex h-14 shrink-0 items-center sm:h-16"
				>
					<img
						src="/brand/axioma-logo.svg"
						alt=""
						width={120}
						height={27}
						className="h-7 w-auto dark:hidden"
					/>
					<img
						src="/brand/axioma-logo-dark.svg"
						alt=""
						width={120}
						height={27}
						className="hidden h-7 w-auto dark:block"
					/>
				</Link>
				<nav
					aria-label="Primary navigation"
					className="order-last flex min-w-0 basis-full items-center gap-1 overflow-x-auto pt-1 pb-2 md:order-none md:flex-1 md:basis-auto md:p-0"
				>
					<Link to="/my-requests" className={navPill}>
						My requests
					</Link>
					<Link to="/help-articles" className={navPill}>
						Help articles
					</Link>
					<a href={siteUrl("status")} className={navPill}>
						{statusCopy.viewStatus}
						<RiArrowRightUpLine className="size-3.5" aria-hidden="true" />
					</a>
				</nav>
				<div className="ml-auto flex h-14 shrink-0 items-center gap-1 sm:h-16 sm:gap-2">
					{foreignFrontDoor ? null : (
						<Link
							to="/tickets/new"
							aria-label="New request"
							className={buttonVariants({
								className: "max-lg:w-8 max-lg:px-0",
							})}
						>
							<RiAddLine aria-hidden="true" />
							<span className="hidden lg:inline">New request</span>
						</Link>
					)}
					<NotificationCenter />
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
