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
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
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
			<Empty>
				<EmptyHeader>
					<EmptyTitle>No knowledge articles found</EmptyTitle>
				</EmptyHeader>
			</Empty>
		);
	return (
		<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
			{articles.map((article) => (
				<Card
					key={article.id}
					role={onSelect ? "button" : undefined}
					tabIndex={onSelect ? 0 : undefined}
					className={
						onSelect
							? "cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							: undefined
					}
					onClick={() => onSelect?.(article)}
					onKeyDown={(event) => {
						if (onSelect && (event.key === "Enter" || event.key === " ")) {
							event.preventDefault();
							onSelect(article);
						}
					}}
					aria-label={onSelect ? `View ${article.title} article` : undefined}
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
			className="mx-auto w-full max-w-4xl"
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
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="knowledge-title">Title</FieldLabel>
					<Input
						id="knowledge-title"
						name="title"
						defaultValue={initial?.title}
						minLength={3}
						required
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="knowledge-summary">Summary</FieldLabel>
					<Textarea
						id="knowledge-summary"
						name="summary"
						defaultValue={initial?.summary ?? ""}
						rows={3}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="knowledge-body">Article</FieldLabel>
					<Textarea
						id="knowledge-body"
						name="body"
						defaultValue={initial?.body}
						rows={18}
						required
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="knowledge-audience">Audience</FieldLabel>
					<NativeSelect
						id="knowledge-audience"
						name="audience"
						defaultValue={initial?.audience ?? "employees"}
					>
						<NativeSelectOption value="public">Public</NativeSelectOption>
						<NativeSelectOption value="employees">Employees</NativeSelectOption>
						<NativeSelectOption value="staff">Staff</NativeSelectOption>
					</NativeSelect>
				</Field>
				<Field orientation="horizontal">
					<Checkbox
						id="knowledge-restricted"
						name="isRestricted"
						defaultChecked={initial?.isRestricted}
					/>
					<FieldLabel htmlFor="knowledge-restricted">Restricted</FieldLabel>
				</Field>
				<Button className="self-end" type="submit" disabled={pending}>
					{pending ? "Saving…" : "Save article"}
				</Button>
			</FieldGroup>
		</form>
	);
}
