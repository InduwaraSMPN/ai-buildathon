/**
 * A v4 UUID that also works off a secure origin.
 *
 * `crypto.randomUUID` is only defined in a secure context, and the portal's own
 * image serves the app over plain HTTP, so calling it directly threw a
 * `TypeError` on the first render of every form that mints an idempotency key —
 * no request could be created at all. `crypto.getRandomValues` carries no such
 * restriction, so it is what the fallback is built from.
 */
export function randomId(): string {
	if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	// RFC 4122 §4.4: version 4 in the high nibble of byte 6, variant 10xx in the
	// two high bits of byte 8.
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return [
		hex.slice(0, 4).join(""),
		hex.slice(4, 6).join(""),
		hex.slice(6, 8).join(""),
		hex.slice(8, 10).join(""),
		hex.slice(10, 16).join(""),
	].join("-");
}

/**
 * Reads an id held in a lazily-filled ref, minting it on first use.
 *
 * The ref is declared `useRef<string>(null)` so a UUID is not burned on every
 * render. TypeScript drops the narrowing that gives back inside a callback, and
 * the read happens inside one, so it goes through here rather than through a
 * non-null assertion at each call site.
 */
export function readRandomId(ref: { current: string | null }): string {
	ref.current ??= randomId();
	return ref.current;
}
