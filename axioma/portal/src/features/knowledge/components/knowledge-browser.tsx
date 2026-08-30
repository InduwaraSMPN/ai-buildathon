import { useId } from "react";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemFooter,
	ItemGroup,
	ItemTitle,
} from "@/components/ui/item";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

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
		<section
			aria-labelledby={`${searchId}-heading`}
			className="flex flex-col gap-5"
		>
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

			<FieldGroup className="grid gap-4 sm:grid-cols-[1fr_14rem]">
				<Field>
					<FieldLabel htmlFor={searchId}>Search help articles</FieldLabel>
					<Input
						id={searchId}
						type="search"
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
						placeholder="Example: connect to Wi-Fi"
					/>
				</Field>
				{onFolderChange ? (
					<Field>
						<FieldLabel htmlFor={folderSelectId}>Topic</FieldLabel>
						<Select
							value={folderId}
							onValueChange={(value) => onFolderChange(value ?? "")}
						>
							<SelectTrigger id={folderSelectId} className="w-full">
								<SelectValue placeholder="All topics" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="">All topics</SelectItem>
									{folders.map((folder) => (
										<SelectItem key={folder.id} value={folder.id}>
											{folder.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
				) : null}
			</FieldGroup>

			{articles.length ? (
				<ItemGroup aria-live="polite">
					{articles.map((article) => {
						const status = plainStatus(article.status);
						return (
							<Item
								key={article.id}
								variant="outline"
								render={<button type="button" />}
								onClick={() => onArticleSelect(article)}
							>
								<ItemContent>
									<ItemTitle>{article.title}</ItemTitle>
									{article.summary ? (
										<ItemDescription>{article.summary}</ItemDescription>
									) : null}
								</ItemContent>
								<ItemFooter className="justify-start text-muted-foreground text-xs">
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
								</ItemFooter>
							</Item>
						);
					})}
				</ItemGroup>
			) : (
				<Empty className="border" role="status">
					<EmptyHeader>
						<EmptyTitle>No articles found</EmptyTitle>
						<EmptyDescription>{emptyMessage}</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</section>
	);
}
