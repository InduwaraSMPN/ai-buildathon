import { Link } from "@tanstack/react-router";
import { Activity, LayoutList, MonitorCog } from "lucide-react";
import type { ReactNode } from "react";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const links = [
	{ to: "/home", label: "Ticket queue", icon: LayoutList },
	{ to: "/devices", label: "Devices", icon: MonitorCog },
] as const;

function Brand() {
	return (
		<Link
			to="/home"
			className="flex items-center gap-2 font-semibold tracking-tight"
		>
			<span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
				<Activity className="size-4" />
			</span>
			<span>Axiōma</span>
		</Link>
	);
}

function Navigation({ mobile = false }: { mobile?: boolean }) {
	return (
		<nav
			aria-label="Primary navigation"
			className={
				mobile ? "flex min-w-0 flex-1 gap-1 overflow-x-auto" : "space-y-1"
			}
		>
			{links.map(({ to, label, icon: Icon }) => (
				<Link
					key={to}
					to={to}
					className={
						mobile
							? "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground text-xs hover:bg-muted hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
							: "flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&.active]:bg-sidebar-accent [&.active]:font-medium [&.active]:text-sidebar-accent-foreground"
					}
				>
					<Icon className="size-4" /> {label}
				</Link>
			))}
		</nav>
	);
}

export function DashboardShell({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-svh bg-muted/40 md:grid md:grid-cols-[240px_minmax(0,1fr)]">
			<aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
				<div className="flex h-12 items-center border-b px-4">
					<Brand />
				</div>
				<div className="flex-1 p-3">
					<p className="mb-2 px-3 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
						Operations
					</p>
					<Navigation />
				</div>
				<div className="border-t p-3">
					<div className="mb-3 flex items-center gap-2 px-3 text-[10px] text-muted-foreground uppercase tracking-wider">
						<span className="size-1.5 rounded-full bg-emerald-500" /> Systems
						operational
					</div>
					<div className="flex items-center gap-2">
						<div className="min-w-0 flex-1">
							<UserMenu />
						</div>
						<ModeToggle />
					</div>
				</div>
			</aside>

			<div className="min-w-0 md:col-start-2">
				<header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur md:hidden">
					<div className="flex h-12 items-center gap-2 px-4">
						<Brand />
						<div className="ml-auto flex items-center gap-1">
							<ModeToggle />
							<UserMenu />
						</div>
					</div>
					<div className="flex border-t px-2 py-1.5">
						<Navigation mobile />
					</div>
				</header>
				<main className="min-h-svh min-w-0 bg-background md:m-2 md:min-h-[calc(100svh-1rem)] md:rounded-xl md:border md:shadow-sm">
					{children}
				</main>
			</div>
		</div>
	);
}
