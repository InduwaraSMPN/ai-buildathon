import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { requireNav } from "@/lib/navigation";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/mailboxes")({
	component: Mailboxes,
	beforeLoad: ({ context }) => {
		requireNav("/mailboxes", context);
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
	const [formOpen, setFormOpen] = useState(false);
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
				setFormOpen(false);
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
			action={
				<Button
					size="sm"
					onClick={() => {
						reset();
						setFormOpen(true);
					}}
				>
					New mailbox
				</Button>
			}
		>
			<Dialog open={formOpen} onOpenChange={setFormOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>{id ? "Edit mailbox" : "New mailbox"}</DialogTitle>
						<DialogDescription>
							Inbound mail to this address opens tickets with the chosen origin.
						</DialogDescription>
					</DialogHeader>
					<FieldGroup className="grid py-4 md:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="mailbox-name">Mailbox name</FieldLabel>
							<Input
								id="mailbox-name"
								placeholder="Helpdesk"
								value={name}
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="mailbox-address">Mailbox address</FieldLabel>
							<Input
								id="mailbox-address"
								type="email"
								placeholder="help@example.com"
								value={address}
								onChange={(event) => setAddress(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="mailbox-origin">Ticket origin</FieldLabel>
							<Select
								value={ticketOrigin}
								onValueChange={(value) => setTicketOrigin(value ?? "")}
							>
								<SelectTrigger id="mailbox-origin" className="w-full">
									<SelectValue placeholder="Ticket origin" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{origins.data.map((origin) => (
											<SelectItem key={origin.id} value={origin.key}>
												{origin.name}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Field orientation="horizontal">
							<Checkbox
								id="mailbox-enabled"
								checked={enabled}
								onCheckedChange={setEnabled}
							/>
							<FieldLabel htmlFor="mailbox-enabled">Enabled</FieldLabel>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button variant="outline" onClick={() => setFormOpen(false)}>
							Cancel
						</Button>
						<Button
							disabled={
								!name.trim() || !address.trim() || !ticketOrigin || save.isPending
							}
							onClick={() =>
								save.mutate({ id, name, address, ticketOrigin, enabled })
							}
						>
							{id ? "Save mailbox" : "Create mailbox"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<div className="grid gap-3">
				{mailboxes.data.map((mailbox) => (
					<Card key={mailbox.id}>
						<CardHeader>
							<CardTitle>{mailbox.name}</CardTitle>
							<CardDescription>
								{mailbox.address} ·{" "}
								{origins.data.find(
									(origin) => origin.key === mailbox.ticketOrigin,
								)?.name ?? mailbox.ticketOrigin}{" "}
								· {mailbox.enabled ? "Enabled" : "Disabled"}
							</CardDescription>
							<CardAction className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => {
										setId(mailbox.id);
										setName(mailbox.name);
										setAddress(mailbox.address);
										setTicketOrigin(mailbox.ticketOrigin);
										setEnabled(mailbox.enabled);
										setFormOpen(true);
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
							</CardAction>
						</CardHeader>
					</Card>
				))}
			</div>
		</PageContainer>
	);
}
