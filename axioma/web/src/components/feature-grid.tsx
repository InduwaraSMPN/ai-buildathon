import type { PlatformGroup } from "../content/platform";

/**
 * `grid` is the three-up hairline grid for a short selection. `index` flows
 * the whole list down balanced columns, which suits a count no grid divides.
 */
export function FeatureGrid({
	groups,
	limit,
	variant = "grid",
}: {
	groups: PlatformGroup[];
	limit?: number;
	variant?: "grid" | "index";
}) {
	const visible = typeof limit === "number" ? groups.slice(0, limit) : groups;
	return (
		<div className={variant === "index" ? "feature-index" : "divider-grid"}>
			{visible.map((group) => (
				<article key={group.id}>
					<h3>{group.title}</h3>
					<p>{group.body}</p>
					<ul>
						{group.points.map((point) => (
							<li key={point}>{point}</li>
						))}
					</ul>
				</article>
			))}
		</div>
	);
}
