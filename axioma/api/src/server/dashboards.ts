export type WidgetArrangement = Readonly<{
	widgetKey: string;
	width?: 1 | 2;
	settings?: unknown;
}>;

export type DashboardWidgetRow = Readonly<{
	id: string;
	userId: string;
	widgetKey: string;
	position: number;
	width: 1 | 2;
	settings: unknown;
}>;

/** Converts a user's ordered payload into rows suitable for one transactional replace. */
export function dashboardArrangementRows(
	userId: string,
	widgets: readonly WidgetArrangement[],
	idFor: (widgetKey: string) => string,
): DashboardWidgetRow[] {
	if (!userId) throw new TypeError("userId is required");
	const keys = new Set<string>();
	return widgets.map((widget, position) => {
		if (!widget.widgetKey) throw new TypeError("widgetKey is required");
		if (keys.has(widget.widgetKey))
			throw new RangeError(`Duplicate dashboard widget: ${widget.widgetKey}`);
		keys.add(widget.widgetKey);
		return {
			id: idFor(widget.widgetKey),
			userId,
			widgetKey: widget.widgetKey,
			position,
			width: widget.width ?? 1,
			settings: widget.settings ?? null,
		};
	});
}
