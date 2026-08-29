import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	CheckCircle2,
	RotateCcw,
	UserRoundCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";
import type {
	TicketActionInput,
	TicketDetail,
	TicketOperatorAction,
	TicketOperatorActionInput,
	TicketRoute,
} from "../api/types";
import { allowedActions } from "./allowed-actions";
import { TicketClassificationForm } from "./ticket-classification-form";

type ActionInput = TicketOperatorActionInput;
type Route = TicketRoute;
const routes = [
	"unassigned",
	"infrastructure",
	"device",
	"application",
	"identity",
	"human_triage",
] satisfies Route[];
const resolutionCodes = [
	["fixed", "Fixed"],
	["workaround", "Workaround"],
	["not_reproducible", "Not reproducible"],
	["duplicate", "Duplicate"],
	["no_action_required", "No action required"],
	["rejected", "Rejected"],
] as const;

export function TicketActions({
	ticket,
	capabilities,
	pending,
	onAction,
}: {
	ticket: TicketDetail;
	capabilities: readonly string[];
	pending: boolean;
	onAction: (input: ActionInput) => Promise<unknown>;
}) {
	const actions = allowedActions(ticket, capabilities);
	const has = useCallback(
		(action: TicketOperatorAction) => actions.includes(action),
		[actions],
	);
	const canAssign = has("assign");
	const canReclassify = has("reclassify");
	const canPend = has("pend");
	const canUnpend = has("unpend");
	const [classificationOpen, setClassificationOpen] = useState(false);
	const pendingReasons = useQuery(orpc.listPendingReasons.queryOptions());

	useEffect(() => {
		const target = window.location.hash.slice(1);
		if (target === "operator-resolve" && has("resolve"))
			document.getElementById(target)?.focus();
		else if (target === "operator-reclassify" && canReclassify)
			setClassificationOpen(true);
		else if (target === "operator-assign" && canAssign)
			document.getElementById(target)?.focus();
	}, [canAssign, canReclassify, has]);

	return (
		<section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
			<h2 className="font-semibold text-xs uppercase tracking-wider">
				Operator actions
			</h2>
			{has("resolve") && (
				<NoteForm
					action="resolve"
					label="Resolution note"
					button="Resolve ticket"
					maxLength={10_000}
					pending={pending}
					onAction={onAction}
				/>
			)}
			{has("close") && (
				<SimpleAction
					action="close"
					label="Close ticket"
					icon={<CheckCircle2 />}
					pending={pending}
					onAction={onAction}
				/>
			)}
			{has("escalate") && (
				<EscalateForm pending={pending} onAction={onAction} />
			)}
			{canPend && pendingReasons.data?.length ? (
				<Select
					value=""
					onValueChange={(reasonId) => {
						if (reasonId) void onAction({ action: "pend", reasonId });
					}}
				>
					<SelectTrigger disabled={pending}>
						<SelectValue placeholder="Put on hold" />
					</SelectTrigger>
					<SelectContent>
						{pendingReasons.data.map((reason) => (
							<SelectItem key={reason.id} value={reason.id}>
								{reason.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : null}
			{canUnpend ? (
				<Button
					type="button"
					variant="outline"
					disabled={pending}
					onClick={() => void onAction({ action: "unpend" })}
				>
					Resume ticket
				</Button>
			) : null}
			{has("assign") && (
				<AssignForm ticket={ticket} pending={pending} onAction={onAction} />
			)}
			{has("reopen") && (
				<SimpleAction
					action="reopen"
					label="Reopen ticket"
					icon={<RotateCcw />}
					pending={pending}
					onAction={onAction}
				/>
			)}
			{has("reclassify") && (
				<Sheet open={classificationOpen} onOpenChange={setClassificationOpen}>
					<Button
						id="operator-reclassify"
						type="button"
						variant="outline"
						className="w-full"
						disabled={pending}
						onClick={() => setClassificationOpen(true)}
					>
						Reclassify
					</Button>
					<SheetContent className="w-full sm:max-w-md">
						<SheetHeader className="border-b pr-12">
							<SheetTitle>Reclassify ticket</SheetTitle>
							<SheetDescription>
								Priority is derived from impact and urgency.
							</SheetDescription>
						</SheetHeader>
						<TicketClassificationForm
							ticket={ticket}
							disabled={pending}
							onSubmit={async (input) => {
								await onAction(input);
								setClassificationOpen(false);
							}}
						/>
					</SheetContent>
				</Sheet>
			)}
		</section>
	);
}

function NoteForm({
	action,
	label,
	button,
	maxLength,
	pending,
	onAction,
}: {
	action: "resolve";
	label: string;
	button: string;
	maxLength: number;
	pending: boolean;
	onAction: (input: ActionInput) => Promise<unknown>;
}) {
	const form = useForm({
		defaultValues: { note: "", resolutionCode: "fixed" as const },
		onSubmit: ({ value }) =>
			onAction({
				action,
				resolution: value.note.trim(),
				resolutionCode: value.resolutionCode,
			}),
		validators: {
			onSubmit: ({ value }) =>
				value.note.trim() ? undefined : `${label} is required`,
		},
	});
	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
		>
			<form.Field name="resolutionCode">
				{(field) => (
					<Field>
						<FieldLabel htmlFor="ticket-resolution-code">
							Resolution code
						</FieldLabel>
						<Select
							value={field.state.value}
							onValueChange={(value) =>
								field.handleChange(value as typeof field.state.value)
							}
							disabled={pending}
						>
							<SelectTrigger id="operator-resolve" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{resolutionCodes.map(([value, text]) => (
									<SelectItem key={value} value={value}>
										{text}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>
			<form.Field
				name="note"
				validators={{
					onChange: ({ value }) =>
						value.trim() ? undefined : `${label} is required`,
					onSubmit: ({ value }) =>
						value.trim() ? undefined : `${label} is required`,
				}}
			>
				{(field) => (
					<Field data-invalid={field.state.meta.errors.length > 0}>
						<FieldLabel htmlFor={`ticket-${action}`}>{label}</FieldLabel>
						<Textarea
							id={`ticket-${action}`}
							aria-invalid={field.state.meta.errors.length > 0}
							maxLength={maxLength}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							disabled={pending}
						/>
						<FieldError>
							{field.state.meta.errors.map(String).join(", ")}
						</FieldError>
					</Field>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => state.canSubmit}>
				{(canSubmit) => (
					<Button
						type="submit"
						className="w-full"
						disabled={pending || !canSubmit}
					>
						<CheckCircle2 /> {button}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}

function EscalateForm({
	pending,
	onAction,
}: {
	pending: boolean;
	onAction: (input: ActionInput) => Promise<unknown>;
}) {
	const [confirmation, setConfirmation] = useState<
		TicketActionInput<"escalate"> | undefined
	>();
	const form = useForm({
		defaultValues: { note: "", route: "human_triage" as Route },
		onSubmit: ({ value }) =>
			setConfirmation({
				action: "escalate",
				note: value.note.trim(),
				route: value.route,
			}),
		validators: {
			onSubmit: ({ value }) =>
				value.note.trim() ? undefined : "Escalation reason is required",
		},
	});
	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
		>
			<form.Field
				name="note"
				validators={{
					onChange: ({ value }) =>
						value.trim() ? undefined : "Escalation reason is required",
					onSubmit: ({ value }) =>
						value.trim() ? undefined : "Escalation reason is required",
				}}
			>
				{(field) => (
					<Field data-invalid={field.state.meta.errors.length > 0}>
						<FieldLabel htmlFor="ticket-escalation-note">
							Escalation reason
						</FieldLabel>
						<Textarea
							id="ticket-escalation-note"
							aria-invalid={field.state.meta.errors.length > 0}
							maxLength={2_000}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							disabled={pending}
						/>
						<FieldError>
							{field.state.meta.errors.map(String).join(", ")}
						</FieldError>
					</Field>
				)}
			</form.Field>
			<form.Field name="route">
				{(field) => (
					<Field>
						<FieldLabel htmlFor="ticket-escalation-route">
							Escalation route
						</FieldLabel>
						<RouteSelect
							id="ticket-escalation-route"
							value={field.state.value}
							disabled={pending}
							onChange={field.handleChange}
						/>
					</Field>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => state.canSubmit}>
				{(canSubmit) => (
					<Button
						type="submit"
						variant="destructive"
						className="w-full"
						disabled={pending || !canSubmit}
					>
						<AlertTriangle /> Escalate
					</Button>
				)}
			</form.Subscribe>
			<ConfirmationDialog
				open={confirmation !== undefined}
				title="Escalate this ticket?"
				description="This hands the ticket to the selected route and records the escalation reason."
				confirmLabel="Escalate"
				destructive
				pending={pending}
				onOpenChange={(open) => !open && setConfirmation(undefined)}
				onConfirm={async () => {
					if (!confirmation) return;
					await onAction(confirmation);
					setConfirmation(undefined);
				}}
			/>
		</form>
	);
}

function AssignForm({
	ticket,
	pending,
	onAction,
}: {
	ticket: TicketDetail;
	pending: boolean;
	onAction: (input: ActionInput) => Promise<unknown>;
}) {
	const options = useQuery(orpc.listTicketAssignmentOptions.queryOptions());
	const form = useForm({
		defaultValues: {
			route: (ticket.route ?? "unassigned") as Route,
			assigneeId: ticket.assigneeId ?? "none",
			ownerId: ticket.ownerId ?? "none",
			teamId: ticket.teamId ?? "none",
		},
		onSubmit: ({ value }) =>
			onAction({
				action: "assign",
				route: value.route,
				assigneeId: value.assigneeId === "none" ? null : value.assigneeId,
				ownerId: value.ownerId === "none" ? null : value.ownerId,
				teamId: value.teamId === "none" ? null : value.teamId,
			}),
	});
	return (
		<form
			id="operator-assign"
			tabIndex={-1}
			className="space-y-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
		>
			<form.Field name="route">
				{(field) => (
					<Field>
						<FieldLabel htmlFor="ticket-assignment-route">
							Assignment route
						</FieldLabel>
						<RouteSelect
							id="ticket-assignment-route"
							value={field.state.value}
							disabled={pending}
							onChange={field.handleChange}
						/>
					</Field>
				)}
			</form.Field>
			{(["assigneeId", "ownerId", "teamId"] as const).map((name) => (
				<form.Field key={name} name={name}>
					{(field) => (
						<Field>
							<FieldLabel>
								{name === "teamId"
									? "Team"
									: name === "ownerId"
										? "Owner"
										: "Assignee"}
							</FieldLabel>
							<Select
								value={field.state.value}
								onValueChange={(value) => value && field.handleChange(value)}
								disabled={pending || options.isPending}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Unassigned</SelectItem>
									{(name === "teamId"
										? options.data?.teams
										: options.data?.users
									)?.map((option) => (
										<SelectItem key={option.id} value={option.id}>
											{option.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
				</form.Field>
			))}
			<Button
				type="submit"
				variant="outline"
				className="w-full"
				disabled={pending || options.isPending}
			>
				<UserRoundCheck /> Assign
			</Button>
		</form>
	);
}

function RouteSelect({
	id,
	value,
	disabled,
	onChange,
}: {
	id: string;
	value: Route;
	disabled: boolean;
	onChange: (route: Route) => void;
}) {
	return (
		<Select
			value={value}
			onValueChange={(next) => next && onChange(next as Route)}
			disabled={disabled}
		>
			<SelectTrigger id={id} className="w-full">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{routes.map((route) => (
					<SelectItem key={route} value={route}>
						{route.replaceAll("_", " ")}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function SimpleAction({
	action,
	label,
	icon,
	pending,
	onAction,
}: {
	action: "close" | "reopen";
	label: string;
	icon: React.ReactNode;
	pending: boolean;
	onAction: (input: ActionInput) => Promise<unknown>;
}) {
	if (action === "reopen")
		return (
			<Button
				type="button"
				className="w-full"
				disabled={pending}
				onClick={() => onAction({ action })}
			>
				{icon} {label}
			</Button>
		);
	return (
		<AlertDialog>
			<AlertDialogTrigger
				render={<Button type="button" className="w-full" disabled={pending} />}
			>
				{icon} {label}
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Close this ticket?</AlertDialogTitle>
					<AlertDialogDescription>
						The ticket will leave the active queue. It can only be reopened
						once, within seven days.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={pending}
						onClick={() => onAction({ action })}
					>
						Close ticket
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function ConfirmationDialog({
	open,
	title,
	description,
	confirmLabel,
	destructive,
	pending,
	onOpenChange,
	onConfirm,
}: {
	open: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	destructive?: boolean;
	pending: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
}) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant={destructive ? "destructive" : "default"}
						disabled={pending}
						onClick={onConfirm}
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
