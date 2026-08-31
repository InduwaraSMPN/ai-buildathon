import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Shared, mirrored design-system validator. The rules live here; the per-app
// surface (which files count as status surfaces, which call sites are grouped)
// lives in the app-local design-system.config.json beside this file, and the
// space baseline in design-system.space-baseline.json. Edit the source in
// axioma/ui and re-run `pnpm --dir axioma/ui mirror`.

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, "../..");
const SRC_ROOT = join(APP_ROOT, "src");
const config = JSON.parse(
	readFileSync(join(HERE, "design-system.config.json"), "utf8"),
);

const PALETTE =
	"emerald|amber|orange|red|yellow|violet|sky|blue|green|rose|purple|teal|cyan|indigo|lime|fuchsia|pink";
const CLASS_PALETTE = new RegExp(
	String.raw`(?:^|[\s"'\x60])(?:[a-z-]+:)*(?:bg|text|border|fill|stroke|ring)-(?:${PALETTE})-(?:[0-9]{2,3})(?=$|[\s"'\x60/])`,
	"gm",
);
const SPACE_CLASS = /\bspace-[xy]-(?:\[[^\]\s"']+\]|[a-z0-9.-]+)(?:\/\d+)?/g;
const TYPE_SCALE_CLASS = /\btext-\[[0-9.]+(?:px|rem)\]/g;
const TONE_TINT =
	/\bbg-(info|warning|success|destructive|primary|secondary)\/[0-9]+/g;

function walk(directory, ui, out = []) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (path === join(SRC_ROOT, "sdk")) return out;
			const isUi = ui || path === join(SRC_ROOT, "components", "ui");
			return walk(path, isUi, out);
		}
		if (!/\.tsx?$/.test(entry.name)) return out;
		const name = relative(SRC_ROOT, path).split(sep).join("/");
		if (name === "routeTree.gen.ts") return out;
		out.push({ name, text: readFileSync(path, "utf8"), ui });
		return out;
	});
}

const files = walk(SRC_ROOT, false);
const product = files.filter((file) => !file.ui);
const uiFiles = files.filter((file) => file.ui);

const find = (pattern, selected = product) =>
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
		product.flatMap(({ name, text }) =>
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
	const selected = product.filter(({ name }) =>
		config.statusPaletteFiles.includes(name),
	);
	assertNone(
		find(CLASS_PALETTE, selected),
		"Raw status palette classes remain in a remediated status surface",
	);
});

test("product tables use the Table primitive", () => {
	assertNone(
		find(/<(?:table|thead|tbody|tfoot|tr|th|td)\b/),
		"Use the shared Table primitives for product tables",
	);
});

test("select and dropdown item collections are grouped at documented call sites", () => {
	const missing = Object.entries(config.groupedCallSites).flatMap(
		([name, { symbol, count }]) => {
			const file = files.find((candidate) => candidate.name === name);
			const actual = file
				? occurrences(file.text, new RegExp(`<${symbol}\\b`, "g"))
				: 0;
			return actual < count ? [`${name}: ${symbol} ${actual}/${count}`] : [];
		},
	);
	assertNone(missing, "Add the documented SelectGroup or DropdownMenuGroup");
});

test("type scale: no hand-set pixel or rem type sizes in product source", () => {
	const exempt = new Set(config.typeScaleAllowlist);
	assertNone(
		product
			.filter(({ name }) => !exempt.has(name))
			.flatMap(({ name, text }) =>
				occurrences(text, TYPE_SCALE_CLASS) > 0 ? [name] : [],
			),
		"Use the type scale (text-xs etc.); hand-set text-[…px]/text-[…rem] sizes are banned",
	);
});

test("tinted tone backgrounds pair with toned text, not solid foreground", () => {
	const violations = product.flatMap(({ name, text }) => {
		const tones = new Set(
			[...text.matchAll(TONE_TINT)].map((match) => match[1]),
		);
		return [...tones]
			.filter((tone) =>
				new RegExp(String.raw`\btext-${tone}-foreground\b`).test(text),
			)
			.map((tone) => `${name}: bg-${tone}/N with text-${tone}-foreground`);
	});
	assertNone(
		violations,
		"Pair bg-X/N with text-X (the tone itself); text-X-foreground is near-white on a tint",
	);
});

test("raw details and summary elements are not used", () => {
	assertNone(
		find(/<(?:details|summary)\b/),
		"Use the Collapsible primitive instead of native <details>/<summary>",
	);
});

test("browser-native prompt, confirm, and alert dialogs are not used", () => {
	assertNone(
		find(/\bwindow\.(?:prompt|confirm|alert)\s*\(/),
		"Use Dialog or AlertDialog instead of browser-native dialogs",
	);
});

test("space utilities do not exceed the per-file baseline", () => {
	const baseline = JSON.parse(
		readFileSync(join(HERE, "design-system.space-baseline.json"), "utf8"),
	);
	const known = new Set(product.map(({ name }) => name));
	const stale = Object.keys(baseline).filter((name) => !known.has(name));
	assertNone(
		stale.map(
			(name) => `${name}: baseline entry for a file that does not exist`,
		),
		"Remove stale baseline entries (they are silently inert)",
	);
	const increases = product.flatMap(({ name, text }) => {
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

test("vendored ui primitives stay on token colours and the type scale", () => {
	// Deliberately narrow: the vendored primitives are upstream code, so only
	// token colours and the type scale are scanned, not the component rules.
	assertNone(
		find(CLASS_PALETTE, uiFiles),
		"Raw palette class in a vendored primitive — use semantic tokens",
	);
	assertNone(
		uiFiles.flatMap(({ name, text }) =>
			occurrences(text, TYPE_SCALE_CLASS) > 0 ? [name] : [],
		),
		"Hand-set text-[…px]/text-[…rem] size in a vendored primitive — use the type scale",
	);
});
