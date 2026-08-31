import { RiAddLine, RiMenuLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AxiomaWordmark } from "@/components/brand";
import { statusCopy } from "@/features/status/copy";
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
	// Whether the customer's own service desk is the front door. Both create
	// links are gated on it; the nav is duplicated for desktop and mobile, so
	// hiding one alone would leave the other reachable.
	const frontDoor = useQuery(orpc.portalIsFrontDoor.queryOptions({}));
	const foreignFrontDoor = frontDoor.data?.foreign === true;

	return (
		<header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
			<div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
				<div className="flex items-center gap-7">
					<Link to="/home" className="flex items-center">
						<AxiomaWordmark
							className="h-7 w-auto text-primary"
							title="Axiōma"
						/>
					</Link>
					<nav aria-label="Primary navigation" className="hidden gap-5 sm:flex">
						<Link
							to="/home"
							className="text-muted-foreground text-sm transition-colors hover:text-foreground"
							activeProps={{ className: "text-foreground font-medium" }}
						>
							My requests
						</Link>
						<Link
							to="/knowledge"
							className="text-muted-foreground text-sm transition-colors hover:text-foreground"
							activeProps={{ className: "text-foreground font-medium" }}
						>
							Help articles
						</Link>
						<Link
							to="/status"
							className="text-muted-foreground text-sm transition-colors hover:text-foreground"
							activeProps={{ className: "text-foreground font-medium" }}
						>
							{statusCopy.viewStatus}
						</Link>
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
								<DropdownMenuItem render={<Link to="/home" />}>
									My requests
								</DropdownMenuItem>
								<DropdownMenuItem render={<Link to="/knowledge" />}>
									Help articles
								</DropdownMenuItem>
								<DropdownMenuItem render={<Link to="/status" />}>
									{statusCopy.viewStatus}
								</DropdownMenuItem>
								{foreignFrontDoor ? null : (
									<DropdownMenuItem render={<Link to="/tickets/new" />}>
										New request
									</DropdownMenuItem>
								)}
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
					{/* Both copies are gated: the nav is duplicated for desktop and
					    mobile, so hiding one would leave the other reachable. */}
					{foreignFrontDoor ? null : (
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
					)}
					<NotificationCenter />
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
