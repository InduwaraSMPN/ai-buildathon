import assert from "node:assert/strict";
import test from "node:test";
import { assertStandardImageChange } from "./change";

test("standard image changes only alter an existing image tag or digest", () => {
	assert.doesNotThrow(() =>
		assertStandardImageChange("repo/app:v1", "repo/app:v2"),
	);
	assert.throws(
		() => assertStandardImageChange(undefined, "repo/app:v2"),
		/does not exist/,
	);
	assert.throws(
		() => assertStandardImageChange("repo/app:v1", "repo/app:v1"),
		/already deployed/,
	);
	assert.throws(
		() => assertStandardImageChange("repo/app:v1", "repo/other:v2"),
		/only the tag/,
	);
	assert.doesNotThrow(() =>
		assertStandardImageChange(
			"registry:5000/team/app:v1",
			"registry:5000/team/app:v2",
		),
	);
	assert.throws(
		() =>
			assertStandardImageChange(
				"registry:5000/team/app:v1",
				"registry:5000/attacker/evil:v2",
			),
		/only the tag/,
	);
});
