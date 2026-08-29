import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

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
}: {
	problems: readonly ProblemSummary[];
	onSelect?: (problem: ProblemSummary) => void;
}) {
	return (
		<PageContainer
			title="Problems"
			description="Root causes, known errors, and linked incidents."
		>
			<ProblemList problems={problems} onSelect={onSelect} />
		</PageContainer>
	);
}

export function ProblemDetailPage({ problem }: { problem: ProblemDetail }) {
	return (
		<PageContainer title={problem.problemNumber} description={problem.title}>
			<ProblemDetailView problem={problem} />
		</PageContainer>
	);
}

export function ProblemList({
	problems,
	onSelect,
}: {
	problems: readonly ProblemSummary[];
	onSelect?: (problem: ProblemSummary) => void;
}) {
	if (problems.length === 0)
		return (
			<p className="py-12 text-center text-muted-foreground text-sm">
				No problems found.
			</p>
		);

	return (
		<div className="border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Problem</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Priority</TableHead>
						<TableHead>Owner</TableHead>
						<TableHead>Updated</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{problems.map((problem) => (
						<TableRow
							key={problem.id}
							className={onSelect ? "cursor-pointer" : undefined}
							onClick={() => onSelect?.(problem)}
						>
							<TableCell>
								<div className="font-medium">{problem.title}</div>
								<div className="text-muted-foreground">
									{problem.problemNumber}
								</div>
							</TableCell>
							<TableCell>
								<Badge variant={problem.isKnownError ? "default" : "outline"}>
									{problem.isKnownError ? "Known error" : problem.status}
								</Badge>
							</TableCell>
							<TableCell>{problem.priority}</TableCell>
							<TableCell>{problem.assigneeId ?? "Unassigned"}</TableCell>
							<TableCell>
								{new Date(problem.updatedAt).toLocaleDateString()}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
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
						<p className="text-muted-foreground">No linked incidents.</p>
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
