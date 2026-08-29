import { Link, useRouterState } from "@tanstack/react-router";
import {
	Activity,
	ChartNoAxesCombined,
	LayoutList,
	MonitorCog,
} from "lucide-react";
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

export const navigation = [
	{ to: "/home", label: "Overview", icon: ChartNoAxesCombined },
	{ to: "/tickets", label: "Ticket queue", icon: LayoutList },
	{ to: "/devices", label: "Devices", icon: MonitorCog },
] as const;

export function AppSidebar() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const { setOpenMobile } = useSidebar();
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="border-b">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							tooltip="Axiōma"
							render={<Link to="/home" onClick={() => setOpenMobile(false)} />}
						>
							<span className="grid size-8 shrink-0 place-items-center bg-primary text-primary-foreground">
								<Activity className="size-4" />
							</span>
							<span className="grid text-left leading-tight">
								<strong>Axiōma</strong>
								<span className="text-muted-foreground">IT operations</span>
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Operations</SidebarGroupLabel>
					<SidebarMenu aria-label="Operations">
						{navigation.map(({ to, label, icon: Icon }) => (
							<SidebarMenuItem key={to}>
								<SidebarMenuButton
									tooltip={label}
									isActive={
										pathname === to ||
										(to === "/tickets" && pathname.startsWith("/tickets/"))
									}
									render={<Link to={to} onClick={() => setOpenMobile(false)} />}
								>
									<Icon />
									<span>{label}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
