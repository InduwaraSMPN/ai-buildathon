import {
	RULE_FIELDS,
	type RuleAction,
	type RuleCriterion,
	type RuleFiring,
} from "@/domain/rules";
import type { Impact, RecordType, TicketRoute, Urgency } from "@/shared";
import {
	ACTION_TYPES,
	type Action,
	type ActionType as SharedActionType,
} from "../automation/actions";

export type { RuleAction, RuleCriterion, RuleFiring };
export { ACTION_TYPES, RULE_FIELDS };

export const RULE_ACTION_TYPES = [
	"set_service",
	"set_impact",
	"set_urgency",
	"set_record_type",
	"set_route",
	"set_team",
	"set_assignee",
	"route_human",
] as const satisfies readonly SharedActionType[];

export type RuleActionType = (typeof RULE_ACTION_TYPES)[number];
export type WorkflowAction = Action;

export interface RuleTicket {
	title: string;
	body: string;
	serviceId?: string | null;
	requesterId: string;
	requesterDepartment?: string | null;
	recordType: RecordType;
	origin?: string | null;
	impact: Impact;
	urgency: Urgency;
	route?: TicketRoute | null;
	teamId?: string | null;
	assigneeId?: string | null;
}

export interface TicketRule {
	id: string;
	name: string;
	position: number;
	enabled: boolean;
	criteria: RuleCriterion[];
	actions: RuleAction[];
}

type ActionType = RuleAction["type"];
type TicketPatch = Partial<
	Pick<
		RuleTicket,
		| "serviceId"
		| "impact"
		| "urgency"
		| "recordType"
		| "route"
		| "teamId"
		| "assigneeId"
	>
>;

export interface RuleEvaluation {
	patch: TicketPatch;
	ticket: RuleTicket;
	firings: RuleFiring[];
	settledActions: ActionType[];
}

export const routesToHuman = (firings: readonly RuleFiring[]) =>
	firings.some((firing) =>
		firing.applied.some((action) => action.type === "route_human"),
	);

const actionField = {
	set_service: "serviceId",
	set_impact: "impact",
	set_urgency: "urgency",
	set_record_type: "recordType",
	set_route: "route",
	set_team: "teamId",
	set_assignee: "assigneeId",
} as const satisfies Record<
	Exclude<ActionType, "route_human">,
	keyof TicketPatch
>;

function matches(ticket: RuleTicket, criterion: RuleCriterion): boolean {
	const actual = ticket[criterion.field];
	if (criterion.operator === "contains")
		return (
			typeof actual === "string" &&
			actual.toLocaleLowerCase().includes(criterion.value.toLocaleLowerCase())
		);
	if (criterion.operator === "in")
		return (
			Array.isArray(criterion.value) &&
			typeof actual === "string" &&
			criterion.value.includes(actual)
		);
	return actual === criterion.value;
}

/** Pure ticket-create pass. Rules are ordered by position then id; each action type settles once. */
export function evaluateTicketRules(
	ticket: RuleTicket,
	rules: readonly TicketRule[],
): RuleEvaluation {
	const result: RuleEvaluation = {
		patch: {},
		ticket: { ...ticket },
		firings: [],
		settledActions: [],
	};
	const settled = new Set<ActionType>();

	for (const rule of [...rules].sort(
		(a, b) => a.position - b.position || a.id.localeCompare(b.id),
	)) {
		if (
			!rule.enabled ||
			!rule.criteria.every((criterion) => matches(result.ticket, criterion))
		)
			continue;
		const firing: RuleFiring = {
			ruleId: rule.id,
			ruleName: rule.name,
			rulePosition: rule.position,
			applied: [],
			skipped: [],
		};
		for (const action of rule.actions) {
			if (settled.has(action.type)) {
				firing.skipped.push({ ...action, reason: "action_already_set" });
				continue;
			}
			if (action.type !== "route_human") {
				const field = actionField[action.type];
				(result.patch as Record<string, unknown>)[field] = action.value;
				(result.ticket as unknown as Record<string, unknown>)[field] =
					action.value;
			}
			settled.add(action.type);
			result.settledActions.push(action.type);
			firing.applied.push(action);
		}
		result.firings.push(firing);
	}
	return result;
}

export interface TokenRun {
	ticketId: string;
	promptTokens: number | null;
	completionTokens: number | null;
}

export interface TokensPerTicket {
	ticketCount: number;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	tokensPerTicket: number | null;
}

/** Measures a ticket cohort, including tickets that needed no model run. */
export function measureTokensPerTicket(
	ticketIds: readonly string[],
	runs: readonly TokenRun[],
): TokensPerTicket {
	const cohort = new Set(ticketIds);
	let promptTokens = 0;
	let completionTokens = 0;
	for (const run of runs) {
		if (!cohort.has(run.ticketId)) continue;
		promptTokens += run.promptTokens ?? 0;
		completionTokens += run.completionTokens ?? 0;
	}
	const totalTokens = promptTokens + completionTokens;
	return {
		ticketCount: cohort.size,
		promptTokens,
		completionTokens,
		totalTokens,
		tokensPerTicket: cohort.size ? totalTokens / cohort.size : null,
	};
}
