import { OVERVIEW_WIDGET_KEYS } from "@/sdk/contracts/automation";

export type OverviewWidgetKey = (typeof OVERVIEW_WIDGET_KEYS)[number];

const WIDGET_PRESENTATION: Record<
	OverviewWidgetKey,
	{ title: string; width: 1 | 2 }
> = {
	priority: { title: "Open by priority", width: 2 },
	confirmation: { title: "Awaiting confirmation", width: 1 },
	escalations: { title: "Escalated in 24 hours", width: 1 },
	"median-ttr": { title: "Median time to resolution", width: 1 },
	csat: { title: "Reporter satisfaction", width: 1 },
	"resolution-rate": { title: "Autonomous resolution rate", width: 2 },
};

export const OVERVIEW_WIDGETS = OVERVIEW_WIDGET_KEYS.map((key) => ({
	key,
	...WIDGET_PRESENTATION[key],
}));

const RENDERABLE = new Set<string>(OVERVIEW_WIDGET_KEYS);

export function isRenderableWidget(key: string): boolean {
	return RENDERABLE.has(key);
}

export function overviewWidgetTitle(key: string): string {
	return isRenderableWidget(key)
		? WIDGET_PRESENTATION[key as OverviewWidgetKey].title
		: key;
}
