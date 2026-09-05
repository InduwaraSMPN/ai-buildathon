// Hand-rolled en-US thousands/currency formatting so SSR and client match.
// Do not use Intl.NumberFormat here; it can differ between environments.

function groupThousands(digits: string): string {
	let grouped = "";
	let count = 0;
	for (let i = digits.length - 1; i >= 0; i -= 1) {
		grouped = digits[i] + grouped;
		count += 1;
		if (count % 3 === 0 && i !== 0) {
			grouped = `,${grouped}`;
		}
	}
	return grouped;
}

export function formatInt(n: number): string {
	const rounded = Math.round(n);
	if (!Number.isFinite(rounded)) {
		return "0";
	}
	if (rounded === 0) {
		return "0";
	}
	const negative = rounded < 0;
	const grouped = groupThousands(Math.abs(rounded).toString());
	return negative ? `-${grouped}` : grouped;
}

export function formatCurrency(n: number): string {
	const rounded = Math.round(n);
	if (!Number.isFinite(rounded)) {
		return "$0";
	}
	if (rounded === 0) {
		return "$0";
	}
	const grouped = groupThousands(Math.abs(rounded).toString());
	return rounded < 0 ? `-$${grouped}` : `$${grouped}`;
}

export function formatHours(n: number): string {
	return formatInt(n);
}
