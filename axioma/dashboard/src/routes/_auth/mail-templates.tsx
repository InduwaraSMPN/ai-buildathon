import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/mail-templates")({
	component: MailTemplates,
	beforeLoad: ({ context }) => {
		if (!context.capabilities.includes("admin.settings"))
			throw redirect({ to: "/home" });
		return { breadcrumb: "Mail templates" };
	},
	head: () => ({ meta: [{ title: "Mail templates · Axiōma" }] }),
});

function MailTemplates() {
	const queryClient = useQueryClient();
	const templates = useQuery(orpc.listEmailTemplates.queryOptions());
	const rules = useQuery(orpc.listEmailTemplateRules.queryOptions());
	const [name, setName] = useState("");
	const [subject, setSubject] = useState("");
	const [textBody, setTextBody] = useState("");
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: orpc.listEmailTemplates.key(),
			}),
			queryClient.invalidateQueries({
				queryKey: orpc.listEmailTemplateRules.key(),
			}),
		]);
	const create = useMutation(
		orpc.createEmailTemplate.mutationOptions({
			onSuccess: () => {
				setName("");
				setSubject("");
				setTextBody("");
				void refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remove = useMutation(
		orpc.deleteEmailTemplate.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	const select = useMutation(
		orpc.setEmailTemplateRule.mutationOptions({
			onSuccess: refresh,
			onError: (error) => toast.error(error.message),
		}),
	);
	if (templates.isPending || rules.isPending)
		return (
			<PageState
				kind="loading"
				title="Loading templates"
				description="Retrieving mail templates…"
			/>
		);
	if (templates.isError || rules.isError)
		return (
			<PageState
				kind="error"
				title="Templates unavailable"
				description={
					(templates.error ?? rules.error)?.message ?? "Unknown error"
				}
				onRetry={() => {
					void templates.refetch();
					void rules.refetch();
				}}
			/>
		);
	const catchAll = rules.data.find(
		(rule) => rule.scope === "catch_all" && rule.enabled,
	);
	return (
		<PageContainer
			title="Mail templates"
			description="Manage message content and choose the default template."
		>
			<Card className="mb-4">
				<CardHeader>
					<CardTitle>New template</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3">
					<Input
						aria-label="Template name"
						placeholder="Template name"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
					<Input
						aria-label="Subject"
						placeholder="Subject"
						value={subject}
						onChange={(event) => setSubject(event.target.value)}
					/>
					<textarea
						aria-label="Text body"
						className="min-h-32 border bg-background p-3 text-sm"
						placeholder="Text body"
						value={textBody}
						onChange={(event) => setTextBody(event.target.value)}
					/>
					<Button
						disabled={
							!name.trim() ||
							!subject.trim() ||
							!textBody.trim() ||
							create.isPending
						}
						onClick={() =>
							create.mutate({
								name,
								subject,
								textBody,
								htmlBody: null,
								enabled: true,
							})
						}
					>
						Create template
					</Button>
				</CardContent>
			</Card>
			<div className="grid gap-3">
				{templates.data.map((template) => (
					<Card key={template.id}>
						<CardContent className="flex items-start justify-between gap-4 p-4">
							<div>
								<p className="font-medium">{template.name}</p>
								<p className="text-muted-foreground text-sm">
									{template.subject}
								</p>
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									disabled={catchAll?.templateId === template.id}
									onClick={() =>
										select.mutate({
											id: catchAll?.id,
											templateId: template.id,
											scope: "catch_all",
											matchValue: null,
											enabled: true,
										})
									}
								>
									{catchAll?.templateId === template.id
										? "Default"
										: "Make default"}
								</Button>
								<Button
									variant="destructive"
									onClick={() => remove.mutate({ id: template.id })}
								>
									Delete
								</Button>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</PageContainer>
	);
}
