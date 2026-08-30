import { Link, useRouterState } from "@tanstack/react-router";
import {
	BookOpen,
	Boxes,
	CalendarDays,
	ChartNoAxesCombined,
	GitPullRequest,
	LayoutDashboard,
	LayoutList,
	Lightbulb,
	ListChecks,
	Mail,
	MonitorCog,
	ScrollText,
	ShieldCheck,
	Store,
	ThumbsUp,
	Workflow,
} from "lucide-react";
import { AxiomaMark, AxiomaWordmark } from "@/components/brand";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { Route } from "@/routes/_auth/route";

export const navigation = [
	{ to: "/home", label: "Overview", icon: ChartNoAxesCombined },
	{ to: "/tickets", label: "Ticket queue", icon: LayoutList },
	{ to: "/devices", label: "Devices", icon: MonitorCog },
	{ to: "/problems", label: "Problems", icon: Lightbulb },
	{ to: "/changes", label: "Changes", icon: GitPullRequest },
	{ to: "/knowledge", label: "Knowledge", icon: BookOpen },
	{ to: "/approvals", label: "Approvals", icon: ThumbsUp },
	{ to: "/assets", label: "Assets", icon: Boxes },
	{ to: "/software-licences", label: "Software licences", icon: ScrollText },
	{ to: "/calendar", label: "Scheduled work", icon: CalendarDays },
	{ to: "/suppliers", label: "Suppliers & contracts", icon: Store },
	{ to: "/mail-log", label: "Mail send log", icon: Mail },
	{ to: "/mailboxes", label: "Mailboxes", icon: Mail },
	{ to: "/mail-templates", label: "Mail templates", icon: Mail },
	{ to: "/overview-widgets", label: "Overview widgets", icon: LayoutDashboard },
	{ to: "/ticket-rules", label: "Ticket rules", icon: ListChecks },
	{ to: "/workflows", label: "Workflows", icon: Workflow },
] as const;

export function AppSidebar() {
	const { capabilities } = Route.useRouteContext();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const { setOpenMobile } = useSidebar();
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="h-14 shrink-0 border-b p-0">
				<Link
					to="/home"
					onClick={() => setOpenMobile(false)}
					className="flex size-full items-center justify-center px-2"
				>
					<AxiomaMark className="hidden size-5 shrink-0 text-primary group-data-[collapsible=icon]:block" />
					<AxiomaWordmark
						className="h-7 w-auto text-primary group-data-[collapsible=icon]:hidden"
						title="Axiōma"
					/>
				</Link>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Operations</SidebarGroupLabel>
					<SidebarMenu aria-label="Operations">
						{navigation
							.filter(
								({ to }) =>
									!(
										to === "/ticket-rules" ||
										to === "/workflows" ||
										to === "/mailboxes" ||
										to === "/mail-templates"
									) || capabilities.includes("admin.settings"),
							)
							.map(({ to, label, icon: Icon }) => (
								<SidebarMenuItem key={to}>
									<SidebarMenuButton
										tooltip={label}
										isActive={
											pathname === to ||
											(to === "/tickets" && pathname.startsWith("/tickets/"))
										}
										render={
											<Link to={to} onClick={() => setOpenMobile(false)} />
										}
									>
										<Icon />
										<span>{label}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						{capabilities.includes("admin.roles") && (
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip="Roles"
									isActive={pathname.startsWith("/admin/roles")}
									render={
										<Link
											to="/admin/roles"
											onClick={() => setOpenMobile(false)}
										/>
									}
								>
									<ShieldCheck />
									<span>Roles</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						)}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
