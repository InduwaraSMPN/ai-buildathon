/**
 * The source is read for exactly one purpose: to decide who is still employed.
 * Everyone the response omits is marked a leaver, so a page the reader failed
 * to follow revokes live people — and lands well inside the shrink brake's
 * tolerance while doing it. These tests are about that: reading to the end, or
 * refusing to hand anything to the planner.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { fetchHttpDirectoryPeople } from "./http-source";
import { DirectorySourceTruncatedError } from "./sync";

/** Answers from `handler` and records what was asked for. */
function serve(handler: (url: URL) => unknown) {
	const original = globalThis.fetch;
	const requested: URL[] = [];
	globalThis.fetch = (async (input: string | URL | Request) => {
		const url = new URL(String(input));
		requested.push(url);
		return Response.json(handler(url));
	}) as unknown as typeof fetch;
	return { requested, restore: () => (globalThis.fetch = original) };
}

const person = (index: number) => ({
	externalId: String(index),
	email: `person-${index}@example.com`,
	name: `Person ${index}`,
});

const SOURCE = "https://directory.example.test/users";

test("a source that answers in one page is read in one request", async () => {
	const { requested, restore } = serve(() => ({ people: [person(1)] }));
	try {
		const people = await fetchHttpDirectoryPeople(SOURCE, "provider-1", "s");
		assert.equal(requested.length, 1);
		assert.equal(requested[0]?.searchParams.get("providerId"), "provider-1");
		assert.equal(people.length, 1);
	} finally {
		restore();
	}
});

test("a next link is followed to exhaustion, carrying the provider through", async () => {
	const { requested, restore } = serve((url) => {
		const page = url.searchParams.get("page") ?? "1";
		if (page === "1") return { people: [person(1)], next: "/users?page=2" };
		if (page === "2") return { people: [person(2)], next: `${SOURCE}?page=3` };
		return { people: [person(3)] };
	});
	try {
		const people = await fetchHttpDirectoryPeople(SOURCE, "provider-1");
		assert.deepEqual(
			people.map((entry) => entry.externalId),
			["1", "2", "3"],
		);
		for (const url of requested)
			assert.equal(url.searchParams.get("providerId"), "provider-1");
	} finally {
		restore();
	}
});

test("an opaque cursor is replayed on the same URL", async () => {
	const { requested, restore } = serve((url) =>
		url.searchParams.get("cursor") === "c2"
			? { people: [person(2)] }
			: { people: [person(1)], nextCursor: "c2" },
	);
	try {
		const people = await fetchHttpDirectoryPeople(SOURCE, "provider-1");
		assert.equal(requested.length, 2);
		assert.equal(people.length, 2);
	} finally {
		restore();
	}
});

test("more pages with nothing to follow refuses instead of planning", async () => {
	const { restore } = serve(() => ({ people: [person(1)], hasMore: true }));
	try {
		await assert.rejects(
			() => fetchHttpDirectoryPeople(SOURCE, "provider-1"),
			(error: unknown) => {
				assert.ok(error instanceof DirectorySourceTruncatedError);
				assert.equal(error.foundCount, 1);
				return true;
			},
		);
	} finally {
		restore();
	}
});

test("a declared total the pages did not reach refuses", async () => {
	const { restore } = serve(() => ({ people: [person(1)], totalCount: 9 }));
	try {
		await assert.rejects(
			() => fetchHttpDirectoryPeople(SOURCE, "provider-1"),
			/declared a total of 9/,
		);
	} finally {
		restore();
	}
});

test("a source that keeps serving the same page is refused, not followed", async () => {
	const { restore } = serve(() => ({ people: [person(1)], next: "/users" }));
	try {
		await assert.rejects(
			() => fetchHttpDirectoryPeople(SOURCE, "provider-1"),
			/served the same page twice/,
		);
	} finally {
		restore();
	}
});

test("a next page on another origin is not followed with the token", async () => {
	const { restore } = serve(() => ({
		people: [person(1)],
		next: "https://elsewhere.test/users",
	}));
	try {
		await assert.rejects(
			() => fetchHttpDirectoryPeople(SOURCE, "provider-1", "s"),
			/different origin/,
		);
	} finally {
		restore();
	}
});
