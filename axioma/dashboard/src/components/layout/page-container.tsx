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
		<main
			id="main-content"
			className="flex min-w-0 flex-1 flex-col p-4 md:p-6"
			tabIndex={-1}
		>
			<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">{title}</h1>
					{description ? (
						<p className="mt-1 text-muted-foreground text-sm">{description}</p>
					) : null}
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
			{children}
		</main>
	);
}
