import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";
import { AxiomaWordmark } from "@/components/brand";
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

export default function SignUpForm({
	redirect,
	onSwitchToSignIn,
}: {
	redirect: string;
	onSwitchToSignIn: () => void;
}) {
	const { isPending } = authClient.useSession();
	const form = useForm({
		defaultValues: { email: "", password: "", name: "" },
		onSubmit: async ({ value }) => {
			await authClient.signUp.email(value, {
				onSuccess: () => {
					window.location.assign(redirect);
					toast.success("Sign up successful");
				},
				onError: (error) => {
					toast.error(error.error.message || error.error.statusText);
				},
			});
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, "Name must be at least 2 characters"),
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	if (isPending) return <Loader />;

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<div className="mb-6 flex flex-col items-center gap-3">
				<AxiomaWordmark className="h-8 w-auto text-primary" title="Axiōma" />
				<h1 className="text-center font-bold text-3xl">Create Account</h1>
				<p className="text-center text-muted-foreground text-sm">
					Set up your Axiōma console access.
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
					{(["name", "email", "password"] as const).map((name) => (
						<form.Field key={name} name={name}>
							{(field) => {
								const invalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={invalid}>
										<FieldLabel htmlFor={field.name}>
											{name === "name"
												? "Name"
												: name === "email"
													? "Email"
													: "Password"}
										</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											type={
												name === "password"
													? "password"
													: name === "email"
														? "email"
														: "text"
											}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											aria-invalid={invalid}
										/>
										<FieldError errors={field.state.meta.errors} />
									</Field>
								);
							}}
						</form.Field>
					))}
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
								{isSubmitting ? "Submitting..." : "Sign Up"}
							</Button>
						)}
					</form.Subscribe>
				</FieldGroup>
			</form>
			<div className="mt-4 text-center">
				<Button variant="link" onClick={onSwitchToSignIn}>
					Already have an account? Sign In
				</Button>
			</div>
		</div>
	);
}
