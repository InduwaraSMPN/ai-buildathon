import { RiArrowLeftLine as ArrowLeft } from "@remixicon/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AxiomaMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { acceptableUse } from "@/features/legal/acceptable-use";

// Deliberately public and outside `_auth`: the sign-in and sign-up cards link
// here, so a reader has to be able to reach the terms before accepting them.
export const Route = createFileRoute("/acceptable-use")({
	component: AcceptableUsePage,
	head: () => ({
		meta: [
			{ title: `${acceptableUse.title} · Axiōma` },
			{
				name: "description",
				content: `Terms of use for the ${acceptableUse.subtitle}.`,
			},
		],
	}),
});

function AcceptableUsePage() {
	return (
		<main className="min-h-svh bg-muted px-6 py-10 md:py-16">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
				<Button
					variant="ghost"
					size="sm"
					className="w-fit text-muted-foreground"
					render={<Link to="/login" />}
				>
					<ArrowLeft data-icon="inline-start" />
					Back to sign in
				</Button>

				<Card className="p-0">
					<CardContent className="flex flex-col gap-8 p-6 md:p-10">
						<header className="flex flex-col gap-4">
							<AxiomaMark className="size-7 text-primary" />
							<div className="flex flex-col gap-1">
								<h1 className="font-heading font-semibold text-2xl tracking-tight">
									{acceptableUse.title}
								</h1>
								<p className="text-muted-foreground text-sm">
									{acceptableUse.subtitle}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline">Version {acceptableUse.version}</Badge>
								<Badge variant="outline">
									Effective {acceptableUse.effective}
								</Badge>
								<Badge tone="success">{acceptableUse.status}</Badge>
							</div>
						</header>

						<Separator />

						<p className="text-balance text-foreground text-sm leading-relaxed">
							{acceptableUse.intro}
						</p>

						<div className="flex flex-col gap-8">
							{acceptableUse.sections.map((section, index) => (
								<section key={section.heading} className="flex flex-col gap-3">
									<h2 className="flex items-baseline gap-3 font-heading font-semibold text-base tracking-tight">
										<span
											aria-hidden="true"
											className="font-mono text-muted-foreground text-xs tabular-nums"
										>
											{String(index + 1).padStart(2, "0")}
										</span>
										{section.heading}
									</h2>
									{section.paragraphs?.map((paragraph) => (
										<p
											key={paragraph}
											className="text-muted-foreground text-sm leading-relaxed"
										>
											{paragraph}
										</p>
									))}
									{section.list ? (
										<ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground text-sm leading-relaxed marker:text-border">
											{section.list.map((item) => (
												<li key={item}>{item}</li>
											))}
										</ul>
									) : null}
								</section>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
