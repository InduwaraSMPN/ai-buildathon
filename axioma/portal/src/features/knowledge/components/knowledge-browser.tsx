import { useId } from "react";

export type KnowledgeArticleSummary = {
	id: string;
	title: string;
	summary?: string | null;
	folder?: string | null;
	updatedAt?: Date | string | null;
	status?: string | null;
};

export type KnowledgeFolder = {
	id: string;
	name: string;
};

const statusText: Record<string, string> = {
	draft: "Being prepared",
	published: "Available",
	archived: "No longer available",
};

function plainStatus(status?: string | null) {
	return status ? (statusText[status] ?? "Availability unknown") : null;
}

export function KnowledgeBrowser({
	articles,
	folders = [],
	query,
	folderId = "",
	onQueryChange,
	onFolderChange,
	onArticleSelect,
	emptyMessage = "No helpful articles found.",
}: {
	articles: KnowledgeArticleSummary[];
	folders?: KnowledgeFolder[];
	query: string;
	folderId?: string;
	onQueryChange: (query: string) => void;
	onFolderChange?: (folderId: string) => void;
	onArticleSelect: (article: KnowledgeArticleSummary) => void;
	emptyMessage?: string;
}) {
	const searchId = useId();
	const folderSelectId = useId();

	return (
		<section aria-labelledby={`${searchId}-heading`} className="space-y-5">
			<div>
				<h2
					id={`${searchId}-heading`}
					className="font-semibold text-2xl tracking-tight"
				>
					Help articles
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Find clear steps for common questions and problems.
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
				<div className="space-y-2">
					<label htmlFor={searchId} className="font-medium text-sm">
						Search help articles
					</label>
					<input
						id={searchId}
						type="search"
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
						placeholder="Example: connect to Wi-Fi"
						className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
					/>
				</div>
				{onFolderChange ? (
					<div className="space-y-2">
						<label htmlFor={folderSelectId} className="font-medium text-sm">
							Topic
						</label>
						<select
							id={folderSelectId}
							value={folderId}
							onChange={(event) => onFolderChange(event.target.value)}
							className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
						>
							<option value="">All topics</option>
							{folders.map((folder) => (
								<option key={folder.id} value={folder.id}>
									{folder.name}
								</option>
							))}
						</select>
					</div>
				) : null}
			</div>

			{articles.length ? (
				<ul className="grid gap-3" aria-live="polite">
					{articles.map((article) => {
						const status = plainStatus(article.status);
						return (
							<li key={article.id}>
								<button
									type="button"
									onClick={() => onArticleSelect(article)}
									className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<span className="font-semibold">{article.title}</span>
									{article.summary ? (
										<span className="mt-1 block text-muted-foreground text-sm leading-relaxed">
											{article.summary}
										</span>
									) : null}
									<span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
										{article.folder ? <span>{article.folder}</span> : null}
										{status ? <span>{status}</span> : null}
										{article.updatedAt ? (
											<span>
												Updated{" "}
												{new Intl.DateTimeFormat(undefined, {
													dateStyle: "medium",
												}).format(new Date(article.updatedAt))}
											</span>
										) : null}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			) : (
				<p
					className="rounded-lg border border-dashed p-8 text-center text-muted-foreground"
					role="status"
				>
					{emptyMessage}
				</p>
			)}
		</section>
	);
}
