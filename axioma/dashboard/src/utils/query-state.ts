type QueryStateInput<T, E> = {
	isPending: boolean;
	isError: boolean;
	error: E;
	data: T | null | undefined;
};

export type QueryContentState<T, E> =
	| { kind: "loading" }
	| { kind: "error"; error: E }
	| { kind: "empty" }
	| { kind: "content"; data: T };

export function selectQueryState<T, E>(
	query: QueryStateInput<T, E>,
	isEmpty: (data: T) => boolean = () => false,
): QueryContentState<T, E> {
	if (query.data !== null && query.data !== undefined) {
		return isEmpty(query.data)
			? { kind: "empty" }
			: { kind: "content", data: query.data };
	}
	if (query.isPending) return { kind: "loading" };
	if (query.isError) return { kind: "error", error: query.error };
	return { kind: "empty" };
}
