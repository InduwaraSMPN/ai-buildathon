export function formatTicketNumber(
	recordType: "incident" | "service_request",
	year: number,
	sequence: number,
	minimumDigits = 5,
) {
	if (!Number.isSafeInteger(sequence) || sequence < 1)
		throw new RangeError("Ticket sequence must be a positive safe integer");
	return `${recordType === "incident" ? "INC" : "REQ"}-${year}-${String(sequence).padStart(minimumDigits, "0")}`;
}

export function auditChanges(
	before: Record<string, unknown>,
	after: Record<string, unknown>,
) {
	return Object.keys(after).flatMap((fieldName) =>
		Object.is(before[fieldName], after[fieldName])
			? []
			: [
					{
						fieldName,
						oldValue: before[fieldName] ?? null,
						newValue: after[fieldName] ?? null,
					},
				],
	);
}
