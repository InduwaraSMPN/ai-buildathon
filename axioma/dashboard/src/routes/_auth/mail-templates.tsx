import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireNav } from "@/lib/navigation";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/mail-templates")({
	component: MailTemplates,
	beforeLoad: ({ context }) => {
		requireNav("/mail-templates", context);
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
	const [formOpen, setFormOpen] = useState(false);
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
				setFormOpen(false);
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
			action={
				<Dialog open={formOpen} onOpenChange={setFormOpen}>
					<DialogTrigger render={<Button size="sm">New template</Button>} />
					<DialogContent className="sm:max-w-2xl">
						<DialogHeader>
							<DialogTitle>New template</DialogTitle>
							<DialogDescription>
								Message content Axiōma sends for matching mail rules.
							</DialogDescription>
						</DialogHeader>
						<FieldGroup className="py-4">
							<Field>
								<FieldLabel htmlFor="template-name">Template name</FieldLabel>
								<Input
									id="template-name"
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="template-subject">Subject</FieldLabel>
								<Input
									id="template-subject"
									value={subject}
									onChange={(event) => setSubject(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="template-body">Text body</FieldLabel>
								<Textarea
									id="template-body"
									className="min-h-32"
									value={textBody}
									onChange={(event) => setTextBody(event.target.value)}
								/>
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button variant="outline" onClick={() => setFormOpen(false)}>
								Cancel
							</Button>
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
						</DialogFooter>
					</DialogContent>
				</Dialog>
			}
		>
			<div className="grid gap-3 md:grid-cols-2">
				{templates.data.map((template) => (
					<Card key={template.id}>
						<CardHeader>
							<CardTitle>{template.name}</CardTitle>
							<CardDescription>{template.subject}</CardDescription>
							<CardAction className="flex gap-2">
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
							</CardAction>
						</CardHeader>
					</Card>
				))}
			</div>
		</PageContainer>
	);
}
