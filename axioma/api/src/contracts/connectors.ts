import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	ITSM_DISPATCH_OUTCOMES,
	ITSM_MAPPABLE_FIELDS,
	ITSM_PROPOSAL_VERDICTS,
	ITSM_SYNC_MODES,
	ITSM_SYNC_STATUSES,
	ITSM_UNMAPPED_POLICIES,
	ITSM_VENDORS,
	ITSM_WRITEBACK_STATUSES,
} from "../shared";

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** 0/8, 10/8, 127/8, 169.254/16, 172.16/12 and 192.168/16. */
function isPrivateIpv4(host: string): boolean {
	const match = IPV4.exec(host);
	if (!match) return false;
	const first = Number(match[1]);
	const second = Number(match[2]);
	return (
		first === 0 ||
		first === 10 ||
		first === 127 ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168)
	);
}

/** `::1` and `::`, fc00::/7 (unique local) and fe80::/10 (link local). */
function isPrivateIpv6(host: string): boolean {
	if (!host.includes(":")) return false;
	if (host === "::1" || host === "::") return true;
	// An IPv4-mapped address reaches the same interface by another spelling, and
	// URL parsing rewrites the dotted form into hex, so both are decoded.
	const mapped = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
	if (mapped) {
		const high = Number.parseInt(mapped[1] ?? "", 16);
		const low = Number.parseInt(mapped[2] ?? "", 16);
		return isPrivateIpv4(
			`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`,
		);
	}
	if (isPrivateIpv4(host.slice(host.lastIndexOf(":") + 1))) return true;
	const head = host.split(":")[0] ?? "";
	return /^f[cd][0-9a-f]{0,2}$/.test(head) || /^fe[89ab][0-9a-f]?$/.test(head);
}

/**
 * Says why a connector may not be pointed at this URL, or null if it may.
 *
 * The client-credentials POST carries the decrypted client secret in its body,
 * so whoever answers at `baseUrl` is handed the credential into the customer's
 * system of record. Plain `http:` hands it to the network as well, and a host
 * that only resolves from inside the deployment — a cloud metadata endpoint, a
 * neighbouring service, the API itself — is an exfiltration target rather than
 * a plausible ITSM. Neither is something an administrator has any reason to
 * type, so both are refused here and again before the client is built: this
 * schema guards the one path a URL is typed through, and the row can be
 * written by paths that never saw it.
 */
export function connectorBaseUrlIssue(value: string): string | null {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return "must be an absolute URL";
	}
	if (url.protocol !== "https:")
		return "must use https, because the client secret travels in the request body";
	const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
	if (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		host.endsWith(".internal") ||
		isPrivateIpv4(host) ||
		isPrivateIpv6(host)
	)
		return "must not name a loopback, link-local, private or internal host";
	return null;
}

const connectorBaseUrl = z.string().superRefine((value, ctx) => {
	const issue = connectorBaseUrlIssue(value);
	if (issue) ctx.addIssue({ code: "custom", message: `baseUrl ${issue}` });
});

/**
 * The connector as an administrator sees it.
 *
 * The client secret is absent by construction rather than by filtering. The
 * portal's boundary is enforced by data shape rather than client discipline,
 * and a credential into the customer's system of record deserves at least the
 * same treatment — a screen that renders nothing sensitive while fetching it
 * is still a leak.
 */
const connector = z.object({
	id: z.string(),
	key: z.string(),
	vendor: z.enum(ITSM_VENDORS),
	label: z.string(),
	baseUrl: z.string(),
	clientId: z.string(),
	recordFilter: z.string(),
	defaultEnvironmentId: z.string(),
	defaultEnvironmentKey: z.string(),
	defaultEnvironmentMode: z.string(),
	enabled: z.boolean(),
	disabledReason: z.string().nullable(),
	pollIntervalSeconds: z.number().int(),
	createCeiling: z.number().int(),
	dispatchCeiling: z.number().int(),
	consecutiveFailures: z.number().int(),
	watermark: z.date().nullable(),
	lastSuccessfulSyncAt: z.date().nullable(),
	createdAt: z.date(),
});

const connectorRun = z.object({
	id: z.string(),
	connectorId: z.string(),
	mode: z.enum(ITSM_SYNC_MODES),
	status: z.enum(ITSM_SYNC_STATUSES),
	fetchedCount: z.number().int(),
	createdCount: z.number().int(),
	updatedCount: z.number().int(),
	skippedCount: z.number().int(),
	dispatchedCount: z.number().int(),
	quarantinedCount: z.number().int(),
	error: z.string().nullable(),
	summary: z.unknown(),
	createdAt: z.date(),
});

const fieldMapping = z.object({
	id: z.string(),
	connectorId: z.string(),
	sourceField: z.string(),
	targetField: z.enum(ITSM_MAPPABLE_FIELDS),
	valueMap: z.record(z.string(), z.string()),
	onUnmapped: z.enum(ITSM_UNMAPPED_POLICIES),
	defaultValue: z.string().nullable(),
});

const environmentRoute = z.object({
	id: z.string(),
	connectorId: z.string(),
	sourceField: z.string(),
	sourceValue: z.string(),
	environmentId: z.string(),
	environmentKey: z.string(),
	environmentMode: z.string(),
	position: z.number().int(),
});

const writeback = z.object({
	id: z.string(),
	connectorId: z.string(),
	ticketId: z.string(),
	ticketNumber: z.string().nullable(),
	status: z.enum(ITSM_WRITEBACK_STATUSES),
	attemptCount: z.number().int(),
	maxAttempts: z.number().int(),
	nextAttemptAt: z.date().nullable(),
	lastError: z.string().nullable(),
	createdAt: z.date(),
	completedAt: z.date().nullable(),
});

const dispatchLedgerEntry = z.object({
	id: z.string(),
	ticketId: z.string(),
	ticketNumber: z.string().nullable(),
	triggerKey: z.string(),
	outcome: z.enum(ITSM_DISPATCH_OUTCOMES),
	detail: z.string().nullable(),
	dispatchedAt: z.date(),
});

/** What a preview would do, per record, without doing it. */
const previewDecision = z.object({
	externalId: z.string(),
	externalKey: z.string(),
	kind: z.enum(["create", "update", "skip"]),
	reason: z.string().nullable(),
	willDispatch: z.boolean(),
	environmentKey: z.string().nullable(),
	environmentVia: z.string().nullable(),
});

const previewResult = z.object({
	fetchedCount: z.number().int(),
	createCount: z.number().int(),
	updateCount: z.number().int(),
	skipCount: z.number().int(),
	dispatchCount: z.number().int(),
	decisions: z.array(previewDecision),
	quarantined: z.array(
		z.object({
			sourceField: z.string(),
			targetField: z.string(),
			value: z.string().nullable(),
			reason: z.string(),
		}),
	),
});

const connectorId = z.object({ connectorId: z.string() });

/** Where a ticket came from, when it came from a foreign system. */
const ticketConnectorOrigin = z
	.object({
		connectorId: z.string(),
		connectorLabel: z.string(),
		vendor: z.enum(ITSM_VENDORS),
		externalKey: z.string(),
		externalUrl: z.string().nullable(),
		foreignUpdatedAt: z.date(),
		dispatchCount: z.number().int(),
	})
	.nullable();

const proposalCall = z.object({
	ordinal: z.number().int(),
	tool: z.string(),
	input: z.unknown(),
	verdict: z.enum(ITSM_PROPOSAL_VERDICTS).nullable(),
});

/** A shadow-mode proposal as a reviewer sees it. */
const proposal = z
	.object({
		id: z.string(),
		runId: z.string(),
		ticketId: z.string(),
		postedAt: z.date().nullable(),
		openedAt: z.date().nullable(),
		calls: z.array(proposalCall),
	})
	.nullable();

/**
 * Reported together, never one alone. Raw agreement flatters a skewed action
 * distribution; kappa collapses on the same data; AC1 stays interpretable.
 * `opened` is what decides whether any of them mean anything.
 */
const agreementReport = z.object({
	total: z.number().int(),
	opened: z.number().int(),
	scored: z.number().int(),
	rawAgreement: z.number().nullable(),
	cohensKappa: z.number().nullable(),
	gwetsAC1: z.number().nullable(),
	byClass: z.array(
		z.object({
			actionClass: z.string(),
			total: z.number().int(),
			agreed: z.number().int(),
			rawAgreement: z.number(),
		}),
	),
});

export const connectorContract = {
	/**
	 * Whether this deployment's employees file through a connector rather than
	 * our portal.
	 *
	 * True when any connector is enabled. The portal then hides its own create
	 * path, because two front doors for one request is worse than either alone —
	 * the employee would not know which of them their colleagues can see.
	 */
	portalIsFrontDoor: oc.output(z.object({ foreign: z.boolean() })),

	/** The proposal for a ticket's most recent shadow run, or null. */
	getTicketProposal: oc
		.input(z.object({ ticketId: z.string() }))
		.output(proposal),

	/**
	 * Records that a human opened the proposal. Separate from any verdict,
	 * because agreement statistics are worthless if nobody read it.
	 */
	markProposalOpened: oc
		.input(z.object({ proposalId: z.string() }))
		.output(z.object({ ok: z.boolean() })),

	/**
	 * One verdict per suppressed call. The unit of judgement is the suggestion,
	 * not the review — a reviewer who accepts the diagnosis and rejects one step
	 * should be able to say so.
	 */
	recordProposalVerdict: oc
		.input(
			z.object({
				proposalId: z.string(),
				callOrdinal: z.number().int(),
				verdict: z.enum(ITSM_PROPOSAL_VERDICTS),
				note: z.string().nullable().default(null),
			}),
		)
		.output(z.object({ ok: z.boolean() })),

	connectorAgreement: oc.input(connectorId).output(agreementReport),

	/**
	 * Null for a native ticket. Read by the dashboard to decide whether the
	 * record is owned elsewhere, which changes what may be done to it here.
	 */
	getTicketConnectorOrigin: oc
		.input(z.object({ ticketId: z.string() }))
		.output(ticketConnectorOrigin),

	listConnectors: oc.output(z.array(connector)),

	createConnector: oc
		.input(
			z.object({
				key: z.string().min(1),
				vendor: z.enum(ITSM_VENDORS),
				label: z.string().min(1),
				baseUrl: connectorBaseUrl,
				clientId: z.string().min(1),
				clientSecret: z.string().min(1),
				recordFilter: z.string().default(""),
				defaultEnvironmentId: z.string().min(1),
				fallbackReporterId: z.string().min(1),
				pollIntervalSeconds: z.number().int().positive().default(120),
				createCeiling: z.number().int().positive().default(50),
				dispatchCeiling: z.number().int().positive().default(3),
			}),
		)
		.output(connector),

	updateConnector: oc
		.input(
			z.object({
				connectorId: z.string(),
				label: z.string().min(1).optional(),
				baseUrl: connectorBaseUrl.optional(),
				clientId: z.string().min(1).optional(),
				/** Omit to leave the stored secret untouched. */
				clientSecret: z.string().min(1).optional(),
				recordFilter: z.string().optional(),
				defaultEnvironmentId: z.string().optional(),
				enabled: z.boolean().optional(),
				pollIntervalSeconds: z.number().int().positive().optional(),
				createCeiling: z.number().int().positive().optional(),
				dispatchCeiling: z.number().int().positive().optional(),
			}),
		)
		.output(connector),

	deleteConnector: oc.input(connectorId).output(z.object({ ok: z.boolean() })),

	/** Proves the credential works before a sync depends on it. */
	testConnector: oc
		.input(connectorId)
		.output(z.object({ ok: z.boolean(), detail: z.string() })),

	/** Same computation as an apply, without applying it. */
	previewConnectorSync: oc.input(connectorId).output(previewResult),

	triggerConnectorSync: oc
		.input(connectorId)
		.output(
			z.object({ runId: z.string(), status: z.enum(ITSM_SYNC_STATUSES) }),
		),

	listConnectorRuns: oc
		.input(
			connectorId.extend({
				limit: z.number().int().min(1).max(100).default(25),
			}),
		)
		.output(z.array(connectorRun)),

	listConnectorWritebacks: oc
		.input(
			connectorId.extend({
				limit: z.number().int().min(1).max(100).default(25),
			}),
		)
		.output(z.array(writeback)),

	retryConnectorWriteback: oc
		.input(z.object({ writebackId: z.string() }))
		.output(z.object({ ok: z.boolean() })),

	listDispatchLedger: oc
		.input(
			connectorId.extend({
				limit: z.number().int().min(1).max(100).default(25),
			}),
		)
		.output(z.array(dispatchLedgerEntry)),

	listFieldMappings: oc.input(connectorId).output(z.array(fieldMapping)),

	upsertFieldMapping: oc
		.input(
			z.object({
				connectorId: z.string(),
				sourceField: z.string().min(1),
				targetField: z.enum(ITSM_MAPPABLE_FIELDS),
				valueMap: z.record(z.string(), z.string()),
				onUnmapped: z.enum(ITSM_UNMAPPED_POLICIES).default("quarantine"),
				defaultValue: z.string().nullable().default(null),
			}),
		)
		.output(fieldMapping),

	deleteFieldMapping: oc
		.input(z.object({ mappingId: z.string() }))
		.output(z.object({ ok: z.boolean() })),

	listEnvironmentRoutes: oc
		.input(connectorId)
		.output(z.array(environmentRoute)),

	upsertEnvironmentRoute: oc
		.input(
			z.object({
				connectorId: z.string(),
				sourceField: z.string().min(1),
				sourceValue: z.string().min(1),
				environmentId: z.string().min(1),
				position: z.number().int().default(0),
			}),
		)
		.output(environmentRoute),

	deleteEnvironmentRoute: oc
		.input(z.object({ routeId: z.string() }))
		.output(z.object({ ok: z.boolean() })),
};
