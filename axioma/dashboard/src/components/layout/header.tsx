import { RiSearchLine as Search } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { LANDING } from "@/lib/navigation";
import { NotificationCenter } from "./notification-center";
import { UserNav } from "./user-nav";

export function Header({
	onSearch,
	showTier3,
}: {
	onSearch: () => void;
	showTier3: boolean;
}) {
	const crumbs = useBreadcrumbs();
	const isMac =
		typeof navigator !== "undefined" &&
		/Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
	return (
		<header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
			<div className="flex min-w-0 items-center gap-2">
				<SidebarTrigger />
				<div className="h-4 w-px bg-border" />
				<Breadcrumb className="min-w-0">
					<BreadcrumbList className="flex-nowrap">
						<BreadcrumbItem>
							<BreadcrumbLink render={<Link to={LANDING} />}>
								Axiōma
							</BreadcrumbLink>
						</BreadcrumbItem>
						{crumbs.map((crumb, index) => (
							<Fragment key={`${crumb.to}-${crumb.label}`}>
								<BreadcrumbSeparator />
								{index === crumbs.length - 1 ? (
									<BreadcrumbItem>
										<BreadcrumbPage className="truncate">
											{crumb.label}
										</BreadcrumbPage>
									</BreadcrumbItem>
								) : (
									<BreadcrumbItem>
										<BreadcrumbLink render={<Link to={crumb.to ?? LANDING} />}>
											{crumb.label}
										</BreadcrumbLink>
									</BreadcrumbItem>
								)}
							</Fragment>
						))}
					</BreadcrumbList>
				</Breadcrumb>
			</div>
			<div className="flex items-center gap-2">
				{showTier3 ? (
					<>
						<Button
							variant="outline"
							size="default"
							onClick={onSearch}
							aria-label="Search records"
						>
							<Search />
							<span className="hidden sm:inline">Search</span>
							<Kbd className="hidden md:inline-flex">
								{isMac ? "⌘K" : "Ctrl K"}
							</Kbd>
						</Button>
						<NotificationCenter />
					</>
				) : null}
				<ModeToggle />
				<UserNav />
			</div>
		</header>
	);
}
