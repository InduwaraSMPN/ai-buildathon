import { RiRefreshLine as RefreshCw } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { formatDate, PageState, timeAgo } from "@/components/support-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/utils/orpc";
import { MappingEditor } from "./mapping-editor";
import { RouteEditor } from "./route-editor";

/**
 * A run of outcomes at a glance.
 *
 * The same strip the public status page uses for 90-day uptime, applied to the
 * last N syncs. It is the one existing pattern in the tree for showing a
 * sequence of outcomes without making the reader parse a table, and it carries
 * its own screen-reader mirror.
 */
function SyncStrip({
	runs,
}: {
	runs: { id: string; status: string; createdAt: Date }[];
}) {
	if (!runs.length) return null;
	const ordered = [...runs].reverse();
	return (
		<div>
			<div aria-hidden="true" className="flex gap-0.5">
				{ordered.map((run) => (
					<span
						key={run.id}
						title={`${run.status} · ${formatDate(run.createdAt)}`}
						className={`h-8 flex-1 rounded-sm ${
							run.status === "completed"
								? "bg-success"
								: run.status === "rejected"
									? "bg-warning"
									: "bg-destructive"
						}`}
					/>
				))}
			</div>
			<ol className="sr-only">
				{ordered.map((run) => (
					<li key={run.id}>
						{formatDate(run.createdAt)}: {run.status}
					</li>
				))}
			</ol>
		</div>
	);
}

/** Null means not computable, which is different from zero and must read that way. */
const formatCoefficient = (value: number | null | undefined) =>
	value === null || value === undefined ? "—" : value.toFixed(2);

export function ConnectorDetail({ connectorId }: { connectorId: string }) {
	const queryClient = useQueryClient();
	const connectors = useQuery(orpc.listConnectors.queryOptions({}));
	const runs = useQuery(
		orpc.listConnectorRuns.queryOptions({
			input: { connectorId, limit: 25 },
			refetchInterval: 30_000,
		}),
	);
	const writebacks = useQuery(
		orpc.listConnectorWritebacks.queryOptions({
			input: { connectorId, limit: 25 },
			refetchInterval: 30_000,
		}),
	);
	const ledger = useQuery(
		orpc.listDispatchLedger.queryOptions({
			input: { connectorId, limit: 25 },
		}),
	);
	const agreement = useQuery(
		orpc.connectorAgreement.queryOptions({ input: { connectorId } }),
	);
	// MappingEditor and RouteEditor each run their own listFieldMappings /
	// listEnvironmentRoutes query, so fetching them here too was a second
	// request for data this component never read.

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: orpc.listConnectorRuns.key() });

	const preview = useMutation(
		orpc.previewConnectorSync.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);
	const sync = useMutation(
		orpc.triggerConnectorSync.mutationOptions({
			onSuccess: async (result) => {
				await invalidate();
				toast[result.status === "completed" ? "success" : "error"](
					`Sync ${result.status}`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const retry = useMutation(
		orpc.retryConnectorWriteback.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.listConnectorWritebacks.key(),
				});
				toast.success("Retried");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (connectors.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading connector"
				description="Reading connector configuration."
			/>
		);
	// A failed list is not a missing connector — reporting it as deleted sends the
	// operator looking for a record that is still there.
	if (connectors.isError)
		return (
			<PageState
				kind="error"
				title="Connector unavailable"
				description={connectors.error.message}
				onRetry={() => connectors.refetch()}
			/>
		);
	const connector = (connectors.data ?? []).find(
		(candidate) => candidate.id === connectorId,
	);
	if (!connector)
		return (
			<PageState
				kind="error"
				title="Connector not found"
				description="It may have been deleted."
			/>
		);

	const ceilingBreaches = (ledger.data ?? []).filter(
		(entry) => entry.outcome === "refused",
	);

	return (
		<PageContainer
			title={connector.label}
			description={`${connector.vendor} · ${connector.baseUrl}`}
			action={
				<div className="flex gap-2">
					<Button
						size="sm"
						variant="outline"
						disabled={preview.isPending}
						onClick={() => preview.mutate({ connectorId })}
					>
						Preview
					</Button>
					<Button
						size="sm"
						disabled={!connector.enabled || sync.isPending}
						onClick={() => sync.mutate({ connectorId })}
					>
						<RefreshCw />
						Sync now
					</Button>
				</div>
			}
		>
			{connector.disabledReason ? (
				<Alert variant="destructive">
					<AlertTitle>This connector disabled itself</AlertTitle>
					<AlertDescription>
						{connector.disabledReason}. Nothing is being polled and no work
						notes are being posted. Re-enable it once the cause is fixed — a
						connector that keeps failing is disabled rather than retried forever
						against a credential that may have been revoked.
					</AlertDescription>
				</Alert>
			) : null}

			<Tabs defaultValue="overview">
				<TabsList variant="line" aria-label="Connector detail">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="mappings">Mappings</TabsTrigger>
					<TabsTrigger value="agreement">Agreement</TabsTrigger>
					<TabsTrigger value="runs">Runs</TabsTrigger>
					<TabsTrigger value="writebacks">Write-backs</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="flex flex-col gap-4">
					{preview.data ? (
						<Card>
							<CardHeader>
								<CardTitle>Preview — nothing was applied</CardTitle>
							</CardHeader>
							<CardContent className="flex flex-col gap-3">
								<p className="text-muted-foreground text-sm">
									{preview.data.fetchedCount} records fetched ·{" "}
									{preview.data.createCount} would be created ·{" "}
									{preview.data.dispatchCount} would start a run. This ran the
									same computation an apply runs, and applied none of it.
								</p>
								{preview.data.quarantined.length ? (
									<Alert>
										<AlertTitle>
											{preview.data.quarantined.length} values have no mapping
										</AlertTitle>
										<AlertDescription>
											{preview.data.quarantined
												.slice(0, 5)
												.map(
													(issue) =>
														`${issue.sourceField}="${issue.value}" → ${issue.targetField}`,
												)
												.join("; ")}
										</AlertDescription>
									</Alert>
								) : null}
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Record</TableHead>
											<TableHead>Would</TableHead>
											<TableHead>Environment</TableHead>
											<TableHead>Starts a run</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{preview.data.decisions.slice(0, 20).map((decision) => (
											<TableRow key={decision.externalId}>
												<TableCell className="font-mono text-xs">
													{decision.externalKey || decision.externalId}
												</TableCell>
												<TableCell>
													{decision.kind}
													{decision.reason ? (
														<span className="text-muted-foreground text-xs">
															{" "}
															· {decision.reason}
														</span>
													) : null}
												</TableCell>
												<TableCell>
													{decision.environmentKey ? (
														<Badge tone="info">
															{decision.environmentKey} · via{" "}
															{decision.environmentVia}
														</Badge>
													) : (
														"—"
													)}
												</TableCell>
												<TableCell>
													{decision.willDispatch ? "yes" : "no"}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					) : null}
					<Card>
						<CardHeader>
							<CardTitle>Recent syncs</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<SyncStrip runs={runs.data ?? []} />
							<dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
								<div>
									<dt className="text-muted-foreground">Last successful</dt>
									<dd>
										{connector.lastSuccessfulSyncAt
											? timeAgo(connector.lastSuccessfulSyncAt)
											: "never"}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">Watermark</dt>
									<dd>
										{connector.watermark
											? formatDate(connector.watermark)
											: "not set"}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">Poll interval</dt>
									<dd>{connector.pollIntervalSeconds}s</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">Dispatch ceiling</dt>
									<dd>{connector.dispatchCeiling} per ticket</dd>
								</div>
							</dl>
						</CardContent>
					</Card>

					{ceilingBreaches.length ? (
						<Card>
							<CardHeader>
								<CardTitle>Dispatches refused</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="mb-3 text-muted-foreground text-sm">
									A ticket that keeps justifying a run is usually a trigger
									predicate that is wrong. These are surfaced here rather than
									buried in a summary, because a dispatch loop should be found
									on a screen and not on a bill.
								</p>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Ticket</TableHead>
											<TableHead>Trigger</TableHead>
											<TableHead>Reason</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{ceilingBreaches.map((entry) => (
											<TableRow key={entry.id}>
												<TableCell>{entry.ticketNumber}</TableCell>
												<TableCell className="font-mono text-xs">
													{entry.triggerKey}
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{entry.detail}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					) : null}
				</TabsContent>

				<TabsContent value="mappings" className="flex flex-col gap-4">
					<Card>
						<CardHeader>
							<CardTitle>Environment routing</CardTitle>
						</CardHeader>
						<CardContent>
							<RouteEditor
								connectorId={connectorId}
								defaultEnvironmentKey={connector.defaultEnvironmentKey}
								defaultEnvironmentMode={connector.defaultEnvironmentMode}
							/>
						</CardContent>
					</Card>

					<Separator />

					<Card>
						<CardHeader>
							<CardTitle>Field mapping</CardTitle>
						</CardHeader>
						<CardContent>
							<MappingEditor connectorId={connectorId} />
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="agreement">
					<Card>
						<CardHeader>
							<CardTitle>Proposal versus actual</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<p className="text-muted-foreground text-sm">
								Three coefficients, reported together because each one lies on
								its own. Raw agreement flatters a skewed action distribution,
								and Axel's is skewed by design — correct refusal is a good
								outcome. Cohen's kappa corrects for chance and then collapses on
								that same skew. Gwet's AC1 stays interpretable. None of them
								mean anything if nobody read the proposal, which is why the open
								count is shown first.
							</p>
							<dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
								<div>
									<dt className="text-muted-foreground">Proposals posted</dt>
									<dd className="text-lg">{agreement.data?.total ?? 0}</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">Actually opened</dt>
									<dd className="text-lg">{agreement.data?.opened ?? 0}</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">Raw agreement</dt>
									<dd className="text-lg">
										{formatCoefficient(agreement.data?.rawAgreement)}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">Cohen's kappa</dt>
									<dd className="text-lg">
										{formatCoefficient(agreement.data?.cohensKappa)}
									</dd>
								</div>
								<div>
									<dt className="text-muted-foreground">Gwet's AC1</dt>
									<dd className="text-lg">
										{formatCoefficient(agreement.data?.gwetsAC1)}
									</dd>
								</div>
							</dl>
							{agreement.data?.byClass.length ? (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Action class</TableHead>
											<TableHead>Proposals</TableHead>
											<TableHead>Matched</TableHead>
											<TableHead>Agreement</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{agreement.data.byClass.map((row) => (
											<TableRow key={row.actionClass}>
												<TableCell className="font-mono text-xs">
													{row.actionClass}
												</TableCell>
												<TableCell>{row.total}</TableCell>
												<TableCell>{row.agreed}</TableCell>
												<TableCell>
													{formatCoefficient(row.rawAgreement)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							) : null}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="runs">
					<Card>
						<CardHeader>
							<CardTitle>Sync history</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-2">
							{(runs.data ?? []).map((run) => (
								<Collapsible key={run.id} className="border p-3">
									<CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
										<span className="flex items-center gap-2">
											<Badge
												tone={
													run.status === "completed"
														? "success"
														: run.status === "rejected"
															? "warning"
															: "destructive"
												}
											>
												{run.status}
											</Badge>
											<span className="text-sm">
												{run.fetchedCount} fetched · {run.createdCount} new ·{" "}
												{run.dispatchedCount} dispatched
												{run.quarantinedCount
													? ` · ${run.quarantinedCount} quarantined`
													: ""}
											</span>
										</span>
										<span className="text-muted-foreground text-xs">
											{timeAgo(run.createdAt)}
										</span>
									</CollapsibleTrigger>
									<CollapsibleContent>
										{run.error ? (
											<p className="mt-2 text-destructive text-sm">
												{run.error}
											</p>
										) : null}
										<pre className="mt-2 overflow-x-auto bg-muted/30 p-2 font-mono text-xs">
											{JSON.stringify(run.summary, null, 2)}
										</pre>
									</CollapsibleContent>
								</Collapsible>
							))}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="writebacks">
					<Card>
						<CardHeader>
							<CardTitle>Work notes</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Ticket</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Attempts</TableHead>
										<TableHead>Next attempt</TableHead>
										<TableHead>Last error</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(writebacks.data ?? []).map((entry) => (
										<TableRow key={entry.id}>
											<TableCell>{entry.ticketNumber}</TableCell>
											<TableCell>
												<Badge
													tone={
														entry.status === "succeeded"
															? "success"
															: entry.status === "failed"
																? "destructive"
																: "info"
													}
												>
													{entry.status}
												</Badge>
											</TableCell>
											<TableCell>
												{entry.attemptCount}/{entry.maxAttempts}
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{entry.nextAttemptAt
													? formatDate(entry.nextAttemptAt)
													: "—"}
											</TableCell>
											<TableCell className="text-destructive text-xs">
												{entry.lastError ?? ""}
											</TableCell>
											<TableCell className="text-right">
												<Button
													size="sm"
													variant="outline"
													disabled={
														entry.status === "succeeded" || retry.isPending
													}
													onClick={() =>
														retry.mutate({ writebackId: entry.id })
													}
												>
													Retry
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</PageContainer>
	);
}
