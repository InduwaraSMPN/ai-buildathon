import assert from "node:assert/strict";
import test from "node:test";
import {
	type CurrentDirectoryPerson,
	calculateDirectorySync,
	type DirectoryPerson,
	DirectoryShrinkError,
	type DirectorySyncPlan,
	syncDirectory,
} from "./sync";

const current: CurrentDirectoryPerson[] = [
	{
		userId: "user-1",
		externalId: "directory-1",
		email: "one@example.com",
		name: "One",
		jobTitle: "Engineer",
		department: "IT",
		managerExternalId: null,
		leaver: false,
	},
	{
		userId: "user-2",
		externalId: "directory-2",
		email: "two@example.com",
		name: "Two",
		jobTitle: null,
		department: "Finance",
		managerExternalId: "directory-1",
		leaver: false,
	},
];

const incoming = [
	{
		externalId: "directory-1",
		email: " ONE@EXAMPLE.COM ",
		name: "One Updated",
		jobTitle: "Senior Engineer",
		department: "IT",
		managerExternalId: null,
	},
	{
		externalId: "directory-3",
		email: "three@example.com",
		name: "Three",
		jobTitle: null,
		department: "IT",
		managerExternalId: "directory-1",
	},
] satisfies [DirectoryPerson, DirectoryPerson];

test("preview and apply use the exact same calculation while preview writes nothing", async () => {
	const applied: DirectorySyncPlan[] = [];
	const store = {
		current: async () => current,
		lastSuccessfulCount: async () => 2,
		apply: async (plan: DirectorySyncPlan) => {
			applied.push(plan);
		},
	};
	const preview = await syncDirectory(store, incoming, "preview");
	assert.equal(applied.length, 0);
	const appliedPlan = await syncDirectory(store, incoming, "apply");
	assert.deepEqual(appliedPlan, preview);
	assert.deepEqual(applied, [preview]);
});

test("missing people are marked as leavers and never deleted", () => {
	const plan = calculateDirectorySync(current, incoming, 2);
	assert.deepEqual(
		{
			created: plan.createdCount,
			updated: plan.updatedCount,
			leavers: plan.leaverCount,
		},
		{ created: 1, updated: 1, leavers: 1 },
	);
	assert.deepEqual(
		plan.changes.find((change) => change.kind === "mark_leaver"),
		{ kind: "mark_leaver", userId: "user-2", externalId: "directory-2" },
	);
	assert.equal(
		plan.changes.some((change) => "delete" in change),
		false,
	);
});

test("40 percent fewer people is rejected with both counts", () => {
	const sixPeople: DirectoryPerson[] = Array.from(
		{ length: 6 },
		(_, index) => ({
			...incoming[1],
			externalId: `directory-${index + 10}`,
			email: `person-${index}@example.com`,
		}),
	);
	assert.throws(
		() => calculateDirectorySync([], sixPeople, 10),
		(error) =>
			error instanceof DirectoryShrinkError &&
			error.previousCount === 10 &&
			error.foundCount === 6 &&
			error.message.includes("found 6 people") &&
			error.message.includes("previous 10"),
	);
	assert.doesNotThrow(() => calculateDirectorySync([], sixPeople, 9));
});

test("duplicate directory identities are rejected", () => {
	assert.throws(
		() => calculateDirectorySync([], [incoming[0], incoming[0]], 0),
		/duplicate external IDs or email addresses/,
	);
});
