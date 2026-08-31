import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AssetsPage } from "@/features/assets/components";
import { requireNav } from "@/lib/navigation";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/assets")({
	component: AssetsRoute,
	beforeLoad: ({ context }) => {
		requireNav("/assets", context);
		return { breadcrumb: "Assets" };
	},
	head: () => ({ meta: [{ title: "Assets · Axiōma" }] }),
});

function AssetsRoute() {
	const queryClient = useQueryClient();
	const assets = useQuery(orpc.listAssets.queryOptions());
	const runs = useQuery(orpc.listAssetImportRuns.queryOptions());
	const [runId, setRunId] = useState<string>();
	const [assetId, setAssetId] = useState<string>();
	const [checkoutAssetId, setCheckoutAssetId] = useState<string>();
	const rejections = useQuery(
		orpc.listAssetImportRejections.queryOptions({
			input: { runId: runId ?? "" },
			enabled: Boolean(runId),
		}),
	);
	const history = useQuery(
		orpc.listAssetHistory.queryOptions({
			input: { assetId: assetId ?? "" },
			enabled: Boolean(assetId),
		}),
	);
	const [input, setInput] = useState<{
		profileId: string;
		identityColumns: string[];
		csv: string;
		fileName: string;
	}>();
	const preview = useMutation(
		orpc.previewAssetImport.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);
	const checkout = useMutation(
		orpc.checkoutAsset.mutationOptions({
			onSuccess: () => {
				setCheckoutAssetId(undefined);
				return queryClient.invalidateQueries({
					queryKey: orpc.listAssets.key(),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const checkin = useMutation(
		orpc.checkinAsset.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: orpc.listAssets.key() }),
			onError: (error) => toast.error(error.message),
		}),
	);
	const importAssets = useMutation(
		orpc.importAssets.mutationOptions({
			onSuccess: async (result) => {
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: orpc.listAssets.key() }),
					queryClient.invalidateQueries({
						queryKey: orpc.listAssetImportRuns.key(),
					}),
				]);
				toast.success(
					`Imported ${result.inserted} new and ${result.updated} updated assets`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (assets.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading assets"
				description="Retrieving inventory…"
			/>
		);
	if (assets.isError)
		return (
			<PageState
				kind="error"
				title="Assets unavailable"
				description={assets.error.message}
				onRetry={() => assets.refetch()}
			/>
		);

	return (
		<>
			<AssetsPage
				assets={assets.data}
				runs={runs.data}
				rejections={rejections.data}
				history={history.data}
				onSelectRun={setRunId}
				onSelectAsset={setAssetId}
				onCheckout={setCheckoutAssetId}
				onCheckin={(id) => checkin.mutate({ assetId: id })}
				preview={
					preview.data
						? { ...preview.data, accepted: preview.data.accepted.length }
						: undefined
				}
				busy={preview.isPending || importAssets.isPending}
				onPreview={async (file) => {
					const csv = await file.text();
					const header = csv.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
					const identityColumns = ["asset_tag", "serial_number", "name"]
						.filter((column) =>
							header
								.split(",")
								.map((value) => value.trim().replace(/^"|"$/g, ""))
								.includes(column),
						)
						.slice(0, 1);
					const next = {
						profileId: "dashboard-csv",
						identityColumns: identityColumns.length
							? identityColumns
							: ["name"],
						csv,
						fileName: file.name,
					};
					setInput(next);
					preview.mutate(next);
				}}
				onImport={
					input && preview.data ? () => importAssets.mutate(input) : undefined
				}
			/>
			<Dialog
				open={Boolean(checkoutAssetId)}
				onOpenChange={(open) => !open && setCheckoutAssetId(undefined)}
			>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							const custodianId = String(
								new FormData(event.currentTarget).get("custodianId") ?? "",
							).trim();
							if (checkoutAssetId && custodianId)
								checkout.mutate({ assetId: checkoutAssetId, custodianId });
						}}
					>
						<DialogHeader>
							<DialogTitle>Check out asset</DialogTitle>
							<DialogDescription>
								Assign this asset to its new custodian.
							</DialogDescription>
						</DialogHeader>
						<FieldGroup className="mt-4">
							<Field>
								<FieldLabel htmlFor="custodian-id">
									Custodian user ID
								</FieldLabel>
								<Input
									id="custodian-id"
									name="custodianId"
									required
									autoFocus
								/>
							</Field>
						</FieldGroup>
						<DialogFooter className="mt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => setCheckoutAssetId(undefined)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={checkout.isPending}>
								{checkout.isPending ? (
									<Spinner data-icon="inline-start" />
								) : null}
								Check out
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
