import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageState } from "@/components/support-ui";
import { SuppliersPage } from "@/features/suppliers/components";
import { requireNav } from "@/lib/navigation";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/suppliers")({
	component: SuppliersRoute,
	beforeLoad: ({ context }) => {
		requireNav("/suppliers", context);
		return { breadcrumb: "Suppliers & contracts" };
	},
	head: () => ({ meta: [{ title: "Suppliers & contracts · Axiōma" }] }),
});

function SuppliersRoute() {
	const suppliers = useQuery(orpc.listSuppliers.queryOptions());
	const contracts = useQuery(orpc.listContracts.queryOptions());
	if (suppliers.isPending || contracts.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading suppliers"
				description="Retrieving suppliers and contracts…"
			/>
		);
	const error = suppliers.error ?? contracts.error;
	if (error)
		return (
			<PageState
				kind="error"
				title="Suppliers unavailable"
				description={error.message}
				onRetry={() => {
					void suppliers.refetch();
					void contracts.refetch();
				}}
			/>
		);
	return (
		<SuppliersPage
			suppliers={suppliers.data ?? []}
			contracts={contracts.data ?? []}
		/>
	);
}
