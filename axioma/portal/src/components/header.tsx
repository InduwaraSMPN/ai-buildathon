import {
	RiAddLine,
	RiArrowRightUpLine as ArrowRightUp,
	RiMenuLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AxiomaWordmark } from "@/components/brand";
import { statusCopy } from "@/features/status/copy";
import { siteUrl } from "@/lib/api-url";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { ModeToggle } from "./mode-toggle";
import { NotificationCenter } from "./notification-center";
import { Button, buttonVariants } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import UserMenu from "./user-menu";

export default function Header() {
	// The header is shared by authenticated routes and the public /status page,
	// so everything session-dependent is gated on `session`. This keeps hook
	// order stable while `/status` stops polling notifications for visitors.
	const { data: session } = authClient.useSession();
	const signedIn = Boolean(session);
	// Whether the customer's own service desk is the front door. Both create
	// links are gated on it; the nav is duplicated for desktop and mobile, so
	// hiding one alone would leave the other reachable.
	const frontDoor = useQuery({
		...orpc.portalIsFrontDoor.queryOptions(),
		enabled: signedIn,
	});
	const foreignFrontDoor = frontDoor.data?.foreign === true;

	return (
		<header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
			<div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
				<div className="flex items-center gap-7">
					{signedIn ? (
						<Link to="/my-requests" className="flex items-center">
							<AxiomaWordmark
								className="h-7 w-auto text-primary"
								title="Axiōma"
							/>
						</Link>
					) : (
						<AxiomaWordmark
							className="h-7 w-auto text-primary"
							title="Axiōma"
						/>
					)}
					<nav aria-label="Primary navigation" className="hidden gap-5 sm:flex">
						{signedIn ? (
							<Link
								to="/my-requests"
								className="text-muted-foreground text-sm transition-colors hover:text-foreground"
								activeProps={{ className: "text-foreground font-medium" }}
							>
								My requests
							</Link>
						) : null}
						{signedIn ? (
							<Link
								to="/help-articles"
								className="text-muted-foreground text-sm transition-colors hover:text-foreground"
								activeProps={{ className: "text-foreground font-medium" }}
							>
								Help articles
							</Link>
						) : null}
						{/* Published on the public website, so this leaves the portal. */}
						<a
							href={siteUrl("status")}
							className="flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
						>
							{statusCopy.viewStatus}
							<ArrowRightUp className="size-3.5" />
						</a>
					</nav>
				</div>
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									variant="ghost"
									size="icon"
									className="sm:hidden"
									aria-label="Open navigation"
								/>
							}
						>
							<RiMenuLine />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="sm:hidden">
							<DropdownMenuGroup>
								{signedIn ? (
									<DropdownMenuItem render={<Link to="/my-requests" />}>
										My requests
									</DropdownMenuItem>
								) : null}
								{signedIn ? (
									<DropdownMenuItem render={<Link to="/help-articles" />}>
										Help articles
									</DropdownMenuItem>
								) : null}
								<DropdownMenuItem render={<a href={siteUrl("status")} />}>
									{statusCopy.viewStatus}
									<ArrowRightUp className="ml-auto size-3.5 text-muted-foreground" />
								</DropdownMenuItem>
								{signedIn && !foreignFrontDoor ? (
									<DropdownMenuItem render={<Link to="/tickets/new" />}>
										New request
									</DropdownMenuItem>
								) : null}
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
					{/* Both copies are gated: the nav is duplicated for desktop and
					    mobile, so hiding one would leave the other reachable. */}
					{signedIn && !foreignFrontDoor ? (
						<Link
							to="/tickets/new"
							className={buttonVariants({
								variant: "outline",
								size: "sm",
								className: "hidden sm:inline-flex",
							})}
						>
							<RiAddLine data-icon="inline-start" aria-hidden="true" /> New
							request
						</Link>
					) : null}
					{signedIn ? <NotificationCenter /> : null}
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
