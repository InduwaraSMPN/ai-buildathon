import type { ReactNode } from "react";

export function InfoSidebar({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<aside
			className="h-fit rounded-xl border bg-card p-4 shadow-xs"
			aria-label={title}
		>
			<h2 className="font-semibold text-sm">{title}</h2>
			<div className="mt-2 text-muted-foreground text-xs leading-relaxed">
				{children}
			</div>
		</aside>
	);
}
