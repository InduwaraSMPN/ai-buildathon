import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Info, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
	affectedPeopleOptions,
	affectedPeopleValues,
	requestTypeOptions,
	requestTypeValues,
	timingOptions,
	timingValues,
} from "@/features/tickets/copy";
import { orpc, queryClient } from "@/utils/orpc";

const requestSchema = z.object({
	title: z
		.string()
		.trim()
		.min(3, "Please add a short summary so we know what you need.")
		.max(160, "Please keep the summary to 160 characters or fewer."),
	body: z
		.string()
		.trim()
		.min(10, "Please add a few more details so we can help.")
		.max(10_000, "Please shorten the details to 10,000 characters or fewer."),
	requestType: z.enum(["not_working", "setup"]),
	affectedPeople: z.enum(["me", "team", "company"]),
	timing: z.enum(["whenever", "today", "blocked"]),
	deviceId: z.string(),
});

type RequestValues = z.input<typeof requestSchema>;
type Option = { value: string; label: string };

function Question({
	legend,
	name,
	value,
	options,
	onChange,
}: {
	legend: string;
	name: string;
	value: string;
	options: readonly Option[];
	onChange: (value: string) => void;
}) {
	return (
		<fieldset className="space-y-3">
			<legend className="font-medium text-sm">{legend}</legend>
			<RadioGroup
				value={value}
				onValueChange={onChange}
				className="gap-3 sm:grid-cols-3"
			>
				{options.map((option) => (
					<Label
						key={option.value}
						htmlFor={`${name}-${option.value}`}
						className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border p-3 font-normal has-[[data-checked]]:border-primary has-[[data-checked]]:bg-muted/50"
					>
						<RadioGroupItem
							id={`${name}-${option.value}`}
							value={option.value}
						/>
						<span>{option.label}</span>
					</Label>
				))}
			</RadioGroup>
		</fieldset>
	);
}

function FieldError({
	errors,
}: {
	errors: Array<{ message?: string } | undefined>;
}) {
	const message = errors[0]?.message;
	return message ? (
		<p className="text-destructive text-sm" role="alert">
			{message}
		</p>
	) : null;
}

function lastSeen(date: Date) {
	return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
		-Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000)),
		"minute",
	);
}

export function RequestForm() {
	const navigate = useNavigate();
	const devices = useQuery(orpc.listMyDevices.queryOptions());
	const createTicket = useMutation(
		orpc.createTicket.mutationOptions({
			onSuccess: async (ticket) => {
				await queryClient.invalidateQueries({
					queryKey: orpc.listTickets.key(),
				});
				toast.success("Request sent");
				await navigate({
					to: "/tickets/$ticketId",
					params: { ticketId: ticket.id },
				});
			},
			onError: () =>
				toast.error("We couldn’t send your request. Please try again."),
		}),
	);
	const form = useForm({
		defaultValues: {
			title: "",
			body: "",
			requestType: "not_working",
			affectedPeople: "me",
			timing: "today",
			deviceId: "",
		} as RequestValues,
		validators: { onSubmit: requestSchema },
		onSubmit: ({ value }) =>
			createTicket.mutateAsync({
				title: value.title.trim(),
				body: value.body.trim(),
				recordType: requestTypeValues[value.requestType],
				impact: affectedPeopleValues[value.affectedPeople],
				urgency: timingValues[value.timing],
				...(value.deviceId ? { deviceId: value.deviceId } : {}),
			}),
	});

	return (
		<form
			className="space-y-7"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="title">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>Short summary</Label>
						<Input
							id={field.name}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							maxLength={160}
							placeholder="Example: I can’t connect to the office Wi-Fi"
							className="h-10 rounded-md text-sm"
							aria-invalid={field.state.meta.errors.length > 0}
						/>
						<FieldError errors={field.state.meta.errors} />
					</div>
				)}
			</form.Field>

			<form.Field name="body">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>What’s happening?</Label>
						<Textarea
							id={field.name}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							maxLength={10_000}
							placeholder="Tell us what you expected, what happened instead, and when it started."
							className="min-h-40 rounded-md text-sm"
							aria-invalid={field.state.meta.errors.length > 0}
						/>
						<FieldError errors={field.state.meta.errors} />
					</div>
				)}
			</form.Field>

			<Alert className="rounded-md">
				<Info aria-hidden="true" />
				<AlertTitle>Keep sensitive information private</AlertTitle>
				<AlertDescription>
					Please don’t include passwords, access codes, or other sensitive
					information.
				</AlertDescription>
			</Alert>

			<form.Field name="requestType">
				{(field) => (
					<Question
						legend="What kind of help do you need?"
						name={field.name}
						value={field.state.value}
						options={requestTypeOptions}
						onChange={(value) =>
							field.handleChange(value as typeof field.state.value)
						}
					/>
				)}
			</form.Field>
			<form.Field name="affectedPeople">
				{(field) => (
					<Question
						legend="Who else is affected?"
						name={field.name}
						value={field.state.value}
						options={affectedPeopleOptions}
						onChange={(value) =>
							field.handleChange(value as typeof field.state.value)
						}
					/>
				)}
			</form.Field>
			<form.Field name="timing">
				{(field) => (
					<Question
						legend="How soon do you need this?"
						name={field.name}
						value={field.state.value}
						options={timingOptions}
						onChange={(value) =>
							field.handleChange(value as typeof field.state.value)
						}
					/>
				)}
			</form.Field>

			{devices.isPending ? (
				<p className="text-muted-foreground text-sm" role="status">
					Checking for your computers…
				</p>
			) : null}
			{devices.isError ? (
				<div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
					<span>We couldn’t check your computers right now.</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => devices.refetch()}
					>
						Try again
					</Button>
				</div>
			) : null}
			{devices.data?.length ? (
				<form.Field name="deviceId">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor={field.name}>
								Is this about one of your computers?
							</Label>
							<select
								id={field.name}
								name={field.name}
								value={field.state.value}
								onChange={(event) => field.handleChange(event.target.value)}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
							>
								<option value="">Use my most recently seen computer</option>
								{devices.data.map((device) => (
									<option key={device.id} value={device.id}>
										{device.hostname}, last seen {lastSeen(device.lastSeenAt)}
									</option>
								))}
							</select>
						</div>
					)}
				</form.Field>
			) : null}

			<div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
				<Link
					to="/home"
					className={buttonVariants({ variant: "outline", size: "lg" })}
				>
					Cancel
				</Link>
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button
							type="submit"
							size="lg"
							disabled={!canSubmit || isSubmitting}
						>
							<Send aria-hidden="true" />{" "}
							{isSubmitting ? "Sending…" : "Send request"}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}
