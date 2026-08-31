/**
 * ServiceNow transport. Fetch and post only — no database, no interpretation.
 *
 * Polls rather than receiving webhooks, and that is forced by the deployment
 * posture rather than chosen: Axiōma runs inside the customer's network, so a
 * cloud instance has nowhere to deliver a webhook. ServiceNow's own answer to
 * the same constraint is the MID Server, which is outbound-only and cannot
 * serve inbound requests at all.
 *
 * Authentication is OAuth 2.0 client credentials — the one grant with no human
 * in the flow, which is what a scheduled poll needs. Tokens are cached in
 * process with an expiry; nothing else in the tree refreshes a credential,
 * because directory and mail both use a static bearer.
 */

import type { ForeignComment, ForeignRecordWithComments } from "./plan";

const TOKEN_PATH = "/oauth_token.do";
const TABLE_PATH = "/api/now/table";
const REQUEST_TIMEOUT_MS = 30_000;
/** Keyset pagination beats sysparm_offset on a large table. */
const PAGE_SIZE = 200;
/** Refresh a little before expiry so a poll never races the boundary. */
const TOKEN_SKEW_MS = 60_000;

export type ServiceNowCredentials = {
	baseUrl: string;
	clientId: string;
	clientSecret: string;
};

export class ServiceNowError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly retryAfterMs: number | null,
	) {
		super(message);
		this.name = "ServiceNowError";
	}
}

type CachedToken = { token: string; expiresAtMs: number };

/**
 * Reads `Retry-After` in both documented forms — delay-seconds and HTTP-date.
 * Returning null means the caller decides, rather than guessing zero.
 */
function retryAfterMs(response: Response, nowMs: number): number | null {
	const header = response.headers.get("retry-after");
	if (!header) return null;
	const seconds = Number(header);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
	const date = Date.parse(header);
	return Number.isNaN(date) ? null : Math.max(0, date - nowMs);
}

/** Escapes a value for a `sysparm_query` term, where `^` and `,` are separators. */
const escapeQueryValue = (value: string) => value.replace(/[\^,]/g, " ");

export class ServiceNowClient {
	private token: CachedToken | null = null;

	constructor(
		private readonly credentials: ServiceNowCredentials,
		private readonly fetchImpl: typeof fetch = fetch,
		private readonly now: () => number = () => Date.now(),
	) {}

	private url(path: string) {
		return `${this.credentials.baseUrl.replace(/\/+$/, "")}${path}`;
	}

	/** Cached client-credentials token. Refreshed slightly before expiry. */
	async accessToken(): Promise<string> {
		const nowMs = this.now();
		if (this.token && this.token.expiresAtMs - TOKEN_SKEW_MS > nowMs)
			return this.token.token;

		const body = new URLSearchParams({
			grant_type: "client_credentials",
			client_id: this.credentials.clientId,
			client_secret: this.credentials.clientSecret,
		});
		const response = await this.fetchImpl(this.url(TOKEN_PATH), {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!response.ok)
			throw new ServiceNowError(
				`ServiceNow token request failed with ${response.status}`,
				response.status,
				retryAfterMs(response, nowMs),
			);
		const payload = (await response.json()) as {
			access_token?: string;
			expires_in?: number;
		};
		if (!payload.access_token)
			throw new ServiceNowError(
				"ServiceNow token response carried no access_token",
				response.status,
				null,
			);
		this.token = {
			token: payload.access_token,
			expiresAtMs: nowMs + (payload.expires_in ?? 1800) * 1000,
		};
		return this.token.token;
	}

	/** Drops the cached token so the next call re-authenticates. */
	forgetToken() {
		this.token = null;
	}

	private async request(path: string, init: RequestInit = {}) {
		const token = await this.accessToken();
		const response = await this.fetchImpl(this.url(path), {
			...init,
			headers: {
				...init.headers,
				authorization: `Bearer ${token}`,
				accept: "application/json",
			},
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (response.status === 401) {
			// The token may have been revoked rather than expired; make the next
			// attempt re-authenticate instead of replaying a dead credential.
			this.forgetToken();
			throw new ServiceNowError(
				"ServiceNow rejected the credential",
				401,
				null,
			);
		}
		if (!response.ok)
			throw new ServiceNowError(
				`ServiceNow request failed with ${response.status}`,
				response.status,
				retryAfterMs(response, this.now()),
			);
		return response;
	}

	/**
	 * Fetches incidents changed since the watermark, oldest first.
	 *
	 * Ordering by `sys_updated_on` and paging on the last value seen is keyset
	 * pagination: it is stable while records are being written underneath it,
	 * which `sysparm_offset` is not.
	 */
	async fetchChangedIncidents(params: {
		since: Date | null;
		filter?: string;
		limit?: number;
	}): Promise<ForeignRecordWithComments[]> {
		const terms: string[] = [];
		if (params.since)
			terms.push(
				`sys_updated_on>${escapeQueryValue(toServiceNowDateTime(params.since))}`,
			);
		if (params.filter?.trim()) terms.push(params.filter.trim());
		terms.push("ORDERBYsys_updated_on");

		// Built with encodeURIComponent rather than URLSearchParams: the latter
		// encodes a space as `+`, which only means space under form-encoding
		// rules. A date-time in `sysparm_query` read literally would break the
		// watermark silently — returning everything or nothing — so `%20` is used
		// because it is unambiguous under both readings.
		const query = [
			`sysparm_query=${encodeURIComponent(terms.join("^"))}`,
			`sysparm_limit=${params.limit ?? PAGE_SIZE}`,
			"sysparm_display_value=true",
			"sysparm_exclude_reference_link=true",
		].join("&");
		const response = await this.request(`${TABLE_PATH}/incident?${query}`);
		const payload = (await response.json()) as { result?: unknown };
		const rows = Array.isArray(payload.result) ? payload.result : [];
		return rows.map((row) => toForeignRecord(row as Record<string, unknown>));
	}

	/**
	 * Reads one incident's terminal state, for the proposal back-fill.
	 *
	 * A separate read from the watermark poll on purpose: this revisits records
	 * the watermark has already passed, to ask what became of them rather than
	 * what changed.
	 */
	async fetchIncidentState(
		externalId: string,
	): Promise<{ resolution: string | null; closedBy: string | null } | null> {
		const query = [
			"sysparm_display_value=true",
			"sysparm_exclude_reference_link=true",
			"sysparm_fields=state,close_code,closed_by,resolved_by,incident_state",
		].join("&");
		const response = await this.request(
			`${TABLE_PATH}/incident/${encodeURIComponent(externalId)}?${query}`,
		);
		const payload = (await response.json()) as {
			result?: Record<string, unknown>;
		};
		const row = payload.result;
		if (!row) return null;
		// close_code is the resolution proper; state is the fallback for an
		// instance that does not use close codes.
		const resolution = asString(row.close_code) ?? asString(row.state);
		return {
			resolution,
			closedBy: asString(row.closed_by) ?? asString(row.resolved_by),
		};
	}

	/**
	 * Posts a work note.
	 *
	 * A work note, never a public comment. The employee-facing thread lives in
	 * the customer's system and Axel does not post into a human conversation;
	 * an internal annotation read by IT staff is a different artefact. The
	 * write is performed here, by the API, so no ITSM credential is ever
	 * reachable from a tool the model selects.
	 *
	 * `correlation_id` and `correlation_display` are populated alongside,
	 * because that is what ServiceNow's own convention is for — it gives their
	 * technicians a back-link without a custom field, and it gives us a
	 * platform-native echo-suppression signal.
	 */
	async postWorkNote(params: {
		externalId: string;
		note: string;
		correlationId?: string;
	}): Promise<{ updatedAt: string | null; receiptId: string | null }> {
		const body: Record<string, string> = { work_notes: params.note };
		if (params.correlationId) {
			body.correlation_id = params.correlationId;
			body.correlation_display = "Axioma";
		}
		const response = await this.request(
			`${TABLE_PATH}/incident/${encodeURIComponent(params.externalId)}`,
			{
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			},
		);
		const payload = (await response.json()) as {
			result?: Record<string, unknown>;
		};
		const result = payload.result ?? {};
		return {
			updatedAt: asString(result.sys_updated_on),
			receiptId: asString(result.sys_id),
		};
	}
}

const asString = (value: unknown): string | null =>
	typeof value === "string" && value.trim() !== "" ? value : null;

/**
 * ServiceNow date-times are `YYYY-MM-DD HH:MM:SS` in UTC, not ISO 8601.
 * Passing an ISO string into `sys_updated_on>` silently matches nothing.
 */
export function toServiceNowDateTime(date: Date): string {
	return date.toISOString().slice(0, 19).replace("T", " ");
}

/** The inverse, so a fetched value can be compared and stored as a real date. */
export function fromServiceNowDateTime(value: string): string {
	const trimmed = value.trim();
	if (trimmed === "") return trimmed;
	return `${trimmed.replace(" ", "T")}Z`;
}

/**
 * Maps a raw ServiceNow row onto the transport-neutral shape the planner reads.
 * Structured fields are carried through verbatim under `fields` so the mapping
 * layer, not this one, decides what they mean.
 */
export function toForeignRecord(
	row: Record<string, unknown>,
): ForeignRecordWithComments {
	const updatedRaw = asString(row.sys_updated_on) ?? "";
	const fields: Record<string, string | null> = {};
	for (const [key, value] of Object.entries(row))
		fields[key] = typeof value === "string" ? value : null;

	return {
		externalId: asString(row.sys_id) ?? "",
		externalKey: asString(row.number) ?? "",
		externalUrl: null,
		title: asString(row.short_description) ?? "",
		body: asString(row.description) ?? "",
		updatedAt: fromServiceNowDateTime(updatedRaw),
		requesterEmail: asString(row.caller_email) ?? asString(row.caller_id),
		fields,
		statusValue: asString(row.state),
		comments: parseJournal(asString(row.comments_and_work_notes) ?? ""),
	};
}

/**
 * ServiceNow returns the journal as a flattened display string rather than as
 * rows. This extracts enough to tell our own entries from the customer's,
 * which is what decides whether a change justifies a run.
 */
export function parseJournal(journal: string): ForeignComment[] {
	if (!journal.trim()) return [];
	const entries: ForeignComment[] = [];
	// Entries lead with `YYYY-MM-DD HH:MM:SS - Name (Work notes)`.
	const pattern =
		/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - ([^(]+)\((Work notes|Additional comments)\)/g;
	let index = 0;
	for (const match of journal.matchAll(pattern)) {
		const [, at, author] = match;
		if (!at) continue;
		entries.push({
			externalId: `${at}#${index}`,
			ours: (author ?? "").trim().toLowerCase().includes("axioma"),
			createdAt: fromServiceNowDateTime(at),
		});
		index += 1;
	}
	return entries;
}
