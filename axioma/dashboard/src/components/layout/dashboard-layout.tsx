import { type ReactNode, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";

export function DashboardLayout({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="min-h-svh bg-muted/40 md:pl-64">
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-background focus:px-3 focus:py-2"
			>
				Skip to content
			</a>
			<AppSidebar open={open} onClose={() => setOpen(false)} />
			<div className="min-w-0 p-0 md:p-2">
				<div className="min-h-svh bg-background md:min-h-[calc(100svh-1rem)] md:rounded-xl md:border md:shadow-sm">
					<Header onMenu={() => setOpen(true)} />
					{children}
				</div>
			</div>
		</div>
	);
}
