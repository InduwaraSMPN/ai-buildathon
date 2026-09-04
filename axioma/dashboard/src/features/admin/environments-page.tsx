import {
	RiEditLine as Pencil,
	RiAddLine as Plus,
	RiDeleteBinLine as Trash,
} from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { formatDate, PageState } from "@/components/support-ui";
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
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
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
import { client, orpc } from "@/utils/orpc";

type Environment = Awaited<ReturnType<typeof client.listEnvironments>>[number];
type EnvironmentInput = Parameters<typeof client.createEnvironment>[0];
type UpdateEnvironmentInput = Parameters<typeof client.updateEnvironment>[0];

const CONNECTION_TYPES = ["in_cluster", "kubeconfig"] as const;
const MODES = ["act", "shadow"] as const;

type FormState = {
	id?: string;
	key: string;
	label: string;
	connectionType: Environment["connectionType"];
	contextName: string;
	mode: Environment["mode"];
	isDefault: boolean;
	credential: string;
};

const emptyForm: FormState = {
	key: "",
	label: "",
	connectionType: "in_cluster",
	contextName: "",
	mode: "act",
	isDefault: false,
	credential: "",
};

export function EnvironmentsPage() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [formError, setFormError] = useState<string | null>(null);
	// The shared key, not a private one: the connector and route editors read the
	// same environments, and a hand-rolled key left their dropdowns offering an
	// environment this page had just deleted.
	const environments = useQuery(orpc.listEnvironments.queryOptions({}));
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: orpc.listEnvironments.key() });

	const createMutation = useMutation({
		mutationFn: (input: EnvironmentInput) => client.createEnvironment(input),
		onSuccess: () => {
			setDialogOpen(false);
			toast.success("Environment created");
			void refresh();
		},
		onError: (error) => toast.error(error.message),
	});
	const updateMutation = useMutation({
		mutationFn: (input: UpdateEnvironmentInput) =>
			client.updateEnvironment(input),
		onSuccess: () => {
			setDialogOpen(false);
			toast.success("Environment updated");
			void refresh();
		},
		onError: (error) => toast.error(error.message),
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => client.deleteEnvironment({ id }),
		onSuccess: () => {
			toast.success("Environment deleted");
			void refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	if (environments.isPending)
		return (
			<PageContainer title="Environments">
				<PageState
					kind="loading"
					title="Loading environments"
					description="Retrieving run-time environments…"
				/>
			</PageContainer>
		);
	if (environments.isError)
		return (
			<PageContainer title="Environments">
				<PageState
					kind="error"
					title="Environments unavailable"
					description={environments.error.message}
					onRetry={() => environments.refetch()}
				/>
			</PageContainer>
		);

	const rows = environments.data ?? [];
	const submitting = createMutation.isPending || updateMutation.isPending;

	const openCreate = () => {
		setForm(emptyForm);
		setFormError(null);
		setDialogOpen(true);
	};
	const openEdit = (environment: Environment) => {
		setForm({
			id: environment.id,
			key: environment.key,
			label: environment.label,
			connectionType: environment.connectionType,
			contextName: environment.contextName ?? "",
			mode: environment.mode,
			isDefault: environment.isDefault,
			credential: "",
		});
		setFormError(null);
		setDialogOpen(true);
	};

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		const key = form.key.trim();
		const label = form.label.trim();
		if (!key || !label) {
			setFormError("Key and label are required.");
			return;
		}
		setFormError(null);
		const input = {
			key,
			label,
			connectionType: form.connectionType,
			contextName: form.contextName.trim() || null,
			mode: form.mode,
			isDefault: form.isDefault,
			credential: form.credential.trim() || undefined,
		};
		if (form.id) updateMutation.mutate({ ...input, id: form.id });
		else createMutation.mutate(input);
	};

	return (
		<PageContainer
			title="Environments"
			description="Manage the run-time environments Axel may act against."
			action={
				<Button onClick={openCreate}>
					<Plus data-icon="inline-start" aria-hidden="true" />
					New environment
				</Button>
			}
		>
			<Card>
				<CardContent className="px-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Key</TableHead>
								<TableHead>Label</TableHead>
								<TableHead>Connection</TableHead>
								<TableHead>Mode</TableHead>
								<TableHead>Default</TableHead>
								<TableHead>Updated</TableHead>
								<TableHead aria-label="Actions" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((environment) => (
								<TableRow key={environment.id}>
									<TableCell>
										<span className="font-mono text-xs">{environment.key}</span>
									</TableCell>
									<TableCell>
										{environment.label}
										{environment.contextName && (
											<div className="text-muted-foreground text-xs">
												{environment.contextName}
											</div>
										)}
									</TableCell>
									<TableCell>
										<Badge variant="outline">
											{labelize(environment.connectionType)}
										</Badge>
									</TableCell>
									<TableCell>{labelize(environment.mode)}</TableCell>
									<TableCell>
										{environment.isDefault ? (
											<Badge tone="info">Default</Badge>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</TableCell>
									<TableCell>
										<time className="text-xs tabular-nums">
											{formatDate(environment.updatedAt)}
										</time>
									</TableCell>
									<TableCell>
										<div className="flex items-center justify-end gap-1">
											<Button
												size="sm"
												variant="ghost"
												aria-label={`Edit ${environment.key}`}
												onClick={() => openEdit(environment)}
											>
												<Pencil aria-hidden="true" />
											</Button>
											<DeleteButton
												label={environment.label}
												pending={deleteMutation.isPending}
												onConfirm={() => deleteMutation.mutate(environment.id)}
											/>
										</div>
									</TableCell>
								</TableRow>
							))}
							{rows.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={7}
										className="text-center text-muted-foreground"
									>
										No environments defined.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<form onSubmit={submit} noValidate>
						<DialogHeader>
							<DialogTitle>
								{form.id ? "Edit environment" : "New environment"}
							</DialogTitle>
							<DialogDescription>
								Define a Kubernetes environment Axel may run against.
								Credentials are stored encrypted and never returned.
							</DialogDescription>
						</DialogHeader>
						<FieldGroup className="mt-4">
							<div className="grid gap-5 sm:grid-cols-2">
								<Field>
									<FieldLabel htmlFor="environment-key">Key</FieldLabel>
									<Input
										id="environment-key"
										value={form.key}
										onChange={(event) =>
											setForm({ ...form, key: event.target.value })
										}
										required
										autoFocus={!form.id}
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="environment-label">Label</FieldLabel>
									<Input
										id="environment-label"
										value={form.label}
										onChange={(event) =>
											setForm({ ...form, label: event.target.value })
										}
										required
									/>
								</Field>
							</div>
							<div className="grid gap-5 sm:grid-cols-2">
								<Field>
									<FieldLabel htmlFor="environment-connection">
										Connection
									</FieldLabel>
									<NativeSelect
										id="environment-connection"
										value={form.connectionType}
										onChange={(event) =>
											setForm({
												...form,
												connectionType: event.target
													.value as Environment["connectionType"],
											})
										}
									>
										{CONNECTION_TYPES.map((type) => (
											<NativeSelectOption key={type} value={type}>
												{labelize(type)}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Field>
								<Field>
									<FieldLabel htmlFor="environment-mode">Mode</FieldLabel>
									<NativeSelect
										id="environment-mode"
										value={form.mode}
										onChange={(event) =>
											setForm({
												...form,
												mode: event.target.value as Environment["mode"],
											})
										}
									>
										{MODES.map((mode) => (
											<NativeSelectOption key={mode} value={mode}>
												{labelize(mode)}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Field>
							</div>
							<Field>
								<FieldLabel htmlFor="environment-context">
									Context name
								</FieldLabel>
								<Input
									id="environment-context"
									value={form.contextName}
									onChange={(event) =>
										setForm({ ...form, contextName: event.target.value })
									}
									placeholder="kube-context when a kubeconfig is used"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="environment-credential">
									Credential
								</FieldLabel>
								<Input
									id="environment-credential"
									type="password"
									value={form.credential}
									onChange={(event) =>
										setForm({ ...form, credential: event.target.value })
									}
									autoComplete="new-password"
									placeholder={
										form.id
											? "Leave blank to keep the existing credential"
											: "kubeconfig or token (optional)"
									}
								/>
							</Field>
							<Field
								orientation="horizontal"
								className="items-center gap-2 text-sm"
							>
								<Checkbox
									id="environment-default"
									name="isDefault"
									value="true"
									checked={form.isDefault}
									onCheckedChange={(checked) =>
										setForm({ ...form, isDefault: checked === true })
									}
								/>
								<FieldLabel htmlFor="environment-default">
									Use as the default fallback environment
								</FieldLabel>
							</Field>
							{formError && <FieldError>{formError}</FieldError>}
						</FieldGroup>
						<DialogFooter className="mt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => setDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={submitting}>
								{submitting
									? "Saving…"
									: form.id
										? "Save changes"
										: "Create environment"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</PageContainer>
	);
}

function DeleteButton({
	label,
	pending,
	onConfirm,
}: {
	label: string;
	pending: boolean;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger
				render={
					<Button
						size="sm"
						variant="ghost"
						aria-label={`Delete ${label}`}
						disabled={pending}
					/>
				}
			>
				<Trash aria-hidden="true" />
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete environment?</AlertDialogTitle>
					<AlertDialogDescription>
						Delete {label}? Run-time links that reference it will be removed.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={onConfirm}
						disabled={pending}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function labelize(value: string) {
	return value.replaceAll("_", " ");
}
