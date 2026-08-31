import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { requireNav } from "@/lib/navigation";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/software-licences")({
	component: SoftwareLicencesRoute,
	beforeLoad: ({ context }) => {
		requireNav("/software-licences", context);
		return { breadcrumb: "Software licences" };
	},
	head: () => ({ meta: [{ title: "Software licences · Axiōma" }] }),
});

function SoftwareLicencesRoute() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [productName, setProductName] = useState("");
	const [identityKey, setIdentityKey] = useState("");
	const entitlements = useQuery(orpc.listSoftwareEntitlements.queryOptions());
	const compliance = useQuery(orpc.readSoftwareCompliance.queryOptions());
	const create = useMutation(
		orpc.createSoftwareEntitlement.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.listSoftwareEntitlements.key(),
				});
				setDialogOpen(false);
				setProductName("");
				setIdentityKey("");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	if (entitlements.isPending || compliance.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading licences"
				description="Assessing entitlement coverage…"
			/>
		);
	if (entitlements.isError || compliance.isError)
		return (
			<PageState
				kind="error"
				title="Licences unavailable"
				description={
					(entitlements.error ?? compliance.error)?.message ?? "Unknown error"
				}
			/>
		);
	const summary = compliance.data.summary;
	return (
		<PageContainer
			title="Software licences"
			description="Entitlements, allocations, and discovered-install compliance."
			action={
				<Dialog
					open={dialogOpen}
					onOpenChange={(open) => {
						setDialogOpen(open);
						if (!open) {
							setProductName("");
							setIdentityKey("");
						}
					}}
				>
					<DialogTrigger render={<Button />}>Add entitlement</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add entitlement</DialogTitle>
							<DialogDescription>
								Add a software product and the number of seats your organisation
								owns.
							</DialogDescription>
						</DialogHeader>
						<form
							onSubmit={(event: FormEvent<HTMLFormElement>) => {
								event.preventDefault();
								const data = new FormData(event.currentTarget);
								const seatCount = Number(data.get("seatCount"));
								if (!Number.isSafeInteger(seatCount) || seatCount < 1) return;
								create.mutate({
									productName: String(data.get("productName")),
									identityKey: String(data.get("identityKey")),
									seatCount,
								});
							}}
						>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="product-name">Product name</FieldLabel>
									<Input
										id="product-name"
										name="productName"
										value={productName}
										onChange={(event) => {
											setProductName(event.target.value);
											setIdentityKey(
												event.target.value.toLowerCase().replace(/\W+/g, "-"),
											);
										}}
										required
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="identity-key">
										Inventory identity key
									</FieldLabel>
									<Input
										id="identity-key"
										name="identityKey"
										value={identityKey}
										onChange={(event) => setIdentityKey(event.target.value)}
										required
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="seat-count">Seat count</FieldLabel>
									<Input
										id="seat-count"
										name="seatCount"
										type="number"
										min={1}
										step={1}
										defaultValue={1}
										required
									/>
								</Field>
							</FieldGroup>
							<DialogFooter className="mt-4">
								<Button
									type="button"
									variant="outline"
									onClick={() => setDialogOpen(false)}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={create.isPending}>
									{create.isPending ? (
										<Spinner data-icon="inline-start" />
									) : null}
									{create.isPending ? "Adding…" : "Add entitlement"}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			}
		>
			<div className="mb-4 grid gap-3 sm:grid-cols-4">
				{Object.entries(summary).map(([key, value]) => (
					<Card key={key}>
						<CardHeader>
							<CardDescription className="capitalize">
								{key.replace(/([A-Z])/g, " $1")}
							</CardDescription>
							<CardTitle className="text-2xl">{value}</CardTitle>
						</CardHeader>
					</Card>
				))}
			</div>
			<div className="grid gap-4 xl:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Entitlements</CardTitle>
						<CardDescription>
							Purchased seats and current allocations.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						{entitlements.data.map((item) => (
							<div
								key={item.id}
								className="flex justify-between gap-4 border p-3"
							>
								<div>
									<strong>{item.productName}</strong>
									<p className="text-muted-foreground text-sm">
										{item.publisher ?? "Unknown publisher"}
									</p>
								</div>
								<Badge variant="outline">
									{item.allocatedSeats}/{item.seatCount} seats
								</Badge>
							</div>
						))}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Install compliance</CardTitle>
						<CardDescription>
							Discovered installs checked against available seats.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						{compliance.data.installs.map((item) => (
							<div
								key={`${item.assetId}:${item.productId}`}
								className="flex justify-between gap-4 border p-3"
							>
								<div>
									<strong>{item.productName}</strong>
									<p className="text-muted-foreground text-sm">
										{item.assetName}
									</p>
								</div>
								<Badge
									variant={
										item.status === "compliant" ? "outline" : "destructive"
									}
								>
									{item.status}
								</Badge>
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</PageContainer>
	);
}
