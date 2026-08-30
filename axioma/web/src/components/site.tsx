import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AxiomaWordmark } from "./brand";

const nav = [
	{ to: "/product", label: "Product" },
	{ to: "/about", label: "About" },
	{ to: "/contact", label: "Contact" },
] as const;

export function Wordmark() {
	return (
		<Link className="wordmark" to="/" aria-label="Axiōma home">
			<AxiomaWordmark className="wordmark-logo" />
		</Link>
	);
}

export function SiteHeader() {
	return (
		<header className="site-header">
			<div className="shell nav-shell">
				<Wordmark />
				<nav className="desktop-nav" aria-label="Main navigation">
					{nav.map((item) => (
						<Link
							key={item.to}
							to={item.to}
							activeProps={{ "aria-current": "page" }}
						>
							{item.label}
						</Link>
					))}
				</nav>
				<details className="mobile-nav">
					<summary>Menu</summary>
					<nav aria-label="Mobile navigation">
						{nav.map((item) => (
							<Link
								key={item.to}
								to={item.to}
								activeProps={{ "aria-current": "page" }}
								onClick={(event) =>
									event.currentTarget
										.closest("details")
										?.removeAttribute("open")
								}
							>
								{item.label}
							</Link>
						))}
					</nav>
				</details>
			</div>
		</header>
	);
}

export function SiteFooter() {
	return (
		<footer className="site-footer">
			<div className="shell footer-grid">
				<div>
					<Wordmark />
					<p>IT support, from ticket to action.</p>
				</div>
				<nav aria-label="Footer navigation">
					{nav.map((item) => (
						<Link key={item.to} to={item.to}>
							{item.label}
						</Link>
					))}
				</nav>
				<p className="copyright">© {new Date().getFullYear()} Axiōma</p>
			</div>
		</footer>
	);
}

export function Arrow() {
	return <span aria-hidden="true">↗</span>;
}

export function PageIntro({
	eyebrow,
	title,
	children,
}: {
	eyebrow: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="page-intro shell">
			<p className="eyebrow">{eyebrow}</p>
			<h1>{title}</h1>
			<div className="lede">{children}</div>
		</section>
	);
}

export function ContactCta({
	title = "Bring the whole ticket into view.",
}: {
	title?: string;
}) {
	return (
		<section className="cta-band">
			<div className="shell cta-inner">
				<div>
					<p className="eyebrow">Start a conversation</p>
					<h2>{title}</h2>
				</div>
				<Link className="button button-light" to="/contact">
					Contact us <Arrow />
				</Link>
			</div>
		</section>
	);
}
