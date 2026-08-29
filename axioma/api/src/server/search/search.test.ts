import assert from "node:assert/strict";
import test from "node:test";

import {
	groupSearchResults,
	normalizeSearchQuery,
	retainAuthorizedResults,
	SEARCH_OBJECT_TYPES,
} from "./index";
import { canAccessSavedView } from "./views";

test("normalizes Unicode, surrounding whitespace, and term separators", () => {
	assert.equal(
		normalizeSearchQuery("  ＡＰＩ\t gateway\n timeout  "),
		"API gateway timeout",
	);
	assert.equal(normalizeSearchQuery(" \n\t "), "");
});

test("groups mixed object types without losing result order", () => {
	const results = [
		{ objectType: "ticket", objectId: "2" },
		{ objectType: "device", objectId: "1" },
		{ objectType: "ticket", objectId: "1" },
	];
	assert.deepEqual(groupSearchResults(results), {
		ticket: [results[0], results[2]],
		device: [results[1]],
	});
});

test("authorization intersection cannot add unscoped results", () => {
	const results = [
		{ objectType: "ticket", objectId: "mine" },
		{ objectType: "ticket", objectId: "theirs" },
		{ objectType: "device", objectId: "mine" },
	];
	assert.deepEqual(
		retainAuthorizedResults(
			results,
			new Set(["ticket:mine", "device:mine", "ticket:missing"]),
		),
		[results[0], results[2]],
	);
});

test("search declares every currently searchable core object type", () => {
	assert.deepEqual(SEARCH_OBJECT_TYPES, [
		"ticket",
		"problem",
		"change",
		"knowledge_article",
		"cmdb_object",
		"asset",
	]);
});

test("saved views are visible only to their user or a caller team", () => {
	const scope = { userId: "u1", teamIds: ["t1", "t2"] };
	assert.equal(
		canAccessSavedView({ ownerType: "user", ownerId: "u1" }, scope),
		true,
	);
	assert.equal(
		canAccessSavedView({ ownerType: "user", ownerId: "u2" }, scope),
		false,
	);
	assert.equal(
		canAccessSavedView({ ownerType: "team", ownerId: "t2" }, scope),
		true,
	);
	assert.equal(
		canAccessSavedView({ ownerType: "team", ownerId: "t3" }, scope),
		false,
	);
});
