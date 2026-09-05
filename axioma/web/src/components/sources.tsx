import type { Source, SourceGrade } from "../content/research";

export function SourceRef({ id, index }: { id: string; index: number }) {
	return (
		<sup>
			<a href={`#src-${id}`} aria-label={`Source ${index}`}>
				{index}
			</a>
		</sup>
	);
}

function gradeLabel(grade: SourceGrade, year: number | string): string {
	if (grade === "independent-benchmark") {
		return `Industry benchmark (${year})`;
	}
	const labels: Record<
		Exclude<SourceGrade, "independent-benchmark">,
		string
	> = {
		"peer-reviewed": "Peer-reviewed study",
		"vendor-benchmark": "Industry benchmark",
		"vendor-survey": "Industry survey",
		"vendor-telemetry": "Industry survey",
		"independent-survey": "Independent survey",
		"analyst-estimate": "Analyst estimate",
		"analyst-forecast": "Analyst forecast",
		government: "Government statistic",
		market: "Market research",
		"industry-reference": "Industry reference",
		measured: "Measured on the demo stack",
	};
	return labels[grade];
}

export function SourcesList({
	ids,
	sources,
}: {
	ids: string[];
	sources: Source[];
}) {
	const ordered = ids
		.map((id) => sources.find((source) => source.id === id))
		.filter((source): source is Source => source !== undefined);
	return (
		<ol className="sources">
			{ordered.map((source) => (
				<li key={source.id} id={`src-${source.id}`}>
					<cite>{source.title}</cite>
					<span>
						{source.publisher}, {source.year}
					</span>
					<span>{gradeLabel(source.grade, source.year)}</span>
					<a href={source.url}>{source.url}</a>
				</li>
			))}
		</ol>
	);
}
