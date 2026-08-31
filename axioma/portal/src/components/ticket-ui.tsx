import {
	type RemixiconComponentType,
	RiCheckboxCircleLine,
	RiErrorWarningLine,
	RiLifebuoyLine,
	RiRouteLine,
	RiTimeLine,
} from "@remixicon/react";
import type { ComponentProps, ReactNode } from "react";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	fallbackStatusCopy,
	isStateType,
	statusDetailCopy,
	ticketUiCopy,
} from "@/features/tickets/copy";
import { ticketStatusTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";
import type { STATE_TYPES } from "@/sdk/shared";

type StateType = (typeof STATE_TYPES)[number];

const statusIcons: Record<StateType, RemixiconComponentType> = {
	new: RiTimeLine,
	open: RiLifebuoyLine,
	pending: RiRouteLine,
	resolved: RiCheckboxCircleLine,
	closed: RiCheckboxCircleLine,
	merged: RiCheckboxCircleLine,
	cancelled: RiErrorWarningLine,
};

export function getStatus(stateType: string, label = fallbackStatusCopy.label) {
	return {
		label,
		detail: isStateType(stateType)
			? statusDetailCopy[stateType]
			: fallbackStatusCopy.detail,
		icon: isStateType(stateType) ? statusIcons[stateType] : RiTimeLine,
	};
}

export function StatusBadge({
	stateType,
	label: configuredLabel,
}: {
	stateType: string;
	label?: string;
}) {
	const { label } = getStatus(stateType, configuredLabel);
	return (
		<Badge
			variant="outline"
			tone={isStateType(stateType) ? ticketStatusTone(stateType) : "neutral"}
		>
			{configuredLabel ?? label}
		</Badge>
	);
}

export function formatDate(value: Date) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export function PageShell({
	children,
	id = "main-content",
	tabIndex = -1,
	...mainProps
}: ComponentProps<"main">) {
	return (
		<main
			className="min-h-full bg-muted/20"
			id={id}
			tabIndex={tabIndex}
			{...mainProps}
		>
			<div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
				{children}
			</div>
		</main>
	);
}

export function PageHeading({
	eyebrow,
	title,
	titleId,
	description,
	meta,
	action,
	className,
}: {
	eyebrow?: string;
	title: string;
	/** For pages whose region is labelled by its own heading. */
	titleId?: string;
	description?: string;
	/** Secondary line under the description — a timestamp, a count. */
	meta?: ReactNode;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<header
			className={cn(
				"mb-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end",
				className,
			)}
		>
			<div className="max-w-2xl">
				{eyebrow ? (
					<p className="mb-2 font-semibold text-primary text-xs uppercase tracking-eyebrow">
						{eyebrow}
					</p>
				) : null}
				<h1
					id={titleId}
					className="wrap-break-word font-heading font-semibold text-2xl tracking-tight"
				>
					{title}
				</h1>
				{description ? (
					<p className="mt-1 text-muted-foreground text-sm">{description}</p>
				) : null}
				{meta ? (
					<p className="mt-3 text-muted-foreground text-xs">{meta}</p>
				) : null}
			</div>
			{action}
		</header>
	);
}

export function LoadingCards() {
	return (
		<div className="grid gap-4" role="status" aria-label={ticketUiCopy.loading}>
			{[0, 1, 2].map((item) => (
				<Card key={item}>
					<CardContent className="flex flex-col gap-4 py-2">
						<Skeleton className="h-5 w-2/3" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-1/3" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export function ErrorState({
	retry,
	error,
}: {
	retry: () => void;
	error?: Error | null;
}) {
	return (
		<Alert variant="destructive">
			<RiErrorWarningLine aria-hidden="true" />
			<AlertTitle>{ticketUiCopy.errorTitle}</AlertTitle>
			<AlertDescription>
				<p>{ticketUiCopy.errorDescription}</p>
				{error?.message ? <p className="text-xs">{error.message}</p> : null}
			</AlertDescription>
			<AlertAction>
				<Button variant="outline" size="sm" onClick={retry}>
					{ticketUiCopy.tryAgain}
				</Button>
			</AlertAction>
		</Alert>
	);
}
