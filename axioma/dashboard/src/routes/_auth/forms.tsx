import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemGroup,
	ItemTitle,
} from "@/components/ui/item";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { requireNav } from "@/lib/navigation";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/forms")({
	component: FormsRoute,
	beforeLoad: ({ context }) => {
		requireNav("/forms", context);
		return { breadcrumb: "Forms" };
	},
	head: () => ({ meta: [{ title: "Request forms · Axiōma" }] }),
});
function FormsRoute() {
	const client = useQueryClient();
	const query = useQuery(orpc.listForms.queryOptions());
	const catalogue = useQuery(orpc.listCatalogue.queryOptions());
	const [formOpen, setFormOpen] = useState(false);
	const create = useMutation(
		orpc.createForm.mutationOptions({
			onSuccess: () => {
				setFormOpen(false);
				return client.invalidateQueries({ queryKey: orpc.listForms.key() });
			},
		}),
	);
	const publish = useMutation(
		orpc.publishForm.mutationOptions({
			onSuccess: () =>
				client.invalidateQueries({ queryKey: orpc.listForms.key() }),
		}),
	);
	const attach = useMutation(
		orpc.setSubcategoryForm.mutationOptions({
			onSuccess: () =>
				client.invalidateQueries({ queryKey: orpc.listCatalogue.key() }),
		}),
	);
	if (
		(query.isPending && query.data == null) ||
		(catalogue.isPending && catalogue.data == null)
	) {
		return (
			<PageState
				kind="loading"
				title="Loading forms"
				description="Retrieving request forms and catalogue…"
			/>
		);
	}
	const error =
		(query.data == null && query.isError ? query.error : null) ??
		(catalogue.data == null && catalogue.isError ? catalogue.error : null);
	if (error) {
		return (
			<PageState
				kind="error"
				title="Forms unavailable"
				description={error.message}
				onRetry={() => {
					void query.refetch();
					void catalogue.refetch();
				}}
			/>
		);
	}
	return (
		<PageContainer
			title="Request forms"
			description="Author and publish typed service-request forms."
			action={
				<Dialog open={formOpen} onOpenChange={setFormOpen}>
					<DialogTrigger render={<Button size="sm">New form</Button>} />
					<DialogContent className="sm:max-w-lg">
						<form
							onSubmit={(event) => {
								event.preventDefault();
								const data = new FormData(event.currentTarget);
								create.mutate({
									key: String(data.get("key")),
									name: String(data.get("name")),
									fields: [
										{
											key: "details",
											label: "Details",
											type: "textarea",
											isMandatory: true,
										},
									],
								});
							}}
						>
							<DialogHeader>
								<DialogTitle>New request form</DialogTitle>
								<DialogDescription>
									Creates a draft with a single Details field. Publish it once the
									fields are right.
								</DialogDescription>
							</DialogHeader>
							<FieldGroup className="py-4">
								<Field>
									<FieldLabel htmlFor="form-key">Form key</FieldLabel>
									<Input id="form-key" name="key" required />
								</Field>
								<Field>
									<FieldLabel htmlFor="form-name">Form name</FieldLabel>
									<Input id="form-name" name="name" required />
								</Field>
							</FieldGroup>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => setFormOpen(false)}
								>
									Cancel
								</Button>
								<Button disabled={create.isPending}>Create draft</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			}
		>
			{(query.data ?? []).length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>No forms found</EmptyTitle>
					</EmptyHeader>
				</Empty>
			) : (
				<ItemGroup className="gap-3 md:grid md:grid-cols-2">
					{(query.data ?? []).map((form) => (
						<Item key={form.id} variant="outline">
							<ItemContent>
								<ItemTitle>
									{form.name} · {form.status}
								</ItemTitle>
							</ItemContent>
							<ItemActions>
								{form.status === "draft" ? (
									<Button
										size="sm"
										onClick={() => publish.mutate({ id: form.id })}
									>
										Publish
									</Button>
								) : (
									<Field>
										<FieldLabel
											className="sr-only"
											htmlFor={`subcategory-${form.id}`}
										>
											Subcategory for {form.name}
										</FieldLabel>
										<NativeSelect
											id={`subcategory-${form.id}`}
											value={
												catalogue.data?.subcategories.find(
													(subcategory) => subcategory.formId === form.id,
												)?.id ?? ""
											}
											disabled={attach.isPending}
											onChange={(event) => {
												const currentId = catalogue.data?.subcategories.find(
													(subcategory) => subcategory.formId === form.id,
												)?.id;
												const subcategoryId = event.target.value || currentId;
												if (subcategoryId)
													attach.mutate({
														subcategoryId,
														formId: event.target.value ? form.id : null,
													});
											}}
										>
											<NativeSelectOption value="">
												Not attached
											</NativeSelectOption>
											{catalogue.data?.subcategories.map((subcategory) => (
												<NativeSelectOption
													key={subcategory.id}
													value={subcategory.id}
												>
													{subcategory.name}
												</NativeSelectOption>
											))}
										</NativeSelect>
									</Field>
								)}
							</ItemActions>
						</Item>
					))}
				</ItemGroup>
			)}
		</PageContainer>
	);
}
