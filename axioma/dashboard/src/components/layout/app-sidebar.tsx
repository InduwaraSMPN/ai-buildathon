import { Link, useMatchRoute } from "@tanstack/react-router";

import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { LANDING, visibleSections } from "@/lib/navigation";
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
					aria-label="Axiōma"
					onClick={() => setOpenMobile(false)}
					className="flex size-full items-center justify-center px-2"
				>
					{/* The shipped brand files rather than the inline logos: each
					    carries the approved fill for its ground (#008236 on light,
					    #016630 on dark). One wrapper per theme, and inside it the
					    mark replaces the wordmark once the rail collapses. */}
					<span className="flex items-center dark:hidden">
						<img
							src="/brand/axioma-mark.svg"
							alt=""
							width={47}
							height={40}
							className="hidden size-5 shrink-0 group-data-[collapsible=icon]:block"
						/>
						<img
							src="/brand/axioma-logo.svg"
							alt=""
							width={120}
							height={27}
							className="h-7 w-auto group-data-[collapsible=icon]:hidden"
						/>
					</span>
					<span className="hidden items-center dark:flex">
						<img
							src="/brand/axioma-mark-dark.svg"
							alt=""
							width={47}
							height={40}
							className="hidden size-5 shrink-0 group-data-[collapsible=icon]:block"
						/>
						<img
							src="/brand/axioma-logo-dark.svg"
							alt=""
							width={120}
							height={27}
							className="h-7 w-auto group-data-[collapsible=icon]:hidden"
						/>
					</span>
				</Link>
			</SidebarHeader>
			<SidebarContent>
				{visibleSections(capabilities).map(({ section, entries }) => (
					<SidebarGroup key={section}>
						<SidebarGroupLabel>{section}</SidebarGroupLabel>
						<SidebarMenu className="gap-1" aria-label={section}>
							{entries.map(({ to, label, icon: Icon }) => (
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
							))}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
