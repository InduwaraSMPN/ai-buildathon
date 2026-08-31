import { useForm } from "@tanstack/react-form";
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
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import Loader from "./loader";

export default function SignInForm({
	redirect,
	onSwitchToSignUp,
}: {
	redirect: string;
	onSwitchToSignUp: () => void;
}) {
	const { isPending } = authClient.useSession();
	const form = useForm({
		defaultValues: { email: "", password: "" },
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(value, {
				onSuccess: () => {
					window.location.assign(redirect);
					toast.success("Sign in successful");
				},
				onError: (error) => {
					toast.error(error.error.message || error.error.statusText);
				},
			});
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	if (isPending) return <Loader />;

	return (
		<main className="mx-auto w-full max-w-md px-6 py-12 sm:py-16">
			<div className="mb-5">
				<h1 className="font-heading font-semibold text-2xl tracking-tight">
					Sign in
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Sign in to the Axiōma console.
				</p>
			</div>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
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
										onChange={(event) => field.handleChange(event.target.value)}
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
										onChange={(event) => field.handleChange(event.target.value)}
										aria-invalid={invalid}
									/>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							);
						}}
					</form.Field>
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
								{isSubmitting && <Spinner data-icon="inline-start" />}
								{isSubmitting ? "Submitting..." : "Sign In"}
							</Button>
						)}
					</form.Subscribe>
				</FieldGroup>
			</form>
			<div className="mt-4 text-center">
				<Button variant="link" onClick={onSwitchToSignUp}>
					Need an account? Sign Up
				</Button>
			</div>
		</main>
	);
}
