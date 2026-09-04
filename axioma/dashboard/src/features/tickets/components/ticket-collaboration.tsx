import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/components/support-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Message,
	MessageContent,
	MessageHeader,
} from "@/components/ui/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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

/** Shared by the submit handler and the button so a click never does nothing. */
const isLoggableMinutes = (value: string) => {
	const minutes = Number(value);
	return value.trim() !== "" && Number.isInteger(minutes) && minutes > 0;
};

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
		// Presence is ambient. An expired session must not fill the console with
		// an unhandled rejection every 30 seconds.
		const heartbeat = () =>
			void client
				.heartbeatTicketPresence({ ticketId: ticket.id })
				.catch(() => undefined);
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
			{ticket.messages.length ? (
				<MessageScroller className="h-96">
					<MessageScrollerViewport>
						<MessageScrollerContent className="gap-3 p-1">
							{ticket.messages.map((message) => (
								<MessageScrollerItem key={message.id}>
									<Message>
										<MessageContent>
											<MessageHeader className="flex-wrap gap-2">
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
											</MessageHeader>
											<Bubble
												variant={
													message.visibility === "private" ? "tinted" : "muted"
												}
											>
												<BubbleContent>
													{message.visibility === "private" ? (
														<Alert className="border-warning/30 bg-warning/10">
															<AlertDescription className="whitespace-pre-wrap">
																{message.body}
															</AlertDescription>
															<TicketAttachments
																targetType="case_note"
																targetId={message.id}
																canEdit={canAttach}
															/>
														</Alert>
													) : (
														<p className="whitespace-pre-wrap">
															{message.body}
														</p>
													)}
												</BubbleContent>
											</Bubble>
										</MessageContent>
									</Message>
								</MessageScrollerItem>
							))}
						</MessageScrollerContent>
					</MessageScrollerViewport>
					<MessageScrollerButton />
				</MessageScroller>
			) : (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>No conversation yet</EmptyTitle>
						<EmptyDescription>
							Replies and private notes will appear here.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
			<form
				className="flex flex-col gap-3 border-t pt-4"
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
				<FieldGroup>
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
					<Field>
						<FieldLabel htmlFor="ticket-message" className="sr-only">
							Message
						</FieldLabel>
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
					</Field>
					<Button type="submit" disabled={!body.trim() || addMessage.isPending}>
						{addMessage.isPending
							? "Sending…"
							: visibility === "public"
								? "Send reply"
								: "Add private note"}
					</Button>
				</FieldGroup>
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
					<Alert className="flex-row items-center justify-between border-warning/30 bg-warning/10">
						<AlertDescription>
							Merged into <TicketLink id={ticket.mergedIntoId} />
						</AlertDescription>
						{canEdit ? (
							<Button
								size="sm"
								variant="outline"
								onClick={() => unmerge.mutate({ sourceTicketId: ticket.id })}
							>
								Unmerge
							</Button>
						) : null}
					</Alert>
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
						onSubmit={(event) => {
							event.preventDefault();
							if (target.trim()) void linkTarget();
						}}
					>
						<FieldGroup className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
							<Field>
								<FieldLabel htmlFor="target-ticket" className="sr-only">
									Target ticket reference
								</FieldLabel>
								<Input
									id="target-ticket"
									value={target}
									onChange={(event) => setTarget(event.target.value)}
									placeholder="INC-2026-00001 or ticket ID"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="ticket-relationship" className="sr-only">
									Relationship
								</FieldLabel>
								<Select
									value={relation}
									onValueChange={(value) =>
										value && setRelation(value as typeof relation)
									}
								>
									<SelectTrigger id="ticket-relationship">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{relations.map((value) => (
												<SelectItem key={value} value={value}>
													{value.replaceAll("_", " ")}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</Field>
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
						</FieldGroup>
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
						onSubmit={(event) => {
							event.preventDefault();
							const value = Number(minutes);
							if (isLoggableMinutes(minutes))
								addTime.mutate({
									ticketId: ticket.id,
									minutes: value,
									note: note.trim(),
								});
						}}
					>
						<FieldGroup className="grid gap-2 sm:grid-cols-[7rem_1fr_auto]">
							<Field>
								<FieldLabel htmlFor="time-minutes" className="sr-only">
									Minutes
								</FieldLabel>
								<Input
									id="time-minutes"
									type="number"
									min={1}
									max={1440}
									value={minutes}
									onChange={(event) => setMinutes(event.target.value)}
									placeholder="Minutes"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="time-note" className="sr-only">
									Work note
								</FieldLabel>
								<Input
									id="time-note"
									value={note}
									maxLength={2000}
									onChange={(event) => setNote(event.target.value)}
									placeholder="Work note (optional)"
								/>
							</Field>
							<Button
								type="submit"
								disabled={!isLoggableMinutes(minutes) || addTime.isPending}
							>
								Log time
							</Button>
						</FieldGroup>
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
