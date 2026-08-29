import type { FormEvent, ReactNode } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type KnowledgeArticle = {
	id: string;
	title: string;
	body: string;
	summary: string | null;
	status: "draft" | "published" | "archived";
	audience: "public" | "employees" | "staff";
	isRestricted: boolean;
	currentVersion: number;
	updatedAt: Date | string;
};

export type KnowledgeArticleInput = Pick<
	KnowledgeArticle,
	"title" | "body" | "audience" | "isRestricted"
> & { summary: string };

export function KnowledgePage({
	articles,
	action,
	onSelect,
}: {
	articles: readonly KnowledgeArticle[];
	action?: ReactNode;
	onSelect?: (article: KnowledgeArticle) => void;
}) {
	return (
		<PageContainer
			title="Knowledge"
			description="Draft, publish, and maintain support guidance."
			action={action}
		>
			<KnowledgeList articles={articles} onSelect={onSelect} />
		</PageContainer>
	);
}

export function KnowledgeList({
	articles,
	onSelect,
}: {
	articles: readonly KnowledgeArticle[];
	onSelect?: (article: KnowledgeArticle) => void;
}) {
	if (articles.length === 0)
		return (
			<p className="py-12 text-center text-muted-foreground text-sm">
				No knowledge articles found.
			</p>
		);
	return (
		<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
			{articles.map((article) => (
				<Card
					key={article.id}
					className={onSelect ? "cursor-pointer hover:bg-muted/30" : undefined}
					onClick={() => onSelect?.(article)}
				>
					<CardHeader>
						<CardTitle>{article.title}</CardTitle>
						<CardDescription>{article.summary ?? "No summary"}</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap gap-2">
						<Badge
							variant={article.status === "published" ? "default" : "secondary"}
						>
							{article.status}
						</Badge>
						<Badge variant="outline">{article.audience}</Badge>
						{article.isRestricted ? (
							<Badge variant="destructive">Restricted</Badge>
						) : null}
						<span className="ml-auto text-muted-foreground">
							v{article.currentVersion}
						</span>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export function KnowledgeArticleView({
	article,
}: {
	article: KnowledgeArticle;
}) {
	return (
		<article className="mx-auto w-full max-w-4xl">
			<Card>
				<CardHeader>
					<CardTitle className="text-xl">{article.title}</CardTitle>
					<CardDescription>{article.summary}</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="mb-5 flex gap-2">
						<Badge>{article.status}</Badge>
						<Badge variant="outline">{article.audience}</Badge>
						<span className="text-muted-foreground">
							Version {article.currentVersion} · Updated{" "}
							{new Date(article.updatedAt).toLocaleString()}
						</span>
					</div>
					<div className="whitespace-pre-wrap text-sm leading-7">
						{article.body}
					</div>
				</CardContent>
			</Card>
		</article>
	);
}

export function KnowledgeArticleEditor({
	initial,
	pending = false,
	onSubmit,
}: {
	initial?: KnowledgeArticle;
	pending?: boolean;
	onSubmit: (value: KnowledgeArticleInput) => void;
}) {
	return (
		<form
			className="mx-auto w-full max-w-4xl space-y-4"
			onSubmit={(event: FormEvent<HTMLFormElement>) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				onSubmit({
					title: String(data.get("title")),
					summary: String(data.get("summary")),
					body: String(data.get("body")),
					audience: String(
						data.get("audience"),
					) as KnowledgeArticleInput["audience"],
					isRestricted: data.get("isRestricted") === "on",
				});
			}}
		>
			<div className="space-y-1.5">
				<Label htmlFor="knowledge-title">Title</Label>
				<Input
					id="knowledge-title"
					name="title"
					defaultValue={initial?.title}
					minLength={3}
					required
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="knowledge-summary">Summary</Label>
				<Textarea
					id="knowledge-summary"
					name="summary"
					defaultValue={initial?.summary ?? ""}
					rows={3}
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="knowledge-body">Article</Label>
				<Textarea
					id="knowledge-body"
					name="body"
					defaultValue={initial?.body}
					rows={18}
					required
				/>
			</div>
			<div className="flex flex-wrap items-center gap-4">
				<label className="flex items-center gap-2 text-sm">
					Audience{" "}
					<select
						name="audience"
						defaultValue={initial?.audience ?? "employees"}
						className="h-8 border bg-background px-2"
					>
						<option value="public">Public</option>
						<option value="employees">Employees</option>
						<option value="staff">Staff</option>
					</select>
				</label>
				<label className="flex items-center gap-2 text-sm">
					<input
						name="isRestricted"
						type="checkbox"
						defaultChecked={initial?.isRestricted}
					/>
					Restricted
				</label>
				<Button className="ml-auto" type="submit" disabled={pending}>
					{pending ? "Saving…" : "Save article"}
				</Button>
			</div>
		</form>
	);
}
