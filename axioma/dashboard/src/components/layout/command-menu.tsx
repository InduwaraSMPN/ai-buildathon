import { RiFileSearchLine as FileSearch } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { orpc } from "@/utils/orpc";
import { navigation } from "./app-sidebar";

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
	const go = (to: string) => {
		onOpenChange(false);
		void navigate({ to });
	};
	const groups = Object.groupBy(
		results.data ?? [],
		(result) => result.objectType,
	);

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
				<div className="flex gap-3 border-b px-3 py-2 text-muted-foreground text-xs">
					<span>
						<Kbd>↑</Kbd>/<Kbd>↓</Kbd> select
					</span>
					<span>
						<Kbd>Enter</Kbd> open
					</span>
				</div>
				<CommandList>
					{!search.trim() ? (
						<>
							<p className="py-4 text-center text-muted-foreground text-sm">
								Type to search records.
							</p>
							<CommandGroup heading="Views">
								{navigation.map(({ to, label, icon: Icon }) => (
									<CommandItem key={to} value={to} onSelect={() => go(to)}>
										<Icon />
										{label}
									</CommandItem>
								))}
							</CommandGroup>
						</>
					) : results.isError && results.data == null ? (
						<CommandEmpty>
							<div role="alert">
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
						</CommandEmpty>
					) : (
						<>
							<CommandEmpty>
								{results.isPending || results.isFetching
									? "Searching…"
									: "No results found."}
							</CommandEmpty>
							{Object.entries(groups).map(([type, items]) => (
								<CommandGroup
									key={type}
									heading={labels[type] ?? type.replaceAll("_", " ")}
								>
									{items?.map((item) => (
										<CommandItem
											key={`${type}:${item.objectId}`}
											value={`${type}:${item.objectId}`}
											onSelect={() => item.url && go(item.url)}
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
