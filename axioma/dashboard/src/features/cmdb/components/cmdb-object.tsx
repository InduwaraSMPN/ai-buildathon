import { Link } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export type CmdbObjectDetail = {
	id: string;
	classId: string;
	classKey: string;
	classLabel: string;
	externalId: string;
	name: string;
	sourceTicketId: string | null;
	sourceRunId: string | null;
	sourceStepId: string | null;
	observedAt: Date | string;
	properties: {
		id: string;
		propertyKey: string;
		label: string;
		propertyType: string;
		value?: unknown;
	}[];
	relationships: {
		id: string;
		verb: string;
		direction: "outgoing" | "incoming";
		objectId: string;
		objectName: string;
	}[];
};

/**
 * A property value is stored as JSON, so a string arrives quoted and an object
 * arrives as a tree. Rendering the raw JSON for the first would be noise, while
 * stringifying the second is the only honest way to show it whole.
 */
function propertyValue(value: unknown) {
	if (value === null || value === undefined) return "—";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	return JSON.stringify(value);
}

export function CmdbObjectPage({ object }: { object: CmdbObjectDetail }) {
	return (
		<PageContainer
			title={object.name}
			description={`${object.classLabel} · ${object.externalId}`}
		>
			<div className="grid gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>Recorded properties</CardTitle>
						<CardDescription>
							What this configuration item is known to be, as last observed.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-5">
						{object.properties.length ? (
							<dl className="grid gap-2 text-sm sm:grid-cols-2">
								{object.properties.map((property) => (
									<div key={property.id} className="min-w-0">
										<dt className="font-medium">{property.label}</dt>
										<dd className="break-all font-mono text-muted-foreground">
											{propertyValue(property.value)}
										</dd>
									</div>
								))}
							</dl>
						) : (
							<Empty>
								<EmptyHeader>
									<EmptyTitle>No properties recorded</EmptyTitle>
								</EmptyHeader>
							</Empty>
						)}
						<section>
							<h2 className="mb-2 font-medium text-sm">Relationships</h2>
							{object.relationships.length ? (
								<ul className="flex flex-col gap-2 text-sm">
									{object.relationships.map((edge) => (
										<li
											key={`${edge.id}:${edge.direction}`}
											className="flex flex-wrap items-center gap-2 rounded-md border p-2"
										>
											<Badge variant="outline">{edge.verb}</Badge>
											<Link
												to="/cmdb/$objectId"
												params={{ objectId: edge.objectId }}
												className="underline-offset-4 hover:underline"
											>
												{edge.objectName}
											</Link>
										</li>
									))}
								</ul>
							) : (
								<p className="text-muted-foreground text-sm">
									No relationships recorded.
								</p>
							)}
						</section>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Provenance</CardTitle>
						<CardDescription>
							Every fact here names the work that observed it.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<dl className="flex flex-col gap-3 text-sm">
							<div>
								<dt className="font-medium">Ticket</dt>
								<dd className="break-all font-mono text-muted-foreground">
									{object.sourceTicketId ? (
										<Link
											to="/tickets/$ticketId"
											params={{ ticketId: object.sourceTicketId }}
											className="underline-offset-4 hover:underline"
										>
											{object.sourceTicketId}
										</Link>
									) : (
										"Not recorded."
									)}
								</dd>
							</div>
							<div>
								<dt className="font-medium">Agent run</dt>
								<dd className="break-all font-mono text-muted-foreground">
									{object.sourceRunId ?? "Not recorded."}
								</dd>
							</div>
							<div>
								<dt className="font-medium">Step</dt>
								<dd className="break-all font-mono text-muted-foreground">
									{object.sourceStepId ?? "Not recorded."}
								</dd>
							</div>
							<div>
								<dt className="font-medium">Observed</dt>
								<dd className="text-muted-foreground">
									{new Date(object.observedAt).toLocaleString()}
								</dd>
							</div>
						</dl>
					</CardContent>
				</Card>
			</div>
		</PageContainer>
	);
}
