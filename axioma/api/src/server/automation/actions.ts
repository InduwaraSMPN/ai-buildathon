import type {
	Category,
	Impact,
	RecordType,
	TicketRoute,
	Urgency,
} from "@/shared";

export type Action =
	| { type: "set_service"; value: string }
	| { type: "set_category"; value: Category }
	| { type: "set_impact"; value: Impact }
	| { type: "set_urgency"; value: Urgency }
	| { type: "set_team"; value: string }
	| { type: "set_assignee"; value: string }
	| { type: "set_sla"; value: string }
	| { type: "set_ola"; value: string }
	| { type: "set_record_type"; value: RecordType }
	| { type: "set_route"; value: TicketRoute }
	| { type: "route_human" }
	| { type: "send_webhook"; value: Record<string, unknown> }
	| { type: "send_notification"; value: Record<string, unknown> };

export const ACTION_TYPES = [
	"set_service",
	"set_category",
	"set_impact",
	"set_urgency",
	"set_team",
	"set_assignee",
	"set_sla",
	"set_ola",
	"set_record_type",
	"set_route",
	"route_human",
	"send_webhook",
	"send_notification",
] as const satisfies readonly Action["type"][];

export type ActionType = (typeof ACTION_TYPES)[number];
export const actionTypeSet = new Set<string>(ACTION_TYPES);

export function isAction(value: unknown): value is Action {
	return (
		typeof value === "object" &&
		value !== null &&
		"type" in value &&
		typeof value.type === "string" &&
		actionTypeSet.has(value.type)
	);
}
