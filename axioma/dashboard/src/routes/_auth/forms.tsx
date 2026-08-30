import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/forms")({
	component: FormsRoute,
	beforeLoad: () => ({ breadcrumb: "Forms" }),
});
function FormsRoute() {
	const client = useQueryClient();
	const query = useQuery(orpc.listForms.queryOptions());
	const catalogue = useQuery(orpc.listCatalogue.queryOptions());
	const create = useMutation(
		orpc.createForm.mutationOptions({
			onSuccess: () =>
				client.invalidateQueries({ queryKey: orpc.listForms.key() }),
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
		>
			<form
				className="mb-6 flex gap-2"
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
				<Input name="key" placeholder="form key" required />
				<Input name="name" placeholder="Form name" required />
				<Button disabled={create.isPending}>Create draft</Button>
			</form>
			<div className="space-y-2">
				{(query.data ?? []).length === 0 ? (
					<p
						className="py-12 text-center text-muted-foreground text-sm"
						role="status"
					>
						No forms found.
					</p>
				) : (
					(query.data ?? []).map((form) => (
						<div
							className="flex items-center justify-between gap-3 border p-3"
							key={form.id}
						>
							<span>
								{form.name} · {form.status}
							</span>
							{form.status === "draft" ? (
								<Button
									size="sm"
									onClick={() => publish.mutate({ id: form.id })}
								>
									Publish
								</Button>
							) : (
								<select
									aria-label={`Subcategory for ${form.name}`}
									className="h-9 border bg-background px-2"
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
									<option value="">Not attached</option>
									{catalogue.data?.subcategories.map((subcategory) => (
										<option key={subcategory.id} value={subcategory.id}>
											{subcategory.name}
										</option>
									))}
								</select>
							)}
						</div>
					))
				)}
			</div>
		</PageContainer>
	);
}
