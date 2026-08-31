import { formatDate } from "@/components/support-ui";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { runStatusTone } from "@/lib/status-tone";
import { type AgentRun, environmentSourceLabel } from "../api/types";

export function RunSelector({
	runs,
	selectedId,
	onSelect,
}: {
	runs: AgentRun[];
	selectedId: string;
	onSelect: (id: string) => void;
}) {
	return (
		<fieldset>
			<legend className="sr-only">Run attempts</legend>
			<ItemGroup className="grid gap-2 sm:grid-cols-2">
				{runs.map((run, index) => {
					const selected = run.id === selectedId;
					return (
						<Item
							key={run.id}
							render={<button type="button" />}
							variant={selected ? "muted" : "outline"}
							aria-pressed={selected}
							onClick={() => onSelect(run.id)}
						>
							<ItemContent className="text-xs">
								<span className="flex items-center justify-between gap-2">
									<strong className="tabular-nums">
										Attempt {runs.length - index}
									</strong>
									<Badge variant="outline" tone={runStatusTone(run.status)}>
										{run.status}
									</Badge>
								</span>
								<span className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
									<span>{run.model ?? "Unknown model"}</span>
									<span className="text-right tabular-nums">
										{formatDuration(run)}
									</span>
									<span className="tabular-nums">
										{formatTokens(run)} tokens
									</span>
									<time className="text-right tabular-nums">
										{formatDate(run.startedAt)}
									</time>
								</span>
								{environmentProvenance(run)}
							</ItemContent>
						</Item>
					);
				})}
			</ItemGroup>
		</fieldset>
	);
}

function formatDuration(run: AgentRun) {
	const milliseconds =
		(run.endedAt ?? new Date()).getTime() - run.startedAt.getTime();
	if (milliseconds < 0) return "—";
	const seconds = Math.floor(milliseconds / 1000);
	const minutes = Math.floor(seconds / 60);
	return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function formatTokens(run: AgentRun) {
	if (run.promptTokens == null && run.completionTokens == null) return "—";
	return (
		(run.promptTokens ?? 0) + (run.completionTokens ?? 0)
	).toLocaleString();
}

function environmentProvenance(run: AgentRun) {
	if (!run.environmentKey && !run.environmentSource) return null;
	const label = environmentSourceLabel(run.environmentSource);
	return (
		<span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground">
			<span className="font-mono">
				{run.environmentKey ?? "No environment"}
			</span>
			{label && <span>{label}</span>}
		</span>
	);
}
