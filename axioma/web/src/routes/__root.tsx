import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { SiteFooter, SiteHeader } from "../components/site";
import { SITE_URL } from "../content/site";
import styles from "../styles/index.css?url";

// Applied before first paint so the theme never flashes.
const themeInit = `(function () {
	try {
		var stored = localStorage.getItem("theme");
		var setting = stored === "light" || stored === "dark" ? stored : "system";
		var dark =
			setting === "dark" ||
			(setting === "system" &&
				window.matchMedia("(prefers-color-scheme: dark)").matches);
		var root = document.documentElement;
		root.classList.toggle("dark", dark);
		root.classList.add("js");
		root.style.colorScheme = dark ? "dark" : "light";
	} catch (e) {}
})();`;

const orgJsonLd = JSON.stringify({
	"@context": "https://schema.org",
	"@type": "Organization",
	name: "Axiōma",
	url: SITE_URL,
	logo: `${SITE_URL}/android-chrome-512x512.png`,
	email: "hello@axioma.dev",
});

const websiteJsonLd = JSON.stringify({
	"@context": "https://schema.org",
	"@type": "WebSite",
	name: "Axiōma",
	url: SITE_URL,
});

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				name: "description",
				content:
					"Axiōma is an AI IT-support platform that carries tickets from employee report to diagnosis, action, and a reasoned outcome.",
			},
			{
				name: "theme-color",
				media: "(prefers-color-scheme: light)",
				content: "#f4f4f5",
			},
			{
				name: "theme-color",
				media: "(prefers-color-scheme: dark)",
				content: "#09090b",
			},
			{ property: "og:site_name", content: "Axiōma" },
			{ property: "og:type", content: "website" },
			{ property: "og:locale", content: "en_US" },
			{ property: "og:image", content: `${SITE_URL}/og.png` },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{ name: "twitter:card", content: "summary_large_image" },
		],
		links: [
			{ rel: "stylesheet", href: styles },
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
			{
				rel: "icon",
				href: "/favicon-32x32.png",
				type: "image/png",
				sizes: "32x32",
			},
			{
				rel: "icon",
				href: "/favicon-16x16.png",
				type: "image/png",
				sizes: "16x16",
			},
			{ rel: "shortcut icon", href: "/favicon.ico" },
			{
				rel: "apple-touch-icon",
				href: "/apple-touch-icon.png",
				sizes: "180x180",
			},
			{ rel: "manifest", href: "/site.webmanifest" },
		],
	}),
	component: RootComponent,
	notFoundComponent: NotFound,
});

function RootComponent() {
	return (
		<RootDocument>
			<a className="skip-link" href="#main">
				Skip to content
			</a>
			<div className="page-frame">
				<div className="page-sheet">
					<SiteHeader />
					<main id="main">
						<Outlet />
					</main>
					<SiteFooter />
				</div>
			</div>
		</RootDocument>
	);
}

function NotFound() {
	useEffect(() => {
		const prevTitle = document.title;
		document.title = "404 — Page not found — Axiōma";
		let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
		const prevContent = meta?.content;
		const created = !meta;
		if (!meta) {
			meta = document.createElement("meta");
			meta.name = "robots";
			document.head.appendChild(meta);
		}
		meta.content = "noindex, nofollow";
		return () => {
			document.title = prevTitle;
			if (meta) {
				if (created) meta.remove();
				else if (prevContent !== undefined) meta.content = prevContent;
			}
		};
	}, []);

	return (
		<section className="not-found shell">
			<h1>This ticket has no owner.</h1>
			<p>The page may have moved, or the address may be incomplete.</p>
			<Link className="button" to="/">
				Return home
			</Link>
		</section>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeInit }} />
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: orgJsonLd }}
				/>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: websiteJsonLd }}
				/>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
