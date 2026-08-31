import type { ReactNode } from "react";

export function PageContainer({
	children,
	title,
	description,
	action,
}: {
	children: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		// The main landmark lives in DashboardLayout, not here. Twelve routes
		// return a bare PageState for their loading, error and empty states
		// without ever reaching PageContainer; when the landmark lived here those
		// states had no <main> at all and the skip link pointed at nothing.
		<div className="flex min-w-0 flex-1 flex-col p-4 md:p-6">
			<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="font-heading font-semibold text-2xl tracking-tight">
						{title}
					</h1>
					{description ? (
						<p className="mt-1 text-muted-foreground text-sm">{description}</p>
					) : null}
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
			{children}
		</div>
	);
}
