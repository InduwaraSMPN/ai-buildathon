import type { ReactNode } from "react";
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
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

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

export function ChangeEditor({
	pending = false,
	cabMemberId,
	onSubmit,
}: {
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
		<form
			onSubmit={(event) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				onSubmit({
					title: String(data.get("title")),
					description: String(data.get("description")) || undefined,
					reasonForChange: String(data.get("reasonForChange")),
					changeType: String(data.get("changeType")) as "normal" | "emergency",
					testPlan: String(data.get("testPlan")),
					rollbackPlan: String(data.get("rollbackPlan")),
					cabMemberIds: [String(data.get("cabMemberIds"))].filter(Boolean),
				});
			}}
		>
			<FieldGroup className="grid sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor="change-title">Title</FieldLabel>
					<Input id="change-title" name="title" required minLength={3} />
				</Field>
				<Field>
					<FieldLabel htmlFor="change-type">Type</FieldLabel>
					<NativeSelect id="change-type" name="changeType" className="w-full">
						<NativeSelectOption value="normal">Normal</NativeSelectOption>
						<NativeSelectOption value="emergency">Emergency</NativeSelectOption>
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
					<FieldLabel htmlFor="change-rollback-plan">Rollback plan</FieldLabel>
					<Input id="change-rollback-plan" name="rollbackPlan" required />
				</Field>
				<input type="hidden" name="cabMemberIds" value={cabMemberId ?? ""} />
				<Button disabled={pending}>Create change</Button>
			</FieldGroup>
		</form>
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
			<Empty>
				<EmptyHeader>
					<EmptyTitle>No changes found</EmptyTitle>
				</EmptyHeader>
			</Empty>
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
							role={onSelect ? "button" : undefined}
							tabIndex={onSelect ? 0 : undefined}
							className={
								onSelect
									? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									: undefined
							}
							onClick={() => onSelect?.(change)}
							onKeyDown={(event) => {
								if (onSelect && (event.key === "Enter" || event.key === " ")) {
									event.preventDefault();
									onSelect(change);
								}
							}}
							aria-label={
								onSelect ? `View ${change.title} change details` : undefined
							}
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
												? new Date(change.pirActualStartAt)
														.toISOString()
														.slice(0, 16)
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
												? new Date(change.pirActualEndAt)
														.toISOString()
														.slice(0, 16)
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
