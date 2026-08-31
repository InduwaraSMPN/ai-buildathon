import type { LinkProps } from "@tanstack/react-router";
import { useMatches } from "@tanstack/react-router";

export type BreadcrumbItem = { label: string; to?: LinkProps["to"] };

/** A route may declare one crumb: a string (its own page) or an array trail. */
export type BreadcrumbContext = string | readonly BreadcrumbItem[];

export function useBreadcrumbs(): BreadcrumbItem[] {
	return useMatches({
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		select: (matches: any) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(
				matches as Array<{
					context: { breadcrumb?: BreadcrumbContext };
					pathname: string;
				}>
			).flatMap((match) => {
				const crumb = match.context.breadcrumb;
				if (!crumb) return [];
				if (typeof crumb === "string") {
					return [{ label: crumb, to: match.pathname as LinkProps["to"] }];
				}
				return [...crumb] as BreadcrumbItem[];
			}),
	});
}
