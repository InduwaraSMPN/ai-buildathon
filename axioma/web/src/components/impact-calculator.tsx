import { useState } from "react";
import { footnoteOrder, impactDefaults, impactMeta } from "../content/impact";
import { formatCurrency, formatHours, formatInt } from "../lib/format";
import { estimate, type ImpactInputs } from "../lib/impact";
import { SourceRef } from "./sources";

const FORMULA =
	"ticketsPerYear = employees × ticketsPerEmployeeMonth × 12\n" +
	"autoClosed = ticketsPerYear × autoShare\n" +
	"itSavings = autoClosed × costPerTicket\n" +
	"employeeHours = autoClosed × lostMinutesPerIncident ÷ 60\n" +
	"employeeValue = employeeHours × loadedHourly";

type Field = keyof ImpactInputs;
type Draft = Record<Field, string>;

const FIELDS: Array<{
	field: Field;
	id: string;
	label: string;
	source?: string;
	note?: string;
	step?: string;
	max?: number;
}> = [
	{ field: "employees", id: "impact-employees", label: "Employees" },
	{
		field: "ticketsPerEmployeeMonth",
		id: "impact-tickets",
		label: "Tickets per employee per month",
		source: impactMeta.ticketsPerEmployeeMonthSource,
		note: impactMeta.ticketsPerEmployeeMonthNote,
		step: "0.1",
	},
	{
		field: "autoShare",
		id: "impact-share",
		label: "Share auto-resolvable",
		note: impactMeta.autoShareNote,
		step: "0.05",
		max: 1,
	},
	{
		field: "costPerTicket",
		id: "impact-cost",
		label: "Cost per ticket (USD)",
		source: impactMeta.costPerTicketSource,
		note: impactMeta.costPerTicketNote,
	},
	{
		field: "lostMinutesPerIncident",
		id: "impact-lost",
		label: "Lost minutes per incident",
		source: impactMeta.lostMinutesPerIncidentSource,
		note: impactMeta.lostMinutesPerIncidentNote,
	},
	{
		field: "loadedHourly",
		id: "impact-hourly",
		label: "Loaded hourly cost (USD)",
		source: impactMeta.loadedHourlySource,
		note: impactMeta.loadedHourlyNote,
		step: "0.01",
	},
];

function refIndex(id: string): number {
	const position = footnoteOrder.indexOf(id);
	return position === -1 ? 0 : position + 1;
}

function toDraft(inputs: ImpactInputs): Draft {
	return {
		employees: String(inputs.employees),
		ticketsPerEmployeeMonth: String(inputs.ticketsPerEmployeeMonth),
		autoShare: String(inputs.autoShare),
		costPerTicket: String(inputs.costPerTicket),
		lostMinutesPerIncident: String(inputs.lostMinutesPerIncident),
		loadedHourly: String(inputs.loadedHourly),
	};
}

/**
 * The field keeps whatever was typed; the estimate reads a number from it. A
 * blank or non-numeric field falls back to its default, a negative one counts
 * as zero, and the share is capped at the whole ticket volume. The hint says
 * which of those happened, so the estimate never changes silently.
 */
function readField(
	field: Field,
	raw: string,
): { value: number; hint: string | null } {
	const fallback = impactDefaults[field];
	if (raw.trim() === "") {
		return {
			value: fallback,
			hint: `Blank, so the estimate uses ${fallback}.`,
		};
	}
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) {
		return {
			value: fallback,
			hint: `Not a number, so the estimate uses ${fallback}.`,
		};
	}
	if (parsed < 0) {
		return { value: 0, hint: "Negative, so the estimate counts it as zero." };
	}
	if (field === "autoShare" && parsed > 1) {
		return {
			value: 1,
			hint: "More than one, so the estimate uses the whole ticket volume.",
		};
	}
	return { value: parsed, hint: null };
}

export function ImpactCalculator() {
	const [draft, setDraft] = useState<Draft>(() => toDraft(impactDefaults));
	const fields = {
		employees: readField("employees", draft.employees),
		ticketsPerEmployeeMonth: readField(
			"ticketsPerEmployeeMonth",
			draft.ticketsPerEmployeeMonth,
		),
		autoShare: readField("autoShare", draft.autoShare),
		costPerTicket: readField("costPerTicket", draft.costPerTicket),
		lostMinutesPerIncident: readField(
			"lostMinutesPerIncident",
			draft.lostMinutesPerIncident,
		),
		loadedHourly: readField("loadedHourly", draft.loadedHourly),
	};
	const result = estimate({
		employees: fields.employees.value,
		ticketsPerEmployeeMonth: fields.ticketsPerEmployeeMonth.value,
		autoShare: fields.autoShare.value,
		costPerTicket: fields.costPerTicket.value,
		lostMinutesPerIncident: fields.lostMinutesPerIncident.value,
		loadedHourly: fields.loadedHourly.value,
	});

	function update(field: Field, raw: string) {
		setDraft((prev) => ({ ...prev, [field]: raw }));
	}

	function reset() {
		setDraft(toDraft(impactDefaults));
	}

	return (
		<div className="impact-calculator">
			<div className="impact-inputs">
				{FIELDS.map((meta) => {
					const { hint } = fields[meta.field];
					const hintId = `${meta.id}-hint`;
					return (
						<div key={meta.field}>
							<label htmlFor={meta.id}>
								{meta.label}
								{meta.source ? (
									<>
										{" "}
										<SourceRef id={meta.source} index={refIndex(meta.source)} />
									</>
								) : null}
							</label>
							<input
								id={meta.id}
								type="number"
								min={0}
								max={meta.max}
								step={meta.step}
								value={draft[meta.field]}
								aria-describedby={hint ? hintId : undefined}
								onChange={(event) => update(meta.field, event.target.value)}
							/>
							{hint ? (
								<p className="impact-hint" id={hintId} role="status">
									{hint}
								</p>
							) : null}
							{meta.note ? <p>{meta.note}</p> : null}
						</div>
					);
				})}
			</div>
			<p>
				{"Estimate from published benchmarks, not a measurement of Axiōma."}
			</p>
			<div className="sunken" aria-live="polite">
				<dl>
					<div>
						<dt>Tickets per year</dt>
						<dd>{formatInt(result.ticketsPerYear)}</dd>
					</div>
					<div>
						<dt>Auto-closed per year</dt>
						<dd>{formatInt(result.autoClosed)}</dd>
					</div>
					<div>
						<dt>IT savings per year</dt>
						<dd>{formatCurrency(result.itSavings)}</dd>
					</div>
					<div>
						<dt>Employee hours returned per year</dt>
						<dd>{formatHours(result.employeeHours)}</dd>
					</div>
					<div>
						<dt>Loaded value per year</dt>
						<dd>{formatCurrency(result.employeeValue)}</dd>
					</div>
				</dl>
				<pre>
					<code>{FORMULA}</code>
				</pre>
			</div>
			<button type="button" onClick={reset}>
				Reset to defaults
			</button>
		</div>
	);
}
