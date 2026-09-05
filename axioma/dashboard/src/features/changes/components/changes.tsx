import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";
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
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/datetime-local";

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
	implementationPlan: string | null;
	testPlan: string | null;
	rollbackPlan: string | null;
	pirReview: string | null;
	pirWasSuccessful: boolean | null;
	pirActualStartAt: Date | string | null;
	pirActualEndAt: Date | string | null;
	pirLessonsLearned: string | null;
	pirFollowUp: string | null;
	sourceRunId: string | null;
	sourceStepId: string | null;
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
	action,
}: {
	changes: readonly ChangeSummary[];
	onSelect?: (change: ChangeSummary) => void;
	action?: ReactNode;
}) {
	return (
		<PageContainer
			title="Changes"
			description="Plan, approve, schedule, and review service changes."
			action={action}
		>
			<ChangeList changes={changes} onSelect={onSelect} />
		</PageContainer>
	);
}

/**
 * The dialog is controlled by the caller so it closes on a successful create
 * and not before — a rejected create must leave the typed values in place.
 */
export function ChangeEditor({
	open,
	onOpenChange,
	pending = false,
	cabMemberId,
	onSubmit,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	pending?: boolean;
	cabMemberId?: string;
	onSubmit: (value: {
		title: string;
		description?: string;
		reasonForChange: string;
		changeType: "normal" | "emergency";
		testPlan: string;
		rollbackPlan: string;
		cabMemberIds: string[];
	}) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger render={<Button size="sm">New change</Button>} />
			<DialogContent className="sm:max-w-2xl">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						onSubmit({
							title: String(data.get("title")),
							description: String(data.get("description")) || undefined,
							reasonForChange: String(data.get("reasonForChange")),
							changeType: String(data.get("changeType")) as
								| "normal"
								| "emergency",
							testPlan: String(data.get("testPlan")),
							rollbackPlan: String(data.get("rollbackPlan")),
							cabMemberIds: [String(data.get("cabMemberIds"))].filter(Boolean),
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>Raise a change</DialogTitle>
						<DialogDescription>
							Describe the change, how it will be tested, and how it rolls back.
						</DialogDescription>
					</DialogHeader>
					<FieldGroup className="grid py-4 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="change-title">Title</FieldLabel>
							<Input id="change-title" name="title" required minLength={3} />
						</Field>
						<Field>
							<FieldLabel htmlFor="change-type">Type</FieldLabel>
							<NativeSelect
								id="change-type"
								name="changeType"
								className="w-full"
							>
								<NativeSelectOption value="normal">Normal</NativeSelectOption>
								<NativeSelectOption value="emergency">
									Emergency
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel htmlFor="change-description">Description</FieldLabel>
							<Input id="change-description" name="description" />
						</Field>
						<Field>
							<FieldLabel htmlFor="change-reason">Reason for change</FieldLabel>
							<Input id="change-reason" name="reasonForChange" required />
						</Field>
						<Field>
							<FieldLabel htmlFor="change-test-plan">Test plan</FieldLabel>
							<Input id="change-test-plan" name="testPlan" required />
						</Field>
						<Field>
							<FieldLabel htmlFor="change-rollback-plan">
								Rollback plan
							</FieldLabel>
							<Input id="change-rollback-plan" name="rollbackPlan" required />
						</Field>
						<input
							type="hidden"
							name="cabMemberIds"
							value={cabMemberId ?? ""}
						/>
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button disabled={pending}>Create change</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function ChangeDetailPage({
	change,
	currentUserId,
	onVote,
	onUpdate,
	pending,
}: {
	change: ChangeDetail;
	/** The viewer. `voteOnChange` always records *their* vote, so the button
	 * belongs on their own row and nowhere else. */
	currentUserId?: string;
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
				currentUserId={currentUserId}
				onVote={onVote}
				onUpdate={onUpdate}
				pending={pending}
			/>
		</PageContainer>
	);
}

const changeColumn = createColumnHelper<ChangeSummary>();
const changeColumns = [
	changeColumn.accessor("title", {
		header: "Change",
		cell: ({ row }) => (
			<div>
				<div className="font-medium">{row.original.title}</div>
				<div className="text-muted-foreground">{row.original.changeNumber}</div>
			</div>
		),
	}),
	changeColumn.accessor("changeType", {
		header: "Type",
		cell: ({ row }) => (
			<span className="capitalize">{row.original.changeType}</span>
		),
	}),
	changeColumn.accessor((change) => change.status.replaceAll("_", " "), {
		id: "status",
		header: "Status",
		cell: ({ row }) => (
			<Badge
				variant={
					row.original.status === "failed" || row.original.status === "rejected"
						? "destructive"
						: "outline"
				}
			>
				{row.original.status.replaceAll("_", " ")}
			</Badge>
		),
	}),
	changeColumn.accessor(
		(change) => change.riskLevel ?? `${change.impact} impact`,
		{ id: "risk", header: "Risk" },
	),
	changeColumn.accessor(
		(change) =>
			change.workStartAt
				? new Date(change.workStartAt).getTime()
				: Number.POSITIVE_INFINITY,
		{
			id: "window",
			header: "Window",
			cell: ({ row }) =>
				row.original.workStartAt
					? new Date(row.original.workStartAt).toLocaleString()
					: "Not scheduled",
		},
	),
];

export function ChangeList({
	changes,
	onSelect,
}: {
	changes: readonly ChangeSummary[];
	onSelect?: (change: ChangeSummary) => void;
}) {
	return (
		<DataTable
			data={changes}
			columns={changeColumns}
			filterLabel="Filter changes"
			filterPlaceholder="Filter title, number, type, or status…"
			emptyTitle="No changes found"
			emptyDescription="No changes have been raised."
			getRowId={(change) => change.id}
			onRowClick={onSelect}
			rowLabel={(change) => `View ${change.title} change details`}
		/>
	);
}

export function ChangeDetailView({
	change,
	currentUserId,
	onVote,
	onUpdate,
	pending,
}: {
	change: ChangeDetail;
	currentUserId?: string;
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
					<ChangeProvenance change={change} />
					<Section
						title="Implementation plan"
						value={change.implementationPlan}
					/>
					<Section title="Test plan" value={change.testPlan} />
					<Section title="Rollback plan" value={change.rollbackPlan} />
					<Section title="PIR review" value={change.pirReview} />
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
							onSubmit={(event) => {
								event.preventDefault();
								const data = new FormData(event.currentTarget);
								onUpdate({
									pirWasSuccessful: data.get("successful") === "true",
									pirActualStartAt: data.get("start")
										? fromDateTimeLocal(String(data.get("start")))
										: undefined,
									pirActualEndAt: data.get("end")
										? fromDateTimeLocal(String(data.get("end")))
										: undefined,
									pirLessonsLearned: String(data.get("lessons")),
									pirFollowUp: String(data.get("followUp")),
								});
							}}
						>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="pir-successful">Outcome</FieldLabel>
									<NativeSelect
										id="pir-successful"
										name="successful"
										defaultValue={
											change.pirWasSuccessful === false ? "false" : "true"
										}
										className="w-full"
									>
										<NativeSelectOption value="true">
											Successful
										</NativeSelectOption>
										<NativeSelectOption value="false">
											Unsuccessful
										</NativeSelectOption>
									</NativeSelect>
								</Field>
								<Field>
									<FieldLabel htmlFor="pir-start">Actual start</FieldLabel>
									<Input
										id="pir-start"
										name="start"
										type="datetime-local"
										defaultValue={
											change.pirActualStartAt
												? toDateTimeLocal(change.pirActualStartAt)
												: ""
										}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="pir-end">Actual end</FieldLabel>
									<Input
										id="pir-end"
										name="end"
										type="datetime-local"
										defaultValue={
											change.pirActualEndAt
												? toDateTimeLocal(change.pirActualEndAt)
												: ""
										}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="pir-lessons">Lessons learned</FieldLabel>
									<Textarea
										id="pir-lessons"
										name="lessons"
										defaultValue={change.pirLessonsLearned ?? ""}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="pir-follow-up">Follow-up</FieldLabel>
									<Textarea
										id="pir-follow-up"
										name="followUp"
										defaultValue={change.pirFollowUp ?? ""}
									/>
								</Field>
								<Button disabled={pending}>Save PIR</Button>
							</FieldGroup>
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
									{onVote && !member.vote && member.userId === currentUserId ? (
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
						<Empty>
							<EmptyHeader>
								<EmptyTitle>No CAB members</EmptyTitle>
							</EmptyHeader>
						</Empty>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

/**
 * A change's narrative fields. Most are prose a person wrote, but the PIR
 * review of an agent-raised change is the verifying read's own response, and a
 * minified Kubernetes payload set as a paragraph is unreadable — the one field
 * an auditor most needs to read looked like the page had broken. JSON is
 * indented and set as a scrolling code block instead; anything else is prose.
 */
function Section({ title, value }: { title: string; value: string | null }) {
	const json = value ? formatJson(value) : null;
	return (
		<section>
			<h2 className="mb-1 font-medium text-sm">{title}</h2>
			{json ? (
				<pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 text-muted-foreground text-xs">
					<code>{json}</code>
				</pre>
			) : (
				<p className="whitespace-pre-wrap text-muted-foreground">
					{value || "Not recorded."}
				</p>
			)}
		</section>
	);
}

/** The indented form when the value is a JSON object or array, else null. */
function formatJson(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
	try {
		return JSON.stringify(JSON.parse(trimmed), null, 2);
	} catch {
		return null;
	}
}

/**
 * Which agent run and step raised and completed this change.
 *
 * An auditor reading a change a person did not type has to be able to reach the
 * evidence, so the run and step ids are printed verbatim rather than summarised.
 * The transcript lives on the ticket, so the link goes to the first linked
 * ticket; a change with no linked ticket still shows the ids, because the ids
 * are the record and the link is only a convenience.
 */
function ChangeProvenance({ change }: { change: ChangeDetail }) {
	const ticketId = change.ticketIds[0];
	return (
		<section>
			<h2 className="mb-1 font-medium text-sm">Completed by</h2>
			{change.sourceRunId ? (
				<p className="text-muted-foreground">
					Agent run{" "}
					<span className="font-mono text-foreground">
						{change.sourceRunId}
					</span>
					{change.sourceStepId ? (
						<>
							, step{" "}
							<span className="font-mono text-foreground">
								{change.sourceStepId}
							</span>
						</>
					) : null}
					.{" "}
					{ticketId ? (
						<Link
							to="/tickets/$ticketId"
							params={{ ticketId }}
							className="underline underline-offset-4 hover:text-foreground"
						>
							Open the transcript
						</Link>
					) : (
						"No ticket is linked to this change."
					)}
				</p>
			) : (
				<p className="text-muted-foreground">
					No agent run is recorded against this change; it was raised by hand.
				</p>
			)}
		</section>
	);
}
