import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Info, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type {
	RequestFormField,
	RequestFormValues,
} from "@/features/request-catalogue/components";
import {
	affectedPeopleOptions,
	affectedPeopleValues,
	requestFormCopy,
	requestTypeOptions,
	timingOptions,
	timingValues,
} from "@/features/tickets/copy";
import { orpc, queryClient } from "@/utils/orpc";
import {
	activeCatalogueFieldKeys,
	serializeCatalogueValues,
} from "./catalogue-form-values";
import { DynamicFields, serializeDynamicFields } from "./dynamic-fields";

const requestDetailsSchema = z.object({
	title: z
		.string()
		.trim()
		.min(3, requestFormCopy.summaryTooShort)
		.max(160, requestFormCopy.summaryTooLong),
	body: z
		.string()
		.trim()
		.min(10, requestFormCopy.detailsTooShort)
		.max(10_000, requestFormCopy.detailsTooLong),
	selectedId: z.string(),
	values: z.record(
		z.string(),
		z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
	),
});

const incidentSchema = requestDetailsSchema
	.pick({ title: true, body: true })
	.extend({
		affectedPeople: z.enum(["me", "team", "company"]),
		timing: z.enum(["whenever", "today", "blocked"]),
		deviceId: z.string(),
		customFields: z.record(z.string(), z.unknown()),
	});

type IncidentValues = z.input<typeof incidentSchema>;
type Option = { value: string; label: string };
type Catalogue = Awaited<ReturnType<typeof orpc.listRequestCatalogue.call>>;
type CatalogueItem = Catalogue[number];

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

function PrivacyNotice() {
	return (
		<Alert className="rounded-md">
			<Info aria-hidden="true" />
			<AlertTitle>{requestFormCopy.privacyTitle}</AlertTitle>
			<AlertDescription>{requestFormCopy.privacyDescription}</AlertDescription>
		</Alert>
	);
}

function lastSeen(date: Date) {
	return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
		-Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000)),
		"minute",
	);
}

function IncidentRequestForm({ onSetup }: { onSetup: () => void }) {
	const navigate = useNavigate();
	const devices = useQuery(orpc.listMyDevices.queryOptions());
	const fieldDefinitions = useQuery(
		orpc.listTicketFieldDefinitions.queryOptions(),
	);
	const createTicket = useMutation(
		orpc.createTicket.mutationOptions({
			onSuccess: async (ticket) => {
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
			title: "",
			body: "",
			affectedPeople: "me",
			timing: "today",
			deviceId: "",
			customFields: {},
		} as IncidentValues,
		validators: { onSubmit: incidentSchema },
		onSubmit: ({ value }) =>
			createTicket.mutateAsync({
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
			<form.Field name="title">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>{requestFormCopy.summaryLabel}</Label>
						<Input
							id={field.name}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							maxLength={160}
							placeholder={requestFormCopy.incidentSummaryPlaceholder}
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
						<Label htmlFor={field.name}>
							{requestFormCopy.incidentDetailsLabel}
						</Label>
						<Textarea
							id={field.name}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							maxLength={10_000}
							placeholder={requestFormCopy.incidentDetailsPlaceholder}
							className="min-h-40 rounded-md text-sm"
							aria-invalid={field.state.meta.errors.length > 0}
						/>
						<FieldError errors={field.state.meta.errors} />
					</div>
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
				<div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
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
				<div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
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
						<div className="space-y-2">
							<Label htmlFor={field.name}>{requestFormCopy.deviceLabel}</Label>
							<select
								id={field.name}
								name={field.name}
								value={field.state.value}
								onChange={(event) => field.handleChange(event.target.value)}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
							>
								<option value="">{requestFormCopy.recentDevice}</option>
								{devices.data.map((device) => (
									<option key={device.id} value={device.id}>
										{device.hostname}, {requestFormCopy.lastSeen}{" "}
										{lastSeen(device.lastSeenAt)}
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
								isSubmitting
							}
						>
							<Send aria-hidden="true" />{" "}
							{isSubmitting ? requestFormCopy.sending : requestFormCopy.send}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

function objectValue(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function catalogueFields(item: CatalogueItem): RequestFormField[] {
	return (item.form?.fields ?? [])
		.filter((field) => !field.isHidden && field.predefinedValue === null)
		.map((field) => {
			const validation = objectValue(field.validation);
			const options = Array.isArray(field.options)
				? field.options.filter(
						(option): option is string | { label: string; value: string } =>
							typeof option === "string" ||
							(option !== null &&
								typeof option === "object" &&
								typeof (option as Record<string, unknown>).label === "string" &&
								typeof (option as Record<string, unknown>).value === "string"),
					)
				: undefined;
			return {
				key: field.key,
				label: field.label,
				type: field.type === "boolean" ? "checkbox" : field.type,
				description: field.description,
				required: field.isMandatory,
				readOnly: field.isReadonly,
				condition: field.condition,
				options,
				min: typeof validation.min === "number" ? validation.min : undefined,
				max: typeof validation.max === "number" ? validation.max : undefined,
				step: validation.integer === true ? 1 : undefined,
				minLength:
					typeof validation.minLength === "number"
						? validation.minLength
						: undefined,
				maxLength:
					typeof validation.maxLength === "number"
						? validation.maxLength
						: undefined,
			} satisfies RequestFormField;
		});
}

const catalogueControlClass =
	"h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60";

function CatalogueRequestForm({ onIncident }: { onIncident: () => void }) {
	const navigate = useNavigate();
	const catalogue = useQuery(orpc.listRequestCatalogue.queryOptions());
	const createRequest = useMutation(
		orpc.createCatalogueRequest.mutationOptions({
			onSuccess: async ({ ticketId }) => {
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
			title: "",
			body: "",
			selectedId: "",
			values: {} as RequestFormValues,
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
			<form.Field name="title">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>{requestFormCopy.summaryLabel}</Label>
						<Input
							id={field.name}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							maxLength={160}
							placeholder={requestFormCopy.setupSummaryPlaceholder}
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
						<Label htmlFor={field.name}>
							{requestFormCopy.setupDetailsLabel}
						</Label>
						<Textarea
							id={field.name}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							maxLength={10_000}
							placeholder={requestFormCopy.setupDetailsPlaceholder}
							className="min-h-40 rounded-md text-sm"
							aria-invalid={field.state.meta.errors.length > 0}
						/>
						<FieldError errors={field.state.meta.errors} />
					</div>
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
				<div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
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
						<div className="space-y-2">
							<Label htmlFor="catalogue-item">
								{requestFormCopy.catalogueLabel}
							</Label>
							<select
								id="catalogue-item"
								name={field.name}
								value={field.state.value}
								onChange={(event) => {
									field.handleChange(event.target.value);
									form.setFieldValue("values", {});
								}}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
							>
								<option value="">{requestFormCopy.cataloguePlaceholder}</option>
								{catalogue.data.map((item) => (
									<option key={item.subcategory.id} value={item.subcategory.id}>
										{item.subcategory.name}
									</option>
								))}
							</select>
							{catalogue.data.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{requestFormCopy.catalogueEmpty}
								</p>
							) : null}
						</div>
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
											.filter((f) => activeKeys.has(f.key))
											.map((f) => {
												const id = `catalogue-${f.key}`;
												const descriptionId = f.description
													? `${id}-description`
													: undefined;
												const value = field.state.value[f.key];
												if (f.type === "checkbox") {
													return (
														<div key={f.key} className="space-y-1">
															<label
																htmlFor={id}
																className="flex items-start gap-3 text-sm"
															>
																<input
																	id={id}
																	name={f.key}
																	type="checkbox"
																	checked={value === true}
																	required={f.required}
																	disabled={f.readOnly}
																	aria-describedby={descriptionId}
																	onChange={(event) =>
																		set(f.key, event.target.checked)
																	}
																	className="mt-0.5 size-4 accent-primary"
																/>
																<span>
																	{f.label}
																	{f.required ? (
																		<span aria-hidden="true"> *</span>
																	) : null}
																</span>
															</label>
															{f.description ? (
																<p
																	id={descriptionId}
																	className="pl-7 text-muted-foreground text-xs"
																>
																	{f.description}
																</p>
															) : null}
														</div>
													);
												}
												const stringValue =
													typeof value === "string" || typeof value === "number"
														? value
														: "";
												return (
													<div key={f.key} className="space-y-2">
														<label htmlFor={id} className="font-medium text-sm">
															{f.label}
															{f.required ? (
																<span aria-hidden="true"> *</span>
															) : null}
														</label>
														{f.description ? (
															<p
																id={descriptionId}
																className="text-muted-foreground text-xs"
															>
																{f.description}
															</p>
														) : null}
														{f.type === "select" || f.type === "multiselect" ? (
															<select
																id={id}
																name={f.key}
																value={
																	f.type === "multiselect" &&
																	Array.isArray(value)
																		? value
																		: stringValue
																}
																multiple={f.type === "multiselect"}
																required={f.required}
																disabled={f.readOnly}
																aria-describedby={descriptionId}
																onChange={(event) =>
																	set(
																		f.key,
																		f.type === "multiselect"
																			? [...event.target.selectedOptions].map(
																					(option) => option.value,
																				)
																			: event.target.value,
																	)
																}
																className={catalogueControlClass}
															>
																<option value="">Select an option</option>
																{f.options?.map((option) => {
																	const item =
																		typeof option === "string"
																			? { label: option, value: option }
																			: option;
																	return (
																		<option key={item.value} value={item.value}>
																			{item.label}
																		</option>
																	);
																})}
															</select>
														) : f.type === "textarea" ? (
															<textarea
																id={id}
																name={f.key}
																value={String(stringValue)}
																required={f.required}
																readOnly={f.readOnly}
																aria-describedby={descriptionId}
																minLength={f.minLength}
																maxLength={f.maxLength}
																placeholder={f.placeholder}
																onChange={(event) =>
																	set(f.key, event.target.value)
																}
																className={`${catalogueControlClass} min-h-28 py-2`}
															/>
														) : (
															<input
																id={id}
																name={f.key}
																type={f.type}
																value={stringValue as string | number}
																required={f.required}
																readOnly={f.readOnly}
																aria-describedby={descriptionId}
																min={f.min}
																max={f.max}
																step={f.step}
																minLength={f.minLength}
																maxLength={f.maxLength}
																placeholder={f.placeholder}
																onChange={(event) =>
																	set(
																		f.key,
																		f.type === "number"
																			? event.target.value === ""
																				? ""
																				: event.target.valueAsNumber
																			: event.target.value,
																	)
																}
																className={catalogueControlClass}
															/>
														)}
													</div>
												);
											})}
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
					to="/home"
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
								<Send aria-hidden="true" />{" "}
								{isSubmitting || createRequest.isPending
									? requestFormCopy.sending
									: requestFormCopy.send}
							</Button>
						);
					}}
				</form.Subscribe>
			</div>
		</form>
	);
}

export function RequestForm() {
	const [requestType, setRequestType] = useState<"not_working" | "setup">(
		"not_working",
	);
	return requestType === "not_working" ? (
		<IncidentRequestForm onSetup={() => setRequestType("setup")} />
	) : (
		<CatalogueRequestForm onIncident={() => setRequestType("not_working")} />
	);
}
