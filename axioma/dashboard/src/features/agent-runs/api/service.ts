import { client } from "@/utils/orpc";
import type { CancelRunInput, StartRunInput } from "./types";

export const agentRunsService = {
	get: (id: string) => client.getRun({ id }),
	start: (input: StartRunInput) => client.startRun(input),
	cancel: (input: CancelRunInput) => client.cancelRun(input),
};
