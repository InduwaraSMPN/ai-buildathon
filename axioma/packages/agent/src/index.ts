import { RUN_LIMITS, type RunStatus, type TicketRoute } from "@axioma/shared";

import { type AnyToolDefinition, listTools, resolveTool } from "./tools";

export * from "./tools";

/**
 * Axel: the agent loop.
 *
 * Read, think, act, verify — bounded. The loop owns the sequence and the limits;
 * the model owns only what to try next. Nothing here decides a verdict from the
 * model's confidence.
 */

export interface ModelProvider {
	/** Identifier of the model that actually answered, recorded on the run. */
	readonly label: string;
	complete(request: ModelRequest): Promise<ModelResponse>;
}

export interface ModelRequest {
	system: string;
	messages: { role: "user" | "assistant" | "tool"; content: string }[];
	tools: AnyToolDefinition[];
}

export type ModelResponse =
	| { kind: "tool_call"; reasoning: string; tool: string; input: unknown }
	| { kind: "resolved"; reasoning: string; resolution: string }
	| { kind: "escalate"; reasoning: string; reason: string; proposal?: unknown };

export interface StepRecorder {
	record(step: {
		kind: "think" | "tool_call" | "observation" | "decision";
		reasoning?: string;
		toolName?: string;
		toolInput?: unknown;
		toolOutput?: unknown;
		error?: string;
	}): Promise<void>;
}

export type ToolExecutor = (name: string, input: unknown) => Promise<unknown>;

export interface RunContext {
	ticketId: string;
	runId: string;
	route: TicketRoute;
	model: ModelProvider;
	recorder: StepRecorder;
	execute: ToolExecutor;
	now: () => number;
}

export interface RunResult {
	status: RunStatus;
	outcome: string;
}

export async function runAgent(ctx: RunContext): Promise<RunResult> {
	const startedAt = ctx.now();
	const transcript: ModelRequest["messages"] = [];
	let toolCalls = 0;

	for (let turn = 0; turn < RUN_LIMITS.maxModelTurns; turn += 1) {
		if (ctx.now() - startedAt > RUN_LIMITS.runDeadlineMs) {
			return exhausted(ctx, "run deadline exceeded");
		}

		const response = await ctx.model.complete({
			system: SYSTEM_PROMPT,
			messages: transcript,
			tools: listTools(),
		});

		if (response.kind === "resolved") {
			await ctx.recorder.record({
				kind: "decision",
				reasoning: response.reasoning,
			});
			return { status: "resolved", outcome: response.resolution };
		}

		if (response.kind === "escalate") {
			await ctx.recorder.record({
				kind: "decision",
				reasoning: response.reasoning,
				toolOutput: response.proposal,
			});
			return { status: "escalated", outcome: response.reason };
		}

		if (toolCalls >= RUN_LIMITS.maxToolCalls) {
			return exhausted(ctx, "tool call ceiling reached");
		}

		const tool = resolveTool(response.tool);
		if (!tool) {
			// An unknown tool is a model error, not a crash. Tell it and let it retry
			// within the same budget.
			await ctx.recorder.record({
				kind: "observation",
				toolName: response.tool,
				error: `unknown tool: ${response.tool}`,
			});
			transcript.push({
				role: "tool",
				content: `unknown tool: ${response.tool}`,
			});
			continue;
		}

		const parsed = tool.input.safeParse(response.input);
		if (!parsed.success) {
			await ctx.recorder.record({
				kind: "observation",
				toolName: tool.name,
				toolInput: response.input,
				error: parsed.error.message,
			});
			transcript.push({
				role: "tool",
				content: `invalid input: ${parsed.error.message}`,
			});
			continue;
		}

		await ctx.recorder.record({
			kind: "tool_call",
			reasoning: response.reasoning,
			toolName: tool.name,
			toolInput: parsed.data,
		});
		toolCalls += 1;

		try {
			const output = await ctx.execute(tool.name, parsed.data);
			await ctx.recorder.record({
				kind: "observation",
				toolName: tool.name,
				toolOutput: output,
			});
			transcript.push({ role: "tool", content: JSON.stringify(output) });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await ctx.recorder.record({
				kind: "observation",
				toolName: tool.name,
				error: message,
			});
			transcript.push({ role: "tool", content: `tool failed: ${message}` });
		}
	}

	return exhausted(ctx, "model turn ceiling reached");
}

async function exhausted(ctx: RunContext, reason: string): Promise<RunResult> {
	await ctx.recorder.record({ kind: "decision", error: reason });
	return { status: "exhausted", outcome: reason };
}

const SYSTEM_PROMPT = `You are Axel, an IT support agent.

Given a ticket, gather evidence with read tools before acting. Act only when the
evidence identifies a specific cause and a specific fix. After any write, verify
with the read tool named by that write's definition — a write returning success
means the call was accepted, not that the problem is fixed.

Escalate rather than act when the fix is a policy decision rather than a
correction. Changing a resource request, adding capacity, or anything whose
right answer depends on intent you do not have is a policy decision. Escalating
with a clear diagnosis is a good outcome, not a failure.

Select tools by name and supply typed parameters. You cannot compose commands.`;
