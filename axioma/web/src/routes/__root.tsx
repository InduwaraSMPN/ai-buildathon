import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "../components/site";
import styles from "../styles.css?url";

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
			{ name: "theme-color", content: "#0B0E12" },
			{ property: "og:site_name", content: "Axiōma" },
			{ property: "og:type", content: "website" },
		],
		links: [
			{ rel: "preconnect", href: "https://fonts.googleapis.com" },
			{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,SOFT,WONK,wght@0,9..144,0..100,0..1,100..900;1,9..144,0..100,0..1,100..900&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Fragment+Mono:ital@0;1&display=swap",
			},
			{ rel: "stylesheet", href: styles },
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
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
				<div className="feed-rail" aria-hidden="true" />
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
	return (
		<section className="not-found shell">
			<p className="eyebrow">404 / Route not found</p>
			<h1>This ticket has no owner.</h1>
			<p>The page may have moved, or the address may be incomplete.</p>
			<a className="button" href="/">
				Return home <span aria-hidden="true">↗</span>
			</a>
		</section>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
