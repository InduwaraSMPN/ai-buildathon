export type InboundStream = {
	pause(): unknown;
	resume(): unknown;
	destroy(error?: Error): unknown;
};

export function createInboundQueue(
	stream: InboundStream,
	handle: (message: Record<string, unknown>) => Promise<void>,
	limit = 100,
) {
	let tail = Promise.resolve();
	let depth = 0;
	let paused = false;
	return (message: Record<string, unknown>) => {
		if (++depth >= limit && !paused) {
			paused = true;
			stream.pause();
		}
		tail = tail
			.then(() => handle(message))
			.catch((error) => {
				stream.destroy(
					error instanceof Error ? error : new Error(String(error)),
				);
			})
			.finally(() => {
				if (--depth < limit && paused) {
					paused = false;
					stream.resume();
				}
			});
	};
}

export type ToolCallRecord = {
	status: "in_progress" | "succeeded" | "failed";
	result: unknown;
	error: string | null;
};

export const replayToolResult = (
	runId: string,
	callId: string,
	record: ToolCallRecord,
) => ({
	toolResult: {
		runId,
		callId,
		ok: record.status === "succeeded",
		...(record.status === "succeeded"
			? { outputJson: JSON.stringify(record.result) }
			: {
					error:
						record.status === "in_progress"
							? "tool call is already in progress"
							: record.error || "tool call failed",
				}),
	},
});

export const leaseDeadline = (now: Date, leaseMs: number) =>
	new Date(now.getTime() + leaseMs);

export function createNonOverlappingTask(run: () => Promise<void>) {
	let active: Promise<void> | undefined;
	return () => (active ??= run().finally(() => (active = undefined)));
}

export async function runMaintenanceJobs(
	jobs: readonly (readonly [string, () => Promise<unknown>])[],
	log: (name: string, reason: unknown) => void,
) {
	const settled = await Promise.allSettled(jobs.map(([, run]) => run()));
	settled.forEach((result, index) => {
		if (result.status === "rejected")
			log(jobs[index]?.[0] ?? "unknown", result.reason);
	});
}
