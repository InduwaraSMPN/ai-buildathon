import { createColumnHelper } from "@tanstack/react-table";
import { type ReactNode, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type ProblemSummary = {
	id: string;
	problemNumber: string;
	title: string;
	status: string;
	priority: "P1" | "P2" | "P3" | "P4";
	assigneeId: string | null;
	isKnownError: boolean;
	updatedAt: Date | string;
};

export type ProblemDetail = ProblemSummary & {
	description: string;
	rootCause: string | null;
	workaround: string | null;
	serviceId: string | null;
	ticketIds: string[];
	resolutionOffer: string | null;
};

export function ProblemsPage({
	problems,
	onSelect,
	action,
}: {
	problems: readonly ProblemSummary[];
	onSelect?: (problem: ProblemSummary) => void;
	action?: ReactNode;
}) {
	return (
		<PageContainer
			title="Problems"
			description="Root causes, known errors, and linked incidents."
			action={action}
		>
			<ProblemList problems={problems} onSelect={onSelect} />
		</PageContainer>
	);
}

export function ProblemEditor({
	pending = false,
	onSubmit,
}: {
	pending?: boolean;
	onSubmit: (value: { title: string; description: string }) => void;
}) {
	const [open, setOpen] = useState(false);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm">New problem</Button>} />
			<DialogContent className="sm:max-w-lg">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						onSubmit({
							title: String(data.get("title")),
							description: String(data.get("description")),
						});
						setOpen(false);
					}}
				>
					<DialogHeader>
						<DialogTitle>Raise a problem</DialogTitle>
						<DialogDescription>
							Record a root cause so related incidents can be linked to it.
						</DialogDescription>
					</DialogHeader>
					<FieldGroup className="py-4">
						<Field>
							<FieldLabel htmlFor="problem-title">Title</FieldLabel>
							<Input id="problem-title" name="title" required minLength={3} />
						</Field>
						<Field>
							<FieldLabel htmlFor="problem-description">Description</FieldLabel>
							<Input
								id="problem-description"
								name="description"
								required
								minLength={1}
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button disabled={pending}>Create</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function ProblemDetailPage({ problem }: { problem: ProblemDetail }) {
	return (
		<PageContainer title={problem.problemNumber} description={problem.title}>
			<ProblemDetailView problem={problem} />
		</PageContainer>
	);
}

const problemColumn = createColumnHelper<ProblemSummary>();
const problemColumns = [
	problemColumn.accessor("title", {
		header: "Problem",
		cell: ({ row }) => (
			<div>
				<div className="font-medium">{row.original.title}</div>
				<div className="text-muted-foreground">{row.original.problemNumber}</div>
			</div>
		),
	}),
	problemColumn.accessor(
		(problem) => (problem.isKnownError ? "Known error" : problem.status),
		{
			id: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge variant={row.original.isKnownError ? "default" : "outline"}>
					{row.original.isKnownError ? "Known error" : row.original.status}
				</Badge>
			),
		},
	),
	problemColumn.accessor("priority", { header: "Priority" }),
	problemColumn.accessor((problem) => problem.assigneeId ?? "Unassigned", {
		id: "owner",
		header: "Owner",
	}),
	problemColumn.accessor((problem) => new Date(problem.updatedAt).getTime(), {
		id: "updated",
		header: "Updated",
		cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString(),
	}),
];

export function ProblemList({
	problems,
	onSelect,
}: {
	problems: readonly ProblemSummary[];
	onSelect?: (problem: ProblemSummary) => void;
}) {
	return (
		<DataTable
			data={problems}
			columns={problemColumns}
			filterLabel="Filter problems"
			filterPlaceholder="Filter title, number, status, or owner…"
			emptyTitle="No problems found"
			emptyDescription="No problems have been raised."
			onRowClick={onSelect}
			rowLabel={(problem) => `View ${problem.title} problem details`}
		/>
	);
}

export function ProblemDetailView({ problem }: { problem: ProblemDetail }) {
	return (
		<div className="grid gap-4 lg:grid-cols-3">
			<Card className="lg:col-span-2">
				<CardHeader>
					<CardTitle>{problem.title}</CardTitle>
					<CardDescription>
						{problem.problemNumber} · {problem.status} · {problem.priority}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					<DetailSection title="Description" value={problem.description} />
					<DetailSection title="Root cause" value={problem.rootCause} />
					<DetailSection title="Workaround" value={problem.workaround} />
					<DetailSection
						title="Resolution offer"
						value={problem.resolutionOffer}
					/>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Linked incidents</CardTitle>
				</CardHeader>
				<CardContent>
					{problem.ticketIds.length ? (
						<ul className="space-y-2">
							{problem.ticketIds.map((id) => (
								<li key={id} className="border p-2 font-mono">
									{id}
								</li>
							))}
						</ul>
					) : (
						<Empty>
							<EmptyHeader>
								<EmptyTitle>No linked incidents</EmptyTitle>
							</EmptyHeader>
						</Empty>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function DetailSection({
	title,
	value,
}: {
	title: string;
	value: string | null;
}) {
	return (
		<section>
			<h2 className="mb-1 font-medium text-sm">{title}</h2>
			<p className="whitespace-pre-wrap text-muted-foreground">
				{value || "Not recorded."}
			</p>
		</section>
	);
}
