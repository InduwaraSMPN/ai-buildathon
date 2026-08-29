import {
	IMPACT_LEVELS,
	type Impact,
	RECORD_TYPES,
	type RecordType,
	TICKET_ROUTES,
	type TicketRoute,
	URGENCY_LEVELS,
	type Urgency,
} from "@/shared";

export type Action =
	| { type: "set_service"; value: string }
	| { type: "set_impact"; value: Impact }
	| { type: "set_urgency"; value: Urgency }
	| { type: "set_team"; value: string }
	| { type: "set_assignee"; value: string }
	| { type: "set_sla"; value: string }
	| { type: "set_ola"; value: string }
	| { type: "set_record_type"; value: RecordType }
	| { type: "set_route"; value: TicketRoute }
	| { type: "route_human" }
	| {
			type: "send_webhook";
			value: { url: string; secret?: string };
	  }
	| {
			type: "send_notification";
			value: { recipientId: string; title?: string; body?: string };
	  };

export const ACTION_TYPES = [
	"set_service",
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

const nonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0;
const oneOf = <T extends string>(
	values: readonly T[],
	value: unknown,
): value is T =>
	typeof value === "string" && (values as readonly string[]).includes(value);

export function isAction(value: unknown): value is Action {
	if (typeof value !== "object" || value === null || !("type" in value))
		return false;
	const action = value as { type?: unknown; value?: unknown };
	if (action.type === "route_human") return true;
	if (typeof action.type !== "string" || !actionTypeSet.has(action.type))
		return false;
	if (action.type === "set_impact") return oneOf(IMPACT_LEVELS, action.value);
	if (action.type === "set_urgency") return oneOf(URGENCY_LEVELS, action.value);
	if (action.type === "set_record_type")
		return oneOf(RECORD_TYPES, action.value);
	if (action.type === "set_route") return oneOf(TICKET_ROUTES, action.value);
	if (action.type === "send_webhook") {
		if (typeof action.value !== "object" || action.value === null) return false;
		const payload = action.value as { url?: unknown; secret?: unknown };
		if (typeof payload.url !== "string") return false;
		try {
			const url = new URL(payload.url);
			return (
				(url.protocol === "http:" || url.protocol === "https:") &&
				(payload.secret === undefined || nonEmptyString(payload.secret))
			);
		} catch {
			return false;
		}
	}
	if (action.type === "send_notification") {
		if (typeof action.value !== "object" || action.value === null) return false;
		const payload = action.value as {
			recipientId?: unknown;
			title?: unknown;
			body?: unknown;
		};
		return (
			nonEmptyString(payload.recipientId) &&
			(payload.title === undefined || typeof payload.title === "string") &&
			(payload.body === undefined || typeof payload.body === "string")
		);
	}
	return nonEmptyString(action.value);
}
