export type KeyboardShortcutAction =
	| "shortcuts"
	| "search"
	| "next"
	| "previous"
	| "open"
	| "escalate"
	| "resolve";

export const KEYBOARD_SHORTCUTS = [
	{ key: "?", action: "shortcuts", label: "Show keyboard shortcuts" },
	{ key: "/", action: "search", label: "Focus search" },
	{ key: "j", action: "next", label: "Select next row" },
	{ key: "k", action: "previous", label: "Select previous row" },
	{ key: "Enter", action: "open", label: "Open selected ticket" },
	{ key: "e", action: "escalate", label: "Escalate selected ticket" },
	{ key: "r", action: "resolve", label: "Resolve selected ticket" },
] as const satisfies ReadonlyArray<{
	key: string;
	action: KeyboardShortcutAction;
	label: string;
}>;

const ACTION_BY_KEY: ReadonlyMap<string, KeyboardShortcutAction> = new Map(
	KEYBOARD_SHORTCUTS.map(({ key, action }) => [key, action]),
);

type ShortcutTarget = {
	tagName?: string;
	isContentEditable?: boolean;
	getAttribute?: (name: string) => string | null;
};

export type ShortcutInput = {
	key: string;
	target?: unknown;
	defaultPrevented?: boolean;
	isComposing?: boolean;
	altKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
};

export function isEditableTarget(target: unknown) {
	if (!target || typeof target !== "object") return false;

	const candidate = target as ShortcutTarget;
	const tagName = candidate.tagName?.toLowerCase();
	return (
		candidate.isContentEditable === true ||
		tagName === "input" ||
		tagName === "textarea" ||
		tagName === "select" ||
		tagName === "button" ||
		tagName === "a" ||
		candidate.getAttribute?.("role") === "textbox"
	);
}

export function getKeyboardShortcutAction({
	key,
	target,
	defaultPrevented,
	isComposing,
	altKey,
	ctrlKey,
	metaKey,
}: ShortcutInput): KeyboardShortcutAction | null {
	if (
		defaultPrevented ||
		isComposing ||
		altKey ||
		ctrlKey ||
		metaKey ||
		isEditableTarget(target)
	) {
		return null;
	}

	return ACTION_BY_KEY.get(key.length === 1 ? key.toLowerCase() : key) ?? null;
}
