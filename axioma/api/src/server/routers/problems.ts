import { capabilityProcedure } from "../orpc";
import {
	closeProblem,
	createProblem,
	getProblem,
	linkProblemTickets,
	listProblems,
	updateProblem,
} from "../problems";

export const problemsRouter = {
	listProblems: capabilityProcedure("problem.manage").listProblems.handler(() =>
		listProblems(),
	),
	getProblem: capabilityProcedure("problem.manage").getProblem.handler(
		({ input }) => getProblem(input.id),
	),
	createProblem: capabilityProcedure("problem.manage").createProblem.handler(
		({ input }) => createProblem(input),
	),
	updateProblem: capabilityProcedure("problem.manage").updateProblem.handler(
		({ input: { id, ...patch } }) => updateProblem(id, patch),
	),
	linkProblemTickets: capabilityProcedure(
		"problem.manage",
	).linkProblemTickets.handler(({ input }) =>
		linkProblemTickets(input.problemId, input.ticketIds),
	),
	closeProblem: capabilityProcedure("problem.manage").closeProblem.handler(
		({ input }) => closeProblem(input.id, input.resolution),
	),
};
