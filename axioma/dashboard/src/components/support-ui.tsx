import {
	RiErrorWarningLine as AlertCircle,
	RiInbox2Line as Inbox,
} from "@remixicon/react";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ticketStatusTone } from "@/features/tickets/components/allowed-actions";
import type { StateType } from "@/sdk/shared";

export function StatusBadge({
	status,
	label = status,
	stateType,
}: {
	status: string;
	label?: string;
	stateType?: StateType;
}) {
	return (
		<Badge variant="outline" className={ticketStatusTone(stateType ?? status)}>
			{label}
		</Badge>
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
	if (kind === "error")
		return (
			<Alert variant="destructive" className="min-h-64 content-center">
				<AlertCircle />
				<AlertTitle>{title}</AlertTitle>
				<AlertDescription>{description}</AlertDescription>
				{onRetry ? (
					<AlertAction>
						<Button variant="outline" size="sm" onClick={onRetry}>
							Try again
						</Button>
					</AlertAction>
				) : null}
			</Alert>
		);

	if (kind === "loading")
		return (
			<div
				className="flex min-h-64 flex-col items-center justify-center gap-4"
				role="status"
			>
				<Spinner />
				<div className="text-center">
					<p className="font-medium">{title}</p>
					<p className="text-muted-foreground text-sm">{description}</p>
				</div>
				<div className="flex flex-col gap-2" aria-hidden="true">
					<Skeleton className="h-3 w-48" />
					<Skeleton className="h-3 w-32" />
				</div>
			</div>
		);

	return (
		<Empty className="min-h-64 border" role="status">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Inbox />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
		</Empty>
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
