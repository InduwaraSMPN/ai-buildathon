import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FileSearch } from "lucide-react";
import { useEffect, useState } from "react";
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
	const query = search.trim();
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
					<CommandEmpty>
						{results.isFetching
							? "Searching…"
							: query
								? "No results found."
								: "Type to search records."}
					</CommandEmpty>
					{!query ? (
						<CommandGroup heading="Views">
							{navigation.map(({ to, label, icon: Icon }) => (
								<CommandItem key={to} value={to} onSelect={() => go(to)}>
									<Icon />
									{label}
								</CommandItem>
							))}
						</CommandGroup>
					) : null}
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
									<span className="min-w-0 flex-1 truncate">{item.title}</span>
									<span className="truncate text-muted-foreground">
										{item.body}
									</span>
								</CommandItem>
							))}
						</CommandGroup>
					))}
				</CommandList>
			</Command>
		</CommandDialog>
	);
}
