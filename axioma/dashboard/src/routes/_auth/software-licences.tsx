import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/software-licences")({
	component: SoftwareLicencesRoute,
	beforeLoad: () => ({ breadcrumb: "Software licences" }),
	head: () => ({ meta: [{ title: "Software licences · Axiōma" }] }),
});

function SoftwareLicencesRoute() {
	const queryClient = useQueryClient();
	const entitlements = useQuery(orpc.listSoftwareEntitlements.queryOptions());
	const compliance = useQuery(orpc.readSoftwareCompliance.queryOptions());
	const create = useMutation(orpc.createSoftwareEntitlement.mutationOptions({
		onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.listSoftwareEntitlements.key() }),
		onError: (error) => toast.error(error.message),
	}));
	if (entitlements.isPending || compliance.isPending) return <PageState kind="loading" title="Loading licences" description="Assessing entitlement coverage…" />;
	if (entitlements.isError || compliance.isError) return <PageState kind="error" title="Licences unavailable" description={(entitlements.error ?? compliance.error)?.message ?? "Unknown error"} />;
	const summary = compliance.data.summary;
	return <PageContainer title="Software licences" description="Entitlements, allocations, and discovered-install compliance."
		action={<Button onClick={() => {
			const productName = window.prompt("Product name");
			const identityKey = window.prompt("Inventory identity key", productName?.toLowerCase().replace(/\W+/g, "-"));
			const seats = Number(window.prompt("Seat count", "1"));
			if (productName && identityKey && Number.isSafeInteger(seats) && seats > 0) create.mutate({ productName, identityKey, seatCount: seats });
		}}>Add entitlement</Button>}>
		<div className="mb-4 grid gap-3 sm:grid-cols-4">
			{Object.entries(summary).map(([key, value]) => <Card key={key}><CardHeader><CardTitle className="capitalize">{key.replace(/([A-Z])/g, " $1")}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{value}</CardContent></Card>)}
		</div>
		<div className="grid gap-4 xl:grid-cols-2">
			<Card><CardHeader><CardTitle>Entitlements</CardTitle></CardHeader><CardContent className="space-y-2">{entitlements.data.map((item) => <div key={item.id} className="flex justify-between border p-3"><div><strong>{item.productName}</strong><p className="text-muted-foreground text-sm">{item.publisher ?? "Unknown publisher"}</p></div><Badge variant="outline">{item.allocatedSeats}/{item.seatCount} seats</Badge></div>)}</CardContent></Card>
			<Card><CardHeader><CardTitle>Install compliance</CardTitle></CardHeader><CardContent className="space-y-2">{compliance.data.installs.map((item) => <div key={`${item.assetId}:${item.productId}`} className="flex justify-between border p-3"><div><strong>{item.productName}</strong><p className="text-muted-foreground text-sm">{item.assetName}</p></div><Badge variant={item.status === "compliant" ? "outline" : "destructive"}>{item.status}</Badge></div>)}</CardContent></Card>
		</div>
	</PageContainer>;
}
