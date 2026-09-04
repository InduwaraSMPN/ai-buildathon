import { RiAddLine, RiArrowUpLine, RiMicLine } from "@remixicon/react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function PromptInput({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="prompt-input"
			className={cn(
				"flex w-full min-w-0 max-w-2xl flex-col gap-2 rounded-2xl border border-border bg-card p-2 text-card-foreground shadow-sm",
				className,
			)}
			{...props}
		/>
	);
}

function PromptInputBody({
	className,
	rows = 4,
	placeholder = "Describe your request…",
	...props
}: React.ComponentProps<"textarea">) {
	return (
		<InputGroup className="border-0 bg-transparent p-0 shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0! dark:bg-transparent">
			<InputGroupTextarea
				rows={rows}
				placeholder={placeholder}
				className={cn("min-h-24", className)}
				{...props}
			/>
		</InputGroup>
	);
}

function PromptInputAttachments({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="prompt-input-attachments"
			className={cn("flex min-w-0 flex-wrap gap-2", className)}
			{...props}
		/>
	);
}

function PromptInputToolbar({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="prompt-input-toolbar"
			className={cn(
				"flex items-center justify-between gap-2 py-0.5",
				className,
			)}
			{...props}
		/>
	);
}

function PromptInputMic({
	className,
	onClick,
	...props
}: React.ComponentProps<typeof Button>) {
	return (
		// No TooltipProvider here: every consumer already wraps the composer in
		// one, and a nested provider would override the app-level delay.
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						size="icon-sm"
						variant="ghost"
						aria-label="Voice input"
						disabled
						// Without this, Base UI emits the *native* `disabled`
						// attribute, and a natively disabled button receives neither
						// `mouseenter` nor focus — so the one thing this control
						// exists to say could never be read. `focusableWhenDisabled`
						// swaps it for `aria-disabled` and keeps the button
						// tab-reachable; Base UI still swallows click and keydown, so
						// it stays inert.
						focusableWhenDisabled
						onClick={onClick}
						className={cn(
							// `disabled:` no longer matches without the native
							// attribute, so the dimming hangs off `data-disabled`
							// instead — and the ghost hover is cancelled, because a
							// control that cannot be used should not light up.
							"data-[disabled]:opacity-50 data-[disabled]:hover:bg-transparent! data-[disabled]:hover:text-inherit!",
							className,
						)}
						{...props}
					/>
				}
			>
				<RiMicLine />
			</TooltipTrigger>
			<TooltipContent side="top">Voice input is coming soon</TooltipContent>
		</Tooltip>
	);
}

function PromptInputSubmit({
	className,
	disabled,
	busy = false,
	children,
	...props
}: React.ComponentProps<typeof Button> & { busy?: boolean }) {
	return (
		<Button
			type="submit"
			// The model call runs for seconds, so the control the user just pressed
			// is where the wait belongs — a disabled arrow reads as a dead button.
			aria-label={busy ? "Sending" : "Send"}
			aria-busy={busy || undefined}
			size="icon-sm"
			variant="default"
			disabled={disabled}
			data-slot="prompt-input-submit"
			className={cn(
				"rounded-full data-[disabled]:bg-muted data-[disabled]:text-muted-foreground data-[disabled]:opacity-100",
				className,
			)}
			{...props}
		>
			{children ?? (busy ? <Spinner /> : <RiArrowUpLine />)}
		</Button>
	);
}

/**
 * A quiet way in to file upload, sized to sit in the toolbar row beside the
 * send control rather than in a footer of its own.
 */
function PromptInputUpload({
	className,
	children,
	disabled,
	onClick,
	...props
}: React.ComponentProps<"button">) {
	return (
		<button
			type="button"
			data-slot="prompt-input-upload"
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"flex items-center gap-1.5 rounded-md py-1 pr-2 pl-1 text-muted-foreground text-sm transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<RiAddLine className="size-4" aria-hidden="true" />
			{children}
		</button>
	);
}

function PromptInputSuggestion({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="prompt-input-suggestion"
			className={cn(
				"flex min-w-0 flex-wrap items-center justify-center gap-2",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * A suggestion chip. Rounded and quiet by default so a row of them reads as
 * optional, and adopts the accent on hover the way the send control does.
 */
function PromptInputSuggestionChip({
	className,
	...props
}: React.ComponentProps<"button">) {
	return (
		<button
			type="button"
			data-slot="prompt-input-suggestion-chip"
			className={cn(
				"rounded-full border border-border bg-card px-3.5 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export {
	PromptInput,
	PromptInputAttachments,
	PromptInputBody,
	PromptInputMic,
	PromptInputSubmit,
	PromptInputSuggestion,
	PromptInputSuggestionChip,
	PromptInputToolbar,
	PromptInputUpload,
};
