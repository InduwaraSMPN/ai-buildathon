// Site-level content: navigation, contact, and canonical origin.

export const SITE_URL = "https://axioma.dev";

export const CONTACT_EMAIL = "hello@axioma.dev";

export const nav = [
	{ to: "/product", label: "Product" },
	{ to: "/pricing", label: "Pricing" },
	{ to: "/about", label: "About" },
	{ to: "/contact", label: "Contact" },
] as const;

export const footerColumns = [
	{
		heading: "Sitemap",
		links: [
			{ href: "/", label: "Home" },
			{ href: "/product", label: "Product" },
			{ href: "/pricing", label: "Pricing" },
			{ href: "/about", label: "About" },
			{ href: "/contact", label: "Contact" },
			{ href: "/status", label: "Service status" },
		],
	},
	{
		heading: "The loop",
		links: [
			{ href: "/product#ticket-flow", label: "Ticket flow" },
			{ href: "/product#decisions", label: "Tool order" },
			{ href: "/product#roles", label: "Roles" },
		],
	},
	{
		heading: "Contact",
		links: [
			{ href: "/contact", label: "Start a conversation", accent: true },
			{ href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL },
		],
	},
] as const;
