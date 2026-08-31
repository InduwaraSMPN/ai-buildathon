import { type ReactNode, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Route } from "@/routes/_auth/route";
import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { Header } from "./header";

export function DashboardLayout({ children }: { children: ReactNode }) {
	const { capabilities } = Route.useRouteContext();
	const [searchOpen, setSearchOpen] = useState(false);
	return (
		<SidebarProvider>
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-background focus:px-3 focus:py-2"
			>
				Skip to content
			</a>
			<AppSidebar />
			<SidebarInset className="min-h-svh">
				<Header
					onSearch={() => setSearchOpen(true)}
					showTier3={capabilities.includes("admin.settings")}
				/>
				{/* One main landmark for every authed route, including the loading,
				    error and empty states that never reach PageContainer. The header
				    is deliberately outside it: a banner must not sit inside main. */}
				<main
					id="main-content"
					className="flex min-w-0 flex-1 flex-col"
					tabIndex={-1}
				>
					{children}
				</main>
			</SidebarInset>
			{capabilities.includes("admin.settings") ? (
				<CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
			) : null}
		</SidebarProvider>
	);
}
