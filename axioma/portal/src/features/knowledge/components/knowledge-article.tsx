import { RiArrowLeftLine } from "@remixicon/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
	const [helpful, setHelpful] = useState("");

	return (
		<article
			className="flex flex-col gap-6"
			aria-labelledby="knowledge-article-title"
		>
			{onBack ? (
				<Button
					type="button"
					variant="ghost"
					onClick={onBack}
					className="self-start"
				>
					<RiArrowLeftLine data-icon="inline-start" aria-hidden="true" />
					Back to help articles
				</Button>
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
				<FieldSet className="border-t pt-5">
					<FieldLegend variant="label">Was this article helpful?</FieldLegend>
					<RadioGroup
						value={helpful}
						onValueChange={(value) => {
							setHelpful(value);
							onHelpful(value === "yes");
						}}
					>
						<FieldGroup className="flex-row">
							{[
								["yes", "Yes"],
								["no", "No"],
							].map(([value, label]) => (
								<Field key={value} orientation="horizontal">
									<RadioGroupItem id={`helpful-${value}`} value={value} />
									<FieldLabel htmlFor={`helpful-${value}`}>{label}</FieldLabel>
								</Field>
							))}
						</FieldGroup>
					</RadioGroup>
				</FieldSet>
			) : null}
		</article>
	);
}
