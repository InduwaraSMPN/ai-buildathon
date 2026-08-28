import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, LayoutList, MonitorCog } from "lucide-react";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	if (pathname === "/login" || pathname === "/") return null;

	const links = [
		{ to: "/home", label: "Ticket queue", icon: LayoutList },
		{ to: "/devices", label: "Devices", icon: MonitorCog },
	] as const;

	return (
		<header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
			<div className="mx-auto flex h-12 max-w-[1600px] items-center gap-5 px-4 lg:px-6">
				<Link
					to="/home"
					className="flex items-center gap-2 font-semibold text-sm tracking-tight"
				>
					<span className="grid size-6 place-items-center bg-primary text-primary-foreground">
						<Activity className="size-3.5" />
					</span>
					Axioma{" "}
					<span className="font-normal text-muted-foreground">Operations</span>
				</Link>
				<nav
					aria-label="Primary navigation"
					className="flex h-full items-center gap-1"
				>
					{links.map(({ to, label, icon: Icon }) => (
						<Link
							key={to}
							to={to}
							className="flex h-full items-center gap-1.5 border-transparent border-b-2 px-3 text-muted-foreground text-xs hover:text-foreground [&.active]:border-primary [&.active]:text-foreground"
						>
							<Icon className="size-3.5" /> {label}
						</Link>
					))}
				</nav>
				<div className="ml-auto flex items-center gap-2">
					<span className="hidden items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider sm:flex">
						<span className="size-1.5 bg-emerald-500" /> Systems operational
					</span>
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
