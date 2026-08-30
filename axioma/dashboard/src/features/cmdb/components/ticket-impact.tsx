import { RiNodeTree as Network } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "@/utils/orpc";

export function TicketImpact({ ticketId }: { ticketId: string }) {
	const linked = useQuery(
		orpc.listTicketCmdbObjects.queryOptions({ input: { ticketId } }),
	);
	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Network className="size-4" aria-hidden="true" />
					CMDB impact
				</CardTitle>
			</CardHeader>
			<CardContent>
				{linked.isPending ? (
					<p className="text-muted-foreground text-sm">Loading linked items…</p>
				) : null}
				{linked.isError ? (
					<div className="flex items-center gap-2 text-sm">
						<span>Impact unavailable.</span>
						<Button
							size="sm"
							variant="outline"
							onClick={() => linked.refetch()}
						>
							Retry
						</Button>
					</div>
				) : null}
				{linked.data?.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No configuration items linked.
					</p>
				) : null}
				<div className="space-y-3">
					{linked.data?.map((object) => (
						<ImpactBranch key={object.id} object={object} />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function ImpactBranch({
	object,
}: {
	object: { id: string; name: string; externalId: string };
}) {
	const impact = useQuery(
		orpc.cmdbImpact.queryOptions({
			input: { objectId: object.id, maxDepth: 3 },
		}),
	);
	return (
		<div className="rounded-md border p-3 text-sm">
			<p className="font-medium">{object.name}</p>
			<p className="font-mono text-muted-foreground text-xs">
				{object.externalId}
			</p>
			{impact.data?.length ? (
				<ul className="mt-2 space-y-1 border-l pl-3">
					{impact.data.map((node) => (
						<li
							key={`${node.objectId}:${node.depth}`}
							style={{ marginLeft: `${Math.max(0, node.depth - 1) * 8}px` }}
						>
							<span className="text-muted-foreground">Depth {node.depth}</span>{" "}
							· {node.object?.name ?? node.objectId}
						</li>
					))}
				</ul>
			) : (
				<p className="mt-2 text-muted-foreground text-xs">
					{impact.isPending ? "Checking impact…" : "No downstream impact."}
				</p>
			)}
		</div>
	);
}
