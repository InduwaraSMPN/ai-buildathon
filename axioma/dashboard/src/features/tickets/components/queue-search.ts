import type {
	TicketCategory,
	TicketListInput,
	TicketPriority,
	TicketRecordType,
	TicketRoute,
	TicketSort,
	TicketSortDirection,
	TicketStatus,
} from "../api/types";

const values =
	<T extends string>(allowed: readonly T[]) =>
	(value: unknown) => {
		const input = Array.isArray(value)
			? value
			: typeof value === "string"
				? [value]
				: [];
		const normalized = input.filter(
			(item): item is T =>
				typeof item === "string" && allowed.includes(item as T),
		);
		return normalized.length ? [...new Set(normalized)] : undefined;
	};

const status = values<TicketStatus>([
	"open",
	"routing",
	"resolving",
	"resolved",
	"escalated",
	"closed",
]);
const priority = values<TicketPriority>(["P1", "P2", "P3", "P4"]);
const recordType = values<TicketRecordType>(["incident", "service_request"]);
const category = (value: unknown): (TicketCategory | null)[] | undefined => {
	const input = Array.isArray(value) ? value : [value];
	const normalized = input.flatMap((item) =>
		item === null || item === "unclassified"
			? [null]
			: ["infrastructure", "device", "access"].includes(String(item))
				? [item as TicketCategory]
				: [],
	);
	return normalized.length ? [...new Set(normalized)] : undefined;
};
const route = values<TicketRoute>([
	"unassigned",
	"infrastructure",
	"device",
	"application",
	"identity",
	"human_triage",
]);
const sortBy = (value: unknown): TicketSort | undefined =>
	["priority", "updatedAt", "createdAt"].includes(String(value))
		? (value as TicketSort)
		: undefined;
const sortDirection = (value: unknown): TicketSortDirection | undefined =>
	value === "asc" || value === "desc" ? value : undefined;

export type TicketQueueSearch = Partial<
	Pick<
		TicketListInput,
		| "status"
		| "priority"
		| "recordType"
		| "category"
		| "route"
		| "assigneeId"
		| "teamId"
		| "myQueue"
		| "deviceId"
		| "unassigned"
		| "escalatedSince"
		| "resolvedAt"
		| "autonomous"
		| "search"
		| "cursor"
		| "sortBy"
		| "sortDirection"
	>
> & {
	density?: "compact" | "comfortable";
	cursorHistory?: string[];
};

export function normalizeTicketQueueSearch(
	search: Record<string, unknown>,
): TicketQueueSearch {
	const text = (value: unknown, max: number) =>
		typeof value === "string" && value.trim()
			? value.trim().slice(0, max)
			: undefined;
	return {
		status: status(search.status),
		priority: priority(search.priority),
		recordType: recordType(search.recordType),
		category: category(search.category),
		route: route(search.route),
		assigneeId: text(search.assigneeId, 160),
		teamId: text(search.teamId, 160),
		myQueue: search.myQueue === true || search.myQueue === "true" || undefined,
		deviceId: text(search.deviceId, 160),
		unassigned:
			search.unassigned === true || search.unassigned === "true" || undefined,
		escalatedSince: (() => {
			const value = text(search.escalatedSince, 40);
			return value && !Number.isNaN(Date.parse(value))
				? new Date(value)
				: undefined;
		})(),
		resolvedAt:
			search.resolvedAt === true || search.resolvedAt === "true" || undefined,
		autonomous:
			search.autonomous === true || search.autonomous === "true" || undefined,
		search: text(search.search, 160),
		cursor: text(search.cursor, 2_000),
		cursorHistory: Array.isArray(search.cursorHistory)
			? search.cursorHistory
					.map((cursor) => text(cursor, 2_000))
					.filter((cursor): cursor is string => cursor !== undefined)
					.slice(-100)
			: undefined,
		sortBy: sortBy(search.sortBy),
		sortDirection: sortDirection(search.sortDirection),
		density: search.density === "comfortable" ? "comfortable" : undefined,
	};
}

export function toTicketListInput(search: TicketQueueSearch): TicketListInput {
	return {
		scope: "all",
		status: search.status,
		priority: search.priority,
		recordType: search.recordType,
		category: search.category,
		route: search.route,
		assigneeId: search.assigneeId,
		teamId: search.teamId,
		myQueue: search.myQueue,
		deviceId: search.deviceId,
		unassigned: search.unassigned,
		escalatedSince: search.escalatedSince,
		resolvedAt: search.resolvedAt,
		autonomous: search.autonomous,
		search: search.search,
		cursor: search.cursor,
		sortBy: search.sortBy ?? "priority",
		sortDirection: search.sortDirection ?? "asc",
		limit: 50,
	};
}
