import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type AssetRow = {
	id: string;
	name: string;
	assetTag?: string | null;
	status?: string | null;
	owner?: string | null;
	customFields?: Record<string, unknown>;
};

export type AssetImportRun = {
	id: string;
	fileName?: string | null;
	acceptedRows: number;
	rejectedRows: number;
	createdAt: Date;
};

export type AssetRejection = {
	id: string;
	rowNumber: number;
	reason: string;
	row: unknown;
};

export type AssetHistoryRow = {
	id: string;
	action: string;
	createdAt: Date;
	changes: unknown;
};

export type AssetImportPreview = {
	headers: readonly string[];
	accepted: number;
	rejected: readonly { rowNumber: number; reason: string }[];
};

export function AssetsPage({
	assets,
	preview,
	onPreview,
	onImport,
	runs = [],
	rejections = [],
	history = [],
	onSelectRun,
	onSelectAsset,
	onCheckout,
	onCheckin,
	busy = false,
}: {
	assets: readonly AssetRow[];
	preview?: AssetImportPreview;
	runs?: readonly AssetImportRun[];
	rejections?: readonly AssetRejection[];
	history?: readonly AssetHistoryRow[];
	onPreview?: (file: File) => void;
	onImport?: () => void;
	onSelectRun?: (id: string) => void;
	onSelectAsset?: (id: string) => void;
	onCheckout?: (id: string) => void;
	onCheckin?: (id: string) => void;
	busy?: boolean;
}) {
	return (
		<PageContainer
			title="Assets"
			description="Inventory and CSV import preview."
			action={
				<div>
					<label htmlFor="asset-csv" className="sr-only">
						Choose asset CSV
					</label>
					<Input
						id="asset-csv"
						type="file"
						accept=".csv,text/csv"
						className="max-w-64"
						disabled={!onPreview || busy}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file) onPreview?.(file);
						}}
					/>
				</div>
			}
		>
			{preview ? (
				<Card className="mb-4">
					<CardHeader>
						<CardTitle>Import preview</CardTitle>
					</CardHeader>
					<CardContent className="text-sm">
						<p>
							{preview.accepted} accepted · {preview.rejected.length} rejected
						</p>
						{preview.rejected.map((row) => (
							<p key={row.rowNumber} className="text-destructive">
								Row {row.rowNumber}: {row.reason}
							</p>
						))}
						<Button
							className="mt-3"
							disabled={!onImport || busy}
							onClick={onImport}
						>
							{busy ? "Importing…" : "Import accepted rows"}
						</Button>
					</CardContent>
				</Card>
			) : null}
			{runs.length ? (
				<Card className="mb-4">
					<CardHeader>
						<CardTitle>Import history</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						{runs.map((run) => (
							<button
								type="button"
								className="block w-full border p-2 text-left"
								key={run.id}
								onClick={() => onSelectRun?.(run.id)}
							>
								{run.fileName ?? "CSV import"} · {run.acceptedRows} accepted ·{" "}
								{run.rejectedRows} rejected · {run.createdAt.toLocaleString()}
							</button>
						))}
						{rejections.map((item) => (
							<details key={item.id} className="border p-2">
								<summary className="text-destructive">
									Row {item.rowNumber}: {item.reason}
								</summary>
								<pre className="mt-2 overflow-auto text-xs">
									{JSON.stringify(item.row, null, 2)}
								</pre>
							</details>
						))}
					</CardContent>
				</Card>
			) : null}
			{history.length ? (
				<Card className="mb-4">
					<CardHeader>
						<CardTitle>Custody history</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						{history.map((item) => (
							<div key={item.id} className="border p-2">
								<strong>{item.action}</strong> ·{" "}
								{item.createdAt.toLocaleString()}
								<pre className="text-xs">{JSON.stringify(item.changes)}</pre>
							</div>
						))}
					</CardContent>
				</Card>
			) : null}
			{assets.length ? (
				<div className="overflow-x-auto border">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b">
								<th className="p-3">Asset</th>
								<th className="p-3">Tag</th>
								<th className="p-3">Owner</th>
								<th className="p-3">Status</th>
								<th className="p-3">Custom fields</th>
								<th className="p-3">Custody</th>
							</tr>
						</thead>
						<tbody>
							{assets.map((asset) => (
								<tr key={asset.id} className="border-b">
									<td className="p-3 font-medium">{asset.name}</td>
									<td className="p-3">{asset.assetTag ?? "—"}</td>
									<td className="p-3">{asset.owner ?? "—"}</td>
									<td className="p-3">{asset.status ?? "—"}</td>
									<td className="p-3 text-xs">
										{Object.entries(asset.customFields ?? {})
											.map(([key, value]) => `${key}: ${String(value)}`)
											.join(" · ") || "—"}
									</td>
									<td className="p-3">
										<div className="flex gap-1">
											<Button
												size="sm"
												variant="outline"
												onClick={() => onSelectAsset?.(asset.id)}
											>
												History
											</Button>
											{asset.owner ? (
												<Button
													size="sm"
													variant="outline"
													onClick={() => onCheckin?.(asset.id)}
												>
													Check in
												</Button>
											) : (
												<Button
													size="sm"
													variant="outline"
													onClick={() => onCheckout?.(asset.id)}
												>
													Check out
												</Button>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<PageState
					kind="empty"
					title="No assets"
					description={
						onPreview
							? "Choose a CSV to preview an import."
							: "No assets have been imported yet."
					}
				/>
			)}
		</PageContainer>
	);
}
