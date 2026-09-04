import { RiFileTextLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { intakeCopy } from "@/features/intake/copy";

export function DeflectionCards({
	articles,
	onSolved,
	onContinue,
}: {
	articles: Array<{ id: string; title: string; summary: string | null }>;
	onSolved: () => void;
	onContinue: () => void;
}) {
	return (
		<div className="flex w-full flex-col gap-3">
			{articles.map((article) => (
				<Card key={article.id} className="w-full">
					<CardHeader className="flex-row items-start gap-3">
						<RiFileTextLine
							className="mt-0.5 size-5 shrink-0 text-muted-foreground"
							aria-hidden="true"
						/>
						<div className="min-w-0">
							<CardTitle className="text-sm leading-snug">
								{article.title}
							</CardTitle>
							{article.summary ? (
								<CardDescription className="mt-1">
									{article.summary}
								</CardDescription>
							) : null}
						</div>
					</CardHeader>
					<CardFooter className="gap-2">
						<Button size="sm" onClick={onSolved}>
							{intakeCopy.deflectionSolved}
						</Button>
						<Button variant="ghost" size="sm" onClick={onContinue}>
							{intakeCopy.deflectionContinue}
						</Button>
					</CardFooter>
				</Card>
			))}
		</div>
	);
}
