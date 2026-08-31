import {
	RiAddLine,
	RiArrowLeftLine,
	RiAttachment2,
	RiCheckboxBlankCircleLine,
	RiComputerLine,
	RiLinkM,
} from "@remixicon/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import {
	ErrorState,
	formatDate,
	getStatus,
	PageHeading,
	PageShell,
	StatusBadge,
} from "@/components/ticket-ui";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Item,
	ItemContent,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { uploadDocuments } from "@/features/documents/api";
import { updateMyTicketMutationOptions } from "@/features/tickets/api/mutations";
import { myTicketQueryOptions } from "@/features/tickets/api/queries";
import {
	ConversationCard,
	CsatCard,
} from "@/features/tickets/components/conversation-card";
import {
	createTicketFormSchemas,
	submitThenReset,
} from "@/features/tickets/components/form-validation";
import { ProgressTimeline } from "@/features/tickets/components/progress-timeline";
import { ResolutionCard } from "@/features/tickets/components/resolution-card";
import {
	approvalStatusCopy,
	attachmentCopy,
	ticketDetailCopy,
} from "@/features/tickets/copy";
import { apiUrl } from "@/lib/api-url";
import { orpc } from "@/utils/orpc";

type DetailValues = { note: string };
const { addDetail: addDetailSchema } = createTicketFormSchemas(z);

export const Route = createFileRoute("/_auth/tickets/$ticketId")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: ticketDetailCopy.pageTitle }] }),
});

function RouteComponent() {
	const { ticketId } = Route.useParams();
	const queryClient = useQueryClient();
	const [detailHelpOpen, setDetailHelpOpen] = useState(false);
	const [linkDialogOpen, setLinkDialogOpen] = useState(false);
	const [linkUrl, setLinkUrl] = useState("");
	const [linkUrlTouched, setLinkUrlTouched] = useState(false);
	const [linkName, setLinkName] = useState("");
	const [uploadError, setUploadError] = useState(false);
	const ticket = useQuery(myTicketQueryOptions(ticketId));
	const approval = useQuery(
		orpc.getMyApprovalStatus.queryOptions({ input: { ticketId } }),
	);
	const documentInput = { targetType: "ticket" as const, targetId: ticketId };
	const documents = useQuery(
		orpc.listDocuments.queryOptions({ input: documentInput }),
	);
	const addLink = useMutation(
		orpc.createLinkDocument.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.listDocuments.key({ input: documentInput }),
				});
				setLinkDialogOpen(false);
				setLinkUrl("");
				setLinkUrlTouched(false);
				setLinkName("");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const updateTicket = useMutation({
		...updateMyTicketMutationOptions(),
		onSuccess: async (...args) => {
			await updateMyTicketMutationOptions().onSuccess?.(...args);
			toast.success(ticketDetailCopy.updated);
		},
		onError: () => toast.error(ticketDetailCopy.updateError),
	});
	const detailForm = useForm({
		defaultValues: {
			note: "",
		} as DetailValues,
		validators: {
			onSubmit: addDetailSchema,
		},
		onSubmit: ({ value }) =>
			submitThenReset(
				() =>
					updateTicket.mutateAsync({
						id: ticketId,
						action: "add_detail",
						note: value.note.trim(),
					}),
				() => detailForm.reset(),
				() => setDetailHelpOpen(false),
			),
	});

	if (ticket.isPending) {
		return (
			<PageShell>
				<Skeleton className="mb-8 h-8 w-36 rounded-md" />
				<div
					className="space-y-4"
					role="status"
					aria-label={ticketDetailCopy.loading}
				>
					<Skeleton className="h-32 w-full rounded-xl" />
					<Skeleton className="h-64 w-full rounded-xl" />
				</div>
			</PageShell>
		);
	}

	if (ticket.isError) {
		return (
			<PageShell>
				<ErrorState retry={() => ticket.refetch()} error={ticket.error} />
			</PageShell>
		);
	}

	if (!ticket.data) {
		return (
			<PageShell>
				<Card>
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{ticketDetailCopy.notFound}</EmptyTitle>
							<EmptyDescription>
								{ticketDetailCopy.notFoundDescription}
							</EmptyDescription>
						</EmptyHeader>
						<Link to="/home" className={buttonVariants()}>
							{ticketDetailCopy.back}
						</Link>
					</Empty>
				</Card>
			</PageShell>
		);
	}

	const data = ticket.data;
	const progress = getStatus(data.statusStateType, data.statusLabel);
	const approvalCopy = approval.data
		? approvalStatusCopy[approval.data.status]
		: undefined;
	const active = ["new", "open", "pending"].includes(data.statusStateType);

	return (
		<PageShell>
			<Link
				to="/home"
				className={buttonVariants({
					variant: "ghost",
					size: "sm",
					className: "mb-6 -ml-2",
				})}
			>
				<RiArrowLeftLine data-icon="inline-start" aria-hidden="true" />{" "}
				{ticketDetailCopy.back}
			</Link>

			<div className="mb-3 flex flex-wrap items-center gap-3">
				<StatusBadge
					stateType={data.statusStateType}
					label={data.statusLabel}
				/>
				<span className="text-muted-foreground text-xs">
					{ticketDetailCopy.opened} {formatDate(data.createdAt)}
				</span>
			</div>
			<PageHeading
				title={data.title}
				description={`${ticketDetailCopy.request} ${data.number ?? data.id}`}
				action={
					active ? (
						<Button
							variant="outline"
							className="w-full sm:w-auto"
							onClick={() => setDetailHelpOpen(true)}
						>
							<RiAddLine data-icon="inline-start" aria-hidden="true" />
							{ticketDetailCopy.addDetail}
						</Button>
					) : null
				}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<div className="min-w-0 space-y-6">
					<Card>
						<CardContent>
							<ProgressTimeline
								stateType={data.statusStateType}
								progressMarker={data.progressMarker}
							/>
						</CardContent>
					</Card>

					<Card id="shared-details">
						<CardHeader>
							<CardTitle>{ticketDetailCopy.shared}</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="whitespace-pre-wrap text-sm leading-7">
								{data.body}
							</p>
						</CardContent>
					</Card>

					<ConversationCard ticketId={data.id} messages={data.messages} />

					<ResolutionCard
						ticket={data}
						pending={updateTicket.isPending}
						onAction={(input) => updateTicket.mutate(input)}
					/>
					{data.statusStateType === "closed" && data.csat ? (
						<CsatCard csat={data.csat} />
					) : null}
				</div>

				<aside className="space-y-4" aria-label={ticketDetailCopy.information}>
					{approvalCopy ? (
						<Card>
							<CardHeader>
								<CardTitle>{ticketDetailCopy.approval}</CardTitle>
							</CardHeader>
							<CardContent>
								<Badge variant="outline">{approvalCopy.label}</Badge>
								<p className="mt-1 text-muted-foreground text-sm">
									{approvalCopy.detail}
								</p>
							</CardContent>
						</Card>
					) : null}
					<Card>
						<CardHeader>
							<CardTitle>{ticketDetailCopy.information}</CardTitle>
						</CardHeader>
						<CardContent>
							<ItemGroup>
								<Item size="sm">
									<ItemMedia variant="icon">
										<RiCheckboxBlankCircleLine aria-hidden="true" />
									</ItemMedia>
									<ItemContent>
										<ItemTitle>{ticketDetailCopy.status}</ItemTitle>
										<Badge variant="secondary">{progress.label}</Badge>
									</ItemContent>
								</Item>
								{data.deviceId ? (
									<>
										<Separator />
										<Item size="sm">
											<ItemMedia variant="icon">
												<RiComputerLine aria-hidden="true" />
											</ItemMedia>
											<ItemContent>
												<ItemTitle>{ticketDetailCopy.deviceAttached}</ItemTitle>
												<Badge variant="outline">{ticketDetailCopy.yes}</Badge>
											</ItemContent>
										</Item>
									</>
								) : null}
								<Separator />
								<Item size="sm">
									<ItemContent>
										<ItemTitle>{ticketDetailCopy.lastUpdated}</ItemTitle>
										<p className="text-muted-foreground text-sm">
											{formatDate(data.updatedAt)}
										</p>
									</ItemContent>
								</Item>
							</ItemGroup>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>{attachmentCopy.title}</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							{documents.isPending ? (
								<p role="status" className="text-muted-foreground text-sm">
									{attachmentCopy.loading}
								</p>
							) : documents.isError ? (
								<Button
									variant="destructive"
									size="sm"
									onClick={() => documents.refetch()}
								>
									{attachmentCopy.loadError}
								</Button>
							) : documents.data.length ? (
								<ItemGroup>
									{documents.data.map((item) => (
										<Item
											key={item.id}
											size="sm"
											variant="outline"
											render={
												<a
													href={
														item.kind === "link"
															? item.url
															: apiUrl(item.downloadUrl)
													}
												/>
											}
										>
											<ItemMedia variant="icon">
												{item.kind === "link" ? (
													<RiLinkM aria-hidden="true" />
												) : (
													<RiAttachment2 aria-hidden="true" />
												)}
											</ItemMedia>
											<ItemContent>
												<ItemTitle>{item.displayName}</ItemTitle>
											</ItemContent>
										</Item>
									))}
								</ItemGroup>
							) : (
								<p className="text-muted-foreground text-sm">
									{attachmentCopy.empty}
								</p>
							)}
							{uploadError ? (
								<Alert variant="destructive">
									<AlertTitle>{attachmentCopy.uploadFailed}</AlertTitle>
								</Alert>
							) : null}
							<Separator />
							<div className="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={addLink.isPending}
									onClick={() => setLinkDialogOpen(true)}
								>
									<RiLinkM data-icon="inline-start" aria-hidden="true" />
									{attachmentCopy.addLink}
								</Button>
								<label
									className={buttonVariants({ variant: "outline", size: "sm" })}
								>
									<RiAttachment2 data-icon="inline-start" aria-hidden="true" />
									<input
										className="sr-only"
										type="file"
										multiple
										onChange={(event) => {
											if (!event.target.files) return;
											setUploadError(false);
											void uploadDocuments({
												...documentInput,
												files: event.target.files,
											}).catch(() => setUploadError(true));
										}}
									/>
									{attachmentCopy.attachFiles}
								</label>
							</div>
						</CardContent>
					</Card>
				</aside>
			</div>

			<Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{attachmentCopy.addLink}</DialogTitle>
						<DialogDescription>
							Add a link to this request’s attachments.
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							const url = linkUrl.trim();
							setLinkUrlTouched(true);
							if (!url) return;
							addLink.mutate({
								...documentInput,
								url,
								displayName: linkName.trim() || url,
							});
						}}
					>
						<FieldGroup>
							<Field data-invalid={linkUrlTouched && !linkUrl.trim()}>
								<FieldLabel htmlFor="attachment-link-url">
									{attachmentCopy.linkUrlPrompt}
								</FieldLabel>
								<Input
									id="attachment-link-url"
									type="url"
									required
									value={linkUrl}
									onBlur={() => setLinkUrlTouched(true)}
									onChange={(event) => setLinkUrl(event.target.value)}
									aria-invalid={linkUrlTouched && !linkUrl.trim()}
								/>
								{linkUrlTouched && !linkUrl.trim() ? (
									<FieldError>This field is required.</FieldError>
								) : null}
							</Field>
							<Field>
								<FieldLabel htmlFor="attachment-link-name">
									{attachmentCopy.linkNamePrompt}
								</FieldLabel>
								<Input
									id="attachment-link-name"
									value={linkName}
									onChange={(event) => setLinkName(event.target.value)}
									placeholder={linkUrl}
								/>
							</Field>
							<DialogFooter>
								<Button
									type="submit"
									disabled={!linkUrl.trim() || addLink.isPending}
								>
									{attachmentCopy.addLink}
								</Button>
							</DialogFooter>
						</FieldGroup>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog open={detailHelpOpen} onOpenChange={setDetailHelpOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{ticketDetailCopy.addDetail}</DialogTitle>
						<DialogDescription>
							{ticketDetailCopy.addDetailDescription}
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							void detailForm.handleSubmit().catch(() => undefined);
						}}
					>
						<FieldGroup>
							<detailForm.Field name="note">
								{(field) => {
									const invalid = field.state.meta.errors.length > 0;
									return (
										<Field data-invalid={invalid}>
											<FieldLabel htmlFor="detail-note">
												{ticketDetailCopy.additionalDetail}
											</FieldLabel>
											<Textarea
												id="detail-note"
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
												maxLength={2_000}
												placeholder={ticketDetailCopy.notePlaceholder}
												className="min-h-24"
												aria-invalid={invalid}
											/>
											<FieldError errors={field.state.meta.errors} />
										</Field>
									);
								}}
							</detailForm.Field>
							<DialogFooter>
								<detailForm.Subscribe
									selector={(state) => ({
										canSubmit: state.canSubmit,
										isSubmitting: state.isSubmitting,
										note: state.values.note,
									})}
								>
									{({ canSubmit, isSubmitting, note }) => (
										<Button
											type="submit"
											disabled={
												!canSubmit ||
												!note.trim() ||
												note.trim().length > 2_000 ||
												isSubmitting ||
												updateTicket.isPending
											}
										>
											{ticketDetailCopy.addDetail}
										</Button>
									)}
								</detailForm.Subscribe>
							</DialogFooter>
						</FieldGroup>
					</form>
				</DialogContent>
			</Dialog>
		</PageShell>
	);
}
