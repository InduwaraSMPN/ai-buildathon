/**
 * The guards every attachment control applies before anything reaches the
 * server: the accepted media types, the size ceiling, and the `accept` string
 * that offers the same set to the file picker. Shared so the ticket page and
 * the intake tray cannot drift apart on what an employee is allowed to send.
 */
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const ATTACHMENT_ACCEPT =
	"image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

export type RejectedAttachment = { file: File; reason: "type" | "size" };

export type ScreenedAttachments = {
	accepted: File[];
	rejected: RejectedAttachment[];
};

function extensionOf(name: string): string {
	return name.split(".").pop()?.toLowerCase() ?? "";
}

/** A dropped file can arrive with an empty media type, so the name is the fallback. */
export function isAllowedImage(file: File): boolean {
	return file.type
		? ALLOWED_IMAGE_TYPES.has(file.type)
		: ALLOWED_EXTENSIONS.has(extensionOf(file.name));
}

export function mediaKind(file: File): "image" | "file" {
	return file.type.startsWith("image/") ||
		ALLOWED_EXTENSIONS.has(extensionOf(file.name))
		? "image"
		: "file";
}

/**
 * Splits a picked or dropped selection into what may be uploaded and what may
 * not. The reason travels with the file rather than a message, so each surface
 * words the refusal in its own copy.
 */
export function screenAttachments(
	files: FileList | File[],
): ScreenedAttachments {
	const accepted: File[] = [];
	const rejected: RejectedAttachment[] = [];
	for (const file of Array.from(files)) {
		if (!isAllowedImage(file)) rejected.push({ file, reason: "type" });
		else if (file.size > MAX_ATTACHMENT_BYTES)
			rejected.push({ file, reason: "size" });
		else accepted.push(file);
	}
	return { accepted, rejected };
}
