import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TicketAttachments } from "@/features/documents/components";
import { client, orpc, queryClient } from "@/utils/orpc";
import type { TicketDetail } from "../api/types";

const relations = [
	"related_to",
	"duplicate_of",
	"caused_by",
	"parent_of",
] as const;

export function TicketConversation({
	ticket,
	canAttach,
}: {
	ticket: TicketDetail;
	canAttach: boolean;
}) {
	const [body, setBody] = useState("");
	const [visibility, setVisibility] = useState<"public" | "private">("public");
	const presence = useQuery(
		orpc.listTicketPresence.queryOptions({
			input: { ticketId: ticket.id },
			refetchInterval: 15_000,
		}),
	);
	const addMessage = useMutation(
		orpc.addTicketMessage.mutationOptions({
			onSuccess: async () => {
				setBody("");
				await queryClient.invalidateQueries({
					queryKey: orpc.getTicket.key({ input: { id: ticket.id } }),
				});
				toast.success(
					visibility === "public" ? "Reply sent" : "Private note added",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	useEffect(() => {
		const heartbeat = () =>
			void client.heartbeatTicketPresence({ ticketId: ticket.id });
		heartbeat();
		const timer = window.setInterval(heartbeat, 30_000);
		return () => window.clearInterval(timer);
	}, [ticket.id]);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
				<span>Viewing now:</span>
				{presence.data?.length ? (
					presence.data.map((person) => (
						<Badge key={person.userId} variant="outline">
							{person.userName}
						</Badge>
					))
				) : (
					<span>No other staff</span>
				)}
			</div>
			<ol className="space-y-3">
				{ticket.messages.length ? (
					ticket.messages.map((message) => (
						<li
							key={message.id}
							className={
								message.visibility === "private"
									? "rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
									: "rounded-lg border bg-muted/30 p-3"
							}
						>
							<div className="mb-2 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
								<span className="font-medium text-foreground">
									{message.authorType === "staff"
										? "Support"
										: ticket.reporterName}
								</span>
								<Badge variant="outline">
									{message.visibility === "private"
										? "Private note"
										: "Public reply"}
								</Badge>
								<time>{formatDate(message.createdAt)}</time>
							</div>
							<p className="whitespace-pre-wrap text-sm leading-6">
								{message.body}
							</p>
							{message.visibility === "private" ? (
								<div className="mt-3 border-t pt-3">
									<TicketAttachments
										targetType="case_note"
										targetId={message.id}
										canEdit={canAttach}
									/>
								</div>
							) : null}
						</li>
					))
				) : (
					<li className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
						No conversation yet.
					</li>
				)}
			</ol>
			<form
				className="space-y-3 border-t pt-4"
				onSubmit={(event) => {
					event.preventDefault();
					const message = body.trim();
					if (message)
						addMessage.mutate({
							ticketId: ticket.id,
							body: message,
							visibility,
						});
				}}
			>
				<fieldset className="flex gap-2">
					<legend className="sr-only">Message visibility</legend>
					<Button
						type="button"
						size="sm"
						variant={visibility === "public" ? "default" : "outline"}
						aria-pressed={visibility === "public"}
						onClick={() => setVisibility("public")}
					>
						Public reply
					</Button>
					<Button
						type="button"
						size="sm"
						variant={visibility === "private" ? "default" : "outline"}
						aria-pressed={visibility === "private"}
						onClick={() => setVisibility("private")}
					>
						Private note
					</Button>
				</fieldset>
				<label htmlFor="ticket-message" className="sr-only">
					Message
				</label>
				<Textarea
					id="ticket-message"
					value={body}
					onChange={(event) => setBody(event.target.value)}
					maxLength={10_000}
					placeholder={
						visibility === "public"
							? "Reply to the requester…"
							: "Add a note visible only to staff…"
					}
					className="min-h-28"
				/>
				<Button type="submit" disabled={!body.trim() || addMessage.isPending}>
					{addMessage.isPending
						? "Sending…"
						: visibility === "public"
							? "Send reply"
							: "Add private note"}
				</Button>
			</form>
		</div>
	);
}

export function TicketActivity({
	ticket,
	canEdit,
}: {
	ticket: TicketDetail;
	canEdit: boolean;
}) {
	const [target, setTarget] = useState("");
	const [relation, setRelation] =
		useState<(typeof relations)[number]>("related_to");
	const [minutes, setMinutes] = useState("");
	const [note, setNote] = useState("");
	const links = useQuery(
		orpc.listTicketLinks.queryOptions({ input: { ticketId: ticket.id } }),
	);
	const audit = useQuery(
		orpc.listTicketAudit.queryOptions({ input: { ticketId: ticket.id } }),
	);
	const time = useQuery(
		orpc.listTicketTimeEntries.queryOptions({ input: { ticketId: ticket.id } }),
	);
	const refreshLinks = () =>
		queryClient.invalidateQueries({
			queryKey: orpc.listTicketLinks.key({ input: { ticketId: ticket.id } }),
		});
	const link = useMutation(
		orpc.linkTickets.mutationOptions({
			onSuccess: async () => {
				setTarget("");
				await refreshLinks();
				toast.success("Ticket linked");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const unlink = useMutation(
		orpc.unlinkTickets.mutationOptions({
			onSuccess: refreshLinks,
			onError: (error) => toast.error(error.message),
		}),
	);
	const merge = useMutation(
		orpc.mergeTickets.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.getTicket.key({ input: { id: ticket.id } }),
				});
				toast.success("Ticket merged");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const unmerge = useMutation(
		orpc.unmergeTicket.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.getTicket.key({ input: { id: ticket.id } }),
				});
				toast.success("Ticket unmerged");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const addTime = useMutation(
		orpc.addTicketTimeEntry.mutationOptions({
			onSuccess: async () => {
				setMinutes("");
				setNote("");
				await queryClient.invalidateQueries({
					queryKey: orpc.listTicketTimeEntries.key({
						input: { ticketId: ticket.id },
					}),
				});
				toast.success("Time logged");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const resolveTarget = async () => {
		const found = await client.lookupTicket({ reference: target.trim() });
		if (!found) throw new Error("Target ticket not found");
		return found.id;
	};
	const linkTarget = async () => {
		try {
			link.mutate({
				ticketId: ticket.id,
				targetTicketId: await resolveTarget(),
				relationType: relation,
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Target ticket not found",
			);
		}
	};
	const mergeTarget = async () => {
		try {
			merge.mutate({
				sourceTicketId: ticket.id,
				targetTicketId: await resolveTarget(),
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Target ticket not found",
			);
		}
	};

	return (
		<div className="space-y-6">
			<section className="space-y-3">
				<h3 className="font-semibold text-sm">Links and merge</h3>
				{ticket.mergedIntoId ? (
					<div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
						<span>
							Merged into <TicketLink id={ticket.mergedIntoId} />
						</span>
						{canEdit ? (
							<Button
								size="sm"
								variant="outline"
								onClick={() => unmerge.mutate({ sourceTicketId: ticket.id })}
							>
								Unmerge
							</Button>
						) : null}
					</div>
				) : null}
				<ul className="space-y-2 text-sm">
					{links.data?.map((item) => {
						const otherId =
							item.ticketId === ticket.id ? item.targetTicketId : item.ticketId;
						return (
							<li
								key={item.id}
								className="flex items-center justify-between rounded-lg border p-3"
							>
								<span className="capitalize">
									{item.relationType.replaceAll("_", " ")}{" "}
									<TicketLink id={otherId} />
								</span>
								{canEdit ? (
									<Button
										size="sm"
										variant="ghost"
										onClick={() => unlink.mutate({ id: item.id })}
									>
										Remove
									</Button>
								) : null}
							</li>
						);
					})}
				</ul>
				{canEdit ? (
					<form
						className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
						onSubmit={(event) => {
							event.preventDefault();
							if (target.trim()) void linkTarget();
						}}
					>
						<Input
							value={target}
							onChange={(event) => setTarget(event.target.value)}
							placeholder="INC-2026-00001 or ticket ID"
							aria-label="Target ticket reference"
						/>
						<select
							value={relation}
							onChange={(event) =>
								setRelation(event.target.value as typeof relation)
							}
							className="h-9 rounded-md border bg-background px-3 text-sm"
							aria-label="Relationship"
						>
							{relations.map((value) => (
								<option key={value} value={value}>
									{value.replaceAll("_", " ")}
								</option>
							))}
						</select>
						<Button
							type="submit"
							variant="outline"
							disabled={!target.trim() || link.isPending}
						>
							Link
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={!target.trim() || merge.isPending}
							onClick={() => void mergeTarget()}
						>
							Merge into
						</Button>
					</form>
				) : null}
			</section>
			<section className="space-y-3 border-t pt-5">
				<h3 className="font-semibold text-sm">
					Time · {time.data?.totalMinutes ?? 0} minutes total
				</h3>
				<ul className="divide-y text-sm">
					{time.data?.entries.map((entry) => (
						<li key={entry.id} className="flex justify-between gap-4 py-2">
							<span>{entry.note || "No note"}</span>
							<span className="text-muted-foreground tabular-nums">
								{entry.minutes} min · {formatDate(entry.createdAt)}
							</span>
						</li>
					))}
				</ul>
				{canEdit ? (
					<form
						className="grid gap-2 sm:grid-cols-[7rem_1fr_auto]"
						onSubmit={(event) => {
							event.preventDefault();
							const value = Number(minutes);
							if (Number.isInteger(value) && value > 0)
								addTime.mutate({
									ticketId: ticket.id,
									minutes: value,
									note: note.trim(),
								});
						}}
					>
						<Input
							type="number"
							min={1}
							max={1440}
							value={minutes}
							onChange={(event) => setMinutes(event.target.value)}
							placeholder="Minutes"
							aria-label="Minutes"
						/>
						<Input
							value={note}
							maxLength={2000}
							onChange={(event) => setNote(event.target.value)}
							placeholder="Work note (optional)"
							aria-label="Work note"
						/>
						<Button type="submit" disabled={!minutes || addTime.isPending}>
							Log time
						</Button>
					</form>
				) : null}
			</section>
			<section className="space-y-3 border-t pt-5">
				<h3 className="font-semibold text-sm">Audit log</h3>
				<ul className="divide-y text-sm">
					{audit.data?.length ? (
						audit.data.map((row) => (
							<li
								key={row.id}
								className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr_auto]"
							>
								<span className="font-medium capitalize">
									{row.fieldName.replaceAll("_", " ")}
								</span>
								<span className="break-all text-muted-foreground">
									{display(row.oldValue)} → {display(row.newValue)}
								</span>
								<time className="text-muted-foreground">
									{formatDate(row.createdAt)}
								</time>
							</li>
						))
					) : (
						<li className="py-4 text-muted-foreground">
							No audited changes yet.
						</li>
					)}
				</ul>
			</section>
		</div>
	);
}

function TicketLink({ id }: { id: string }) {
	return (
		<Link
			to="/tickets/$ticketId"
			params={{ ticketId: id }}
			className="font-mono underline underline-offset-2"
		>
			{id}
		</Link>
	);
}

function display(value: unknown) {
	if (value == null) return "—";
	return typeof value === "string" ? value : JSON.stringify(value);
}
