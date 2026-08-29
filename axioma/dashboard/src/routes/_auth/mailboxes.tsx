import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/mailboxes")({
	component: Mailboxes,
	beforeLoad: ({ context }) => {
		if (!context.capabilities.includes("admin.settings"))
			throw redirect({ to: "/home" });
		return { breadcrumb: "Mailboxes" };
	},
	head: () => ({ meta: [{ title: "Mailboxes · Axiōma" }] }),
});

function Mailboxes() {
	const queryClient = useQueryClient();
	const mailboxes = useQuery(orpc.listMailboxes.queryOptions());
	const origins = useQuery(orpc.listTicketOrigins.queryOptions());
	const [id, setId] = useState<string>();
	const [name, setName] = useState("");
	const [address, setAddress] = useState("");
	const [ticketOrigin, setTicketOrigin] = useState("");
	const [enabled, setEnabled] = useState(true);
	const reset = () => {
		setId(undefined);
		setName("");
		setAddress("");
		setTicketOrigin("");
		setEnabled(true);
	};
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: orpc.listMailboxes.key() });
	const save = useMutation(
		orpc.upsertMailbox.mutationOptions({
			onSuccess: () => {
				reset();
				void refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remove = useMutation(
		orpc.deleteMailbox.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	if (mailboxes.isPending || origins.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading mailboxes"
				description="Retrieving inbound mail settings…"
			/>
		);
	if (mailboxes.isError || origins.isError) {
		const failed = mailboxes.isError ? mailboxes : origins;
		return (
			<PageState
				kind="error"
				title="Mailboxes unavailable"
				description={failed.error?.message ?? "Try again shortly."}
				onRetry={() => void failed.refetch()}
			/>
		);
	}
	return (
		<PageContainer
			title="Mailboxes"
			description="Manage inbound addresses and their default ticket origin."
		>
			<Card className="mb-4">
				<CardHeader>
					<CardTitle>{id ? "Edit mailbox" : "New mailbox"}</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 md:grid-cols-2">
					<Input
						aria-label="Mailbox name"
						placeholder="Helpdesk"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
					<Input
						aria-label="Mailbox address"
						type="email"
						placeholder="help@example.com"
						value={address}
						onChange={(event) => setAddress(event.target.value)}
					/>
					<Select
						value={ticketOrigin}
						onValueChange={(value) => setTicketOrigin(value ?? "")}
					>
						<SelectTrigger className="w-full" aria-label="Ticket origin">
							<SelectValue placeholder="Ticket origin" />
						</SelectTrigger>
						<SelectContent>
							{origins.data.map((origin) => (
								<SelectItem key={origin.id} value={origin.key}>
									{origin.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="flex items-center gap-2 text-sm">
						<Checkbox
							id="mailbox-enabled"
							checked={enabled}
							onCheckedChange={setEnabled}
						/>
						<label htmlFor="mailbox-enabled">Enabled</label>
					</div>
					<div className="flex gap-2 md:col-span-2">
						<Button
							disabled={
								!name.trim() ||
								!address.trim() ||
								!ticketOrigin ||
								save.isPending
							}
							onClick={() =>
								save.mutate({ id, name, address, ticketOrigin, enabled })
							}
						>
							{id ? "Save mailbox" : "Create mailbox"}
						</Button>
						{id && (
							<Button variant="outline" onClick={reset}>
								Cancel
							</Button>
						)}
					</div>
				</CardContent>
			</Card>
			<div className="grid gap-3">
				{mailboxes.data.map((mailbox) => (
					<Card key={mailbox.id}>
						<CardContent className="flex items-start justify-between gap-4 p-4">
							<div>
								<p className="font-medium">{mailbox.name}</p>
								<p className="text-muted-foreground text-sm">
									{mailbox.address} ·{" "}
									{origins.data.find(
										(origin) => origin.key === mailbox.ticketOrigin,
									)?.name ?? mailbox.ticketOrigin}{" "}
									· {mailbox.enabled ? "Enabled" : "Disabled"}
								</p>
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => {
										setId(mailbox.id);
										setName(mailbox.name);
										setAddress(mailbox.address);
										setTicketOrigin(mailbox.ticketOrigin);
										setEnabled(mailbox.enabled);
									}}
								>
									Edit
								</Button>
								<Button
									variant="destructive"
									disabled={remove.isPending}
									onClick={() => remove.mutate({ id: mailbox.id })}
								>
									Delete
								</Button>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</PageContainer>
	);
}
