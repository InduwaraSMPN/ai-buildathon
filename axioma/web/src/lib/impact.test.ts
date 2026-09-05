import { impactDefaults } from "../content/impact.ts";
import { estimate } from "./impact.ts";

const result = estimate(impactDefaults);

console.assert(
	result.ticketsPerYear === 4800,
	"annual ticket estimate changed",
);
console.assert(result.autoClosed === 1200, "covered ticket estimate changed");
console.assert(result.itSavings === 54000, "IT cost estimate changed");
console.assert(result.employeeHours === 560, "employee hours estimate changed");
console.assert(
	result.employeeValue === 27316.8,
	"employee value estimate changed",
);
