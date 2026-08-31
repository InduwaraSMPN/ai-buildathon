import {
	RiAddLine,
	RiArrowDownSLine,
	RiArrowRightLine,
	RiCheckboxCircleLine,
	RiInboxLine,
} from "@remixicon/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ErrorState,
	formatDate,
	LoadingCards,
	PageHeading,
	PageShell,
	StatusBadge,
} from "@/components/ticket-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
	getTicketStage,
	homeCopy,
	isFinishedTicket,
} from "@/features/tickets/copy";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/home")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: homeCopy.pageTitle }] }),
});

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const tickets = useQuery(
		orpc.listTickets.queryOptions({ input: { scope: "mine" } }),
	);
	const firstName = session.data?.user.name?.split(" ")[0];
	const items = tickets.data?.items ?? [];
	const enroll = useMutation(
		orpc.enrollDevice.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: orpc.listMyDevices.key() }),
		}),
	);
	const enrollmentForm = useForm({
		defaultValues: { code: "" },
		onSubmit: ({ value }) => enroll.mutateAsync({ code: value.code.trim() }),
		validators: {
			onSubmit: ({ value }) =>
				value.code.trim().length >= 4 ? undefined : homeCopy.codeError,
		},
	});
	const activeTickets = items.filter(
		(ticket) => !isFinishedTicket(ticket.statusStateType),
	);
	const finishedTickets = items.filter((ticket) =>
		isFinishedTicket(ticket.statusStateType),
	);
	const ticketCard = (ticket: (typeof items)[number]) => (
		<Link
			key={ticket.id}
			to="/tickets/$ticketId"
			params={{ ticketId: ticket.id }}
			className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<Card className="transition-colors group-hover:bg-muted/40">
				<CardContent className="flex items-center justify-between gap-4 sm:gap-5">
					<div className="min-w-0">
						<div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
							<StatusBadge
								stateType={ticket.statusStateType}
								label={ticket.statusLabel}
							/>
							<span className="font-medium text-muted-foreground text-xs">
								{homeCopy.stage} {getTicketStage(ticket.statusStateType)}
							</span>
							{ticket.statusStateType === "resolved" ? (
								<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
									<RiCheckboxCircleLine
										className="size-3.5"
										aria-hidden="true"
									/>
									<span>{homeCopy.resolutionReady}</span>
								</span>
							) : null}
							<span className="text-muted-foreground text-xs">
								{homeCopy.updated} {formatDate(ticket.updatedAt)}
							</span>
						</div>
						<h3 className="truncate font-semibold text-base">{ticket.title}</h3>
						<p className="mt-1 font-mono text-muted-foreground text-xs">
							{ticket.number ?? ticket.id}
						</p>
						<p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
							{ticket.body}
						</p>
					</div>
					<RiArrowRightLine
						className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
						aria-hidden="true"
					/>
				</CardContent>
			</Card>
		</Link>
	);

	const frontDoor = useQuery(orpc.portalIsFrontDoor.queryOptions({}));
	const foreignFrontDoor = frontDoor.data?.foreign === true;

	return (
		<PageShell>
			<PageHeading
				eyebrow={homeCopy.eyebrow}
				title={firstName ? homeCopy.welcome(firstName) : homeCopy.title}
				description={homeCopy.description}
				action={
					// Hidden when the customer's own service desk is the front door:
					// two places to file one request is worse than either alone.
					foreignFrontDoor ? undefined : (
						<Link to="/tickets/new" className={buttonVariants({ size: "lg" })}>
							<RiAddLine data-icon="inline-start" aria-hidden="true" />
							{homeCopy.newRequest}
						</Link>
					)
				}
			/>

			<Card className="mb-6 py-0">
				<Collapsible>
					<div className="p-4 sm:p-6">
						<CollapsibleTrigger render={<Button variant="ghost" />}>
							{homeCopy.connectComputer}
							<RiArrowDownSLine
								data-icon="inline-end"
								aria-hidden="true"
								className="transition-transform group-aria-expanded/button:rotate-180"
							/>
						</CollapsibleTrigger>
					</div>
					<CollapsibleContent keepMounted>
						<Separator />
						<form
							className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-6"
							onSubmit={(event) => {
								event.preventDefault();
								enrollmentForm.handleSubmit();
							}}
						>
							<enrollmentForm.Field name="code">
								{(field) => {
									const invalid = field.state.meta.errors.length > 0;
									return (
										<Field className="min-w-0 flex-1" data-invalid={invalid}>
											<FieldLabel htmlFor="enrollment-code">
												{homeCopy.codeLabel}
											</FieldLabel>
											<Input
												id="enrollment-code"
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
												maxLength={64}
												placeholder={homeCopy.codePlaceholder}
												aria-invalid={invalid}
											/>
											<FieldError>
												{field.state.meta.errors.map(String).join(", ")}
											</FieldError>
										</Field>
									);
								}}
							</enrollmentForm.Field>
							<Button type="submit" disabled={enroll.isPending}>
								{enroll.isPending ? <Spinner data-icon="inline-start" /> : null}
								{enroll.isPending
									? homeCopy.connecting
									: homeCopy.connectComputer}
							</Button>
						</form>
						{enroll.isError ? (
							<FieldError className="px-4 pb-4 sm:px-6">
								{homeCopy.connectError}
							</FieldError>
						) : null}
						{enroll.isSuccess ? (
							<p className="px-4 pb-4 text-sm sm:px-6" role="status">
								{homeCopy.connected}
							</p>
						) : null}
					</CollapsibleContent>
				</Collapsible>
			</Card>

			<div className="mb-4 flex items-center justify-between">
				<h2 className="font-semibold text-lg">{homeCopy.requests}</h2>
				{items.length ? (
					<p className="text-muted-foreground text-sm">
						{items.length}{" "}
						{items.length === 1 ? homeCopy.request : homeCopy.requestsPlural}
					</p>
				) : null}
			</div>

			{tickets.isPending ? <LoadingCards /> : null}
			{tickets.isError ? (
				<ErrorState retry={() => tickets.refetch()} error={tickets.error} />
			) : null}
			{tickets.data && items.length === 0 ? (
				<Card className="border-dashed bg-transparent">
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<RiInboxLine aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle>{homeCopy.emptyTitle}</EmptyTitle>
							<EmptyDescription>{homeCopy.emptyDescription}</EmptyDescription>
						</EmptyHeader>
						{foreignFrontDoor ? null : (
							<EmptyContent>
								<Link
									to="/tickets/new"
									className={buttonVariants({ variant: "outline" })}
								>
									{homeCopy.createFirst}
								</Link>
							</EmptyContent>
						)}
					</Empty>
				</Card>
			) : null}
			{activeTickets?.length ? (
				<section aria-labelledby="active-requests-heading">
					<h3 id="active-requests-heading" className="sr-only">
						{homeCopy.active}
					</h3>
					<div className="grid gap-4">{activeTickets.map(ticketCard)}</div>
				</section>
			) : null}
			{finishedTickets?.length ? (
				<Card className="mt-6 py-0">
					<Collapsible>
						<div className="p-4 sm:p-6">
							<CollapsibleTrigger render={<Button variant="ghost" />}>
								{homeCopy.finished} ({finishedTickets.length})
								<RiArrowDownSLine
									data-icon="inline-end"
									aria-hidden="true"
									className="transition-transform group-aria-expanded/button:rotate-180"
								/>
							</CollapsibleTrigger>
						</div>
						<CollapsibleContent keepMounted>
							<Separator />
							<div className="grid gap-4 p-4 sm:p-6">
								{finishedTickets.map(ticketCard)}
							</div>
						</CollapsibleContent>
					</Collapsible>
				</Card>
			) : null}
		</PageShell>
	);
}
