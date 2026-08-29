import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { requireDocumentWriteTarget } from "./access";
import {
	canReadCaseNote,
	canReadDocument,
	deduplicateDocument,
	documentExtensionAllowList,
	prepareFileDocument,
	prepareLinkDocument,
} from "./index";
import { FileBlobStore, MAX_DOCUMENT_BYTES } from "./storage";

test("allow-list accepts documents, rejects unlisted files, and can never include executables", () => {
	assert.equal(
		prepareFileDocument("report.PDF", new Uint8Array([1])).displayName,
		"report.PDF",
	);
	assert.throws(
		() => prepareFileDocument("payload.exe", new Uint8Array(), ["exe"]),
		/Executable/,
	);
	assert.throws(
		() => prepareFileDocument("page.html", new Uint8Array()),
		/not allowed/,
	);
	assert.throws(() => documentExtensionAllowList(["svg"]), /cannot widen/);
	assert.deepEqual([...documentExtensionAllowList(["pdf"])], [".pdf"]);
});

test("stored filenames are server-generated and content hashes support shared storage", () => {
	const first = prepareFileDocument(
		"one.txt",
		new TextEncoder().encode("same"),
	);
	const second = prepareFileDocument(
		"two.txt",
		new TextEncoder().encode("same"),
	);
	assert.notEqual(first.storedFilename, "one.txt");
	assert.notEqual(first.storedFilename, second.storedFilename);
	assert.equal(first.storageKey, second.storageKey);
	assert.equal(deduplicateDocument(first, second), first);
});

test("filesystem storage atomically deduplicates hashes and enforces size", async () => {
	const root = await mkdtemp(join(tmpdir(), "axioma-documents-"));
	try {
		const store = new FileBlobStore(root);
		const key = "a".repeat(64);
		assert.equal(await store.put(key, new TextEncoder().encode("first")), true);
		assert.equal(
			await store.put(key, new TextEncoder().encode("second")),
			false,
		);
		assert.equal(await readFile(join(root, key), "utf8"), "first");
		await store.remove(key);
		await assert.rejects(access(join(root, key)));
		await assert.rejects(
			store.put("b".repeat(64), new Uint8Array(MAX_DOCUMENT_BYTES + 1)),
			/exceeds/,
		);
		await assert.rejects(
			store.put("../escape", new Uint8Array()),
			/Invalid blob key/,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("links are first-class HTTP(S) documents", () => {
	assert.deepEqual(
		prepareLinkDocument("Runbook", "https://example.com/runbook"),
		{
			displayName: "Runbook",
			url: "https://example.com/runbook",
		},
	);
	assert.throws(
		() => prepareLinkDocument("bad", "javascript:alert(1)"),
		/HTTP/,
	);
});

test("visibility is inherited from current links at read time", async () => {
	const links = [
		{ targetType: "ticket", targetId: "hidden" },
		{ targetType: "ticket", targetId: "visible" },
	] as const;
	const viewer = { userId: "reporter", role: "reporter" } as const;
	assert.equal(
		await canReadDocument(
			links,
			viewer,
			(target) => target.targetId === "visible",
		),
		true,
	);
	assert.equal(await canReadDocument(links, viewer, () => false), false);
});

test("reporters cannot write attachments to case notes", async () => {
	await assert.rejects(
		requireDocumentWriteTarget(
			{ targetType: "case_note", targetId: "staff-message" },
			{ userId: "reporter", role: "reporter" },
		),
		(error: unknown) =>
			error instanceof Error && "code" in error && error.code === "NOT_FOUND",
	);
});

test("private case-note attachments are unreachable by reporters at a direct URL", async () => {
	const reporter = { userId: "u1", role: "reporter" } as const;
	const analyst = { userId: "a1", role: "analyst" } as const;
	const privateNote = { reporterId: "u1", private: true };
	assert.equal(canReadCaseNote(reporter, privateNote), false);
	assert.equal(
		await canReadDocument(
			[{ targetType: "case_note", targetId: "private-note" }],
			reporter,
			(_target, currentViewer) => canReadCaseNote(currentViewer, privateNote),
		),
		false,
	);
	assert.equal(
		canReadCaseNote(reporter, { reporterId: "u1", private: false }),
		true,
	);
	assert.equal(
		canReadCaseNote(analyst, { reporterId: "u1", private: true }),
		true,
	);
});
