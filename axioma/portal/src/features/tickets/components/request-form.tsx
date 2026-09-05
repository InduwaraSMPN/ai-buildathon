import { RiInformationLine, RiSendPlane2Line } from "@remixicon/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { timeAgo } from "@/components/ticket-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { CatalogueField } from "@/features/request-catalogue/components/catalogue-field";
import type { RequestFormValues } from "@/features/request-catalogue/types";
import {
	affectedPeopleOptions,
	affectedPeopleValues,
	requestFormCopy,
	requestTypeOptions,
	timingOptions,
	timingValues,
} from "@/features/tickets/copy";
import { orpc, queryClient } from "@/utils/orpc";
import type { IncidentValues } from "../form-schema";
import {
	catalogueFields,
	incidentSchema,
	requestDetailsSchema,
} from "../form-schema";
import {
	activeCatalogueFieldKeys,
	serializeCatalogueValues,
} from "./catalogue-form-values";
import { DynamicFields, serializeDynamicFields } from "./dynamic-fields";
import { Question } from "./question-field";

const impactToAffected: Record<string, "me" | "team" | "company"> = {
	low: "me",
	medium: "team",
	high: "company",
};
const urgencyToTiming: Record<string, "whenever" | "today" | "blocked"> = {
	low: "whenever",
	medium: "today",
	high: "blocked",
};

export type RequestFormInitialValues = {
	title?: string;
	body?: string;
	impact?: string;
	urgency?: string;
	deviceId?: string;
	customFields?: Record<string, unknown>;
	subcategoryId?: string;
	catalogueValues?: Record<string, unknown>;
};

function PrivacyNotice() {
	return (
		<Alert className="rounded-md">
			<RiInformationLine aria-hidden="true" />
			<AlertTitle>{requestFormCopy.privacyTitle}</AlertTitle>
			<AlertDescription>{requestFormCopy.privacyDescription}</AlertDescription>
		</Alert>
	);
}

function IncidentRequestForm({
	onSetup,
	initialValues,
}: {
	onSetup: () => void;
	initialValues?: RequestFormInitialValues;
}) {
	const navigate = useNavigate();
	const idempotencyKey = useRef(crypto.randomUUID());
	const devices = useQuery(orpc.listMyDevices.queryOptions());
	const fieldDefinitions = useQuery(
		orpc.listTicketFieldDefinitions.queryOptions(),
	);
	const createTicket = useMutation(
		orpc.createTicket.mutationOptions({
			onSuccess: async (ticket) => {
				idempotencyKey.current = crypto.randomUUID();
				await queryClient.invalidateQueries({
					queryKey: orpc.listTickets.key(),
				});
				toast.success(requestFormCopy.sent);
				await navigate({
					to: "/tickets/$ticketId",
					params: { ticketId: ticket.id },
				});
			},
			onError: () => toast.error(requestFormCopy.sendError),
		}),
	);
	const form = useForm({
		defaultValues: {
			title: initialValues?.title ?? "",
			body: initialValues?.body ?? "",
			affectedPeople: initialValues?.impact
				? (impactToAffected[initialValues.impact] ?? "me")
				: "me",
			timing: initialValues?.urgency
				? (urgencyToTiming[initialValues.urgency] ?? "today")
				: "today",
			deviceId: initialValues?.deviceId ?? "",
			customFields: (initialValues?.customFields ?? {}) as Record<
				string,
				unknown
			>,
		} as IncidentValues,
		validators: { onSubmit: incidentSchema },
		onSubmit: ({ value }) =>
			createTicket.mutateAsync({
				idempotencyKey: idempotencyKey.current,
				title: value.title.trim(),
				body: value.body.trim(),
				recordType: "incident",
				impact: affectedPeopleValues[value.affectedPeople],
				urgency: timingValues[value.timing],
				...(value.deviceId ? { deviceId: value.deviceId } : {}),
				customFields: serializeDynamicFields(
					fieldDefinitions.data ?? [],
					value.customFields,
				),
			}),
	});

	return (
		<form
			className="space-y-7"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit().catch(() => undefined);
			}}
		>
			<FieldGroup>
				<form.Field name="title">
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor={field.name}>
								{requestFormCopy.summaryLabel}
							</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								maxLength={160}
								placeholder={requestFormCopy.incidentSummaryPlaceholder}
								aria-invalid={field.state.meta.errors.length > 0}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>

				<form.Field name="body">
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor={field.name}>
								{requestFormCopy.incidentDetailsLabel}
							</FieldLabel>
							<Textarea
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								maxLength={10_000}
								placeholder={requestFormCopy.incidentDetailsPlaceholder}
								className="min-h-40"
								aria-invalid={field.state.meta.errors.length > 0}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>

				<PrivacyNotice />
				<Question
					legend={requestFormCopy.requestTypeLegend}
					name="requestType"
					value="not_working"
					options={requestTypeOptions}
					onChange={(value) => value === "setup" && onSetup()}
				/>
				<form.Field name="affectedPeople">
					{(field) => (
						<Question
							legend={requestFormCopy.affectedPeopleLegend}
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
							legend={requestFormCopy.timingLegend}
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
						{requestFormCopy.devicesLoading}
					</p>
				) : null}
				{devices.isError ? (
					<div
						className="flex flex-wrap items-center gap-3 text-sm"
						role="alert"
					>
						<span>{requestFormCopy.devicesError}</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => devices.refetch()}
						>
							{requestFormCopy.tryAgain}
						</Button>
					</div>
				) : null}
				{fieldDefinitions.isPending ? (
					<p className="text-muted-foreground text-sm" role="status">
						{requestFormCopy.extraDetailsLoading}
					</p>
				) : null}
				{fieldDefinitions.isError ? (
					<div
						className="flex flex-wrap items-center gap-3 text-sm"
						role="alert"
					>
						<span>{requestFormCopy.extraDetailsError}</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => fieldDefinitions.refetch()}
						>
							{requestFormCopy.tryAgain}
						</Button>
					</div>
				) : null}
				{fieldDefinitions.data?.length ? (
					<form.Field name="customFields">
						{(field) => (
							<div className="space-y-5">
								<DynamicFields
									definitions={fieldDefinitions.data}
									values={field.state.value}
									onChange={field.handleChange}
								/>
							</div>
						)}
					</form.Field>
				) : null}

				{devices.data?.length ? (
					<form.Field name="deviceId">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>
									{requestFormCopy.deviceLabel}
								</FieldLabel>
								<Select
									name={field.name}
									value={field.state.value || null}
									onValueChange={(value) => field.handleChange(value ?? "")}
								>
									<SelectTrigger id={field.name} className="w-full">
										<SelectValue placeholder={requestFormCopy.recentDevice} />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{devices.data.map((device) => (
												<SelectItem key={device.id} value={device.id}>
													{device.hostname}, {requestFormCopy.lastSeen}{" "}
													{timeAgo(device.lastSeenAt)}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</Field>
						)}
					</form.Field>
				) : null}

				<div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
					<Link
						to="/my-requests"
						className={buttonVariants({ variant: "outline", size: "lg" })}
					>
						{requestFormCopy.cancel}
					</Link>
					<form.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
							title: state.values.title,
							body: state.values.body,
						})}
					>
						{({ canSubmit, isSubmitting, title, body }) => (
							<Button
								type="submit"
								size="lg"
								disabled={
									!canSubmit ||
									title.trim().length < 3 ||
									title.trim().length > 160 ||
									body.trim().length < 10 ||
									body.trim().length > 10_000 ||
									isSubmitting ||
									createTicket.isPending
								}
							>
								{isSubmitting || createTicket.isPending ? (
									<Spinner data-icon="inline-start" />
								) : (
									<RiSendPlane2Line
										aria-hidden="true"
										data-icon="inline-start"
									/>
								)}
								{isSubmitting || createTicket.isPending
									? requestFormCopy.sending
									: requestFormCopy.send}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</FieldGroup>
		</form>
	);
}

function CatalogueRequestForm({
	onIncident,
	initialValues,
}: {
	onIncident: () => void;
	initialValues?: RequestFormInitialValues;
}) {
	const navigate = useNavigate();
	const idempotencyKey = useRef(crypto.randomUUID());
	const catalogue = useQuery(orpc.listRequestCatalogue.queryOptions());
	const createRequest = useMutation(
		orpc.createCatalogueRequest.mutationOptions({
			onSuccess: async ({ ticketId }) => {
				idempotencyKey.current = crypto.randomUUID();
				await queryClient.invalidateQueries({
					queryKey: orpc.listTickets.key(),
				});
				toast.success(requestFormCopy.sent);
				await navigate({ to: "/tickets/$ticketId", params: { ticketId } });
			},
			onError: () => toast.error(requestFormCopy.sendError),
		}),
	);
	const form = useForm({
		defaultValues: {
			title: initialValues?.title ?? "",
			body: initialValues?.body ?? "",
			selectedId: initialValues?.subcategoryId ?? "",
			values: (initialValues?.catalogueValues ?? {}) as RequestFormValues,
		},
		validators: {
			onSubmit: requestDetailsSchema,
		},
		onSubmit: async ({ value }) => {
			const selected = catalogue.data?.find(
				(item) => item.subcategory.id === value.selectedId,
			);
			const formDef = selected?.form;
			if (!formDef) return;
			await createRequest.mutateAsync({
				idempotencyKey: idempotencyKey.current,
				subcategoryId: selected.subcategory.id,
				formId: formDef.id,
				values: serializeCatalogueValues(formDef.fields, value.values),
				title: value.title.trim(),
				body: value.body.trim(),
			});
		},
	});

	return (
		<form
			className="space-y-7"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit().catch(() => undefined);
			}}
		>
			<FieldGroup>
				<form.Field name="title">
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor={field.name}>
								{requestFormCopy.summaryLabel}
							</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								maxLength={160}
								placeholder={requestFormCopy.setupSummaryPlaceholder}
								aria-invalid={field.state.meta.errors.length > 0}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>
				<form.Field name="body">
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor={field.name}>
								{requestFormCopy.setupDetailsLabel}
							</FieldLabel>
							<Textarea
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								maxLength={10_000}
								placeholder={requestFormCopy.setupDetailsPlaceholder}
								className="min-h-40"
								aria-invalid={field.state.meta.errors.length > 0}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>
				<PrivacyNotice />
				<Question
					legend={requestFormCopy.requestTypeLegend}
					name="requestType"
					value="setup"
					options={requestTypeOptions}
					onChange={(value) => value === "not_working" && onIncident()}
				/>

				{catalogue.isPending ? (
					<p className="text-muted-foreground text-sm" role="status">
						{requestFormCopy.catalogueLoading}
					</p>
				) : null}
				{catalogue.isError ? (
					<div
						className="flex flex-wrap items-center gap-3 text-sm"
						role="alert"
					>
						<span>{requestFormCopy.catalogueError}</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => catalogue.refetch()}
						>
							{requestFormCopy.tryAgain}
						</Button>
					</div>
				) : null}
				{catalogue.data ? (
					<form.Field name="selectedId">
						{(field) => (
							<Field>
								<FieldLabel htmlFor="catalogue-item">
									{requestFormCopy.catalogueLabel}
								</FieldLabel>
								<Select
									name={field.name}
									value={field.state.value || null}
									onValueChange={(value) => {
										field.handleChange(value ?? "");
										form.setFieldValue("values", {});
									}}
								>
									<SelectTrigger id="catalogue-item" className="w-full">
										<SelectValue
											placeholder={requestFormCopy.cataloguePlaceholder}
										/>
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{catalogue.data.map((item) => (
												<SelectItem
													key={item.subcategory.id}
													value={item.subcategory.id}
												>
													{item.subcategory.name}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
								{catalogue.data.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										{requestFormCopy.catalogueEmpty}
									</p>
								) : null}
							</Field>
						)}
					</form.Field>
				) : null}

				<form.Subscribe selector={(state) => state.values.selectedId}>
					{(selectedId) => {
						const selected = catalogue.data?.find(
							(item) => item.subcategory.id === selectedId,
						);
						if (!selected) return null;
						if (!selected.form) {
							return (
								<p className="text-muted-foreground text-sm" role="status">
									{requestFormCopy.catalogueUnavailable}
								</p>
							);
						}
						const formDef = selected.form;
						const fields = catalogueFields(selected);
						return (
							<form.Field name="values">
								{(field) => {
									const activeKeys = activeCatalogueFieldKeys(
										formDef.fields,
										field.state.value,
									);
									const set = (key: string, value: RequestFormValues[string]) =>
										field.handleChange({ ...field.state.value, [key]: value });
									return (
										<div className="space-y-6">
											{fields
												.filter((item) => activeKeys.has(item.key))
												.map((item) => (
													<CatalogueField
														key={item.key}
														field={item}
														value={field.state.value[item.key]}
														onChange={(value) => set(item.key, value)}
													/>
												))}
											{createRequest.isError ? (
												<p className="text-destructive text-sm" role="alert">
													{requestFormCopy.sendError}
												</p>
											) : null}
										</div>
									);
								}}
							</form.Field>
						);
					}}
				</form.Subscribe>

				<div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
					<Link
						to="/my-requests"
						className={buttonVariants({ variant: "outline", size: "lg" })}
					>
						{requestFormCopy.cancel}
					</Link>
					<form.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
							title: state.values.title,
							body: state.values.body,
							selectedId: state.values.selectedId,
						})}
					>
						{({ canSubmit, isSubmitting, title, body, selectedId }) => {
							const selected = catalogue.data?.find(
								(item) => item.subcategory.id === selectedId,
							);
							return (
								<Button
									type="submit"
									size="lg"
									disabled={
										!canSubmit ||
										title.trim().length < 3 ||
										title.trim().length > 160 ||
										body.trim().length < 10 ||
										body.trim().length > 10_000 ||
										!selected?.form ||
										isSubmitting ||
										createRequest.isPending
									}
								>
									{isSubmitting || createRequest.isPending ? (
										<Spinner data-icon="inline-start" />
									) : (
										<RiSendPlane2Line
											aria-hidden="true"
											data-icon="inline-start"
										/>
									)}
									{isSubmitting || createRequest.isPending
										? requestFormCopy.sending
										: requestFormCopy.send}
								</Button>
							);
						}}
					</form.Subscribe>
				</div>
			</FieldGroup>
		</form>
	);
}

export function RequestForm({
	initialValues,
}: {
	initialValues?: RequestFormInitialValues;
}) {
	// A draft carried over from the assistant already knows it is a catalogue
	// request; opening on the incident form would hide everything it filled in.
	const [requestType, setRequestType] = useState<"not_working" | "setup">(
		initialValues?.subcategoryId ? "setup" : "not_working",
	);
	return requestType === "not_working" ? (
		<IncidentRequestForm
			onSetup={() => setRequestType("setup")}
			initialValues={initialValues}
		/>
	) : (
		<CatalogueRequestForm
			onIncident={() => setRequestType("not_working")}
			initialValues={initialValues}
		/>
	);
}
