import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
	readFileSync(new URL(path, import.meta.url), "utf8");
const names = (source: string, pattern: RegExp) =>
	new Set([...source.matchAll(pattern)].map((match) => match[1] as string));

test("every contract procedure uses an explicit authorization builder", () => {
	const routerSources = readdirSync(new URL("./routers", import.meta.url))
		.filter((file) => file.endsWith(".ts"))
		.map((file) => read(`./routers/${file}`));
	const contractSources = readdirSync(new URL("../contracts", import.meta.url))
		.filter((file) => file.endsWith(".ts"))
		.map((file) => read(`../contracts/${file}`));
	const contracts = names(contractSources.join("\n"), /^\s*(\w+): oc\b/gm);
	const handlers = names(
		routerSources.join("\n").replace(/\s+/g, " "),
		/(\w+): (?:capabilityProcedure\([^)]*\)|anyCapabilityProcedure\([^)]*\)|healthProcedure|publicProcedure|privateDataProcedure|reporterProcedure)\.\1\.handler/g,
	);

	assert.deepEqual(
		[...contracts].filter((name) => !handlers.has(name)),
		[],
	);
	assert.doesNotMatch(
		routerSources.join(""),
		/protectedProcedure|variantProcedure/,
	);
	assert.deepEqual(
		[...routerSources.join("").matchAll(/healthProcedure\.(\w+)/g)].map(
			(match) => match[1],
		),
		["healthCheck"],
	);
	assert.deepEqual(
		[...routerSources.join("").matchAll(/publicProcedure\.(\w+)/g)].map(
			(match) => match[1],
		),
		["readStatus", "listAuthProviders"],
	);
	assert.deepEqual(
		[...routerSources.join("").matchAll(/privateDataProcedure\.(\w+)/g)].map(
			(match) => match[1],
		),
		["privateData"],
	);
	assert.deepEqual(
		[...routerSources.join("").matchAll(/reporterProcedure\.(\w+)/g)].map(
			(match) => match[1],
		),
		[
			"listMyDevices",
			"listPublicKnowledge",
			"getPublicKnowledgeArticle",
			"getMyApprovalStatus",
		],
	);
	assert.doesNotMatch(
		read("./orpc.ts"),
		/export const (os|authenticatedProcedure)/,
	);
});

test("reporter exceptions remain ownership scoped", () => {
	const main = read("./routers/index.ts");
	assert.match(
		main,
		/listMyDevices:[\s\S]*?eq\(devices\.ownerId, context\.userId\)/,
	);
	assert.match(
		main,
		/enrollDevice: capabilityProcedure\("device\.enroll"\)[\s\S]*?devices\.ownerId[\s\S]*?context\.userId/,
	);
	assert.match(main, /add_detail: "ticket\.create"/);
	assert.match(
		main,
		/input\.action === "add_detail"\s*&&\s*current\.reporterId !== context\.userId/,
	);
});
