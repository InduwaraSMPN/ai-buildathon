// Deterministic footnote numbers per page.

export function createSourceIndex(ids: string[]): Map<string, number> {
	const index = new Map<string, number>();
	for (const id of ids) {
		if (!index.has(id)) {
			index.set(id, index.size + 1);
		}
	}
	return index;
}
