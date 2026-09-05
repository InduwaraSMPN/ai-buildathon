import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const research = await readFile(new URL("../src/content/research.ts", import.meta.url), "utf8");
const facts = await readFile(new URL("../src/content/facts.ts", import.meta.url), "utf8");
const sanctioned = new Set([
	...research.matchAll(/"([<>≈~+−-]?\$?[\d,.]+(?:\s?(?:%|pp|×|h|s|min|KB|tokens|M|B|\/yr))?)"/g),
].map((match) => match[1].replaceAll(",", "").match(/\d+(?:\.\d+)?/)?.[0]).filter(Boolean).map((value) => String(Number(value))));
for (const match of facts.matchAll(/:\s*(\d+(?:\.\d+)?)/g)) sanctioned.add(String(Number(match[1])));

const files = [];
for (const dir of ["src/content", "src/routes"]) {
	for (const name of await readdir(new URL(`../${dir}/`, import.meta.url))) {
		if (/\.(?:ts|tsx)$/.test(name) && name !== "research.ts" && name !== "facts.ts") files.push(join(dir, name));
	}
}
const figure = /(?:[<>≈~+−-]?\$?\d[\d,.]*(?:\s?(?:%|pp|×|h|s|min|KB|tokens|M|B|\/yr)))/g;
const failures = [];
for (const file of files) {
	const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
	for (const match of text.matchAll(figure)) {
		const rawValue = match[0].replaceAll(",", "").match(/\d+(?:\.\d+)?/)?.[0];
		const value = rawValue ? String(Number(rawValue)) : undefined;
		const line = text.slice(0, match.index).split("\n").length;
		const sourceLine = text.split("\n")[line - 1];
		if (!value || /^\s*(?:ordinal:|year:)/.test(sourceLine) || /(?:viewBox|\bpx\b)/.test(sourceLine) || sanctioned.has(value)) continue;
		failures.push(`${file}:${line}: ${match[0]}`);
	}
}
if (failures.length) {
	console.error(`Untraceable figures:\n${failures.join("\n")}`);
	process.exit(1);
}
console.log(`Figure audit passed (${files.length} files).`);
