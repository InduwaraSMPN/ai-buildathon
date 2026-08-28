import { Link } from "@tanstack/react-router";
import {
	Activity,
	ChartNoAxesCombined,
	LayoutList,
	MonitorCog,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const groups = [
	{
		label: "Operations",
		items: [
			{ to: "/home", label: "Overview", icon: ChartNoAxesCombined },
			{ to: "/tickets", label: "Ticket queue", icon: LayoutList },
			{ to: "/devices", label: "Devices", icon: MonitorCog },
		],
	},
] as const;

export function AppSidebar({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	return (
		<>
			{open ? (
				<button
					type="button"
					className="fixed inset-0 z-30 bg-black/40 md:hidden"
					aria-label="Close navigation"
					onClick={onClose}
				/>
			) : null}
			<aside
				className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
			>
				<div className="flex h-14 items-center gap-2 border-b px-4">
					<Link
						to="/home"
						onClick={onClose}
						className="flex min-w-0 flex-1 items-center gap-2"
					>
						<span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
							<Activity className="size-4" />
						</span>
						<span className="grid text-left text-sm leading-tight">
							<strong className="truncate">Axiōma</strong>
							<span className="truncate text-muted-foreground text-xs">
								IT operations
							</span>
						</span>
					</Link>
					<Button
						variant="ghost"
						size="icon-sm"
						className="md:hidden"
						onClick={onClose}
						aria-label="Close navigation"
					>
						<X />
					</Button>
				</div>
				<div className="flex-1 overflow-y-auto p-3">
					{groups.map((group) => (
						<div key={group.label}>
							<p className="mb-2 px-2 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
								{group.label}
							</p>
							<nav className="space-y-1" aria-label={group.label}>
								{group.items.map(({ to, label, icon: Icon }) => (
									<Link
										key={to}
										to={to}
										onClick={onClose}
										activeOptions={{ exact: to !== "/tickets" }}
										className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&.active]:bg-sidebar-accent [&.active]:font-medium [&.active]:text-sidebar-accent-foreground"
									>
										<Icon className="size-4" />
										{label}
									</Link>
								))}
							</nav>
						</div>
					))}
				</div>
				<div className="border-t p-4">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<span className="size-2 rounded-full bg-emerald-500" />
						Systems operational
					</div>
				</div>
			</aside>
		</>
	);
}
