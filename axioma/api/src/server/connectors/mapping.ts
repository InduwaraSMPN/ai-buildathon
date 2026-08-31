/**
 * Pure mapping from a foreign ITSM record onto our ticket vocabulary.
 *
 * Nothing here touches the database or the network. The connector's transport
 * fetches records, this decides what they mean, and the store applies the
 * result — the same three-layer split `server/directory/` uses.
 *
 * Two rules are structural rather than conventional:
 *
 * - `priority` is never mappable. It is derived from impact and urgency by
 *   `derivePriority`, so a foreign priority has to be mapped *into* those and
 *   re-derived. `MappableField` omits it so a mapping that tries fails to
 *   typecheck.
 * - Environment is never derived from the mapped ticket. It comes from an
 *   administrator-maintained allowlist keyed on a foreign field, because the
 *   write-authorization for every foreign field is configured in a system we
 *   do not administer and cannot introspect.
 */

import {
	derivePriority,
	IMPACT_LEVELS,
	type Impact,
	type ITSM_MAPPABLE_FIELDS,
	type ITSM_UNMAPPED_POLICIES,
	type Priority,
	RECORD_TYPES,
	type RecordType,
	URGENCY_LEVELS,
	type Urgency,
} from "@/shared";

/** What happens to a foreign value with no mapping entry. Vocabulary in `@/shared`. */
export type UnmappedPolicy = (typeof ITSM_UNMAPPED_POLICIES)[number];

/**
 * Fields a mapping may target. `priority` is deliberately absent — it is
 * derived, and offering it would let an administrator configure something the
 * system cannot honour.
 */
export type MappableField = (typeof ITSM_MAPPABLE_FIELDS)[number];

export type FieldMapping = {
	sourceField: string;
	targetField: MappableField;
	/** Foreign value to local value. Compared case-insensitively after trimming. */
	valueMap: Record<string, string>;
	onUnmapped: UnmappedPolicy;
	/** Used only when `onUnmapped` is `default`. */
	defaultValue?: string;
};

/** One record as the transport hands it over, before any interpretation. */
export type ForeignRecord = {
	externalId: string;
	/** The human-facing reference in the foreign system, e.g. `INC0010023`. */
	externalKey: string;
	externalUrl: string | null;
	title: string;
	body: string;
	/** ISO 8601, as reported by the foreign system. */
	updatedAt: string;
	requesterEmail: string | null;
	/** Raw foreign structured fields, keyed by foreign field name. */
	fields: Record<string, string | null>;
};

export type MappedTicket = {
	recordType: RecordType;
	impact: Impact;
	urgency: Urgency;
	/** Derived from impact and urgency; never mapped. */
	priority: Priority;
	/** Local status key, or null to take the default status. */
	status: string | null;
	serviceId: string;
	serviceSubcategoryId: string;
};

/** A value that could not be mapped, kept with enough context to fix the mapping. */
export type MappingIssue = {
	sourceField: string;
	targetField: MappableField;
	value: string | null;
	reason: string;
};

export type MappingOutcome =
	| { ok: true; ticket: MappedTicket; quarantined: MappingIssue[] }
	| { ok: false; rejected: MappingIssue[]; quarantined: MappingIssue[] };

/** Local vocabulary the mapping is validated against. */
export type MappingVocabulary = {
	statusKeys: readonly string[];
	serviceIds: readonly string[];
	serviceSubcategoryIds: readonly string[];
	defaultServiceId: string;
	defaultServiceSubcategoryId: string;
};

const CLOSED_ENUMS = {
	recordType: RECORD_TYPES,
	impact: IMPACT_LEVELS,
	urgency: URGENCY_LEVELS,
} as const satisfies Partial<Record<MappableField, readonly string[]>>;

const normalizeKey = (value: string) => value.trim().toLowerCase();

/** Case-insensitive lookup, so a foreign `Resolved` matches a mapped `resolved`. */
function lookup(valueMap: Record<string, string>, value: string) {
	const wanted = normalizeKey(value);
	for (const [key, mapped] of Object.entries(valueMap))
		if (normalizeKey(key) === wanted) return mapped;
	return undefined;
}

function permitted(
	target: MappableField,
	value: string,
	vocabulary: MappingVocabulary,
): boolean {
	if (target in CLOSED_ENUMS)
		return (
			CLOSED_ENUMS[target as keyof typeof CLOSED_ENUMS] as readonly string[]
		).includes(value);
	if (target === "status") return vocabulary.statusKeys.includes(value);
	if (target === "serviceId") return vocabulary.serviceIds.includes(value);
	return vocabulary.serviceSubcategoryIds.includes(value);
}

/**
 * Applies field mappings to one foreign record.
 *
 * Unmapped values follow the mapping's own policy. `quarantine` is the
 * recommended default: rejecting loses the ticket, defaulting lies about it,
 * and quarantining keeps it while telling an administrator what to fix.
 */
export function mapForeignRecord(
	record: ForeignRecord,
	mappings: readonly FieldMapping[],
	vocabulary: MappingVocabulary,
): MappingOutcome {
	const resolved = new Map<MappableField, string>();
	const rejected: MappingIssue[] = [];
	const quarantined: MappingIssue[] = [];

	for (const mapping of mappings) {
		const raw = record.fields[mapping.sourceField] ?? null;
		const issue = (reason: string): MappingIssue => ({
			sourceField: mapping.sourceField,
			targetField: mapping.targetField,
			value: raw,
			reason,
		});

		if (raw === null || raw.trim() === "") {
			// An absent source field is not an error; the target keeps its default.
			continue;
		}

		const mapped = lookup(mapping.valueMap, raw);
		if (mapped === undefined) {
			if (mapping.onUnmapped === "reject") {
				rejected.push(issue("no mapping entry for this value"));
				continue;
			}
			if (mapping.onUnmapped === "quarantine") {
				quarantined.push(issue("no mapping entry for this value"));
				continue;
			}
			if (
				mapping.defaultValue === undefined ||
				!permitted(mapping.targetField, mapping.defaultValue, vocabulary)
			) {
				// A default that is not itself valid is a configuration error, and
				// falling back to it silently would be worse than quarantining.
				quarantined.push(issue("no mapping entry, and the default is invalid"));
				continue;
			}
			resolved.set(mapping.targetField, mapping.defaultValue);
			continue;
		}

		if (!permitted(mapping.targetField, mapped, vocabulary)) {
			quarantined.push(
				issue(
					`maps to "${mapped}", which is not a known ${mapping.targetField}`,
				),
			);
			continue;
		}
		resolved.set(mapping.targetField, mapped);
	}

	if (rejected.length) return { ok: false, rejected, quarantined };

	const impact = (resolved.get("impact") ?? "medium") as Impact;
	const urgency = (resolved.get("urgency") ?? "medium") as Urgency;
	const serviceId = resolved.get("serviceId") ?? vocabulary.defaultServiceId;
	// Subcategory must belong to the resolved service; a mapped pair that does
	// not agree is caught at insert by the composite foreign key, so keep the
	// defaults together rather than mixing a mapped service with a default
	// subcategory.
	const serviceSubcategoryId =
		resolved.get("serviceId") && !resolved.get("serviceSubcategoryId")
			? vocabulary.defaultServiceSubcategoryId
			: (resolved.get("serviceSubcategoryId") ??
				vocabulary.defaultServiceSubcategoryId);

	return {
		ok: true,
		quarantined,
		ticket: {
			recordType: (resolved.get("recordType") ?? "incident") as RecordType,
			impact,
			urgency,
			priority: derivePriority(impact, urgency),
			status: resolved.get("status") ?? null,
			serviceId,
			serviceSubcategoryId,
		},
	};
}

/**
 * One row of the environment allowlist. Ordered; first match wins.
 *
 * This is an allowlist rather than a trust decision. A foreign value that is
 * not listed falls through to the connector default, and a foreign value can
 * never name an environment an administrator did not already enter.
 */
export type EnvironmentRoute = {
	sourceField: string;
	sourceValue: string;
	environmentKey: string;
	position: number;
};

export type EnvironmentResolution = {
	environmentKey: string;
	via: "route" | "default" | "default_after_invalid_route";
	matched?: EnvironmentRoute;
};

/**
 * Resolves the environment for a synced ticket.
 *
 * Never consults the mapped ticket. Service is mapped from whatever signal is
 * available — including, in the incumbent's own products, a model classifying
 * the free-text description — so letting service imply environment would let
 * ticket prose choose the cluster.
 *
 * Fails closed in both directions: an unmatched record takes the connector
 * default, and a route naming an environment that does not exist is ignored
 * rather than honoured.
 */
export function resolveEnvironmentKey(
	record: ForeignRecord,
	routes: readonly EnvironmentRoute[],
	defaultEnvironmentKey: string,
	knownEnvironmentKeys: readonly string[],
): EnvironmentResolution {
	let sawInvalidRoute = false;
	const ordered = [...routes].sort(
		(left, right) =>
			left.position - right.position ||
			left.sourceField.localeCompare(right.sourceField) ||
			left.sourceValue.localeCompare(right.sourceValue),
	);

	for (const route of ordered) {
		const raw = record.fields[route.sourceField] ?? null;
		if (raw === null) continue;
		if (normalizeKey(raw) !== normalizeKey(route.sourceValue)) continue;
		if (!knownEnvironmentKeys.includes(route.environmentKey)) {
			sawInvalidRoute = true;
			continue;
		}
		return {
			environmentKey: route.environmentKey,
			via: "route",
			matched: route,
		};
	}

	return {
		environmentKey: defaultEnvironmentKey,
		via: sawInvalidRoute ? "default_after_invalid_route" : "default",
	};
}
