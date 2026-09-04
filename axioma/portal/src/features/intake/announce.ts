import { useEffect, useState } from "react";

/**
 * Batch a self-filling surface into one announcement instead of narrating
 * every streamed change. The delay is deliberately long — a screen reader user
 * hears the settled summary, not each mutation — and focus is never moved.
 */
export const ANNOUNCE_DELAY_MS = 2500;

/**
 * Returns the text a polite live region should currently hold.
 *
 * `hold` is the streaming flag: while a turn is in flight nothing is scheduled
 * and the previous summary stays put, so the region says one settled thing per
 * turn rather than re-reading itself on every delta.
 */
export function useDebouncedAnnouncement(summary: string, hold: boolean) {
	const [announcement, setAnnouncement] = useState("");
	useEffect(() => {
		if (hold) return;
		const timer = setTimeout(() => setAnnouncement(summary), ANNOUNCE_DELAY_MS);
		return () => clearTimeout(timer);
	}, [summary, hold]);
	return announcement;
}
