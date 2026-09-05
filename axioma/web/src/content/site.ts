// Site-level content: navigation, contact, and canonical origin.

export const SITE_URL = "https://axioma.dev";

export const CONTACT_EMAIL = "hello@axioma.dev";

export const PILOT_MAILTO =
	"mailto:hello@axioma.dev?subject=Shadow-mode%20pilot";

export const nav = [
	{ to: "/product", label: "Product" },
	{ to: "/impact", label: "Impact" },
	{ to: "/pricing", label: "Pricing" },
	{ to: "/about", label: "About" },
	{ to: "/contact", label: "Contact" },
] as const;

export const footerColumns = [
	{
		heading: "Product",
		links: [
			{ to: "/product", label: "Product" },
			{ to: "/impact", label: "Impact" },
			{ to: "/pricing", label: "Deployment packages" },
			{ to: "/status", label: "Service status" },
		],
	},
	{
		heading: "Company",
		links: [
			{ to: "/about", label: "About" },
			{ to: "/contact", label: "Contact" },
		],
	},
	{
		heading: "Contact",
		links: [{ href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL }],
	},
] as const;
