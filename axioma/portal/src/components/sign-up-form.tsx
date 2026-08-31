import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import { AuthArtwork } from "@/components/auth-artwork";
import { AuthProviders } from "@/components/auth-providers";
import { AxiomaWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

const LANDING = "/my-requests";

export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const navigate = useNavigate({ from: "/login" });
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
		onSubmit: async ({ value }) => {
			await authClient.signUp.email(
				{ name: value.name, email: value.email, password: value.password },
				{
					onSuccess: () => {
						navigate({ to: LANDING });
						toast.success("Sign up successful");
					},
					onError: () => {
						toast.error("We couldn’t create your account. Please try again.");
					},
				},
			);
		},
		validators: {
			onSubmit: z
				.object({
					name: z.string().min(2, "Name must be at least 2 characters"),
					email: z.email("Invalid email address"),
					password: z.string().min(8, "Password must be at least 8 characters"),
					confirmPassword: z.string(),
				})
				.refine((value) => value.password === value.confirmPassword, {
					message: "Passwords do not match",
					path: ["confirmPassword"],
				}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="flex flex-col gap-6">
			<Card className="overflow-hidden p-0">
				<CardContent className="grid p-0 md:grid-cols-2">
					<form
						className="p-6 md:p-8"
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<FieldGroup>
							<div className="flex flex-col items-center gap-2 text-center">
								<h1 className="font-heading font-semibold text-2xl tracking-tight">
									Create your account
								</h1>
								{/* `title` carries the accessible name, so the sentence
								 * still reads "Set up access to Axiōma workplace support"
								 * aloud. */}
								<p className="flex flex-wrap items-center justify-center gap-1.5 text-muted-foreground text-sm">
									Set up access to
									<AxiomaWordmark
										title="Axiōma"
										className="h-4 w-auto text-foreground"
									/>
									workplace support
								</p>
							</div>
							<form.Field name="name">
								{(field) => {
									const invalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={invalid}>
											<FieldLabel htmlFor={field.name}>Name</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												autoComplete="name"
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
												placeholder="m@example.com"
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={invalid}
											/>
											<FieldError errors={field.state.meta.errors} />
											<FieldDescription>
												We&apos;ll use this to contact you about your requests.
											</FieldDescription>
										</Field>
									);
								}}
							</form.Field>
							<Field>
								<Field className="grid grid-cols-2 gap-4">
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
														autoComplete="new-password"
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
									<form.Field name="confirmPassword">
										{(field) => {
											const invalid =
												field.state.meta.isTouched && !field.state.meta.isValid;
											return (
												<Field data-invalid={invalid}>
													<FieldLabel htmlFor={field.name}>
														Confirm Password
													</FieldLabel>
													<Input
														id={field.name}
														name={field.name}
														type="password"
														autoComplete="new-password"
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
								</Field>
								<FieldDescription>
									Must be at least 8 characters long.
								</FieldDescription>
							</Field>
							<Field>
								<form.Subscribe
									selector={(state) => ({
										canSubmit: state.canSubmit,
										isSubmitting: state.isSubmitting,
									})}
								>
									{({ canSubmit, isSubmitting }) => (
										<Button type="submit" disabled={!canSubmit || isSubmitting}>
											{isSubmitting ? (
												<Spinner data-icon="inline-start" />
											) : null}
											{isSubmitting ? "Creating account..." : "Create Account"}
										</Button>
									)}
								</form.Subscribe>
							</Field>
							<AuthProviders callbackURL={LANDING} />
							<FieldDescription className="text-center">
								Already have an account?{" "}
								<button
									type="button"
									className="underline underline-offset-4 hover:text-primary"
									onClick={onSwitchToSignIn}
								>
									Sign in
								</button>
							</FieldDescription>
						</FieldGroup>
					</form>
					<div className="relative hidden bg-muted md:block">
						<AuthArtwork />
					</div>
				</CardContent>
			</Card>
			<FieldDescription className="px-6 text-center">
				By continuing you agree to the{" "}
				<Link to="/acceptable-use">Axiōma acceptable use policy</Link> for this
				portal.
			</FieldDescription>
		</div>
	);
}
