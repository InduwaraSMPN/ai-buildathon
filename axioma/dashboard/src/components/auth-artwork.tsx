import { useEffect, useState } from "react";

import { Asciify } from "@/components/canvasui/Asciify";

/**
 * The frames the auth panel cycles through.
 *
 * Unsplash serves these with `Access-Control-Allow-Origin: *`, and the
 * `crossOrigin` attribute below is what turns that header into an origin-clean
 * capture canvas. Without it Asciify's non-Chromium fallback probes the image,
 * finds the canvas tainted, and silently paints nothing — the panel would go
 * blank everywhere except Chrome.
 */
const FRAMES = [
	{
		src: "https://images.unsplash.com/photo-1782977389500-dd7adad33ebe?q=80&w=2032&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		alt: "Motion-blurred white umbel flowers in a summer meadow",
	},
	{
		src: "https://images.unsplash.com/photo-1782094002386-7d9ae1f49f50?q=80&w=1817&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		alt: "Motion-blurred oxeye daisies swirling in a green field",
	},
	{
		src: "https://images.unsplash.com/photo-1781499455083-6ccc3beb20cd?q=80&w=1809&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		alt: "Motion-blurred blue and pink lupin spires",
	},
	{
		src: "https://images.unsplash.com/photo-1779684474703-5c0519bcf7e8?q=80&w=2703&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
		alt: "Motion-blurred pale blue forget-me-nots",
	},
] as const;

const FRAME_MS = 14000;
const FADE_IN_MS = 1200;
const FADE_OUT_MS = 400;

/**
 * The photographic half of the auth card, redrawn as ascii under the cursor.
 *
 * Every frame stays mounted and is faded with `opacity` rather than swapped
 * into a single `<img>`: Asciify reads the live DOM, so an opacity cross-fade
 * is something both of its capture paths already understand — the Chromium
 * html-in-canvas path animates it, and the fallback snapshot multiplies each
 * element's cascaded opacity into `globalAlpha`. Swapping `src` would instead
 * blank the panel for a network round trip on every rotation.
 *
 * The two frames do not cross. The incoming one fades up over the full
 * duration while the outgoing one holds at full opacity, and only once the
 * incoming has arrived does the outgoing drop away. Fading both at once would
 * put them at 0.5 together in the middle, compositing to 0.75 coverage and
 * letting the card's muted background wash through every transition.
 *
 * Staggering rather than stacking is what keeps this correct without a
 * `z-index`, and no `z-index` is the point: Asciify's output canvas is the
 * last child of its wrapper and paints above these images only for as long as
 * none of them raises itself out of the normal painting order. A `z-index: 1`
 * here hides the ascii entirely, except during a fade — which is exactly what
 * it looks like when it goes wrong.
 */
export function AuthArtwork() {
	const [frames, setFrames] = useState({ previous: 0, current: 0 });

	useEffect(() => {
		// Rotation is decoration, so it is the first thing to go when the reader
		// has asked for less movement. Asciify runs its own reduced-motion check
		// for the lens itself.
		const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
		if (motion.matches) return;
		const timer = window.setInterval(
			() =>
				setFrames((shown) => ({
					previous: shown.current,
					current: (shown.current + 1) % FRAMES.length,
				})),
			FRAME_MS,
		);
		return () => window.clearInterval(timer);
	}, []);

	// Asciify hard-codes `position: relative` inline on its wrapper, and an
	// inline style beats a class, so `absolute inset-0` would leave the box at
	// zero height. It is sized against the panel with `size-full` instead.
	//
	// No effect props are passed. Every one of Asciify's own defaults already
	// matches the canvasui demo — radius 0.4, softness 1, scale 2, spacing 1,
	// baseStrength 0, glow and aberration 0.75, black background — so passing
	// nothing is what keeps this identical to the reference.
	return (
		<Asciify className="size-full">
			{FRAMES.map((image, index) => {
				const active = index === frames.current;
				const outgoing = index === frames.previous && !active;
				return (
					<img
						key={image.src}
						src={image.src}
						alt={active ? image.alt : ""}
						aria-hidden={active ? undefined : true}
						crossOrigin="anonymous"
						decoding="async"
						// The first frame is the one on screen at first paint, and
						// until it decodes the panel is an empty muted rectangle. The
						// other three are not needed for the length of a full turn.
						fetchPriority={index === 0 ? "high" : "low"}
						className="absolute inset-0 size-full object-cover ease-in-out"
						style={{
							opacity: active || outgoing ? 1 : 0,
							transitionProperty: active || outgoing ? "opacity" : "none",
							transitionDuration: active
								? `${FADE_IN_MS}ms`
								: `${FADE_OUT_MS}ms`,
							// The outgoing frame waits for the incoming one to arrive
							// before it starts leaving, so the panel is never showing
							// two half-opaque photos at once.
							transitionDelay: outgoing ? `${FADE_IN_MS}ms` : "0ms",
						}}
					/>
				);
			})}
		</Asciify>
	);
}
