import { useForm } from "@tanstack/react-form";
import {
	AlertTriangle,
	CheckCircle2,
	RotateCcw,
	UserRoundCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
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

export function TicketActions({
	ticket,
	pending,
	onAction,
}: {
	ticket: TicketDetail;
	pending: boolean;
	onAction: (input: ActionInput) => Promise<unknown>;
}) {
	const actions = allowedActions(ticket);
	const has = (action: TicketOperatorAction) => actions.includes(action);
	const canAssign = has("assign");
	const canReclassify = has("reclassify");
	const [classificationOpen, setClassificationOpen] = useState(false);

	useEffect(() => {
		const target = window.location.hash.slice(1);
		if (target === "operator-reclassify" && canReclassify)
			setClassificationOpen(true);
		else if (target === "operator-assign" && canAssign)
			document.getElementById(target)?.focus();
	}, [canAssign, canReclassify]);

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
			{has("assign") && (
				<AssignForm
					route={ticket.route ?? "unassigned"}
					pending={pending}
					onAction={onAction}
				/>
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
		defaultValues: { note: "" },
		onSubmit: ({ value }) =>
			onAction({ action, resolution: value.note.trim() }),
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
	route,
	pending,
	onAction,
}: {
	route: Route;
	pending: boolean;
	onAction: (input: ActionInput) => Promise<unknown>;
}) {
	const form = useForm({
		defaultValues: { route },
		onSubmit: ({ value }) => onAction({ action: "assign", route: value.route }),
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
			<Button
				type="submit"
				variant="outline"
				className="w-full"
				disabled={pending}
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
