import type { LucideIcon } from "lucide-react";
import {
	AlertCircle,
	CircleCheck,
	Clock3,
	LifeBuoy,
	Route,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	fallbackStatusCopy,
	statusDetailCopy,
	ticketUiCopy,
} from "@/features/tickets/copy";
import { cn } from "@/lib/utils";

const statusIcons: Record<string, LucideIcon> = {
	new: Clock3,
	open: LifeBuoy,
	pending: Route,
	resolved: CircleCheck,
	closed: CircleCheck,
};

export function getStatus(stateType: string, label = fallbackStatusCopy.label) {
	return {
		label,
		detail: statusDetailCopy[stateType] ?? fallbackStatusCopy.detail,
		icon: statusIcons[stateType] ?? Clock3,
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
		<span
			className={cn(
				"inline-flex items-center rounded-full border px-2.5 py-1 font-medium text-xs",
				stateType === "resolved" || stateType === "closed"
					? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
					: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
			)}
		>
			{configuredLabel ?? label}
		</span>
	);
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
				<Card className="rounded-xl" key={item}>
					<CardContent className="space-y-4 py-2">
						<Skeleton className="h-5 w-2/3 rounded-md" />
						<Skeleton className="h-4 w-full rounded-md" />
						<Skeleton className="h-4 w-1/3 rounded-md" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export function ErrorState({ retry }: { retry: () => void }) {
	return (
		<Card className="rounded-xl border-destructive/30">
			<CardContent className="flex flex-col items-center gap-4 py-12 text-center">
				<AlertCircle className="size-8 text-destructive" aria-hidden="true" />
				<div>
					<h2 className="font-semibold text-lg">{ticketUiCopy.errorTitle}</h2>
					<p className="mt-1 text-muted-foreground">
						{ticketUiCopy.errorDescription}
					</p>
				</div>
				<Button variant="outline" onClick={retry}>
					{ticketUiCopy.tryAgain}
				</Button>
			</CardContent>
		</Card>
	);
}
