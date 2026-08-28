export type AgentStep = {
	id: string;
	runId: string;
	ordinal: number;
	kind: string;
	reasoning: string | null;
	toolName: string | null;
	toolInput: unknown | null;
	toolOutput: unknown | null;
	error: string | null;
	evidence?: unknown;
	createdAt: Date;
};

export type AgentRunSummary = {
	status: string;
	outcome: string | null;
	model: string | null;
	promptTokens: number | null;
	completionTokens: number | null;
	startedAt: Date;
	endedAt: Date | null;
};

export type AgentRun = AgentRunSummary & {
	id: string;
	ticketId: string;
	steps: AgentStep[];
};

export type TicketAgentRuns = {
	id: string;
	runs: AgentRun[];
};
