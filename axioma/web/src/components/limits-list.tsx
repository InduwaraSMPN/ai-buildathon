export function LimitsList({
	limits,
}: {
	limits: { title: string; body: string }[];
}) {
	return (
		<dl className="rows">
			{limits.map((limit) => (
				<div key={limit.title}>
					<dt>{limit.title}</dt>
					<dd>{limit.body}</dd>
				</div>
			))}
		</dl>
	);
}
