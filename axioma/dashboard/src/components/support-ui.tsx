import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ticketStatusTone } from "@/features/tickets/components/allowed-actions";
import { cn } from "@/lib/utils";

const connectionTone = {
	online:
		"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	offline: "border-border bg-muted text-muted-foreground",
} as const;

export function StatusBadge({
	status,
	label = status,
	stateType,
}: {
	status: string;
	label?: string;
	stateType?: string;
}) {
	const normalized = status.toLowerCase();
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wider",
				ticketStatusTone(stateType ?? normalized) ??
					connectionTone[normalized as keyof typeof connectionTone] ??
					connectionTone.offline,
			)}
		>
			{label}
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
