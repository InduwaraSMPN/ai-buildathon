export const ssoCopy = {
	divider: "Or continue with",
	signIn: (providerName: string) => `Continue with ${providerName}`,
	/**
	 * Shown on a provider nobody has enabled yet. The portal audience is
	 * employees rather than administrators, so this says who has not set it up
	 * — their organisation — instead of naming a console setting they cannot
	 * reach.
	 */
	notConfigured: (providerName: string) =>
		`${providerName} is not set up for your organisation`,
	failure:
		"We couldn’t sign you in with your organisation account. Try again or use email and password.",
} as const;
