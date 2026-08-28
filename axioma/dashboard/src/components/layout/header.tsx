import { useRouterState } from "@tanstack/react-router";
import { PanelLeft } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { UserNav } from "./user-nav";

const labels: Record<string, string> = {
	"/home": "Overview",
	"/tickets": "Ticket queue",
	"/devices": "Devices",
};

export function Header({ onMenu }: { onMenu: () => void }) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const title = pathname.startsWith("/tickets/")
		? "Ticket detail"
		: (labels[pathname] ?? "Operations");
	return (
		<header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 rounded-t-xl border-b bg-background/80 px-4 backdrop-blur-md">
			<div className="flex min-w-0 items-center gap-2">
				<Button
					variant="ghost"
					size="icon-sm"
					className="md:hidden"
					onClick={onMenu}
					aria-label="Open navigation"
				>
					<PanelLeft />
				</Button>
				<div className="hidden h-4 w-px bg-border md:block" />
				<nav aria-label="Breadcrumb" className="truncate text-sm">
					<span className="text-muted-foreground">Axiōma</span>
					<span className="px-2 text-muted-foreground">/</span>
					<span>{title}</span>
				</nav>
			</div>
			<div className="flex items-center gap-2">
				<ModeToggle />
				<UserNav />
			</div>
		</header>
	);
}
