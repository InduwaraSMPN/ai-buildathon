import { Link, useMatchRoute } from "@tanstack/react-router";
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
import { LANDING, visibleNavigation } from "@/lib/navigation";
import { Route } from "@/routes/_auth/route";

export function AppSidebar() {
	const { capabilities } = Route.useRouteContext();
	const matchRoute = useMatchRoute();
	const { setOpenMobile } = useSidebar();
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="h-14 shrink-0 border-b p-0">
				<Link
					to={LANDING}
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
					<SidebarMenu className="gap-1" aria-label="Operations">
						{visibleNavigation(capabilities).map(
							({ to, label, icon: Icon }) => (
								<SidebarMenuItem key={to}>
									<SidebarMenuButton
										tooltip={label}
										isActive={Boolean(matchRoute({ to, fuzzy: true }))}
										render={
											<Link to={to} onClick={() => setOpenMobile(false)} />
										}
									>
										<Icon />
										<span>{label}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							),
						)}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
