import { Link } from "@tanstack/react-router";
import { LifeBuoy, Plus } from "lucide-react";
import { ModeToggle } from "./mode-toggle";
import { buttonVariants } from "./ui/button";
import UserMenu from "./user-menu";

export default function Header() {
	return (
		<header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
			<div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
				<div className="flex items-center gap-7">
					<Link
						to="/home"
						className="flex items-center gap-2 font-semibold tracking-tight"
					>
						<span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<LifeBuoy className="size-4" aria-hidden="true" />
						</span>
						<span>Axioma</span>
					</Link>
					<nav aria-label="Primary navigation" className="hidden sm:block">
						<Link
							to="/home"
							className="text-muted-foreground text-sm transition-colors hover:text-foreground"
							activeProps={{ className: "text-foreground font-medium" }}
						>
							My requests
						</Link>
					</nav>
				</div>
				<div className="flex items-center gap-2">
					<Link
						to="/tickets/new"
						className={buttonVariants({
							size: "sm",
							className: "hidden sm:inline-flex",
						})}
					>
						<Plus aria-hidden="true" /> New request
					</Link>
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
