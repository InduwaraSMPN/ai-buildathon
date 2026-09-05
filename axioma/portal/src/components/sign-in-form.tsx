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

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const navigate = useNavigate({ from: "/login" });
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: { email: "", password: "" },
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{ email: value.email, password: value.password },
				{
					onSuccess: () => {
						navigate({ to: LANDING });
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
									Sign in
								</h1>
								{/* `title` carries the accessible name, so the sentence
								 * still reads "Access your Axiōma support requests…" aloud. */}
								<p className="flex flex-wrap items-center justify-center gap-1.5 text-muted-foreground text-sm">
									Access your
									<AxiomaWordmark
										title="Axiōma"
										className="h-4 w-auto text-foreground"
									/>
									support portal.
								</p>
							</div>
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
											{isSubmitting ? "Signing in..." : "Sign in"}
										</Button>
									)}
								</form.Subscribe>
							</Field>
							<AuthProviders callbackURL={LANDING} />
							<FieldDescription className="text-center">
								Need an account?{" "}
								<button
									type="button"
									className="underline underline-offset-4 hover:text-primary"
									onClick={onSwitchToSignUp}
								>
									Sign up
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
