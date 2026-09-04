import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";

const EXECUTABLE_EXTENSIONS = new Set([
	".app",
	".bat",
	".bin",
	".cmd",
	".com",
	".cpl",
	".dll",
	".dmg",
	".exe",
	".gadget",
	".hta",
	".inf",
	".ins",
	".iso",
	".jar",
	".js",
	".jse",
	".lnk",
	".msc",
	".msi",
	".msp",
	".mst",
	".pif",
	".ps1",
	".reg",
	".scr",
	".sh",
	".sys",
	".vb",
	".vbe",
	".vbs",
	".ws",
	".wsc",
	".wsf",
	".wsh",
]);

export const DEFAULT_DOCUMENT_EXTENSIONS = [
	".csv",
	".doc",
	".docx",
	".gif",
	".jpeg",
	".jpg",
	".json",
	".log",
	".pdf",
	".png",
	".ppt",
	".pptx",
	".txt",
	".webp",
	".xls",
	".xlsx",
] as const;

/**
 * The media type each allowed extension implies. The multipart `Content-Type`
 * is chosen by the uploader and never validated against the bytes, so trusting
 * it let any blob claim `image/png` to the vision reader or `text/plain` to the
 * agent's document fetch. The extension is the one thing already validated, so
 * it is what the served and stored type are derived from.
 */
const MEDIA_TYPES: Record<string, string> = {
	".csv": "text/csv",
	".doc": "application/msword",
	".docx":
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".gif": "image/gif",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".json": "application/json",
	".log": "text/plain",
	".pdf": "application/pdf",
	".png": "image/png",
	".ppt": "application/vnd.ms-powerpoint",
	".pptx":
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	".txt": "text/plain",
	".webp": "image/webp",
	".xls": "application/vnd.ms-excel",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export type DocumentTarget = {
	targetType: "ticket" | "case_note" | "draft";
	targetId: string;
};
export type DocumentViewer = { userId: string; role: "reporter" | "analyst" };

const normalizedExtension = (filename: string) =>
	extname(filename).toLowerCase();

/** Serving type for a stored document, from its name rather than its uploader. */
export function documentMediaType(filename: string): string {
	return (
		MEDIA_TYPES[normalizedExtension(filename)] ?? "application/octet-stream"
	);
}

export function documentExtensionAllowList(
	configured: readonly string[] = DEFAULT_DOCUMENT_EXTENSIONS,
) {
	const safeDefaults = new Set<string>(DEFAULT_DOCUMENT_EXTENSIONS);
	const extensions = new Set(
		configured.map((value) =>
			(value.startsWith(".") ? value : `.${value}`).toLowerCase(),
		),
	);
	for (const extension of extensions) {
		if (EXECUTABLE_EXTENSIONS.has(extension))
			throw new Error(
				`Executable document extension is forbidden: ${extension}`,
			);
		if (!safeDefaults.has(extension))
			throw new Error(
				`Document extension cannot widen the safe allow-list: ${extension}`,
			);
	}
	return extensions;
}

export function prepareFileDocument(
	originalFilename: string,
	content: Uint8Array,
	configuredExtensions?: readonly string[],
) {
	const extension = normalizedExtension(originalFilename);
	if (
		!extension ||
		!documentExtensionAllowList(configuredExtensions).has(extension)
	)
		throw new Error(
			`Document extension is not allowed: ${extension || "none"}`,
		);
	const sha256 = createHash("sha256").update(content).digest("hex");
	return {
		displayName: originalFilename,
		mediaType: documentMediaType(originalFilename),
		sha256,
		storageKey: sha256,
		storedFilename: `${randomUUID()}${extension}`,
	};
}

export function prepareLinkDocument(displayName: string, value: string) {
	const url = new URL(value);
	if (url.protocol !== "https:" && url.protocol !== "http:")
		throw new Error("Only HTTP(S) document links are supported");
	return { displayName, url: url.toString() };
}

/** Any currently-visible parent grants access; no permission snapshot is stored on the document. */
export async function canReadDocument(
	links: readonly DocumentTarget[],
	viewer: DocumentViewer,
	canReadTarget: (
		target: DocumentTarget,
		viewer: DocumentViewer,
	) => boolean | Promise<boolean>,
) {
	for (const link of links) if (await canReadTarget(link, viewer)) return true;
	return false;
}

export function canReadCaseNote(
	viewer: DocumentViewer,
	note: { reporterId: string; private: boolean },
) {
	return (
		viewer.role === "analyst" ||
		(!note.private && viewer.userId === note.reporterId)
	);
}

/** Reuse an existing content row; document_links still permits attachment to many records. */
export const deduplicateDocument = <T extends { sha256: string }>(
	existing: T | undefined,
	incoming: T,
) => existing ?? incoming;
