import type { AgentRun, AgentStep } from "../api/types";

export type EscalationDetails = {
	schedulerMessage: string | null;
	patchLines: string[];
};

export function extractEscalationDetails(
	run: AgentRun,
): EscalationDetails | null {
	if (run.status !== "escalated") return null;

	const evidenceSteps = run.steps.filter((step) => step.evidence?.trim());
	const schedulerStep =
		evidenceSteps.find(
			(step) =>
				step.kind === "observation" &&
				/scheduler|unschedulable|insufficient/i.test(step.evidence ?? ""),
		) ??
		evidenceSteps.find((step) =>
			/scheduler|unschedulable|insufficient/i.test(step.evidence ?? ""),
		) ??
		evidenceSteps.findLast((step) => step.kind === "observation");
	const patch =
		run.steps.findLast((step) => step.toolName === "cluster.patch_image")
			?.toolInput ?? findDecisionPatch(run.steps);

	const details = {
		schedulerMessage: schedulerStep?.evidence ?? null,
		patchLines: formatPatch(patch),
	};
	return details.schedulerMessage || details.patchLines.length ? details : null;
}

function findDecisionPatch(steps: AgentStep[]): unknown {
	for (const step of steps.toReversed()) {
		if (step.kind !== "decision") continue;
		const output = record(step.toolOutput);
		if (!output) continue;
		for (const key of ["proposedPatch", "proposed_patch", "patch"])
			if (key in output) return output[key];
		if (isPatchImageInput(output) || isJsonPatch(output)) return output;
		if (typeof output.description === "string") {
			const described = parseStructuredPatch(output.description);
			if (described) return described;
		}
	}
	return null;
}

function parseStructuredPatch(description: string): unknown {
	try {
		const value: unknown = JSON.parse(description);
		if (Array.isArray(value))
			return value.every((operation) => {
				const item = record(operation);
				return item && isJsonPatch(item);
			})
				? value
				: null;
		const parsed = record(value);
		if (!parsed) return null;
		if (
			isPatchImageInput(parsed) ||
			isJsonPatch(parsed) ||
			("before" in parsed && "after" in parsed) ||
			("from" in parsed && "to" in parsed)
		)
			return parsed;
		for (const key of ["proposedPatch", "proposed_patch", "patch"])
			if (key in parsed) return parsed[key];
		return null;
	} catch {
		return null;
	}
}

function formatPatch(value: unknown): string[] {
	if (typeof value === "string" && value.trim())
		return value
			.split("\n")
			.filter((line) => line.trim())
			.map((line) => (/^[+-]/.test(line) ? line : `+ ${line}`));
	if (Array.isArray(value)) return value.flatMap(formatOperation);

	const patch = record(value);
	if (!patch) return [];
	if (isJsonPatch(patch)) return formatOperation(patch);
	if (isPatchImageInput(patch)) {
		const target = `${patch.namespace}/${patch.name} containers[${patch.container_index}].image`;
		return [`- ${target}: (current)`, `+ ${target}: ${patch.image}`];
	}
	if ("before" in patch && "after" in patch)
		return [`- ${serialize(patch.before)}`, `+ ${serialize(patch.after)}`];
	if ("from" in patch && "to" in patch)
		return [`- ${serialize(patch.from)}`, `+ ${serialize(patch.to)}`];
	return [];
}

function formatOperation(value: unknown): string[] {
	const operation = record(value);
	if (!operation || typeof operation.op !== "string") return [];
	const path = typeof operation.path === "string" ? operation.path : "value";
	if (operation.op === "remove") return [`- ${path}`];
	if (operation.op === "add")
		return [`+ ${path}: ${serialize(operation.value)}`];
	if (operation.op === "replace")
		return [
			`- ${path}: ${"from" in operation ? serialize(operation.from) : "(current)"}`,
			`+ ${path}: ${serialize(operation.value)}`,
		];
	return [];
}

function isPatchImageInput(value: Record<string, unknown>) {
	return (
		typeof value.namespace === "string" &&
		typeof value.name === "string" &&
		typeof value.container_index === "number" &&
		typeof value.image === "string"
	);
}

function isJsonPatch(value: Record<string, unknown>) {
	return (
		typeof value.op === "string" &&
		["add", "remove", "replace"].includes(value.op)
	);
}

function record(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function serialize(value: unknown) {
	return typeof value === "string"
		? value
		: (JSON.stringify(value) ?? String(value));
}
