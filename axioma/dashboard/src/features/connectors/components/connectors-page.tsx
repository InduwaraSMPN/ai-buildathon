import { RiRefreshLine as RefreshCw } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { formatDate, PageState, timeAgo } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";
import { ConnectorForm } from "./connector-form";

/**
 * Connection health at a glance.
 *
 * The online dot reuses the device pattern rather than inventing a second one:
 * a `size-2` circle with a screen-reader label, because the colour alone is
 * not the signal.
 */
function ConnectorDot({
	enabled,
	failing,
}: {
	enabled: boolean;
	failing: boolean;
}) {
	const label = !enabled ? "Disabled" : failing ? "Failing" : "Healthy";
	return (
		<span className="flex items-center gap-2">
			<span
				aria-hidden="true"
				className={`size-2 rounded-full ${
					!enabled
						? "bg-muted-foreground/50"
						: failing
							? "bg-warning"
							: "bg-success"
				}`}
			/>
			<span className="sr-only">{label}</span>
			<span className="text-muted-foreground text-xs">{label}</span>
		</span>
	);
}

export function ConnectorsPage() {
	const queryClient = useQueryClient();
	const query = useQuery(
		orpc.listConnectors.queryOptions({ refetchInterval: 30_000 }),
	);

	const sync = useMutation(
		orpc.triggerConnectorSync.mutationOptions({
			onSuccess: async (result) => {
				await queryClient.invalidateQueries({
					queryKey: orpc.listConnectors.key(),
				});
				toast[result.status === "completed" ? "success" : "error"](
					`Sync ${result.status}`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (query.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading connectors"
				description="Reading connector health."
			/>
		);
	if (query.error)
		return (
			<PageState
				kind="error"
				title="Could not load connectors"
				description={query.error.message}
				onRetry={() => query.refetch()}
			/>
		);

	const connectors = query.data ?? [];

	return (
		<PageContainer
			title="ITSM connectors"
			description="Axiōma runs behind the customer's own service desk. Each connector polls one instance, ingests changed tickets, and posts what Axel found back as a work note."
			action={<ConnectorForm />}
		>
			{connectors.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>No connectors</EmptyTitle>
						<EmptyDescription>
							A connector needs an OAuth client credential and a default
							environment. Point the default at a shadow-mode environment so an
							unmapped ticket resolves to too little access rather than too
							much.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Connections</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Connector</TableHead>
									<TableHead>Health</TableHead>
									<TableHead>Default environment</TableHead>
									<TableHead>Last successful sync</TableHead>
									<TableHead>Watermark</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{connectors.map((connector) => (
									<TableRow key={connector.id}>
										<TableCell>
											<Link
												to="/admin/connectors/$connectorId"
												params={{ connectorId: connector.id }}
												className="font-medium underline-offset-4 hover:underline"
											>
												{connector.label}
											</Link>
											<div className="text-muted-foreground text-xs">
												{connector.vendor} · {connector.baseUrl}
											</div>
											{connector.disabledReason ? (
												<div className="text-destructive text-xs">
													{connector.disabledReason}
												</div>
											) : null}
										</TableCell>
										<TableCell>
											<ConnectorDot
												enabled={connector.enabled}
												failing={connector.consecutiveFailures > 0}
											/>
										</TableCell>
										<TableCell>
											<Badge
												tone={
													connector.defaultEnvironmentMode === "shadow"
														? "info"
														: "warning"
												}
											>
												{connector.defaultEnvironmentKey} ·{" "}
												{connector.defaultEnvironmentMode}
											</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{connector.lastSuccessfulSyncAt
												? timeAgo(connector.lastSuccessfulSyncAt)
												: "never"}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{connector.watermark
												? formatDate(connector.watermark)
												: "not set"}
										</TableCell>
										<TableCell className="text-right">
											<Button
												size="sm"
												variant="outline"
												disabled={!connector.enabled || sync.isPending}
												onClick={() =>
													sync.mutate({ connectorId: connector.id })
												}
											>
												<RefreshCw />
												Sync now
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</PageContainer>
	);
}
