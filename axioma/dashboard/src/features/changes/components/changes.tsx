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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export type ChangeSummary = {
	id: string;
	changeNumber: string;
	title: string;
	changeType: "standard" | "normal" | "emergency";
	status: string;
	priority: "P1" | "P2" | "P3" | "P4";
	impact: "high" | "medium" | "low";
	riskLevel: string | null;
	workStartAt: Date | string | null;
};

export type ChangeDetail = ChangeSummary & {
	description: string | null;
	reasonForChange: string | null;
	testPlan: string | null;
	rollbackPlan: string | null;
	pirWasSuccessful: boolean | null;
	pirActualStartAt: Date | string | null;
	pirActualEndAt: Date | string | null;
	pirLessonsLearned: string | null;
	pirFollowUp: string | null;
	cabRequired: boolean;
	ticketIds: string[];
	cabMembers: {
		id: string;
		userId: string;
		isRequired: boolean;
		vote: "approve" | "reject" | "abstain" | null;
	}[];
};

export function ChangesPage({
	changes,
	onSelect,
}: {
	changes: readonly ChangeSummary[];
	onSelect?: (change: ChangeSummary) => void;
}) {
	return (
		<PageContainer
			title="Changes"
			description="Plan, approve, schedule, and review service changes."
		>
			<ChangeList changes={changes} onSelect={onSelect} />
		</PageContainer>
	);
}

export function ChangeDetailPage({
	change,
	onVote,
	onUpdate,
	pending,
}: {
	change: ChangeDetail;
	onVote?: (vote: "approve" | "reject" | "abstain") => void;
	onUpdate?: (value: {
		pirWasSuccessful?: boolean;
		pirActualStartAt?: Date;
		pirActualEndAt?: Date;
		pirLessonsLearned?: string;
		pirFollowUp?: string;
	}) => void;
	pending?: boolean;
}) {
	return (
		<PageContainer title={change.changeNumber} description={change.title}>
			<ChangeDetailView
				change={change}
				onVote={onVote}
				onUpdate={onUpdate}
				pending={pending}
			/>
		</PageContainer>
	);
}

export function ChangeList({
	changes,
	onSelect,
}: {
	changes: readonly ChangeSummary[];
	onSelect?: (change: ChangeSummary) => void;
}) {
	if (changes.length === 0)
		return (
			<p className="py-12 text-center text-muted-foreground text-sm">
				No changes found.
			</p>
		);
	return (
		<div className="border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Change</TableHead>
						<TableHead>Type</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Risk</TableHead>
						<TableHead>Window</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{changes.map((change) => (
						<TableRow
							key={change.id}
							className={onSelect ? "cursor-pointer" : undefined}
							onClick={() => onSelect?.(change)}
						>
							<TableCell>
								<div className="font-medium">{change.title}</div>
								<div className="text-muted-foreground">
									{change.changeNumber}
								</div>
							</TableCell>
							<TableCell className="capitalize">{change.changeType}</TableCell>
							<TableCell>
								<Badge
									variant={
										change.status === "failed" || change.status === "rejected"
											? "destructive"
											: "outline"
									}
								>
									{change.status.replaceAll("_", " ")}
								</Badge>
							</TableCell>
							<TableCell>
								{change.riskLevel ?? `${change.impact} impact`}
							</TableCell>
							<TableCell>
								{change.workStartAt
									? new Date(change.workStartAt).toLocaleString()
									: "Not scheduled"}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

export function ChangeDetailView({
	change,
	onVote,
	onUpdate,
	pending,
}: {
	change: ChangeDetail;
	onVote?: (vote: "approve" | "reject" | "abstain") => void;
	onUpdate?: (value: {
		pirWasSuccessful?: boolean;
		pirActualStartAt?: Date;
		pirActualEndAt?: Date;
		pirLessonsLearned?: string;
		pirFollowUp?: string;
	}) => void;
	pending?: boolean;
}) {
	return (
		<div className="grid gap-4 lg:grid-cols-3">
			<Card className="lg:col-span-2">
				<CardHeader>
					<CardTitle>{change.title}</CardTitle>
					<CardDescription>
						{change.changeNumber} · {change.changeType} ·{" "}
						{change.status.replaceAll("_", " ")}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					<Section title="Description" value={change.description} />
					<Section title="Reason for change" value={change.reasonForChange} />
					<Section title="Test plan" value={change.testPlan} />
					<Section title="Rollback plan" value={change.rollbackPlan} />
					<Section
						title="PIR outcome"
						value={
							change.pirWasSuccessful === null
								? null
								: change.pirWasSuccessful
									? "Successful"
									: "Unsuccessful"
						}
					/>
					<Section
						title="PIR actual start"
						value={
							change.pirActualStartAt
								? new Date(change.pirActualStartAt).toLocaleString()
								: null
						}
					/>
					<Section
						title="PIR actual end"
						value={
							change.pirActualEndAt
								? new Date(change.pirActualEndAt).toLocaleString()
								: null
						}
					/>
					<Section
						title="PIR lessons learned"
						value={change.pirLessonsLearned}
					/>
					<Section title="PIR follow-up" value={change.pirFollowUp} />
					{onUpdate ? (
						<form
							className="space-y-2"
							onSubmit={(event) => {
								event.preventDefault();
								const data = new FormData(event.currentTarget);
								onUpdate({
									pirWasSuccessful: data.get("successful") === "true",
									pirActualStartAt: data.get("start")
										? new Date(String(data.get("start")))
										: undefined,
									pirActualEndAt: data.get("end")
										? new Date(String(data.get("end")))
										: undefined,
									pirLessonsLearned: String(data.get("lessons")),
									pirFollowUp: String(data.get("followUp")),
								});
							}}
						>
							<select
								name="successful"
								defaultValue={
									change.pirWasSuccessful === false ? "false" : "true"
								}
								className="h-8 border bg-background px-2"
							>
								<option value="true">Successful</option>
								<option value="false">Unsuccessful</option>
							</select>
							<input
								name="start"
								type="datetime-local"
								defaultValue={
									change.pirActualStartAt
										? new Date(change.pirActualStartAt)
												.toISOString()
												.slice(0, 16)
										: ""
								}
								className="h-8 border px-2"
							/>
							<input
								name="end"
								type="datetime-local"
								defaultValue={
									change.pirActualEndAt
										? new Date(change.pirActualEndAt).toISOString().slice(0, 16)
										: ""
								}
								className="h-8 border px-2"
							/>
							<textarea
								name="lessons"
								defaultValue={change.pirLessonsLearned ?? ""}
								placeholder="Lessons learned"
								className="w-full border p-2"
							/>
							<textarea
								name="followUp"
								defaultValue={change.pirFollowUp ?? ""}
								placeholder="Follow-up"
								className="w-full border p-2"
							/>
							<Button disabled={pending}>Save PIR</Button>
						</form>
					) : null}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>CAB decisions</CardTitle>
					<CardDescription>
						{change.cabRequired
							? "Approval required"
							: "No CAB approval required"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{change.cabMembers.length ? (
						<ul className="space-y-2">
							{change.cabMembers.map((member) => (
								<li key={member.id} className="flex justify-between border p-2">
									<span>
										{member.userId}
										{member.isRequired ? " *" : ""}
									</span>
									<Badge
										variant={
											member.vote === "reject" ? "destructive" : "secondary"
										}
									>
										{member.vote ?? "pending"}
									</Badge>
									{onVote && !member.vote ? (
										<Button
											size="sm"
											disabled={pending}
											onClick={() => onVote("approve")}
										>
											Approve
										</Button>
									) : null}
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground">No CAB members.</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function Section({ title, value }: { title: string; value: string | null }) {
	return (
		<section>
			<h2 className="mb-1 font-medium text-sm">{title}</h2>
			<p className="whitespace-pre-wrap text-muted-foreground">
				{value || "Not recorded."}
			</p>
		</section>
	);
}
