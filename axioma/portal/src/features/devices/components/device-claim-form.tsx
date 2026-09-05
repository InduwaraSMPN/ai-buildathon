import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { deviceCopy } from "@/features/devices/copy";
import { orpc, queryClient } from "@/utils/orpc";

export function DeviceClaimForm({ onSuccess }: { onSuccess?: () => void }) {
	const inputId = useId();
	const claim = useMutation(
		orpc.claimDevice.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.listMyDevices.key(),
				});
				form.reset();
				onSuccess?.();
			},
		}),
	);
	const form = useForm({
		defaultValues: { code: "" },
		onSubmit: ({ value }) => claim.mutateAsync({ code: value.code.trim() }),
		validators: {
			onSubmit: ({ value }) =>
				value.code.trim().length >= 4 ? undefined : deviceCopy.codeError,
		},
	});

	return (
		<>
			<form
				className="flex flex-col gap-3 sm:flex-row sm:items-end"
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit().catch(() => undefined);
				}}
			>
				<form.Field name="code">
					{(field) => {
						const invalid = field.state.meta.errors.length > 0;
						return (
							<Field className="min-w-0 flex-1" data-invalid={invalid}>
								<FieldLabel htmlFor={inputId}>
									{deviceCopy.codeLabel}
								</FieldLabel>
								<Input
									id={inputId}
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									maxLength={32}
									placeholder={deviceCopy.codePlaceholder}
									aria-invalid={invalid}
								/>
								<FieldError>
									{field.state.meta.errors.map(String).join(", ")}
								</FieldError>
							</Field>
						);
					}}
				</form.Field>
				<Button type="submit" disabled={claim.isPending}>
					{claim.isPending ? <Spinner data-icon="inline-start" /> : null}
					{claim.isPending ? deviceCopy.connecting : deviceCopy.connectComputer}
				</Button>
			</form>
			{claim.isError ? (
				<FieldError className="mt-3">{deviceCopy.connectError}</FieldError>
			) : null}
			{claim.isSuccess ? (
				<p className="mt-3 text-sm" role="status">
					{deviceCopy.connected}
				</p>
			) : null}
		</>
	);
}
