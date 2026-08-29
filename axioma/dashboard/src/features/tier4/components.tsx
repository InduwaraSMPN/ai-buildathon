import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowUp,
	FileUp,
	Link as LinkIcon,
	Paperclip,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api-url";
import { orpc } from "@/utils/orpc";

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
export type ScheduledWork = {
	ticketId: string;
	ticketNumber: string | null;
	title: string;
	status: string;
	priority: string;
	workStartAt: Date | null;
	workEndAt: Date | null;
	workAllDay: boolean;
	snoozedUntil: Date | null;
};
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
export type MailLogRow = {
	id: string;
	recipient: string;
	subject: string;
	subsystem: string;
	outcome: "sent" | "failed";
	attemptedAt: Date;
};
export type OverviewWidget = { key: string; title: string; width: 1 | 2 };
export type RequestAttachment = {
	id: string;
	name: string;
	href: string;
	kind: "file" | "link";
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

export function CalendarPage({ work }: { work: readonly ScheduledWork[] }) {
	return (
		<PageContainer
			title="Scheduled work"
			description="Upcoming changes, maintenance, and recurring work."
		>
			{work.length ? (
				<div className="grid gap-3">
					{work.map((item) => (
						<Card key={item.ticketId}>
							<CardContent className="flex items-start justify-between gap-4 p-4">
								<div>
									<p className="font-medium">
										{item.ticketNumber ?? item.ticketId} · {item.title}
									</p>
									<p className="text-muted-foreground text-xs">
										{item.priority} · {item.status}
									</p>
									<p className="text-muted-foreground text-sm">
										{item.workStartAt?.toLocaleString()}
										{item.workEndAt
											? ` – ${item.workEndAt.toLocaleString()}`
											: ""}
									</p>
								</div>
								<Badge variant="outline">
									{item.workAllDay ? "All day" : "Scheduled"}
									{item.snoozedUntil
										? ` · Snoozed until ${item.snoozedUntil.toLocaleString()}`
										: ""}
								</Badge>
							</CardContent>
						</Card>
					))}
				</div>
			) : (
				<PageState
					kind="empty"
					title="No scheduled work"
					description="No work is scheduled in this period."
				/>
			)}
		</PageContainer>
	);
}

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

export function MailLogPage({ entries }: { entries: readonly MailLogRow[] }) {
	return (
		<PageContainer
			title="Mail send log"
			description="Inspect successful and failed delivery attempts."
		>
			{entries.length ? (
				<div className="overflow-x-auto border">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b">
								<th className="p-3">Attempted</th>
								<th className="p-3">Recipient</th>
								<th className="p-3">Subject</th>
								<th className="p-3">Subsystem</th>
								<th className="p-3">Outcome</th>
							</tr>
						</thead>
						<tbody>
							{entries.map((entry) => (
								<tr key={entry.id} className="border-b">
									<td className="p-3">{entry.attemptedAt.toLocaleString()}</td>
									<td className="p-3">{entry.recipient}</td>
									<td className="p-3 font-medium">{entry.subject}</td>
									<td className="p-3">{entry.subsystem}</td>
									<td className="p-3">
										<Badge
											variant={
												entry.outcome === "failed" ? "destructive" : "outline"
											}
										>
											{entry.outcome}
										</Badge>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<PageState
					kind="empty"
					title="No mail attempts"
					description="No delivery attempts have been recorded."
				/>
			)}
		</PageContainer>
	);
}

export function WidgetArrangement({
	widgets,
	onChange,
}: {
	widgets: readonly OverviewWidget[];
	onChange?: (widgets: readonly OverviewWidget[]) => void;
}) {
	const [ordered, setOrdered] = useState(widgets);
	useEffect(() => setOrdered(widgets), [widgets]);
	const move = (index: number, offset: -1 | 1) => {
		const next = [...ordered];
		const other = index + offset;
		if (!next[other]) return;
		[next[index], next[other]] = [next[other], next[index]];
		setOrdered(next);
		onChange?.(next);
	};
	return (
		<div className="grid gap-2">
			{ordered.map((widget, index) => (
				<div key={widget.key} className="flex items-center gap-2 border p-3">
					<span className="min-w-0 flex-1 font-medium">{widget.title}</span>
					<Button
						size="icon-sm"
						variant="outline"
						aria-label={`Move ${widget.title} up`}
						disabled={index === 0}
						onClick={() => move(index, -1)}
					>
						<ArrowUp />
					</Button>
					<Button
						size="icon-sm"
						variant="outline"
						aria-label={`Move ${widget.title} down`}
						disabled={index === ordered.length - 1}
						onClick={() => move(index, 1)}
					>
						<ArrowDown />
					</Button>
				</div>
			))}
		</div>
	);
}

export function TicketAttachments({
	targetType = "ticket",
	targetId,
	canEdit = true,
}: {
	targetType?: "ticket" | "case_note";
	targetId: string;
	canEdit?: boolean;
}) {
	const queryClient = useQueryClient();
	const input = { targetType, targetId };
	const documents = useQuery(orpc.listDocuments.queryOptions({ input }));
	const addLink = useMutation(
		orpc.createLinkDocument.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: orpc.listDocuments.key({ input }),
				}),
			onError: (error) => toast.error(error.message),
		}),
	);
	const [uploading, setUploading] = useState(false);
	if (documents.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading attachments"
				description="Retrieving linked documents…"
			/>
		);
	if (documents.isError)
		return (
			<PageState
				kind="error"
				title="Attachments unavailable"
				description={documents.error.message}
				onRetry={() => documents.refetch()}
			/>
		);
	return (
		<AttachmentControls
			attachments={documents.data.map((item) => ({
				id: item.id,
				name: item.displayName,
				kind: item.kind,
				href: item.kind === "link" ? item.url : apiUrl(item.downloadUrl),
			}))}
			onAddLink={
				canEdit
					? () => {
							const url = window.prompt("Link URL");
							if (!url) return;
							const displayName = window.prompt("Link name", url) ?? url;
							addLink.mutate({ ...input, url, displayName });
						}
					: undefined
			}
			onFiles={
				!canEdit || uploading
					? undefined
					: async (files) => {
							setUploading(true);
							try {
								for (const file of files) {
									const body = new FormData();
									body.set("file", file);
									body.set("targetType", targetType);
									body.set("targetId", targetId);
									const response = await fetch(apiUrl("api/documents"), {
										method: "POST",
										body,
										credentials: "include",
									});
									if (!response.ok) throw new Error(await response.text());
								}
								await queryClient.invalidateQueries({
									queryKey: orpc.listDocuments.key({ input }),
								});
								toast.success("Attachments uploaded");
							} catch (error) {
								toast.error(
									error instanceof Error ? error.message : "Upload failed",
								);
							} finally {
								setUploading(false);
							}
						}
			}
		/>
	);
}

export function AttachmentControls({
	attachments,
	onFiles,
	onAddLink,
}: {
	attachments: readonly RequestAttachment[];
	onFiles?: (files: FileList) => void;
	onAddLink?: () => void;
}) {
	return (
		<div className="space-y-3">
			<div className="flex gap-2">
				<label className="inline-flex">
					<span className="sr-only">Attach files</span>
					<input
						className="sr-only"
						type="file"
						multiple
						disabled={!onFiles}
						onChange={(event) => {
							if (event.target.files) onFiles?.(event.target.files);
						}}
					/>
					<span className="inline-flex h-9 items-center gap-2 border px-3 text-sm">
						<Paperclip className="size-4" />
						Attach files
					</span>
				</label>
				<Button variant="outline" disabled={!onAddLink} onClick={onAddLink}>
					<LinkIcon />
					Add link
				</Button>
			</div>
			{attachments.map((item) => (
				<a
					key={item.id}
					href={item.href}
					className="flex items-center gap-2 border p-2 text-sm hover:bg-muted"
				>
					<FileUp className="size-4" />
					<span>{item.name}</span>
				</a>
			))}
		</div>
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
