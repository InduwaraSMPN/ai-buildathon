// Pure estimate from published benchmarks.

export interface ImpactInputs {
	employees: number;
	ticketsPerEmployeeMonth: number;
	autoShare: number;
	costPerTicket: number;
	lostMinutesPerIncident: number;
	loadedHourly: number;
}

export interface ImpactOutputs {
	ticketsPerYear: number;
	autoClosed: number;
	itSavings: number;
	employeeHours: number;
	employeeValue: number;
}

export function estimate(inputs: ImpactInputs): ImpactOutputs {
	const ticketsPerYear = inputs.employees * inputs.ticketsPerEmployeeMonth * 12;
	const autoClosed = ticketsPerYear * inputs.autoShare;
	const itSavings = autoClosed * inputs.costPerTicket;
	const employeeHours = (autoClosed * inputs.lostMinutesPerIncident) / 60;
	const employeeValue = employeeHours * inputs.loadedHourly;
	return {
		ticketsPerYear,
		autoClosed,
		itSavings,
		employeeHours,
		employeeValue,
	};
}
