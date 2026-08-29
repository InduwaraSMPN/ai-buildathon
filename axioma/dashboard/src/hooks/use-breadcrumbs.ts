import { useMatches } from "@tanstack/react-router";

export type BreadcrumbItem = { label: string; to?: string };

export function useBreadcrumbs(): BreadcrumbItem[] {
	return useMatches({
		select: (matches) =>
			matches.flatMap((match) => {
				const crumb = (
					match.context as {
						breadcrumb?: string | ((params: Record<string, string>) => string);
					}
				).breadcrumb;
				if (!crumb) return [];
				return [
					{
						label: typeof crumb === "function" ? crumb(match.params) : crumb,
						to: match.pathname,
					},
				];
			}),
	});
}
