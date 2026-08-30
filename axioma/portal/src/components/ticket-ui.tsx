import {
	type RemixiconComponentType,
	RiCheckboxCircleLine,
	RiErrorWarningLine,
	RiLifebuoyLine,
	RiRouteLine,
	RiTimeLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
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
	statusDetailCopy,
	ticketUiCopy,
} from "@/features/tickets/copy";
import { STATE_TYPES } from "@/sdk/shared";

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

const statusVariants: Record<
	StateType,
	"default" | "secondary" | "destructive" | "outline"
> = {
	new: "secondary",
	open: "default",
	pending: "outline",
	resolved: "secondary",
	closed: "outline",
	merged: "secondary",
	cancelled: "destructive",
} as const;

function isStateType(value: string): value is StateType {
	return (STATE_TYPES as readonly string[]).includes(value);
}

export function getStatus(stateType: string, label = fallbackStatusCopy.label) {
	return {
		label,
		detail: statusDetailCopy[stateType] ?? fallbackStatusCopy.detail,
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
	const variant = isStateType(stateType)
		? statusVariants[stateType]
		: "outline";
	return <Badge variant={variant}>{configuredLabel ?? label}</Badge>;
}

export function formatDate(value: Date) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export function PageShell({ children }: { children: ReactNode }) {
	return (
		<main className="min-h-full bg-muted/20">
			<div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
				{children}
			</div>
		</main>
	);
}

export function PageHeading({
	eyebrow,
	title,
	description,
	action,
}: {
	eyebrow: string;
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
			<div className="max-w-2xl">
				<p className="mb-2 font-semibold text-primary text-xs uppercase tracking-[0.18em]">
					{eyebrow}
				</p>
				<h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
					{title}
				</h1>
				<p className="mt-3 text-base text-muted-foreground leading-relaxed">
					{description}
				</p>
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

export function ErrorState({ retry }: { retry: () => void }) {
	return (
		<Alert variant="destructive">
			<RiErrorWarningLine aria-hidden="true" />
			<AlertTitle>{ticketUiCopy.errorTitle}</AlertTitle>
			<AlertDescription>{ticketUiCopy.errorDescription}</AlertDescription>
			<AlertAction>
				<Button variant="outline" size="sm" onClick={retry}>
					{ticketUiCopy.tryAgain}
				</Button>
			</AlertAction>
		</Alert>
	);
}
