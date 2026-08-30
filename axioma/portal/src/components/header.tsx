import { RiAddLine, RiMenuLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { AxiomaWordmark } from "@/components/brand";
import { statusCopy } from "@/features/status/copy";
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
	return (
		<header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
			<div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
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
								<DropdownMenuItem render={<Link to="/tickets/new" />}>
									New request
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
					<Link
						to="/tickets/new"
						className={buttonVariants({
							size: "sm",
							className: "hidden sm:inline-flex",
						})}
					>
						<RiAddLine data-icon="inline-start" aria-hidden="true" /> New
						request
					</Link>
					<NotificationCenter />
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
