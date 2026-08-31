import { RiUpload2Line } from "@remixicon/react";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

function custodyActionLabel(action: string) {
	if (action === "checkout") return "Checked out";
	if (action === "checkin") return "Checked in";
	return action || "Unknown action";
}

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
				<label
					className={cn(
						buttonVariants({ variant: "outline" }),
						(!onPreview || busy) && "pointer-events-none opacity-50",
					)}
				>
					<input
						className="sr-only"
						type="file"
						accept=".csv,text/csv"
						disabled={!onPreview || busy}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file) onPreview?.(file);
							event.target.value = "";
						}}
					/>
					{busy ? (
						<Spinner data-icon="inline-start" />
					) : (
						<RiUpload2Line data-icon="inline-start" />
					)}
					{busy ? "Reading CSV…" : "Choose asset CSV"}
				</label>
			}
		>
			<div className="flex flex-col gap-4">
				{preview ? (
					<Card>
						<CardHeader>
							<CardTitle>Import preview</CardTitle>
							<CardDescription>
								Review the validation results before changing inventory.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-3 text-sm">
							<div className="flex flex-wrap gap-2">
								<Badge variant="secondary">{preview.accepted} accepted</Badge>
								<Badge
									variant={preview.rejected.length ? "destructive" : "outline"}
								>
									{preview.rejected.length} rejected
								</Badge>
							</div>
							{preview.rejected.map((row) => (
								<p key={row.rowNumber} className="text-destructive">
									Row {row.rowNumber}: {row.reason}
								</p>
							))}
						</CardContent>
						<CardFooter>
							<AlertDialog>
								<AlertDialogTrigger
									render={<Button disabled={!onImport || busy} />}
								>
									{busy ? <Spinner data-icon="inline-start" /> : null}
									{busy ? "Importing…" : "Import accepted rows"}
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											Import {preview.accepted} accepted rows?
										</AlertDialogTitle>
										<AlertDialogDescription>
											This creates or updates inventory records from the
											selected CSV.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction onClick={onImport}>
											Import assets
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</CardFooter>
					</Card>
				) : null}

				{runs.length ? (
					<Card>
						<CardHeader>
							<CardTitle>Import history</CardTitle>
							<CardDescription>
								Select an import to inspect rejected rows.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-2 text-sm">
							{runs.map((run) => (
								<Button
									key={run.id}
									variant="outline"
									className="h-auto justify-start whitespace-normal py-2 text-left"
									onClick={() => onSelectRun?.(run.id)}
								>
									<span>
										<span className="block font-medium">
											{run.fileName ?? "CSV import"}
										</span>
										<span className="block text-muted-foreground">
											{run.acceptedRows} accepted · {run.rejectedRows} rejected
											· {run.createdAt.toLocaleString()}
										</span>
									</span>
								</Button>
							))}
							{rejections.map((item) => (
								<Collapsible key={item.id} className="rounded-lg border p-3">
									<CollapsibleTrigger className="w-full cursor-pointer text-left font-medium text-destructive">
										Row {item.rowNumber}: {item.reason}
									</CollapsibleTrigger>
									<CollapsibleContent>
										<pre className="mt-2 overflow-auto rounded-md bg-muted p-2 text-xs">
											{JSON.stringify(item.row, null, 2)}
										</pre>
									</CollapsibleContent>
								</Collapsible>
							))}
						</CardContent>
					</Card>
				) : null}

				{history.length ? (
					<Card>
						<CardHeader>
							<CardTitle>Custody history</CardTitle>
							<CardDescription>
								Recorded check-in and checkout changes.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-2 text-sm">
							{history.map((item) => (
								<div key={item.id} className="rounded-lg border p-3">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<strong>{custodyActionLabel(item.action)}</strong>
										<span className="text-muted-foreground text-xs">
											{item.createdAt.toLocaleString()}
										</span>
									</div>
									<pre className="mt-2 overflow-auto rounded-md bg-muted p-2 text-xs">
										{JSON.stringify(item.changes, null, 2)}
									</pre>
								</div>
							))}
						</CardContent>
					</Card>
				) : null}

				{assets.length ? (
					<Card>
						<CardHeader>
							<CardTitle>Inventory</CardTitle>
							<CardDescription>
								{assets.length} assets currently tracked.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Asset</TableHead>
										<TableHead>Tag</TableHead>
										<TableHead>Owner</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Custom fields</TableHead>
										<TableHead>Custody</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{assets.map((asset) => (
										<TableRow key={asset.id}>
											<TableCell className="font-medium">
												{asset.name}
											</TableCell>
											<TableCell>{asset.assetTag ?? "—"}</TableCell>
											<TableCell>{asset.owner ?? "—"}</TableCell>
											<TableCell>
												{asset.status ? (
													<Badge variant="outline">{asset.status}</Badge>
												) : (
													"—"
												)}
											</TableCell>
											<TableCell className="max-w-72 whitespace-normal text-muted-foreground text-xs">
												{Object.entries(asset.customFields ?? {})
													.map(([key, value]) => `${key}: ${String(value)}`)
													.join(" · ") || "—"}
											</TableCell>
											<TableCell>
												<div className="flex gap-1">
													<Button
														size="sm"
														variant="ghost"
														onClick={() => onSelectAsset?.(asset.id)}
													>
														History
													</Button>
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															asset.owner
																? onCheckin?.(asset.id)
																: onCheckout?.(asset.id)
														}
													>
														{asset.owner ? "Check in" : "Check out"}
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
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
			</div>
		</PageContainer>
	);
}
