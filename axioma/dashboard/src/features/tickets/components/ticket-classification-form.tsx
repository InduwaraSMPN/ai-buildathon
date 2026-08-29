import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { TicketActionInput, TicketDetail } from "../api/types";

type Classification = TicketActionInput<"reclassify">;
type RecordType = NonNullable<Classification["recordType"]>;
type Level = NonNullable<Classification["impact"]>;

const recordTypes: RecordType[] = ["incident", "service_request"];
const levels: Level[] = ["high", "medium", "low"];

export function TicketClassificationForm({
	ticket,
	catalogue,
	disabled,
	onSubmit,
}: {
	ticket: TicketDetail;
	catalogue?: Awaited<
		ReturnType<typeof import("@/utils/orpc").client.listCatalogue>
	>;
	disabled: boolean;
	onSubmit: (input: Classification) => Promise<unknown>;
}) {
	const form = useForm({
		defaultValues: {
			recordType: ticket.recordType,
			impact: ticket.impact,
			urgency: ticket.urgency,
			serviceId: ticket.serviceId,
			serviceSubcategoryId: ticket.serviceSubcategoryId,
		},
		onSubmit: ({ value }) => onSubmit({ action: "reclassify", ...value }),
	});

	return (
		<form
			className="p-4"
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.Field name="recordType">
					{(field) => (
						<Field>
							<FieldLabel htmlFor="ticket-record-type">Type</FieldLabel>
							<Select
								value={field.state.value}
								onValueChange={(value) =>
									value && field.handleChange(value as RecordType)
								}
								disabled={disabled}
							>
								<SelectTrigger id="ticket-record-type" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{recordTypes.map((recordType) => (
										<SelectItem key={recordType} value={recordType}>
											{recordType.replaceAll("_", " ")}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => state.values.serviceId}>
					{(serviceId) => (
						<div className="grid grid-cols-2 gap-2">
							<form.Field name="serviceId">
								{(field) => (
									<Field>
										<FieldLabel htmlFor="ticket-service">Service</FieldLabel>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												value && field.handleChange(value)
											}
											disabled={disabled}
										>
											<SelectTrigger id="ticket-service" className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{catalogue?.services.map((service) => (
													<SelectItem key={service.id} value={service.id}>
														{service.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								)}
							</form.Field>
							<form.Field name="serviceSubcategoryId">
								{(field) => (
									<Field>
										<FieldLabel htmlFor="ticket-subcategory">
											Subcategory
										</FieldLabel>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												value && field.handleChange(value)
											}
											disabled={disabled}
										>
											<SelectTrigger id="ticket-subcategory" className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{catalogue?.subcategories
													.filter(
														(subcategory) =>
															subcategory.serviceId === serviceId,
													)
													.map((subcategory) => (
														<SelectItem
															key={subcategory.id}
															value={subcategory.id}
														>
															{subcategory.name}
														</SelectItem>
													))}
											</SelectContent>
										</Select>
									</Field>
								)}
							</form.Field>
						</div>
					)}
				</form.Subscribe>
				<div className="grid grid-cols-2 gap-2">
					{(["impact", "urgency"] as const).map((name) => (
						<form.Field key={name} name={name}>
							{(field) => (
								<Field>
									<FieldLabel htmlFor={`ticket-${name}`} className="capitalize">
										{name}
									</FieldLabel>
									<Select
										value={field.state.value}
										onValueChange={(value) =>
											value && field.handleChange(value as Level)
										}
										disabled={disabled}
									>
										<SelectTrigger id={`ticket-${name}`} className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{levels.map((level) => (
												<SelectItem key={level} value={level}>
													{level}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							)}
						</form.Field>
					))}
				</div>
				<Button type="submit" disabled={disabled}>
					Save classification
				</Button>
			</FieldGroup>
		</form>
	);
}
