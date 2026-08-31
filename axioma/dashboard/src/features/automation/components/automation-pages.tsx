import {
	RiEditLine as Pencil,
	RiAddLine as Plus,
	RiDeleteBinLine as Trash2,
} from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

type EditorValues = {
	name: string;
	secondary: string;
	firstJson: string;
	actions: string;
	active: boolean;
};

type EditorProps = {
	open: boolean;
	title: string;
	secondaryLabel: string;
	secondaryType?: "text" | "number";
	firstJsonLabel: string;
	activeLabel: string;
	initial: EditorValues;
	pending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (values: EditorValues) => void;
};

function parseArray(value: string, label: string) {
	const parsed: unknown = JSON.parse(value);
	if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array.`);
	return parsed;
}

function AutomationEditor({
	open,
	title,
	secondaryLabel,
	secondaryType = "text",
	firstJsonLabel,
	activeLabel,
	initial,
	pending,
	onOpenChange,
	onSubmit,
}: EditorProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						JSON fields must contain arrays.
					</DialogDescription>
				</DialogHeader>
				<form
					key={`${title}-${initial.name}`}
					className="flex flex-col gap-4"
					onSubmit={(event: FormEvent<HTMLFormElement>) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						onSubmit({
							name: String(data.get("name")),
							secondary: String(data.get("secondary")),
							firstJson: String(data.get("firstJson")),
							actions: String(data.get("actions")),
							active: data.get("active") === "true",
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="automation-name">Name</FieldLabel>
							<Input
								id="automation-name"
								name="name"
								defaultValue={initial.name}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="automation-secondary">
								{secondaryLabel}
							</FieldLabel>
							<Input
								id="automation-secondary"
								name="secondary"
								type={secondaryType}
								defaultValue={initial.secondary}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="automation-first-json">
								{firstJsonLabel}
							</FieldLabel>
							<Textarea
								id="automation-first-json"
								name="firstJson"
								defaultValue={initial.firstJson}
								rows={4}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="automation-actions">Actions</FieldLabel>
							<Textarea
								id="automation-actions"
								name="actions"
								defaultValue={initial.actions}
								rows={4}
								required
							/>
						</Field>
						<Field orientation="horizontal">
							<Checkbox
								id="automation-active"
								name="active"
								value="true"
								defaultChecked={initial.active}
							/>
							<FieldLabel htmlFor="automation-active">{activeLabel}</FieldLabel>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={pending}>
							{pending ? <Spinner data-icon="inline-start" /> : null}
							Save
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function DeleteButton({
	name,
	pending,
	onConfirm,
}: {
	name: string;
	pending: boolean;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger
				render={<Button size="sm" variant="destructive" disabled={pending} />}
			>
				{pending ? (
					<Spinner data-icon="inline-start" />
				) : (
					<Trash2 data-icon="inline-start" />
				)}
				Delete
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete {name}?</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={pending}
						onClick={onConfirm}
					>
						{pending ? <Spinner data-icon="inline-start" /> : null}
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

const emptyRule: EditorValues = {
	name: "",
	secondary: "0",
	firstJson: "[]",
	actions: "[]",
	active: true,
};

export function TicketRulesPage() {
	const queryClient = useQueryClient();
	const query = useQuery(orpc.listTicketRules.queryOptions());
	const [editingId, setEditingId] = useState<string | null | undefined>(
		undefined,
	);
	const selected = query.data?.find((item) => item.id === editingId);
	const close = () => setEditingId(undefined);
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: orpc.listTicketRules.key() });
	const create = useMutation(
		orpc.createTicketRule.mutationOptions({
			onSuccess: async () => {
				await refresh();
				close();
				toast.success("Rule created");
			},
		}),
	);
	const update = useMutation(
		orpc.updateTicketRule.mutationOptions({
			onSuccess: async () => {
				await refresh();
				close();
				toast.success("Rule updated");
			},
		}),
	);
	const remove = useMutation(
		orpc.deleteTicketRule.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Rule deleted");
			},
		}),
	);

	return (
		<PageContainer
			title="Ticket rules"
			description="Ordered criteria and actions applied to tickets."
			action={
				<Button onClick={() => setEditingId(null)}>
					<Plus data-icon="inline-start" />
					New rule
				</Button>
			}
		>
			{query.isPending ? (
				<PageState
					kind="loading"
					title="Loading rules"
					description="Reading ticket rules…"
				/>
			) : query.isError ? (
				<PageState
					kind="error"
					title="Rules unavailable"
					description={query.error.message}
					onRetry={() => query.refetch()}
				/>
			) : query.data.length === 0 ? (
				<PageState
					kind="empty"
					title="No ticket rules"
					description="Create the first rule to automate ticket handling."
				/>
			) : (
				<div className="grid gap-4 lg:grid-cols-2">
					{query.data.map((rule) => (
						<Card key={rule.id} className="h-full">
							<CardHeader>
								<CardTitle>{rule.name}</CardTitle>
								<CardDescription>
									Position {rule.position} · {rule.criteria.length} criteria ·{" "}
									{rule.actions.length} actions
								</CardDescription>
								<CardAction>
									<Badge variant={rule.enabled ? "default" : "secondary"}>
										{rule.enabled ? "Enabled" : "Disabled"}
									</Badge>
								</CardAction>
							</CardHeader>
							<CardFooter className="mt-auto flex gap-2">
								<Button
									size="sm"
									variant="outline"
									onClick={() => setEditingId(rule.id)}
								>
									<Pencil data-icon="inline-start" />
									Edit
								</Button>
								<DeleteButton
									name={rule.name}
									pending={remove.isPending}
									onConfirm={() => remove.mutate({ id: rule.id })}
								/>
							</CardFooter>
						</Card>
					))}
				</div>
			)}
			<AutomationEditor
				open={editingId !== undefined}
				title={selected ? "Edit ticket rule" : "New ticket rule"}
				secondaryLabel="Position"
				secondaryType="number"
				firstJsonLabel="Criteria"
				activeLabel="Enabled"
				initial={
					selected
						? {
								name: selected.name,
								secondary: String(selected.position),
								firstJson: JSON.stringify(selected.criteria, null, 2),
								actions: JSON.stringify(selected.actions, null, 2),
								active: selected.enabled,
							}
						: emptyRule
				}
				pending={create.isPending || update.isPending}
				onOpenChange={(open) => !open && close()}
				onSubmit={(values) => {
					try {
						const input = {
							name: values.name,
							position: Number(values.secondary),
							criteria: parseArray(values.firstJson, "Criteria"),
							actions: parseArray(values.actions, "Actions"),
							enabled: values.active,
						};
						selected
							? update.mutate({ id: selected.id, ...input })
							: create.mutate(input);
					} catch (error) {
						toast.error(
							error instanceof Error ? error.message : "Invalid JSON",
						);
					}
				}}
			/>
		</PageContainer>
	);
}

const emptyWorkflow: EditorValues = {
	name: "",
	secondary: "",
	firstJson: "[]",
	actions: "[]",
	active: true,
};

export function WorkflowsPage() {
	const queryClient = useQueryClient();
	const query = useQuery(orpc.listWorkflows.queryOptions());
	const deliveries = useQuery(
		orpc.listWebhookDeliveries.queryOptions({ input: { limit: 20 } }),
	);
	const [editingId, setEditingId] = useState<string | null | undefined>(
		undefined,
	);
	const selected = query.data?.find((item) => item.id === editingId);
	const close = () => setEditingId(undefined);
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: orpc.listWorkflows.key() });
	const create = useMutation(
		orpc.createWorkflow.mutationOptions({
			onSuccess: async () => {
				await refresh();
				close();
				toast.success("Workflow created");
			},
		}),
	);
	const update = useMutation(
		orpc.updateWorkflow.mutationOptions({
			onSuccess: async () => {
				await refresh();
				close();
				toast.success("Workflow updated");
			},
		}),
	);
	const remove = useMutation(
		orpc.deleteWorkflow.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Workflow deleted");
			},
		}),
	);

	return (
		<PageContainer
			title="Workflows"
			description="Event-driven conditions and actions."
			action={
				<Button onClick={() => setEditingId(null)}>
					<Plus data-icon="inline-start" />
					New workflow
				</Button>
			}
		>
			<div className="space-y-6">
				{query.isPending ? (
					<PageState
						kind="loading"
						title="Loading workflows"
						description="Reading workflows…"
					/>
				) : query.isError ? (
					<PageState
						kind="error"
						title="Workflows unavailable"
						description={query.error.message}
						onRetry={() => query.refetch()}
					/>
				) : query.data.length === 0 ? (
					<PageState
						kind="empty"
						title="No workflows"
						description="Create the first event-driven workflow."
					/>
				) : (
					<div className="grid gap-4 lg:grid-cols-2">
						{query.data.map((workflow) => (
							<Card key={workflow.id} className="h-full">
								<CardHeader>
									<CardTitle>{workflow.name}</CardTitle>
									<CardDescription>
										{workflow.triggerEvent} · {workflow.conditions.length}{" "}
										conditions · {workflow.actions.length} actions
									</CardDescription>
									<CardAction>
										<Badge
											variant={workflow.isActive ? "default" : "secondary"}
										>
											{workflow.isActive ? "Active" : "Inactive"}
										</Badge>
									</CardAction>
								</CardHeader>
								{workflow.lastRunStatus ? (
									<CardContent>
										<Badge variant="outline">
											Last run: {workflow.lastRunStatus}
										</Badge>
									</CardContent>
								) : null}
								<CardFooter className="mt-auto flex gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={() => setEditingId(workflow.id)}
									>
										<Pencil data-icon="inline-start" />
										Edit
									</Button>
									<DeleteButton
										name={workflow.name}
										pending={remove.isPending}
										onConfirm={() => remove.mutate({ id: workflow.id })}
									/>
								</CardFooter>
							</Card>
						))}
					</div>
				)}
				<Card>
					<CardHeader>
						<CardTitle>Webhook deliveries</CardTitle>
						<CardDescription>
							Latest webhook responses and failures.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						{deliveries.data?.map((delivery) => (
							<div key={delivery.id} className="rounded-md border p-3 text-sm">
								<div className="flex items-center justify-between gap-2">
									<span className="truncate font-medium">{delivery.url}</span>
									<Badge variant="outline">
										{delivery.responseStatus ?? delivery.status}
									</Badge>
								</div>
								{delivery.responseBody ? (
									<pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
										{delivery.responseBody}
									</pre>
								) : null}
								{delivery.lastError ? (
									<p className="mt-2 text-destructive">{delivery.lastError}</p>
								) : null}
							</div>
						))}
						{deliveries.data?.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No deliveries yet.
							</p>
						) : null}
					</CardContent>
				</Card>
			</div>
			<AutomationEditor
				open={editingId !== undefined}
				title={selected ? "Edit workflow" : "New workflow"}
				secondaryLabel="Trigger event"
				firstJsonLabel="Conditions"
				activeLabel="Active"
				initial={
					selected
						? {
								name: selected.name,
								secondary: selected.triggerEvent,
								firstJson: JSON.stringify(selected.conditions, null, 2),
								actions: JSON.stringify(selected.actions, null, 2),
								active: selected.isActive,
							}
						: emptyWorkflow
				}
				pending={create.isPending || update.isPending}
				onOpenChange={(open) => !open && close()}
				onSubmit={(values) => {
					try {
						const input = {
							name: values.name,
							triggerEvent: values.secondary,
							conditions: parseArray(values.firstJson, "Conditions"),
							actions: parseArray(values.actions, "Actions"),
							isActive: values.active,
						};
						selected
							? update.mutate({ id: selected.id, ...input })
							: create.mutate(input);
					} catch (error) {
						toast.error(
							error instanceof Error ? error.message : "Invalid JSON",
						);
					}
				}}
			/>
		</PageContainer>
	);
}
