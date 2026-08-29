import { useEffect, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	getKeyboardShortcutAction,
	KEYBOARD_SHORTCUTS,
	type KeyboardShortcutAction,
} from "./keyboard-shortcut-logic";

export type KeyboardShortcutHandlers = Partial<
	Record<Exclude<KeyboardShortcutAction, "shortcuts">, () => void>
>;

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers = {}) {
	const [shortcutsOpen, setShortcutsOpen] = useState(false);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const action = getKeyboardShortcutAction(event);
			if (!action || (shortcutsOpen && action !== "shortcuts")) return;

			const handler =
				action === "shortcuts"
					? () => setShortcutsOpen((open) => !open)
					: handlers[action];
			if (!handler) return;

			event.preventDefault();
			handler();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [handlers, shortcutsOpen]);

	return { shortcutsOpen, setShortcutsOpen };
}

export function KeyboardShortcutSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent aria-describedby="keyboard-shortcuts-description">
				<SheetHeader>
					<SheetTitle>Keyboard shortcuts</SheetTitle>
					<SheetDescription id="keyboard-shortcuts-description">
						Queue navigation and ticket actions
					</SheetDescription>
				</SheetHeader>
				<dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 px-4">
					{KEYBOARD_SHORTCUTS.map(({ key, label }) => (
						<div className="contents" key={key}>
							<dt>
								<Kbd>{key}</Kbd>
							</dt>
							<dd>{label}</dd>
						</div>
					))}
				</dl>
			</SheetContent>
		</Sheet>
	);
}
