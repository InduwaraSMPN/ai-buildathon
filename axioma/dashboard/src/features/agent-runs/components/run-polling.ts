export function runRefetchInterval(query: {
	state: { data?: { status: string } | null };
}) {
	return query.state.data?.status === "running" ? 2_000 : false;
}
