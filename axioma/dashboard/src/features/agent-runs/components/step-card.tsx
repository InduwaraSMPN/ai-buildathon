import {
	RiCheckboxCircleLine as CheckCircle2,
	RiArrowDownSLine as ChevronDown,
	RiDatabase2Line as Database,
	RiErrorWarningLine as ErrorWarning,
	RiEyeLine as Eye,
	RiFlagLine as Flag,
	RiForbid2Line as Forbid,
	RiInformationLine as Information,
	RiLightbulbLine as Lightbulb,
	RiShieldCheckLine as ShieldCheck,
	RiAlarmWarningLine as TriangleAlert,
	RiToolsLine as Wrench,
} from "@remixicon/react";
import { formatDate } from "@/components/support-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { EvidenceTone } from "@/sdk/shared";
import type { AgentStep } from "../api/types";

const stepKinds = {
	think: { icon: Lightbulb, tone: "text-muted-foreground" },
	tool_call: { icon: Wrench, tone: "text-primary" },
	observation: { icon: Eye, tone: "text-secondary-foreground" },
	decision: { icon: CheckCircle2, tone: "text-success" },
	terminal: { icon: Flag, tone: "text-warning" },
} satisfies Record<AgentStep["kind"], { icon: typeof Lightbulb; tone: string }>;

/**
 * The observation the run must record before it is allowed to resolve. It is
 * the same tool name the run loop gates on, so the badge states the obligation
 * rather than restating the tool badge beside it.
 */
const CMDB_OBSERVATION = "cmdb_record_observation";

/**
 * A refusal by the API's environment guard rather than a platform fault. The
 * gateway writes the guard's own text onto the step it refused, and that same
 * text is what the ITSM connector reads to turn a shadow suppression into a
 * reviewable proposal — so the transcript recognises the string the guard
 * produced instead of a parallel flag that could disagree with it.
 */
const SHADOW_REFUSAL = "shadow mode; refusing write tool";

export function StepCard({
	step,
	number,
}: {
	step: AgentStep;
	number: number;
}) {
	const kind = step.kind;
	const isToolCall = kind === "tool_call";
	const isDecision = kind === "decision" || kind === "terminal";
	// Set by the API when this read discharged a verification obligation, so a
	// verifying read is not left looking like the diagnostic read of the same
	// tool a few rows above it.
	const verifiesTool = step.verifiesTool;
	const gatesResolution = isToolCall && step.toolName === CMDB_OBSERVATION;
	const refused = step.error?.includes(SHADOW_REFUSAL) ?? false;
	return (
		<li className="grid grid-cols-[42px_1fr] border-b last:border-b-0">
			<div className="flex justify-center border-r bg-muted/30 py-4">
				<span className="grid size-5 place-items-center bg-foreground font-mono text-background text-xs">
					{number}
				</span>
			</div>
			<article className={cn("min-w-0 p-4", isDecision && "bg-muted/30")}>
				<div className="flex flex-wrap items-center gap-2">
					<StepIcon kind={kind} />
					<strong className="text-xs uppercase tracking-wider">
						{kind.replaceAll("_", " ")}
					</strong>
					{step.toolName && (
						<Badge variant="secondary" className="font-mono">
							{step.toolName}
						</Badge>
					)}
					{verifiesTool && (
						<Badge variant="outline" tone="success">
							<ShieldCheck aria-hidden="true" />
							Verifies <span className="font-mono">{verifiesTool}</span>
						</Badge>
					)}
					{gatesResolution && (
						<Badge variant="outline" tone="info">
							<Database aria-hidden="true" />
							Required before resolution
						</Badge>
					)}
					{refused && (
						<Badge variant="outline" tone="destructive">
							<Forbid aria-hidden="true" />
							Refused by policy
						</Badge>
					)}
					<time className="ml-auto text-muted-foreground text-xs">
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
				{step.evidence && (
					<EvidenceBlock evidence={step.evidence} tone={step.evidenceTone} />
				)}
				{step.toolOutput != null && <CollapsedOutput value={step.toolOutput} />}
				{!isToolCall && step.toolInput != null && (
					<ValueBlock title="Input" value={step.toolInput} code />
				)}
				{step.error && (
					<ValueBlock
						title={refused ? "Refused" : "Error"}
						value={step.error}
						error
					/>
				)}
				{step.notice && <NoticeBlock notice={step.notice} />}
			</article>
		</li>
	);
}

// The Alert primitive has no tone variants, so each evidence tone maps to
// semantic-token classes locally; the tone itself comes from the agent.
const evidenceToneClass = {
	success: "border-success/40 bg-success/10",
	warning: "border-warning/40 bg-warning/10",
	destructive: "border-destructive/40 bg-destructive/10",
	neutral: "border-border bg-muted/40",
} satisfies Record<EvidenceTone, string>;

const evidenceToneIcon = {
	success: CheckCircle2,
	warning: TriangleAlert,
	destructive: ErrorWarning,
	neutral: Information,
} satisfies Record<EvidenceTone, typeof CheckCircle2>;

function EvidenceBlock({
	evidence,
	tone = "success",
}: {
	evidence: string;
	tone?: EvidenceTone;
}) {
	const Icon = evidenceToneIcon[tone];
	return (
		<Alert className={cn("mt-3", evidenceToneClass[tone])}>
			<Icon aria-hidden="true" />
			<AlertTitle>Evidence</AlertTitle>
			<AlertDescription>
				<pre className="whitespace-pre-wrap break-words font-sans text-foreground text-xs leading-5">
					{evidence}
				</pre>
			</AlertDescription>
		</Alert>
	);
}

function NoticeBlock({ notice }: { notice: string }) {
	return (
		<Alert className="mt-3 border-border bg-muted/40">
			<AlertTitle>Notice</AlertTitle>
			<AlertDescription>{notice}</AlertDescription>
		</Alert>
	);
}

function CollapsedOutput({ value }: { value: unknown }) {
	return (
		<Collapsible className="mt-3 border bg-muted/30">
			<CollapsibleTrigger className="flex w-full items-center justify-between p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
				Full tool output
				<ChevronDown className="size-3.5" aria-hidden="true" />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<pre className="overflow-x-auto whitespace-pre-wrap break-words border-t p-3 font-mono text-xs leading-5">
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
	const content = (
		<pre
			className={
				code
					? "overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-5"
					: "whitespace-pre-wrap font-sans text-xs leading-5"
			}
		>
			{serialize(value)}
		</pre>
	);
	if (error)
		return (
			<Alert variant="destructive" className="mt-3">
				<AlertTitle>{title}</AlertTitle>
				<AlertDescription>{content}</AlertDescription>
			</Alert>
		);
	return (
		<div className="mt-3">
			<p className="mb-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
				{title}
			</p>
			{content}
		</div>
	);
}

function serialize(value: unknown) {
	if (typeof value === "string") return value;
	const serialized = JSON.stringify(value, null, 2);
	return serialized ?? String(value);
}

function StepIcon({ kind }: { kind: AgentStep["kind"] }) {
	const { icon: Icon, tone } = stepKinds[kind];
	return <Icon className={cn("size-4", tone)} aria-hidden="true" />;
}
