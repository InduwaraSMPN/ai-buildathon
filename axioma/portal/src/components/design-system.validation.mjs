import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC_ROOT = join(APP_ROOT, "src");
const STATUS_PALETTE_FILES = [
	"components/ticket-ui.tsx",
	"features/status/components/service-status.tsx",
	"features/tickets/components/conversation-card.tsx",
	"features/tickets/components/resolution-card.tsx",
];
const GROUPED_CALL_SITES = {
	"components/header.tsx": "DropdownMenuGroup",
	"components/mode-toggle.tsx": "DropdownMenuGroup",
	"components/notification-center.tsx": "DropdownMenuGroup",
	"features/knowledge/components/knowledge-browser.tsx": "SelectGroup",
	"features/request-catalogue/components/catalogue-field.tsx": "SelectGroup",
	"features/tickets/components/dynamic-fields.tsx": "SelectGroup",
	"features/tickets/components/request-form.tsx": "SelectGroup",
};
const PALETTE =
	"emerald|amber|orange|red|yellow|violet|sky|blue|green|rose|purple|teal|cyan|indigo|lime|fuchsia|pink";
const CLASS_PALETTE = new RegExp(
	String.raw`(?:^|[\s"'\x60])(?:[a-z-]+:)*(?:bg|text|border|fill|stroke|ring)-(?:${PALETTE})-(?:[0-9]{2,3})(?=$|[\s"'\x60/])`,
	"gm",
);
const SPACE_CLASS = /\bspace-[xy]-(?:\[[^\]\s"']+\]|[a-z0-9.-]+)(?:\/\d+)?/g;

function sourceFiles(directory = SRC_ROOT) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (
				path === join(SRC_ROOT, "components", "ui") ||
				path === join(SRC_ROOT, "sdk")
			)
				return [];
			return sourceFiles(path);
		}
		if (!/\.tsx?$/.test(entry.name)) return [];
		const name = relative(SRC_ROOT, path).split(sep).join("/");
		if (name === "routeTree.gen.ts") return [];
		return [{ name, text: readFileSync(path, "utf8") }];
	});
}

const files = sourceFiles();
const find = (pattern, selected = files) =>
	selected.flatMap(({ name, text }) => {
		pattern.lastIndex = 0;
		return pattern.test(text) ? [name] : [];
	});
const occurrences = (text, pattern) => [...text.matchAll(pattern)].length;

function assertNone(actual, message) {
	assert.deepEqual([...new Set(actual)].sort(), [], message);
}

test("product source does not import lucide-react", () => {
	assertNone(
		find(/(?:from\s*|import\s*\()["']lucide-react["']/),
		"Replace Lucide imports with Remix Icon imports",
	);
});

test("visible single-value selects use design-system controls", () => {
	assertNone(
		files.flatMap(({ name, text }) =>
			[...text.matchAll(/<select\b[\s\S]*?>/g)]
				.filter(([, tag]) => !/\bmultiple(?:\s|=|>)/.test(tag))
				.map(() => name),
		),
		"Use Select or NativeSelect; raw <select multiple> is the documented native exception",
	);
});

test("product checkboxes use Checkbox", () => {
	assertNone(
		find(/<input\b(?=[^>]*\btype\s*=\s*["']checkbox["'])[^>]*>/),
		"Replace raw product checkboxes with Checkbox",
	);
});

test("feature loading states do not use animate-pulse directly", () => {
	assertNone(
		find(/(?:^|\s)animate-pulse(?:\s|$)/m),
		"Use Skeleton instead of feature-level animate-pulse",
	);
});

test("remediated status surfaces use semantic color tokens", () => {
	const selected = files.filter(({ name }) =>
		STATUS_PALETTE_FILES.includes(name),
	);
	assertNone(
		find(CLASS_PALETTE, selected),
		"Raw status palette classes remain in a remediated status surface",
	);
});

test("product source does not use raw table markup", () => {
	assertNone(
		find(/<(?:table|thead|tbody|tfoot|tr|th|td)\b/),
		"Portal product source must not introduce raw table markup",
	);
});

test("select and dropdown item collections are grouped at documented call sites", () => {
	const missing = Object.entries(GROUPED_CALL_SITES).flatMap(
		([name, symbol]) => {
			const file = files.find((candidate) => candidate.name === name);
			return !file || !new RegExp(`<${symbol}\\b`).test(file.text)
				? [`${name}: ${symbol}`]
				: [];
		},
	);
	assertNone(missing, "Add the documented SelectGroup or DropdownMenuGroup");
});

test("space utilities do not exceed the per-file baseline", () => {
	const baseline = JSON.parse(
		readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				"design-system.space-baseline.json",
			),
			"utf8",
		),
	);
	const increases = files.flatMap(({ name, text }) => {
		const count = occurrences(text, SPACE_CLASS);
		return count > (baseline[name] ?? 0)
			? [`${name}: ${count} > ${baseline[name] ?? 0}`]
			: [];
	});
	assertNone(
		increases,
		"Reduce new space-x/space-y utilities or intentionally update the reviewed baseline",
	);
});

test("browser-native prompt, confirm, and alert dialogs are not used", () => {
	assertNone(
		find(/\bwindow\.(?:prompt|confirm|alert)\s*\(/),
		"Use Dialog or AlertDialog instead of browser-native dialogs",
	);
});
