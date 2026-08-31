import { RiArrowLeftLine } from "@remixicon/react";
import { useState } from "react";
import { PageHeading } from "@/components/ticket-ui";
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
			<PageHeading
				className="border-b pb-5"
				eyebrow={article.topic ?? undefined}
				title={article.title}
				titleId="knowledge-article-title"
				description={article.summary ?? undefined}
				meta={
					article.updatedAt
						? `Updated ${new Intl.DateTimeFormat(undefined, {
								dateStyle: "long",
							}).format(new Date(article.updatedAt))}`
						: undefined
				}
			/>
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
