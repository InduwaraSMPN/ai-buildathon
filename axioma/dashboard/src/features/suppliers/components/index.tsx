import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SupplierRow = {
	id: string;
	name: string;
	contact?: string | null;
	status: string;
};

export type ContractRow = {
	id: string;
	name: string;
	supplierName: string;
	startsOn: string;
	endsOn?: string | null;
	status: string;
};

export function SuppliersPage({
	suppliers,
	contracts,
}: {
	suppliers: readonly SupplierRow[];
	contracts: readonly ContractRow[];
}) {
	return (
		<PageContainer
			title="Suppliers & contracts"
			description="Supplier relationships and contract coverage."
		>
			<div className="grid gap-4 xl:grid-cols-2">
				<SimpleList
					title="Suppliers"
					empty="No suppliers found."
					rows={suppliers.map((item) => ({
						id: item.id,
						title: item.name,
						detail: item.contact ?? "No contact",
						status: item.status,
					}))}
				/>
				<SimpleList
					title="Contracts"
					empty="No contracts found."
					rows={contracts.map((item) => ({
						id: item.id,
						title: item.name,
						detail: `${item.supplierName} · ${item.startsOn} – ${item.endsOn ?? "ongoing"}`,
						status: item.status,
					}))}
				/>
			</div>
		</PageContainer>
	);
}

function SimpleList({
	title,
	empty,
	rows,
}: {
	title: string;
	empty: string;
	rows: readonly {
		id: string;
		title: string;
		detail: string;
		status: string;
	}[];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{rows.length ? (
					<ul className="divide-y">
						{rows.map((row) => (
							<li key={row.id} className="flex justify-between gap-4 py-3">
								<div>
									<p className="font-medium">{row.title}</p>
									<p className="text-muted-foreground text-sm">{row.detail}</p>
								</div>
								<Badge variant="outline">{row.status}</Badge>
							</li>
						))}
					</ul>
				) : (
					<p className="text-muted-foreground text-sm">{empty}</p>
				)}
			</CardContent>
		</Card>
	);
}
