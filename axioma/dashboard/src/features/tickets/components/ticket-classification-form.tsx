import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
type Category = NonNullable<Classification["category"]>;

const recordTypes: RecordType[] = ["incident", "service_request"];
const levels: Level[] = ["high", "medium", "low"];
const categories: Category[] = ["infrastructure", "device", "access"];

export function TicketClassificationForm({
	ticket,
	disabled,
	onSubmit,
}: {
	ticket: TicketDetail;
	disabled: boolean;
	onSubmit: (input: Classification) => Promise<unknown>;
}) {
	const form = useForm({
		defaultValues: {
			recordType: ticket.recordType,
			impact: ticket.impact,
			urgency: ticket.urgency,
			category: (ticket.category ?? "") as Category | "",
			subcategory: ticket.subcategory ?? "",
		},
		onSubmit: ({ value }) =>
			onSubmit({
				action: "reclassify",
				recordType: value.recordType,
				impact: value.impact,
				urgency: value.urgency,
				category: value.category || null,
				subcategory: value.subcategory.trim() || null,
			}),
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
				<form.Field name="category">
					{(field) => (
						<Field>
							<FieldLabel htmlFor="ticket-category">Category</FieldLabel>
							<Select
								value={field.state.value}
								onValueChange={(value) =>
									field.handleChange((value ?? "") as Category | "")
								}
								disabled={disabled}
							>
								<SelectTrigger id="ticket-category" className="w-full">
									<SelectValue placeholder="Unclassified" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="">Unclassified</SelectItem>
									{categories.map((category) => (
										<SelectItem key={category} value={category}>
											{category}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
				</form.Field>
				<form.Field name="subcategory">
					{(field) => (
						<Field>
							<FieldLabel htmlFor="ticket-subcategory">Subcategory</FieldLabel>
							<Input
								id="ticket-subcategory"
								maxLength={160}
								value={field.state.value}
								onChange={(event) => field.handleChange(event.target.value)}
								disabled={disabled}
							/>
						</Field>
					)}
				</form.Field>
				<Button type="submit" disabled={disabled}>
					Save classification
				</Button>
			</FieldGroup>
		</form>
	);
}
