import { RiSendPlane2Line, RiSparkling2Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { timeAgo } from "@/components/ticket-ui";
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

/** The "Needs your input" line names fields by the label the form shows. */
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

/** Counts what the assistant put in the form, for the screen-reader summary. */
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

/**
 * One run of related questions. The drafted form used to be a single flat
 * column of nine controls, which read as a wall the moment the catalogue added
 * fields of its own; the headings give it the shape of the request it
 * describes.
 */
function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex min-w-0 flex-col gap-4 border-border border-t pt-6 first:border-t-0 first:pt-0">
			<h3 className="font-heading font-semibold text-base">{title}</h3>
			{children}
		</section>
	);
}

export function DraftReview({
	state,
	submitting,
	onFieldChange,
	onRevert,
	onConfirmSubcategory,
	onSubmit,
}: {
	state: DraftViewState;
	submitting: boolean;
	onFieldChange: (key: string, value: unknown) => void;
	onRevert: (key: string) => void;
	onConfirmSubcategory: () => void;
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
	// The same set the banner counts, addressed by path, so a field can carry its
	// own marker instead of leaving the banner to name it from a distance.
	const needsInputPaths = useMemo(() => new Set(needsInput), [needsInput]);

	// The fields the model left blank are collected into one summary line that
	// names them, rather than a warning bolted to each one. Container keys
	// (`customFields`, `formValues`) and anything the form does not render carry
	// no label and are dropped rather than shown raw.
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
			className="flex min-w-0 flex-col gap-6"
			aria-busy={state.streaming ? "true" : "false"}
		>
			{/* The form is what fills itself in, so the debounced summary belongs
			    here rather than on the transcript, and it is the only live region
			    on it. */}
			<div className="sr-only" aria-live="polite" aria-atomic="false">
				{announcement}
			</div>

			{/* One banner, not two. "Drafted from your description" and "Needs your
			    input" were stacked blocks making the same request — check this
			    before you send it — so the second is now the second line of the
			    first, and the fields it counts carry their own marker. */}
			<div className="flex gap-3 rounded-xl border bg-muted/40 p-4">
				<RiSparkling2Line
					className="mt-0.5 size-5 shrink-0 text-info"
					aria-hidden="true"
				/>
				<div className="flex min-w-0 flex-col gap-1">
					<p className="font-medium text-sm">{intakeCopy.bannerTitle}</p>
					{needsInput.length > 0 ? (
						<p className="text-sm text-warning">
							{/* Counted from the labels, not the raw keys: a key the form
							    does not render carries no label and is dropped from the
							    list, so counting keys promised one more field to check
							    than the page could show. */}
							<span className="font-medium">
								{intakeCopy.needsInputCount(
									needsInputLabels.length || needsInput.length,
								)}
							</span>
							{needsInputLabels.length > 0
								? ` — ${LIST_FORMAT.format(needsInputLabels)}`
								: ` — ${intakeCopy.incidentFallbackSummary}`}
						</p>
					) : (
						<p className="text-muted-foreground text-sm">
							{intakeCopy.bannerDescription}
						</p>
					)}
				</div>
			</div>

			<Section title={intakeCopy.sectionRequest}>
				<FieldGroup>
					<Field>
						<FieldProvenance
							source={provenance(state, "title")}
							hasAiValue={hasAiValue(state, "title")}
							needsInput={needsInputPaths.has("title")}
							onRevert={() => onRevert("title")}
						>
							<FieldLabel htmlFor="intake-title">
								{requestFormCopy.summaryLabel}
							</FieldLabel>
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
						</FieldProvenance>
					</Field>

					<Field>
						<FieldProvenance
							source={provenance(state, "body")}
							hasAiValue={hasAiValue(state, "body")}
							needsInput={needsInputPaths.has("body")}
							onRevert={() => onRevert("body")}
						>
							<FieldLabel htmlFor="intake-body">
								{requestFormCopy.incidentDetailsLabel}
							</FieldLabel>
							<Textarea
								id="intake-body"
								maxLength={10_000}
								value={body}
								onChange={(event) => onFieldChange("body", event.target.value)}
								className="min-h-36"
								aria-invalid={!bodyValid}
							/>
							{body && !bodyValid ? (
								<FieldError>
									{bodyParse.error?.issues[0]?.message ??
										requestFormCopy.detailsTooShort}
								</FieldError>
							) : null}
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
								needsInput={needsInputPaths.has("deviceId")}
								onRevert={() => onRevert("deviceId")}
							>
								<FieldLabel htmlFor="intake-device">
									{requestFormCopy.deviceLabel}
								</FieldLabel>
								<Select
									name="deviceId"
									value={state.values.deviceId || null}
									onValueChange={(value) =>
										onFieldChange("deviceId", value ?? "")
									}
								>
									<SelectTrigger id="intake-device" className="w-full">
										<SelectValue placeholder={requestFormCopy.recentDevice} />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{/* Without an empty option a device the model chose could
											    only be swapped, never taken off, and the request was
											    filed against the wrong computer. */}
											<SelectItem value={null}>
												{intakeCopy.noDevice}
											</SelectItem>
											{devices.data.map((device) => (
												<SelectItem key={device.id} value={device.id}>
													{device.hostname}, {requestFormCopy.lastSeen}{" "}
													{timeAgo(device.lastSeenAt)}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</FieldProvenance>
						</Field>
					) : null}
				</FieldGroup>
			</Section>

			<Section title={intakeCopy.sectionImpact}>
				<FieldGroup>
					<Field>
						<FieldProvenance
							source={provenance(state, "impact")}
							hasAiValue={hasAiValue(state, "impact")}
							needsInput={needsInputPaths.has("impact")}
							onRevert={() => onRevert("impact")}
						>
							{/* A field the model was unsure about is left empty rather than
							    guessed, so nothing is preselected until a value exists. */}
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
							needsInput={needsInputPaths.has("urgency")}
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
				</FieldGroup>
			</Section>

			{fieldDefinitions.isPending ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-10 w-full" />
				</div>
			) : null}
			{fieldDefinitions.data?.length ? (
				<Section title={intakeCopy.sectionDetails}>
					<div className="flex flex-col gap-5">
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
									needsInput={needsInputPaths.has(path)}
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
				</Section>
			) : null}

			{selected ? (
				<Section title={intakeCopy.confirmSubcategoryHeading}>
					{/* Rendered for any routed subcategory, not only one that carries a
					    form — otherwise a formless subcategory gates submit on a
					    confirmation the user is never offered. */}
					<SubcategoryConfirm
						subcategoryName={selected.subcategory.name}
						confirmed={state.subcategoryConfirmed}
						onConfirm={onConfirmSubcategory}
					/>
					<div className="flex flex-col gap-5">
						{catalogueFields(selected)
							.filter((item) => activeKeys.has(item.key))
							.map((item) => {
								const path = `formValues.${item.key}`;
								return (
									<FieldProvenance
										key={item.key}
										source={provenance(state, path)}
										hasAiValue={hasAiValue(state, path)}
										needsInput={needsInputPaths.has(path)}
										onRevert={() => onRevert(path)}
									>
										<CatalogueField
											field={item}
											value={
												((state.values.formValues ?? {}) as RequestFormValues)[
													item.key
												]
											}
											onChange={(value) => onFieldChange(path, value)}
										/>
									</FieldProvenance>
								);
							})}
					</div>
				</Section>
			) : null}

			{/* Sticky, because the form is long enough to bury its own action: the
			    send control sat past the last catalogue field, so the answer to "am
			    I done?" was several screens from the work. */}
			<div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-xl border bg-card/90 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-end">
				{/* Not an alert: the send gate is unmet on first render, and an alert
				    would interrupt the screen reader the moment the form arrives. The
				    bar always says where the request stands, so a ready one is not a
				    button floating in an empty strip. */}
				{canSend ? (
					<p className="self-start text-muted-foreground text-sm sm:mr-auto sm:self-center">
						{intakeCopy.readyToSend}
					</p>
				) : (
					<p className="self-start text-destructive text-sm sm:mr-auto sm:self-center">
						{intakeCopy.requiresAttention}
					</p>
				)}
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
