import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

import { ssoCopy } from "@/features/auth/copy";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

import Loader from "./loader";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const navigate = useNavigate({
		from: "/login",
	});
	const { isPending } = authClient.useSession();
	const providers = useQuery(orpc.listAuthProviders.queryOptions());

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: () => {
						navigate({
							to: "/home",
						});
						toast.success("Sign in successful");
					},
					onError: () => {
						toast.error(
							"We couldn’t sign you in. Check your details and try again.",
						);
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<main className="mx-auto w-full max-w-md px-6 py-12 sm:py-16">
			<div className="mb-5">
				<h1 className="font-heading font-semibold text-2xl tracking-tight">
					Sign in
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Access your support requests and see what’s happening.
				</p>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="flex flex-col gap-4"
			>
				<FieldGroup>
					<form.Field name="email">
						{(field) => {
							const invalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={invalid}>
									<FieldLabel htmlFor={field.name}>Email</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="email"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={invalid}
									/>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="password">
						{(field) => {
							const invalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={invalid}>
									<FieldLabel htmlFor={field.name}>Password</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="password"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={invalid}
									/>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<Button
							type="submit"
							className="w-full"
							disabled={!canSubmit || isSubmitting}
						>
							{isSubmitting ? <Spinner data-icon="inline-start" /> : null}
							{isSubmitting ? "Submitting..." : "Sign In"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			{providers.data?.length ? (
				<div className="mt-6 space-y-3">
					<div className="flex items-center gap-3 text-muted-foreground text-sm">
						<Separator className="flex-1" />
						{ssoCopy.divider}
						<Separator className="flex-1" />
					</div>
					{providers.data.map((provider) => (
						<Button
							key={provider.providerId}
							variant="outline"
							className="w-full"
							onClick={async () => {
								const result = await authClient.signIn.social({
									provider: provider.providerId,
									callbackURL: "/home",
								});
								if (result.error) toast.error(ssoCopy.failure);
							}}
						>
							{ssoCopy.signIn(provider.name)}
						</Button>
					))}
				</div>
			) : null}

			<div className="mt-4 text-center">
				<Button variant="link" onClick={onSwitchToSignUp}>
					Need an account? Sign Up
				</Button>
			</div>
		</main>
	);
}
