import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { MonitorCog, Ticket } from "lucide-react";
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
import { deviceQueries } from "@/features/devices/api/queries";
import { ticketQueries } from "@/features/tickets/api/queries";
import { navigation } from "./app-sidebar";

export function CommandMenu({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const tickets = useQuery({
		...ticketQueries.list({
			scope: "all",
			limit: 50,
			search: search.trim() || undefined,
		}),
		enabled: open,
	});
	const devices = useQuery({ ...deviceQueries.all(), enabled: open });
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
	const goToDevice = (deviceId: string) => {
		onOpenChange(false);
		void navigate({ to: "/devices", search: { deviceId } });
	};
	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Search Axiōma"
			description="Search views, tickets, and devices"
		>
			<Command>
				<CommandInput
					autoFocus
					value={search}
					onValueChange={setSearch}
					placeholder="Search views, tickets, or devices…"
				/>
				<div className="flex flex-wrap gap-3 border-b px-3 py-2 text-muted-foreground text-xs">
					<span>
						<Kbd>j</Kbd>/<Kbd>k</Kbd> rows
					</span>
					<span>
						<Kbd>Enter</Kbd> open
					</span>
					<span>
						<Kbd>e</Kbd> escalate
					</span>
					<span>
						<Kbd>r</Kbd> resolve
					</span>
					<span>
						<Kbd>?</Kbd> help
					</span>
				</div>
				<CommandList>
					<CommandEmpty>
						{tickets.isPending || devices.isPending
							? "Loading…"
							: "No results found."}
					</CommandEmpty>
					<CommandGroup heading="Views">
						{navigation.map(({ to, label, icon: Icon }) => (
							<CommandItem
								key={to}
								value={`${label} ${to}`}
								onSelect={() => go(to)}
							>
								<Icon />
								{label}
							</CommandItem>
						))}
					</CommandGroup>
					<CommandGroup heading="Tickets">
						{tickets.data?.items.map((ticket) => (
							<CommandItem
								key={ticket.id}
								value={`${ticket.id} ${ticket.title}`}
								onSelect={() => go(`/tickets/${ticket.id}`)}
							>
								<Ticket />
								<span className="truncate">{ticket.title}</span>
								<span className="ml-auto font-mono text-muted-foreground">
									{ticket.id}
								</span>
							</CommandItem>
						))}
					</CommandGroup>
					<CommandGroup heading="Devices">
						{devices.data?.map((device) => (
							<CommandItem
								key={device.id}
								value={`${device.id} ${device.hostname} ${device.ownerName ?? ""} ${device.username ?? ""}`}
								onSelect={() => goToDevice(device.id)}
							>
								<MonitorCog />
								<span className="truncate">{device.hostname}</span>
								<span className="ml-auto font-mono text-muted-foreground">
									{device.id}
								</span>
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</Command>
		</CommandDialog>
	);
}
