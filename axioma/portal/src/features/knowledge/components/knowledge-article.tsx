export type KnowledgeArticleData = {
	title: string;
	body: string;
	summary?: string | null;
	topic?: string | null;
	updatedAt?: Date | string | null;
};

export function KnowledgeArticle({
	article,
	onBack,
	onHelpful,
}: {
	article: KnowledgeArticleData;
	onBack?: () => void;
	onHelpful?: (helpful: boolean) => void;
}) {
	return (
		<article className="space-y-6" aria-labelledby="knowledge-article-title">
			{onBack ? (
				<button
					type="button"
					onClick={onBack}
					className="font-medium text-primary text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					Back to help articles
				</button>
			) : null}
			<header className="border-b pb-5">
				{article.topic ? (
					<p className="font-medium text-muted-foreground text-sm">
						{article.topic}
					</p>
				) : null}
				<h1
					id="knowledge-article-title"
					className="mt-1 font-semibold text-3xl tracking-tight"
				>
					{article.title}
				</h1>
				{article.summary ? (
					<p className="mt-3 text-muted-foreground leading-relaxed">
						{article.summary}
					</p>
				) : null}
				{article.updatedAt ? (
					<p className="mt-3 text-muted-foreground text-xs">
						Updated{" "}
						{new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
							new Date(article.updatedAt),
						)}
					</p>
				) : null}
			</header>
			<div className="whitespace-pre-wrap text-sm leading-7">
				{article.body}
			</div>
			{onHelpful ? (
				<fieldset className="flex flex-wrap items-center gap-3 border-t pt-5">
					<legend className="mb-3 font-medium text-sm">
						Was this article helpful?
					</legend>
					<button
						type="button"
						onClick={() => onHelpful(true)}
						className="rounded-md border px-4 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						Yes
					</button>
					<button
						type="button"
						onClick={() => onHelpful(false)}
						className="rounded-md border px-4 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						No
					</button>
				</fieldset>
			) : null}
		</article>
	);
}
