import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
					className="space-y-4"
					onSubmit={(event: FormEvent<HTMLFormElement>) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						onSubmit({
							name: String(data.get("name")),
							secondary: String(data.get("secondary")),
							firstJson: String(data.get("firstJson")),
							actions: String(data.get("actions")),
							active: data.get("active") === "on",
						});
					}}
				>
					<div className="space-y-1.5">
						<Label htmlFor="automation-name">Name</Label>
						<Input
							id="automation-name"
							name="name"
							defaultValue={initial.name}
							required
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="automation-secondary">{secondaryLabel}</Label>
						<Input
							id="automation-secondary"
							name="secondary"
							type={secondaryType}
							defaultValue={initial.secondary}
							required
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="automation-first-json">{firstJsonLabel}</Label>
						<Textarea
							id="automation-first-json"
							name="firstJson"
							defaultValue={initial.firstJson}
							rows={4}
							required
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="automation-actions">Actions</Label>
						<Textarea
							id="automation-actions"
							name="actions"
							defaultValue={initial.actions}
							rows={4}
							required
						/>
					</div>
					<label className="flex items-center gap-2 text-sm">
						<input
							name="active"
							type="checkbox"
							defaultChecked={initial.active}
						/>
						{activeLabel}
					</label>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={pending}>
							{pending ? "Saving…" : "Save"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
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
					<Plus />
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
				<div className="grid gap-3 lg:grid-cols-2">
					{query.data.map((rule) => (
						<Card key={rule.id}>
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
							<CardContent className="flex gap-2">
								<Button
									size="sm"
									variant="outline"
									onClick={() => setEditingId(rule.id)}
								>
									<Pencil />
									Edit
								</Button>
								<Button
									size="sm"
									variant="destructive"
									disabled={remove.isPending}
									onClick={() =>
										window.confirm(`Delete ${rule.name}?`) &&
										remove.mutate({ id: rule.id })
									}
								>
									<Trash2 />
									Delete
								</Button>
							</CardContent>
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
					<Plus />
					New workflow
				</Button>
			}
		>
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
				<div className="grid gap-3 lg:grid-cols-2">
					{query.data.map((workflow) => (
						<Card key={workflow.id}>
							<CardHeader>
								<CardTitle>{workflow.name}</CardTitle>
								<CardDescription>
									{workflow.triggerEvent} · {workflow.conditions.length}{" "}
									conditions · {workflow.actions.length} actions
								</CardDescription>
								<CardAction>
									<Badge variant={workflow.isActive ? "default" : "secondary"}>
										{workflow.isActive ? "Active" : "Inactive"}
									</Badge>
								</CardAction>
							</CardHeader>
							<CardContent className="flex items-center gap-2">
								<Button
									size="sm"
									variant="outline"
									onClick={() => setEditingId(workflow.id)}
								>
									<Pencil />
									Edit
								</Button>
								<Button
									size="sm"
									variant="destructive"
									disabled={remove.isPending}
									onClick={() =>
										window.confirm(`Delete ${workflow.name}?`) &&
										remove.mutate({ id: workflow.id })
									}
								>
									<Trash2 />
									Delete
								</Button>
								{workflow.lastRunStatus ? (
									<Badge variant="outline">
										Last run: {workflow.lastRunStatus}
									</Badge>
								) : null}
							</CardContent>
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
				<CardContent className="space-y-3">
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
						<p className="text-muted-foreground text-sm">No deliveries yet.</p>
					) : null}
				</CardContent>
			</Card>
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
