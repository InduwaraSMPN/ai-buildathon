import assert from "node:assert/strict";
import {
	getKeyboardShortcutAction,
	isEditableTarget,
} from "./keyboard-shortcut-logic.ts";

assert.equal(getKeyboardShortcutAction({ key: "?" }), "shortcuts");
assert.equal(getKeyboardShortcutAction({ key: "/" }), "search");
assert.equal(getKeyboardShortcutAction({ key: "J" }), "next");
assert.equal(getKeyboardShortcutAction({ key: "k" }), "previous");
assert.equal(getKeyboardShortcutAction({ key: "Enter" }), "open");
assert.equal(getKeyboardShortcutAction({ key: "e" }), "escalate");
assert.equal(getKeyboardShortcutAction({ key: "r" }), "resolve");
assert.equal(getKeyboardShortcutAction({ key: "j", ctrlKey: true }), null);
assert.equal(
	getKeyboardShortcutAction({ key: "j", target: { tagName: "INPUT" } }),
	null,
);
assert.equal(
	isEditableTarget({ tagName: "div", isContentEditable: true }),
	true,
);
assert.equal(
	isEditableTarget({
		tagName: "div",
		getAttribute: (name) => (name === "role" ? "textbox" : null),
	}),
	true,
);
assert.equal(isEditableTarget({ tagName: "button" }), true);
assert.equal(isEditableTarget({ tagName: "a" }), true);

console.log("keyboard shortcut validation passed");
