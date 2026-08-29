import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
	formatDate,
	PageHeader,
	PageState,
	StatusBadge,
} from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { AgentTranscript } from "@/features/agent-runs/components/agent-transcript";
import { TicketImpact } from "@/features/cmdb/components/ticket-impact";
import { TicketAttachments } from "@/features/documents/components";
import { Route } from "@/routes/_auth/tickets.$ticketId";
import { orpc } from "@/utils/orpc";
import { ticketMutations } from "../api/mutations";
import { ticketQueries } from "../api/queries";
import type {
	TicketDetail as TicketDetailData,
	TicketOperatorActionInput,
	UpdateTicketInput,
} from "../api/types";
import { DynamicFields } from "./dynamic-fields";
import { TicketActions } from "./ticket-actions";
import { TicketActivity, TicketConversation } from "./ticket-collaboration";

export function TicketDetailPage({ ticketId }: { ticketId: string }) {
	const { capabilities } = Route.useRouteContext();
	const query = useQuery(ticketQueries.detail(ticketId));
	if (query.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading ticket"
				description="Retrieving ticket details…"
			/>
		);
	if (query.isError)
		return (
			<PageState
				kind="error"
				title="Ticket unavailable"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);
	if (!query.data)
		return (
			<PageState
				kind="empty"
				title="Ticket not found"
				description="This ticket may have been removed or the ID is incorrect."
			/>
		);
	return <TicketDetail ticket={query.data} capabilities={capabilities} />;
}

function TicketDetail({
	ticket,
	capabilities,
}: {
	ticket: TicketDetailData;
	capabilities: readonly string[];
}) {
	const queryClient = useQueryClient();
	const fieldDefinitions = useQuery(
		orpc.listFieldDefinitions.queryOptions({ input: { objectType: "ticket" } }),
	);
	const serviceRecords = useQuery(
		orpc.getTicketServiceRecords.queryOptions({
			input: { ticketId: ticket.id },
		}),
	);
	const mutation = useMutation(
		ticketMutations.update(queryClient, {
			onSuccess: () => toast.success("Ticket updated"),
			onError: (error) => toast.error(error.message),
		}),
	);
	const update = (input: TicketOperatorActionInput) =>
		mutation.mutateAsync({ id: ticket.id, ...input } as UpdateTicketInput);

	return (
		<div className="space-y-5">
			<PageHeader
				eyebrow={`Ticket / ${ticket.number ?? ticket.id}`}
				title={ticket.title}
				description={`Reported by ${ticket.reporterName} · ${formatDate(ticket.createdAt)}`}
				actions={
					<StatusBadge status={ticket.status} label={ticket.statusLabel} />
				}
			/>
			<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
				<Tabs
					defaultValue="conversation"
					className="min-w-0 rounded-xl border bg-card p-4 shadow-sm"
				>
					<TabsList variant="line" aria-label="Ticket details">
						<TabsTrigger value="conversation">Conversation</TabsTrigger>
						<TabsTrigger value="transcript">Transcript</TabsTrigger>
						<TabsTrigger value="request">Request</TabsTrigger>
						<TabsTrigger value="activity">Activity</TabsTrigger>
					</TabsList>
					<TabsContent value="conversation" className="pt-4">
						<TicketConversation
							ticket={ticket}
							canAttach={capabilities.includes("ticket.update")}
						/>
					</TabsContent>
					<TabsContent value="transcript" className="pt-4">
						<AgentTranscript
							runs={ticket.runs}
							ticketId={ticket.id}
							status={ticket.status}
						/>
					</TabsContent>
					<TabsContent value="request" className="pt-4">
						<p className="whitespace-pre-wrap text-sm leading-6">
							{ticket.body}
						</p>
					</TabsContent>
					<TabsContent value="activity" className="pt-4">
						<TicketActivity
							ticket={ticket}
							canEdit={capabilities.includes("ticket.reclassify")}
						/>
					</TabsContent>
				</Tabs>
				<aside className="space-y-4">
					<Metadata ticket={ticket} />
					<DynamicFields
						definitions={fieldDefinitions.data ?? []}
						values={ticket.customFields}
					/>
					<TicketImpact ticketId={ticket.id} />
					<section className="rounded-xl border bg-card p-4 shadow-sm">
						<h2 className="mb-3 font-semibold text-xs uppercase tracking-wider">
							Related service records
						</h2>
						<div className="space-y-2 text-sm">
							{serviceRecords.data?.problems.map((problem) => (
								<Link
									key={problem.id}
									to="/problems/$problemId"
									params={{ problemId: problem.id }}
									className="block underline underline-offset-2"
								>
									{problem.problemNumber}: {problem.title}
									{problem.workaround ? ` — ${problem.workaround}` : ""}
								</Link>
							))}
							{serviceRecords.data?.changes.map((change) => (
								<Link
									key={change.id}
									to="/changes/$changeId"
									params={{ changeId: change.id }}
									className="block underline underline-offset-2"
								>
									{change.changeNumber}: {change.title}
								</Link>
							))}
							{serviceRecords.data &&
							!serviceRecords.data.problems.length &&
							!serviceRecords.data.changes.length
								? "None linked"
								: null}
						</div>
					</section>
					<section className="rounded-xl border bg-card p-4 shadow-sm">
						<h2 className="mb-3 font-semibold text-xs uppercase tracking-wider">
							Attachments
						</h2>
						<TicketAttachments
							targetId={ticket.id}
							canEdit={capabilities.includes("ticket.update")}
						/>
					</section>
					<TicketActions
						ticket={ticket}
						capabilities={capabilities}
						pending={mutation.isPending}
						onAction={update}
					/>
				</aside>
			</div>
		</div>
	);
}

function Metadata({ ticket }: { ticket: TicketDetailData }) {
	return (
		<section className="rounded-xl border bg-card p-4 shadow-sm">
			<h2 className="font-semibold text-xs uppercase tracking-wider">
				Metadata
			</h2>
			<dl className="mt-3 divide-y text-xs">
				<Meta label="Reference">{ticket.number ?? ticket.id}</Meta>
				<Meta label="Status">
					<StatusBadge status={ticket.status} label={ticket.statusLabel} />
				</Meta>
				<Meta label="Type">{label(ticket.recordType)}</Meta>
				<Meta label="Priority">
					<Tooltip>
						<TooltipTrigger
							render={<Badge variant="outline" className="cursor-help" />}
						>
							{ticket.priority}
						</TooltipTrigger>
						<TooltipContent>
							Calculated from impact and urgency; change classification to
							update it.
						</TooltipContent>
					</Tooltip>
				</Meta>
				<Meta label="Impact">{label(ticket.impact)}</Meta>
				<Meta label="Urgency">{label(ticket.urgency)}</Meta>
				<Meta label="Category">
					{ticket.category ? label(ticket.category) : "Unclassified"}
				</Meta>
				<Meta label="Subcategory">{ticket.subcategory ?? "None"}</Meta>
				<Meta label="Route">
					{ticket.route ? label(ticket.route) : "Unassigned"}
				</Meta>
				<Meta label="Progress">
					{ticket.progressMarker ? label(ticket.progressMarker) : "None"}
				</Meta>
				<Meta label="Reporter">{ticket.reporterName}</Meta>
				<Meta label="Reporter ID">{ticket.reporterId}</Meta>
				<Meta label="Device">
					{ticket.deviceId ? (
						<Link
							to="/devices"
							search={{ deviceId: ticket.deviceId }}
							className="underline underline-offset-2"
						>
							{ticket.deviceId}
						</Link>
					) : (
						"None linked"
					)}
				</Meta>
				<Meta label="Created">
					<time className="tabular-nums">{formatDate(ticket.createdAt)}</time>
				</Meta>
				<Meta label="Updated">
					<time className="tabular-nums">{formatDate(ticket.updatedAt)}</time>
				</Meta>
				<Meta label="Resolved">
					<span className="tabular-nums">
						{ticket.resolvedAt ? formatDate(ticket.resolvedAt) : "—"}
					</span>
				</Meta>
				<Meta label="Closed">
					<span className="tabular-nums">
						{ticket.closedAt ? formatDate(ticket.closedAt) : "—"}
					</span>
				</Meta>
				<Meta label="Resolution">{ticket.resolution ?? "Pending"}</Meta>
				<Meta label="Escalation">{ticket.escalationNote ?? "None"}</Meta>
				<Meta label="Reopened">
					<span className="tabular-nums">
						{ticket.reopenedAt ? formatDate(ticket.reopenedAt) : "—"}
					</span>
				</Meta>
			</dl>
		</section>
	);
}

function label(value: string) {
	return value.replaceAll("_", " ");
}

function Meta({
	label: title,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="grid grid-cols-[90px_1fr] gap-3 py-2.5 first:pt-0 last:pb-0">
			<dt className="text-muted-foreground">{title}</dt>
			<dd className="min-w-0 break-words text-right capitalize">{children}</dd>
		</div>
	);
}
