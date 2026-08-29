import type { Impact, RecordType, TicketRoute, Urgency } from "@/shared";

export const RULE_FIELDS = [
	"serviceId",
	"requesterId",
	"requesterDepartment",
	"recordType",
	"origin",
	"title",
	"body",
] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

export type RuleCriterion =
	| {
			field: Exclude<RuleField, "title" | "body">;
			operator: "equals" | "in";
			value: string | string[];
	  }
	| { field: "title" | "body"; operator: "contains" | "equals"; value: string };

export type RuleAction =
	| { type: "set_service"; value: string }
	| { type: "set_impact"; value: Impact }
	| { type: "set_urgency"; value: Urgency }
	| { type: "set_record_type"; value: RecordType }
	| { type: "set_route"; value: TicketRoute }
	| { type: "set_team"; value: string }
	| { type: "set_assignee"; value: string }
	| { type: "route_human" };

export interface RuleFiring {
	ruleId: string;
	ruleName: string;
	rulePosition: number;
	applied: RuleAction[];
	skipped: Array<RuleAction & { reason: "action_already_set" }>;
}
