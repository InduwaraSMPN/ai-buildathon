export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 10_000;
export const MAX_CSV_COLUMNS = 100;

export type CsvRow = Readonly<Record<string, string>>;
export type AssetImportRejection = {
	rowNumber: number;
	reason: string;
	row: CsvRow;
};
export type AssetImportCandidate = {
	rowNumber: number;
	identityKey: string;
	values: CsvRow;
};
export type AssetImportPreview = {
	headers: string[];
	accepted: AssetImportCandidate[];
	rejected: AssetImportRejection[];
};

export function parseCsv(input: string): string[][] {
	if (Buffer.byteLength(input, "utf8") > MAX_CSV_BYTES)
		throw new Error(`CSV exceeds ${MAX_CSV_BYTES} bytes`);

	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	// Excel and many supplier exports write `a, "b,c"`, so a field that has seen
	// nothing but whitespace still opens a quoted field — testing for an empty
	// field instead splits that row on the comma inside the quotes.
	let blank = true;
	let closed = false;

	for (let index = 0; index < input.length; index += 1) {
		const character = input[index] ?? "";
		if (quoted) {
			if (character === '"' && input[index + 1] === '"') {
				field += '"';
				index += 1;
			} else if (character === '"') {
				quoted = false;
				closed = true;
			} else field += character;
		} else if (character === '"' && blank) {
			quoted = true;
			blank = false;
			field = "";
		} else if (character === ",") {
			row.push(field);
			field = "";
			blank = true;
			closed = false;
		} else if (character === "\n" || character === "\r") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			blank = true;
			closed = false;
			if (character === "\r" && input[index + 1] === "\n") index += 1;
		} else if (closed) {
			// Only whitespace may follow a closing quote. Appending the rest would
			// turn `"a"x` into `ax`, which reads as a value the file never held.
			if (character.trim() !== "")
				throw new Error(
					`CSV row ${rows.length + 1} has content after a closing quote`,
				);
		} else {
			field += character;
			if (character.trim() !== "") blank = false;
		}
	}

	if (quoted) throw new Error("CSV has an unterminated quoted field");
	if (field.length > 0 || row.length > 0 || closed) {
		row.push(field);
		rows.push(row);
	}
	if (rows.length > MAX_CSV_ROWS + 1)
		throw new Error(`CSV exceeds ${MAX_CSV_ROWS} data rows`);
	return rows;
}

/**
 * The stable identity of one imported row. Length-prefixing each part keeps two
 * different column/value combinations from producing the same key. Exported so
 * anything writing assetImportIdentities directly builds the key the importer
 * will look it up by, rather than a shape of its own.
 */
export function assetIdentityKey(
	identityColumns: readonly string[],
	row: CsvRow,
): string {
	return identityColumns
		.map(
			(column) =>
				`${column.length}:${column}=${row[column]?.length}:${row[column]}`,
		)
		.join("|");
}

export function previewAssetCsv(
	input: string,
	identityColumns: readonly string[],
): AssetImportPreview {
	const rows = parseCsv(input);
	if (rows.length === 0) throw new Error("CSV is empty");
	if (identityColumns.length === 0)
		throw new Error("At least one identity column is required");

	const headers = (rows[0] ?? []).map((header, index) =>
		(index === 0 ? header.replace(/^\uFEFF/, "") : header).trim(),
	);
	if (headers.length > MAX_CSV_COLUMNS)
		throw new Error(`CSV exceeds ${MAX_CSV_COLUMNS} columns`);
	if (headers.some((header) => !header))
		throw new Error("CSV headers cannot be blank");
	if (new Set(headers).size !== headers.length)
		throw new Error("CSV headers must be unique");
	for (const column of identityColumns)
		if (!headers.includes(column))
			throw new Error(`Identity column '${column}' is missing`);

	const accepted: AssetImportCandidate[] = [];
	const rejected: AssetImportRejection[] = [];
	for (let index = 1; index < rows.length; index += 1) {
		const values = rows[index] ?? [];
		if (values.length === 1 && values[0]?.trim() === "") continue;
		const rowNumber = index + 1;
		const row = Object.fromEntries(
			headers.map((header, column) => [header, values[column]?.trim() ?? ""]),
		);
		if (values.length !== headers.length) {
			rejected.push({
				rowNumber,
				reason: `Expected ${headers.length} columns, received ${values.length}`,
				row,
			});
			continue;
		}
		const missing = identityColumns.filter((column) => !row[column]);
		if (missing.length > 0) {
			rejected.push({
				rowNumber,
				reason: `Missing identity value: ${missing.join(", ")}`,
				row,
			});
			continue;
		}
		accepted.push({
			rowNumber,
			identityKey: assetIdentityKey(identityColumns, row),
			values: row,
		});
	}
	return { headers, accepted, rejected };
}
