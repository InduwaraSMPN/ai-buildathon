import { RiArrowLeftLine } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { formatDate, PageState, StatusBadge } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { AgentTranscript } from "@/features/agent-runs/components/agent-transcript";
import { TicketImpact } from "@/features/cmdb/components/ticket-impact";
import {
	TicketOriginBanner,
	useForeignOwned,
} from "@/features/connectors/components/ticket-origin-banner";
import { TicketAttachments } from "@/features/documents/components";
import { Route } from "@/routes/_auth/tickets.$ticketId";
import { orpc } from "@/utils/orpc";
import type {
	TicketDetail as TicketDetailData,
	TicketOperatorActionInput,
	UpdateTicketInput,
} from "../api/types";
import { invalidateTicketQueries } from "../query-behavior";
import { DynamicFields, serializeDynamicFields } from "./dynamic-fields";
import { SlaCountdown } from "./sla-countdown";
import { TicketActions } from "./ticket-actions";
import { TicketActivity, TicketConversation } from "./ticket-collaboration";

export function TicketDetailPage({ ticketId }: { ticketId: string }) {
	const { capabilities } = Route.useRouteContext();
	const query = useQuery(
		orpc.getTicket.queryOptions({
			input: { id: ticketId },
		}),
	);
	if (query.isPending && query.data === undefined)
		return (
			<PageState
				kind="loading"
				title="Loading ticket"
				description="Retrieving ticket details…"
			/>
		);
	if (query.isError && query.data === undefined)
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
	const foreignOwned = useForeignOwned(ticket.id);
	const queryClient = useQueryClient();
	const fieldDefinitions = useQuery(
		orpc.listFieldDefinitions.queryOptions({ input: { objectType: "ticket" } }),
	);
	const serviceRecords = useQuery(
		orpc.getTicketServiceRecords.queryOptions({
			input: { ticketId: ticket.id },
		}),
	);
	const sla = useQuery(
		orpc.listTicketSla.queryOptions({
			input: { ticketId: ticket.id },
			refetchInterval: 15_000,
			refetchIntervalInBackground: false,
		}),
	);
	const [customFields, setCustomFields] = useState(ticket.customFields);
	const customFieldsRef = useRef(customFields);
	customFieldsRef.current = customFields;
	const submittedCustomFields = useRef<Record<string, unknown> | null>(null);
	const ticketIdRef = useRef(ticket.id);
	const editedCustomFields = useRef(new Set<string>());
	useEffect(() => {
		if (ticketIdRef.current !== ticket.id) {
			ticketIdRef.current = ticket.id;
			editedCustomFields.current.clear();
			setCustomFields(ticket.customFields);
			return;
		}
		setCustomFields((current) =>
			Object.fromEntries(
				Array.from(
					new Set([
						...Object.keys(current),
						...Object.keys(ticket.customFields),
					]),
					(key) => [
						key,
						editedCustomFields.current.has(key)
							? current[key]
							: ticket.customFields[key],
					],
				),
			),
		);
	}, [ticket.id, ticket.customFields]);
	const customFieldsMutation = useMutation(
		orpc.setTicketDynamicFields.mutationOptions({
			onSuccess: async () => {
				for (const [key, submittedValue] of Object.entries(
					submittedCustomFields.current ?? {},
				))
					if (Object.is(customFieldsRef.current[key], submittedValue))
						editedCustomFields.current.delete(key);
				submittedCustomFields.current = null;
				await queryClient.invalidateQueries({
					queryKey: orpc.getTicket.key({ input: { id: ticket.id } }),
				});
				toast.success("Custom fields updated");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const mutation = useMutation(
		orpc.updateTicket.mutationOptions({
			onSuccess: async (_data, variables) => {
				await invalidateTicketQueries(queryClient, orpc, variables.id);
				toast.success("Ticket updated");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	// Callers fire this from click handlers and never await it, so the rejection
	// is swallowed here. `onError` above stays the user-facing report; letting it
	// through only adds an unhandled rejection to the console.
	const update = (input: TicketOperatorActionInput) =>
		mutation
			.mutateAsync({ id: ticket.id, ...input } as UpdateTicketInput)
			.catch(() => undefined);

	return (
		<PageContainer
			title={ticket.title}
			description={`Ticket / ${ticket.number ?? ticket.id} · Reported by ${ticket.reporterName} · ${formatDate(ticket.createdAt)}`}
			action={
				<div className="flex items-center gap-3">
					<Link
						to="/tickets"
						className="inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
					>
						<RiArrowLeftLine aria-hidden="true" /> Back to queue
					</Link>
					<StatusBadge
						status={ticket.status}
						label={ticket.statusLabel}
						stateType={ticket.statusStateType}
					/>
				</div>
			}
		>
			<TicketOriginBanner ticketId={ticket.id} />
			<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
				<Card className="min-w-0">
					<Tabs defaultValue="conversation">
						<CardHeader>
							<TabsList variant="line" aria-label="Ticket details">
								<TabsTrigger value="conversation">Conversation</TabsTrigger>
								<TabsTrigger value="transcript">Transcript</TabsTrigger>
								<TabsTrigger value="request">Request</TabsTrigger>
								<TabsTrigger value="activity">Activity</TabsTrigger>
							</TabsList>
						</CardHeader>
						<CardContent>
							<TabsContent value="conversation">
								<TicketConversation
									ticket={ticket}
									canAttach={capabilities.includes("ticket.update")}
								/>
							</TabsContent>
							<TabsContent value="transcript">
								<AgentTranscript
									runs={ticket.runs}
									ticketId={ticket.id}
									status={ticket.status}
								/>
							</TabsContent>
							<TabsContent value="request">
								<p className="whitespace-pre-wrap text-sm leading-6">
									{ticket.body}
								</p>
							</TabsContent>
							<TabsContent value="activity">
								<TicketActivity
									ticket={ticket}
									canEdit={capabilities.includes("ticket.reclassify")}
								/>
							</TabsContent>
						</CardContent>
					</Tabs>
				</Card>
				<aside className="flex flex-col gap-4">
					<Metadata ticket={ticket} />
					<SlaCountdown targets={sla.data ?? []} foreignOwned={foreignOwned} />
					<DynamicFields
						definitions={fieldDefinitions.data ?? []}
						values={customFields}
						onChange={(values) => {
							for (const key of new Set([
								...Object.keys(customFields),
								...Object.keys(values),
							]))
								if (!Object.is(values[key], customFields[key]))
									editedCustomFields.current.add(key);
							setCustomFields(values);
						}}
						onSave={() => {
							const values = serializeDynamicFields(
								fieldDefinitions.data ?? [],
								customFields,
							);
							submittedCustomFields.current = Object.fromEntries(
								Object.keys(values).map((key) => [key, customFields[key]]),
							);
							customFieldsMutation.mutate({ ticketId: ticket.id, values });
						}}
						pending={customFieldsMutation.isPending}
					/>
					<TicketImpact ticketId={ticket.id} />
					<Card size="sm">
						<CardHeader>
							<CardTitle>Related service records</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-2">
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
						</CardContent>
					</Card>
					<Card size="sm">
						<CardHeader>
							<CardTitle>Attachments</CardTitle>
						</CardHeader>
						<CardContent>
							<TicketAttachments
								targetId={ticket.id}
								canEdit={capabilities.includes("ticket.update")}
							/>
						</CardContent>
					</Card>
					<TicketActions
						ticket={ticket}
						capabilities={capabilities}
						pending={mutation.isPending}
						onAction={update}
					/>
				</aside>
			</div>
		</PageContainer>
	);
}

function Metadata({ ticket }: { ticket: TicketDetailData }) {
	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Metadata</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="divide-y text-xs">
					<Meta label="Reference">{ticket.number ?? ticket.id}</Meta>
					<Meta label="Status">
						<StatusBadge
							status={ticket.status}
							label={ticket.statusLabel}
							stateType={ticket.statusStateType}
						/>
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
					<Meta label="Service">{ticket.serviceName}</Meta>
					<Meta label="Service subcategory">
						{ticket.serviceSubcategoryName}
					</Meta>
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
			</CardContent>
		</Card>
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
