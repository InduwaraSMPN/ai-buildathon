export const ssoCopy = {
	divider: "or continue with",
	signIn: (providerName: string) => `Continue with ${providerName}`,
	failure:
		"We couldn’t sign you in with your organisation account. Try again or use email and password.",
} as const;
