import assert from "node:assert/strict";
import test from "node:test";
import { fetchHttpDirectoryPeople } from "./directory/http-source";
import { createHttpMailProvider } from "./mail/http-provider";

test("HTTP mail provider posts the normalized message and bearer token", async () => {
	const originalFetch = globalThis.fetch;
	let request: Request | undefined;
	globalThis.fetch = async (input, init) => {
		request = new Request(input, init);
		return Response.json({ messageId: "mail-1" });
	};
	try {
		const result = await createHttpMailProvider(
			"https://mail.example.test/send",
			"secret",
		).send({
			to: "person@example.com",
			subject: "Hello",
			text: "Body",
		});
		assert.equal(request?.headers.get("authorization"), "Bearer secret");
		assert.deepEqual(await request?.json(), {
			to: "person@example.com",
			subject: "Hello",
			text: "Body",
		});
		assert.equal(result.messageId, "mail-1");
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("directory source is server-configured and validates its payload", async () => {
	const originalFetch = globalThis.fetch;
	let request: Request | undefined;
	globalThis.fetch = async (input, init) => {
		request = new Request(input, init);
		return Response.json({
			people: [{ externalId: "1", email: "one@example.com", name: "One" }],
		});
	};
	try {
		const people = await fetchHttpDirectoryPeople(
			"https://directory.example.test/users?tenant=one",
			"provider-1",
			"secret",
		);
		assert.equal(
			new URL(request?.url ?? "").searchParams.get("providerId"),
			"provider-1",
		);
		assert.equal(request?.headers.get("authorization"), "Bearer secret");
		assert.deepEqual(people[0], {
			externalId: "1",
			email: "one@example.com",
			name: "One",
			jobTitle: null,
			department: null,
			managerExternalId: null,
			kind: "reporter",
		});
	} finally {
		globalThis.fetch = originalFetch;
	}
});
