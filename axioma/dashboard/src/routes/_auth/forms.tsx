import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/page-container";
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
				{(query.data ?? []).map((form) => (
					<div
						className="flex items-center justify-between border p-3"
						key={form.id}
					>
						<span>
							{form.name} · {form.status}
						</span>
						{form.status === "draft" ? (
							<Button size="sm" onClick={() => publish.mutate({ id: form.id })}>
								Publish
							</Button>
						) : null}
					</div>
				))}
			</div>
		</PageContainer>
	);
}
