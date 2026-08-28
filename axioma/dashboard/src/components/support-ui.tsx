import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const statusTone: Record<string, string> = {
	open: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
	routing:
		"border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
	resolving:
		"border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
	resolved:
		"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	escalated:
		"border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
	closed: "border-border bg-muted text-muted-foreground",
	connected:
		"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	offline: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wider",
				statusTone[status.toLowerCase()] ?? statusTone.closed,
			)}
		>
			{status}
		</span>
	);
}

export function PageState({
	kind,
	title,
	description,
	onRetry,
}: {
	kind: "loading" | "empty" | "error";
	title: string;
	description: string;
	onRetry?: () => void;
}) {
	const Icon =
		kind === "loading" ? LoaderCircle : kind === "error" ? AlertCircle : Inbox;
	return (
		<div
			className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card p-8 text-center shadow-sm"
			role={kind === "error" ? "alert" : "status"}
		>
			<Icon
				className={cn(
					"size-6 text-muted-foreground",
					kind === "loading" && "animate-spin",
				)}
			/>
			<div>
				<p className="font-semibold text-sm">{title}</p>
				<p className="mt-1 max-w-md text-muted-foreground text-xs">
					{description}
				</p>
			</div>
			{onRetry && <Button onClick={onRetry}>Try again</Button>}
		</div>
	);
}

export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
}: {
	eyebrow: string;
	title: string;
	description: string;
	actions?: ReactNode;
}) {
	return (
		<header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
					{eyebrow}
				</p>
				<h1 className="mt-1 font-semibold text-2xl tracking-tight">{title}</h1>
				<p className="mt-1 text-muted-foreground text-xs">{description}</p>
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</header>
	);
}

export const formatDate = (date: Date) =>
	new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);

export const timeAgo = (date: Date) => {
	const seconds = Math.round((date.getTime() - Date.now()) / 1000);
	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		["year", 31_536_000],
		["month", 2_592_000],
		["day", 86_400],
		["hour", 3_600],
		["minute", 60],
	];
	const [unit, size] = units.find(
		([, value]) => Math.abs(seconds) >= value,
	) ?? ["second", 1];
	return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
		Math.round(seconds / size),
		unit,
	);
};
