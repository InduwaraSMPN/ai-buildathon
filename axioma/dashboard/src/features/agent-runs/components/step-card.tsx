import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	Circle,
	Wrench,
} from "lucide-react";
import { formatDate } from "@/components/support-ui";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { AgentStep } from "../api/types";

export function StepCard({
	step,
	number,
}: {
	step: AgentStep;
	number: number;
}) {
	const kind = step.kind.toLowerCase();
	const isToolCall = kind === "tool_call";
	const isDecision = kind === "decision" || kind === "terminal";
	return (
		<li className="grid grid-cols-[42px_1fr] border-b last:border-b-0">
			<div className="flex justify-center border-r bg-muted/30 py-4">
				<span className="grid size-5 place-items-center bg-foreground font-mono text-[9px] text-background">
					{number}
				</span>
			</div>
			<article
				className={`min-w-0 p-4 ${isDecision ? "bg-foreground/[0.03]" : ""}`}
			>
				<div className="flex flex-wrap items-center gap-2">
					<StepIcon step={step} />
					<strong className="text-xs uppercase tracking-wider">
						{kind.replaceAll("_", " ")}
					</strong>
					{step.toolName && (
						<span className="border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
							{step.toolName}
						</span>
					)}
					<time className="ml-auto text-[10px] text-muted-foreground">
						{formatDate(step.createdAt)}
					</time>
				</div>
				{step.reasoning && (
					<ValueBlock
						title={isDecision ? "Decision" : "Reasoning"}
						value={step.reasoning}
					/>
				)}
				{isToolCall && step.toolInput != null && (
					<ValueBlock title="Tool input" value={step.toolInput} code />
				)}
				{step.evidence && <EvidenceBlock evidence={step.evidence} />}
				{step.toolOutput != null && <CollapsedOutput value={step.toolOutput} />}
				{!isToolCall && step.toolInput != null && (
					<ValueBlock title="Input" value={step.toolInput} code />
				)}
				{step.error && <ValueBlock title="Error" value={step.error} error />}
			</article>
		</li>
	);
}

function EvidenceBlock({ evidence }: { evidence: string }) {
	return (
		<section className="mt-3 border-2 border-emerald-500/40 bg-emerald-500/5 p-3">
			<p className="mb-1.5 font-semibold text-[10px] text-emerald-700 uppercase tracking-wider dark:text-emerald-300">
				Evidence
			</p>
			<pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5">
				{evidence}
			</pre>
		</section>
	);
}

function CollapsedOutput({ value }: { value: unknown }) {
	return (
		<Collapsible className="mt-3 border bg-muted/30">
			<CollapsibleTrigger className="flex w-full items-center justify-between p-3 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
				Full tool output
				<ChevronDown className="size-3.5" aria-hidden="true" />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<pre className="overflow-x-auto whitespace-pre-wrap break-words border-t p-3 font-mono text-[11px] leading-5">
					{serialize(value)}
				</pre>
			</CollapsibleContent>
		</Collapsible>
	);
}

function ValueBlock({
	title,
	value,
	code,
	error,
}: {
	title: string;
	value: unknown;
	code?: boolean;
	error?: boolean;
}) {
	return (
		<div
			className={
				error
					? "mt-3 border border-destructive/30 bg-destructive/5 p-3"
					: "mt-3"
			}
		>
			<p
				className={`mb-1.5 font-medium text-[10px] uppercase tracking-wider ${error ? "text-destructive" : "text-muted-foreground"}`}
			>
				{title}
			</p>
			<pre
				className={
					code
						? "overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5"
						: "whitespace-pre-wrap font-sans text-xs leading-5"
				}
			>
				{serialize(value)}
			</pre>
		</div>
	);
}

function serialize(value: unknown) {
	if (typeof value === "string") return value;
	const serialized = JSON.stringify(value, null, 2);
	return serialized ?? String(value);
}

function StepIcon({ step }: { step: AgentStep }) {
	if (step.error)
		return (
			<AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
		);
	if (step.kind === "tool_call" || step.kind === "observation" || step.toolName)
		return <Wrench className="size-4 text-violet-500" aria-hidden="true" />;
	if (step.kind === "decision" || step.kind === "terminal")
		return (
			<CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
		);
	return <Circle className="size-4 text-sky-500" aria-hidden="true" />;
}
