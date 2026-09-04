import { z } from "zod";
import { env } from "@/env";
import { DirectorySourceTruncatedError } from "./sync";

/**
 * Enough for a large directory at any sane page size, and a bound on a source
 * whose cursor never terminates.
 */
const MAX_PAGES = 200;

const person = z
	.object({
		externalId: z.string().trim().min(1),
		email: z.email(),
		name: z.string().trim().min(1),
		jobTitle: z.string().nullable().default(null),
		department: z.string().nullable().default(null),
		managerExternalId: z.string().nullable().default(null),
	})
	.transform((value) => ({
		...value,
		kind:
			value[env.AXIOMA_DIRECTORY_STAFF_ATTRIBUTE]?.trim().toLowerCase() ===
			env.AXIOMA_DIRECTORY_STAFF_VALUE.trim().toLowerCase()
				? ("staff" as const)
				: ("reporter" as const),
	}));

/**
 * One page of the directory.
 *
 * The bare array is the shape this integration shipped with and carries no
 * continuation, so it can only ever describe a whole directory. The object
 * form may carry one under whichever of the usual names the source uses: a
 * `next` link, an opaque cursor replayed on the same URL, a `hasMore` flag, or
 * a declared total to check the accumulated count against. All of them are
 * optional, so a source that already answers in one request is unaffected.
 */
const page = z.union([
	z.array(person).transform((people) => ({
		people,
		next: null,
		cursor: null,
		hasMore: null,
		total: null,
	})),
	z
		.object({
			people: z.array(person),
			next: z.string().trim().min(1).nullish().default(null),
			nextCursor: z.string().trim().min(1).nullish().default(null),
			hasMore: z.boolean().nullish().default(null),
			total: z.number().int().nonnegative().nullish().default(null),
			totalCount: z.number().int().nonnegative().nullish().default(null),
		})
		.transform((value) => ({
			people: value.people,
			next: value.next,
			cursor: value.nextCursor,
			hasMore: value.hasMore,
			total: value.total ?? value.totalCount,
		})),
]);

type DirectoryPage = z.infer<typeof page>;

/**
 * Where the next page lives, or null when the source did not offer one.
 *
 * `next` is read as a link, absolute or relative to the page it came from; a
 * cursor is replayed as a query parameter on the same URL. Leaving the origin
 * is refused rather than followed, because the request carries the source
 * token and a redirection is not pagination.
 */
function nextPageUrl(
	current: URL,
	body: Pick<DirectoryPage, "next" | "cursor">,
	providerId: string,
): URL | null {
	if (!body.next && !body.cursor) return null;
	const target = body.next ? new URL(body.next, current) : new URL(current);
	if (target.origin !== current.origin)
		throw new Error(
			`Directory source pointed its next page at ${target.origin}, a different origin`,
		);
	if (body.cursor) target.searchParams.set("cursor", body.cursor);
	target.searchParams.set("providerId", providerId);
	return target;
}

export async function fetchHttpDirectoryPeople(
	urlText: string,
	providerId: string,
	token?: string,
) {
	const url = new URL(urlText);
	url.searchParams.set("providerId", providerId);

	const people: DirectoryPage["people"] = [];
	const requested = new Set<string>();
	let target: URL | null = url;
	let declaredTotal: number | null = null;

	while (target) {
		// A source that hands back a page it already served would page forever,
		// and one still going after MAX_PAGES is not paginating either.
		if (requested.has(target.href))
			throw new DirectorySourceTruncatedError(
				people.length,
				"served the same page twice",
			);
		if (requested.size >= MAX_PAGES)
			throw new DirectorySourceTruncatedError(
				people.length,
				`still had more after ${MAX_PAGES} pages`,
			);
		requested.add(target.href);

		const response = await fetch(target, {
			headers: token ? { authorization: `Bearer ${token}` } : undefined,
			signal: AbortSignal.timeout(30_000),
		});
		if (!response.ok)
			throw new Error(`Directory source returned ${response.status}`);
		const body = page.parse(await response.json());
		people.push(...body.people);
		declaredTotal = body.total ?? declaredTotal;

		const following = nextPageUrl(target, body, providerId);
		if (!following) {
			// More to come with nothing to follow is exactly the silent truncation
			// this guard exists for.
			if (body.hasMore)
				throw new DirectorySourceTruncatedError(
					people.length,
					"reported more pages without a cursor to follow",
				);
			break;
		}
		target = following;
	}

	if (declaredTotal !== null && people.length < declaredTotal)
		throw new DirectorySourceTruncatedError(
			people.length,
			`declared a total of ${declaredTotal}`,
		);
	return people;
}

export function fetchDirectoryPeople(providerId: string) {
	if (!env.AXIOMA_DIRECTORY_SOURCE_URL)
		throw new Error("AXIOMA_DIRECTORY_SOURCE_URL is not configured");
	return fetchHttpDirectoryPeople(
		env.AXIOMA_DIRECTORY_SOURCE_URL,
		providerId,
		env.AXIOMA_DIRECTORY_SOURCE_TOKEN,
	);
}
