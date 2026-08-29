import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageState } from "@/components/support-ui";
import { AssetsPage } from "@/features/assets/components";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/assets")({
	component: AssetsRoute,
	beforeLoad: ({ context }) => {
		if (!context.capabilities.includes("admin.settings"))
			throw redirect({ to: "/home" });
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
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: orpc.listAssets.key() }),
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
		<AssetsPage
			assets={assets.data}
			runs={runs.data}
			rejections={rejections.data}
			history={history.data}
			onSelectRun={setRunId}
			onSelectAsset={setAssetId}
			onCheckout={(id) => {
				const custodianId = window.prompt("Custodian user ID");
				if (custodianId) checkout.mutate({ assetId: id, custodianId });
			}}
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
					identityColumns: identityColumns.length ? identityColumns : ["name"],
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
	);
}
