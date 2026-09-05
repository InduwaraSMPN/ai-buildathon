import { RiFileSearchLine as FileSearch } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandDialog,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { type NavPath, visibleSections } from "@/lib/navigation";
import { Route } from "@/routes/_auth/route";
import { orpc } from "@/utils/orpc";

const labels: Record<string, string> = {
	ticket: "Tickets",
	problem: "Problems",
	change: "Changes",
	knowledge_article: "Knowledge",
	cmdb_object: "CMDB",
	asset: "Assets",
};

export function CommandMenu({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const navigate = useNavigate();
	const { capabilities } = Route.useRouteContext();
	const [search, setSearch] = useState("");
	const [query, setQuery] = useState("");
	useEffect(() => {
		const timer = window.setTimeout(() => setQuery(search.trim()), 300);
		return () => window.clearTimeout(timer);
	}, [search]);
	const results = useQuery({
		...orpc.search.queryOptions({ input: { query, limit: 40, offset: 0 } }),
		enabled: open && query.length > 0,
	});
	useEffect(() => {
		const shortcut = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				onOpenChange(!open);
			}
		};
		window.addEventListener("keydown", shortcut);
		return () => window.removeEventListener("keydown", shortcut);
	}, [open, onOpenChange]);
	// `goTo` is typed to the registry's literal union so a renamed path stops
	// compiling here, while `goUrl` intentionally widens to a plain string:
	// backend deep links arrive from the API as free-form URLs.
	const goTo = (to: NavPath) => {
		onOpenChange(false);
		void navigate({ to });
	};
	const goUrl = (url: string) => {
		onOpenChange(false);
		// Widened on purpose: server-supplied deep links from the API are plain
		// strings and are deliberately not part of the typed registry. An absolute
		// one has to leave the router, though — handing `https://…` to `navigate`
		// resolved it as an internal path and landed on `/https:/…`.
		if (/^https?:\/\//i.test(url)) {
			window.open(url, "_blank", "noopener,noreferrer");
			return;
		}
		void navigate({ to: url });
	};
	const groups = Object.groupBy(
		results.data ?? [],
		(result) => result.objectType,
	);
	const term = search.trim().toLowerCase();
	const sections = visibleSections(capabilities)
		.map(({ section, entries }) => ({
			section,
			entries: entries.filter(({ label }) =>
				label.toLowerCase().includes(term),
			),
		}))
		.filter(({ entries }) => entries.length > 0);

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Search Axiōma"
			description="Search across Axiōma records"
		>
			<Command shouldFilter={false}>
				<CommandInput
					autoFocus
					value={search}
					onValueChange={setSearch}
					placeholder="Search tickets, devices, CMDB, knowledge…"
				/>
				<div className="flex gap-4 border-b px-3 py-2 text-muted-foreground text-xs">
					<span className="flex items-center gap-1.5">
						<Kbd>↑</Kbd>
						<span aria-hidden="true">/</span>
						<Kbd>↓</Kbd>
						select
					</span>
					<span className="flex items-center gap-1.5">
						<Kbd>Enter</Kbd>
						open
					</span>
				</div>
				<CommandList>
					{sections.map(({ section, entries }) => (
						<CommandGroup key={section} heading={section}>
							{entries.map(({ to, label, icon: Icon }) => (
								<CommandItem key={to} value={to} onSelect={() => goTo(to)}>
									<Icon />
									{label}
								</CommandItem>
							))}
						</CommandGroup>
					))}
					{!term ? null : results.isError && results.data == null ? (
						<div className="p-4 text-center text-sm" role="alert">
							<p className="text-destructive">Search failed</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{results.error.message}
							</p>
							<Button
								variant="outline"
								size="sm"
								className="mt-3"
								onClick={() => results.refetch()}
							>
								Try again
							</Button>
						</div>
					) : (
						<>
							{results.data?.length ? null : (
								<p
									className="p-4 text-center text-muted-foreground text-sm"
									role="status"
								>
									{results.isPending || results.isFetching
										? "Searching…"
										: "No results found."}
								</p>
							)}
							{Object.entries(groups).map(([type, items]) => (
								<CommandGroup
									key={type}
									heading={labels[type] ?? type.replaceAll("_", " ")}
								>
									{items?.map((item) => (
										<CommandItem
											key={`${type}:${item.objectId}`}
											value={`${type}:${item.objectId}`}
											onSelect={() => item.url && goUrl(item.url)}
											disabled={!item.url}
										>
											<FileSearch />
											<span className="min-w-0 flex-1 truncate">
												{item.title}
											</span>
											<span className="truncate text-muted-foreground">
												{item.body}
											</span>
										</CommandItem>
									))}
								</CommandGroup>
							))}
						</>
					)}
				</CommandList>
			</Command>
		</CommandDialog>
	);
}
