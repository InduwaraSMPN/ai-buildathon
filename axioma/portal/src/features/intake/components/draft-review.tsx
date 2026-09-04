import { RiSendPlane2Line, RiSparkling2Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedAnnouncement } from "@/features/intake/announce";
import { FieldProvenance } from "@/features/intake/components/field-provenance";
import { SubcategoryConfirm } from "@/features/intake/components/subcategory-confirm";
import { intakeCopy } from "@/features/intake/copy";
import type { DraftViewState } from "@/features/intake/types";
import { CatalogueField } from "@/features/request-catalogue/components/catalogue-field";
import type { RequestFormValues } from "@/features/request-catalogue/types";
import { activeCatalogueFieldKeys } from "@/features/tickets/components/catalogue-form-values";
import { DynamicFields } from "@/features/tickets/components/dynamic-fields";
import { Question } from "@/features/tickets/components/question-field";
import {
	affectedPeopleOptions,
	affectedPeopleValues,
	requestFormCopy,
	timingOptions,
	timingValues,
} from "@/features/tickets/copy";
import {
	catalogueFields,
	requestDetailsSchema,
} from "@/features/tickets/form-schema";
import { orpc } from "@/utils/orpc";

const impactToKey: Record<string, string> = Object.fromEntries(
	Object.entries(affectedPeopleValues).map(([key, value]) => [value, key]),
);
const timingToKey: Record<string, string> = Object.fromEntries(
	Object.entries(timingValues).map(([key, value]) => [value, key]),
);

/** §3.2's summary line names fields by the label the form already shows. */
const FIXED_FIELD_LABELS: Record<string, string> = {
	title: requestFormCopy.summaryLabel,
	body: requestFormCopy.incidentDetailsLabel,
	impact: requestFormCopy.affectedPeopleLegend,
	urgency: requestFormCopy.timingLegend,
	deviceId: requestFormCopy.deviceLabel,
};

const LIST_FORMAT = new Intl.ListFormat(undefined, {
	style: "long",
	type: "conjunction",
});

/** Counts what the assistant actually put in the form, for the §2.9 summary. */
function countFilledFields(values: DraftViewState["values"]): number {
	const filled = (value: unknown) =>
		value !== undefined && value !== null && value !== "";
	const scalars = [
		values.title,
		values.body,
		values.impact,
		values.urgency,
		values.deviceId,
	].filter(filled).length;
	const nested = [values.customFields ?? {}, values.formValues ?? {}].reduce(
		(total, record) => total + Object.values(record).filter(filled).length,
		0,
	);
	return scalars + nested;
}

function lastSeen(date: Date) {
	return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
		-Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000)),
		"minute",
	);
}

export function DraftReview({
	state,
	submitting,
	onFieldChange,
	onRevert,
	onConfirmSubcategory,
	onManual,
	onSubmit,
}: {
	state: DraftViewState;
	submitting: boolean;
	onFieldChange: (key: string, value: unknown) => void;
	onRevert: (key: string) => void;
	onConfirmSubcategory: () => void;
	onManual: () => void;
	onSubmit: () => void;
}) {
	const devices = useQuery(orpc.listMyDevices.queryOptions());
	const fieldDefinitions = useQuery(
		orpc.listTicketFieldDefinitions.queryOptions(),
	);
	const catalogue = useQuery(orpc.listRequestCatalogue.queryOptions());

	const selected = useMemo(
		() =>
			catalogue.data?.find(
				(item) => item.subcategory.id === state.subcategoryId,
			),
		[catalogue.data, state.subcategoryId],
	);

	const title = state.values.title ?? "";
	const body = state.values.body ?? "";
	const titleParse = requestDetailsSchema.shape.title.safeParse(title);
	const bodyParse = requestDetailsSchema.shape.body.safeParse(body);
	const titleValid = titleParse.success;
	const bodyValid = bodyParse.success;

	// The reducer normalises aiDraft to drafted() wrappers only, so the model's
	// plain values (intent, assistantMessage) are already filtered out here.
	const needsInput = useMemo(
		() =>
			Object.entries(state.aiDraft ?? {})
				.filter(
					([, entry]) => entry.confidence === "low" || entry.value === null,
				)
				.map(([key]) => key),
		[state.aiDraft],
	);

	// §3.2 wants one summary line naming the fields, not a warning bolted to
	// each one. Container keys (`customFields`, `formValues`) and anything the
	// form does not render carry no label and are dropped rather than shown raw.
	const needsInputLabels = useMemo(() => {
		const dynamic = new Map<string, string>(
			(fieldDefinitions.data ?? []).map((definition) => [
				`customFields.${definition.key}`,
				definition.label,
			]),
		);
		const catalogue = new Map<string, string>(
			selected
				? catalogueFields(selected).map((item) => [
						`formValues.${item.key}`,
						item.label,
					])
				: [],
		);
		const labels = new Set<string>();
		for (const key of needsInput) {
			const label =
				FIXED_FIELD_LABELS[key] ?? dynamic.get(key) ?? catalogue.get(key);
			if (label) labels.add(label);
		}
		return [...labels];
	}, [needsInput, fieldDefinitions.data, selected]);

	const filledCount = countFilledFields(state.values);
	const announcement = useDebouncedAnnouncement(
		filledCount > 0
			? intakeCopy.fieldsFilled(filledCount)
			: intakeCopy.draftReady,
		state.streaming,
	);

	const handleImpact = (presentation: string) => {
		onFieldChange(
			"impact",
			affectedPeopleValues[presentation as keyof typeof affectedPeopleValues],
		);
	};
	const handleUrgency = (presentation: string) => {
		onFieldChange(
			"urgency",
			timingValues[presentation as keyof typeof timingValues],
		);
	};

	const activeKeys = useMemo(() => {
		if (!selected?.form) return new Set<string>();
		return activeCatalogueFieldKeys(
			selected.form.fields,
			(state.values.formValues ?? {}) as Record<string, unknown>,
		);
	}, [selected, state.values.formValues]);

	const mandatoryEmpty = useMemo(() => {
		if (!selected?.form) return false;
		return catalogueFields(selected)
			.filter((item) => activeKeys.has(item.key))
			.some((item) => {
				if (!item.required) return false;
				const value = state.values.formValues?.[item.key];
				return value === undefined || value === "" || value === null;
			});
	}, [selected, activeKeys, state.values.formValues]);

	// The routing decision is the one field that must be confirmed by hand. Gate
	// on the routed id rather than the resolved catalogue entry: while the
	// catalogue is still loading `selected` is undefined, and gating on it let an
	// AI-routed request through unconfirmed.
	const awaitingCatalogue = Boolean(state.subcategoryId) && !selected;
	const needsConfirmation = Boolean(state.subcategoryId);
	const canSend =
		titleValid &&
		bodyValid &&
		!awaitingCatalogue &&
		(!needsConfirmation || (state.subcategoryConfirmed && !mandatoryEmpty));

	return (
		<div
			className="flex min-w-0 flex-col gap-5"
			aria-busy={state.streaming ? "true" : "false"}
		>
			{/* The form is what fills itself in, so the §2.9 summary belongs here
			    rather than on the transcript, and it is the only live region on it. */}
			<div className="sr-only" aria-live="polite" aria-atomic="false">
				{announcement}
			</div>
			<Alert className="gap-3 rounded-md" data-variant="outline">
				<RiSparkling2Line className="size-5 text-info" aria-hidden="true" />
				<AlertTitle>{intakeCopy.bannerTitle}</AlertTitle>
				<AlertDescription>{intakeCopy.bannerDescription}</AlertDescription>
			</Alert>

			{needsInput.length > 0 ? (
				<div className="flex flex-col gap-1 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
					<span className="font-medium">{intakeCopy.needsInputHeading}</span>
					<span>
						{needsInputLabels.length > 0
							? intakeCopy.needsInputFields(
									LIST_FORMAT.format(needsInputLabels),
								)
							: intakeCopy.incidentFallbackSummary}
					</span>
				</div>
			) : null}

			<FieldGroup>
				<Field>
					<FieldProvenance
						source={provenance(state, "title")}
						hasAiValue={hasAiValue(state, "title")}
						onRevert={() => onRevert("title")}
					>
						<FieldLabel htmlFor="intake-title">
							{requestFormCopy.summaryLabel}
						</FieldLabel>
					</FieldProvenance>
					<Input
						id="intake-title"
						maxLength={160}
						value={title}
						onChange={(event) => onFieldChange("title", event.target.value)}
						aria-invalid={!titleValid}
					/>
					{title && !titleValid ? (
						<FieldError>
							{titleParse.error?.issues[0]?.message ??
								requestFormCopy.summaryTooShort}
						</FieldError>
					) : null}
				</Field>

				<Field>
					<FieldProvenance
						source={provenance(state, "body")}
						hasAiValue={hasAiValue(state, "body")}
						onRevert={() => onRevert("body")}
					>
						<FieldLabel htmlFor="intake-body">
							{requestFormCopy.incidentDetailsLabel}
						</FieldLabel>
					</FieldProvenance>
					<Textarea
						id="intake-body"
						maxLength={10_000}
						value={body}
						onChange={(event) => onFieldChange("body", event.target.value)}
						className="min-h-40"
						aria-invalid={!bodyValid}
					/>
					{body && !bodyValid ? (
						<FieldError>
							{bodyParse.error?.issues[0]?.message ??
								requestFormCopy.detailsTooShort}
						</FieldError>
					) : null}
				</Field>

				<Separator />

				<Field>
					<FieldProvenance
						source={provenance(state, "impact")}
						hasAiValue={hasAiValue(state, "impact")}
						onRevert={() => onRevert("impact")}
					>
						{/* §3.2: a field the model was unsure about is left empty, so
						    nothing is preselected until a value actually exists. */}
						<Question
							legend={requestFormCopy.affectedPeopleLegend}
							name="intake-impact"
							value={
								state.values.impact
									? (impactToKey[state.values.impact] ?? null)
									: null
							}
							options={affectedPeopleOptions}
							onChange={handleImpact}
						/>
					</FieldProvenance>
				</Field>

				<Field>
					<FieldProvenance
						source={provenance(state, "urgency")}
						hasAiValue={hasAiValue(state, "urgency")}
						onRevert={() => onRevert("urgency")}
					>
						<Question
							legend={requestFormCopy.timingLegend}
							name="intake-urgency"
							value={
								state.values.urgency
									? (timingToKey[state.values.urgency] ?? null)
									: null
							}
							options={timingOptions}
							onChange={handleUrgency}
						/>
					</FieldProvenance>
				</Field>

				{devices.isPending ? (
					<p className="text-muted-foreground text-sm" role="status">
						{requestFormCopy.devicesLoading}
					</p>
				) : null}
				{devices.data?.length ? (
					<Field>
						<FieldProvenance
							source={provenance(state, "deviceId")}
							hasAiValue={hasAiValue(state, "deviceId")}
							onRevert={() => onRevert("deviceId")}
						>
							<FieldLabel htmlFor="intake-device">
								{requestFormCopy.deviceLabel}
							</FieldLabel>
						</FieldProvenance>
						<Select
							name="deviceId"
							value={state.values.deviceId ?? null}
							onValueChange={(value) => onFieldChange("deviceId", value ?? "")}
						>
							<SelectTrigger id="intake-device" className="w-full">
								<SelectValue placeholder={requestFormCopy.recentDevice} />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{devices.data.map((device) => (
										<SelectItem key={device.id} value={device.id}>
											{device.hostname}, {requestFormCopy.lastSeen}{" "}
											{lastSeen(device.lastSeenAt)}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
				) : null}

				{fieldDefinitions.isPending ? (
					<div className="flex flex-col gap-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-10 w-full" />
					</div>
				) : null}
				{fieldDefinitions.data?.length ? (
					<div className="flex flex-col gap-4">
						{fieldDefinitions.data.map((definition) => {
							// The model wraps every dynamic answer in one customFields
							// entry, so provenance is addressed per key by the reducer's
							// normalised path — a bare key never resolves.
							const path = `customFields.${definition.key}`;
							return (
								<FieldProvenance
									key={definition.id}
									source={provenance(state, path)}
									hasAiValue={hasAiValue(state, path)}
									onRevert={() => onRevert(path)}
								>
									<DynamicFields
										definitions={[definition]}
										values={state.values.customFields ?? {}}
										onChange={(next) =>
											onFieldChange(path, next[definition.key])
										}
									/>
								</FieldProvenance>
							);
						})}
					</div>
				) : null}

				{selected ? (
					<>
						<Separator />
						<div className="flex flex-col gap-4">
							<div>
								<h3 className="font-medium text-base">
									{intakeCopy.confirmSubcategoryHeading}
								</h3>
								{/* Rendered for any routed subcategory, not only one that
								    carries a form — otherwise a formless subcategory gates
								    submit on a confirmation the user is never offered. */}
								<SubcategoryConfirm
									subcategoryName={selected.subcategory.name}
									confirmed={state.subcategoryConfirmed}
									onConfirm={onConfirmSubcategory}
								/>
							</div>
							{catalogueFields(selected)
								.filter((item) => activeKeys.has(item.key))
								.map((item) => {
									const path = `formValues.${item.key}`;
									return (
										<FieldProvenance
											key={item.key}
											source={provenance(state, path)}
											hasAiValue={hasAiValue(state, path)}
											onRevert={() => onRevert(path)}
										>
											<CatalogueField
												field={item}
												value={
													(
														(state.values.formValues ?? {}) as RequestFormValues
													)[item.key]
												}
												onChange={(value) => onFieldChange(path, value)}
											/>
										</FieldProvenance>
									);
								})}
						</div>
					</>
				) : null}
			</FieldGroup>

			<div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-end">
				{/* The escape hatch has to stay reachable once the composer is gone,
				    §2.2: never something the user has to argue past. */}
				<button
					type="button"
					className="self-start text-primary text-sm underline underline-offset-4 sm:mr-auto"
					onClick={onManual}
				>
					{intakeCopy.manualEscape}
				</button>
				{/* Not an alert: the send gate is unmet on first render, and an alert
				    would interrupt the screen reader the moment the form arrives. */}
				{!canSend ? (
					<p className="self-start text-destructive text-sm">
						{intakeCopy.requiresAttention}
					</p>
				) : null}
				<Button
					type="button"
					size="lg"
					disabled={!canSend || submitting}
					onClick={onSubmit}
				>
					{submitting ? (
						<Spinner data-icon="inline-start" />
					) : (
						<RiSendPlane2Line aria-hidden="true" data-icon="inline-start" />
					)}
					{submitting ? intakeCopy.sending : intakeCopy.approveAndSend}
				</Button>
			</div>
		</div>
	);
}

function provenance(state: DraftViewState, path: string): "ai" | "user" | null {
	if (!hasAiValue(state, path)) return null;
	return state.fieldSources[path] ?? "ai";
}

function hasAiValue(state: DraftViewState, path: string): boolean {
	const draft = state.aiDraft?.[path];
	return Boolean(draft && draft.value !== null && draft.value !== undefined);
}
