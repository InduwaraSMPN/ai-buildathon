import { type ReactNode, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { Header } from "./header";

export function DashboardLayout({ children }: { children: ReactNode }) {
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
				<Header onSearch={() => setSearchOpen(true)} />
				{children}
			</SidebarInset>
			<CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
		</SidebarProvider>
	);
}
