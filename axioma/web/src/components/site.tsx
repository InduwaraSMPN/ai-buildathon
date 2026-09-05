import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { CONTACT_EMAIL, footerColumns, nav } from "../content/site";
import { ThemeToggle } from "./theme-toggle";

/**
 * The site stores nothing, so "subscribe" hands the address to the visitor's
 * own mail client rather than posting it anywhere. Swap the handler out once a
 * real list endpoint exists.
 */
function SubscribeForm() {
	const [email, setEmail] = useState("");

	return (
		<form
			className="subscribe-field"
			onSubmit={(event) => {
				event.preventDefault();
				const subject = encodeURIComponent("Axiōma updates");
				const body = encodeURIComponent(
					`Please add ${email} to the Axiōma updates list.`,
				);
				window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
			}}
		>
			<label className="sr-only" htmlFor="subscribe-email">
				Email address
			</label>
			<input
				id="subscribe-email"
				name="email"
				type="email"
				required
				autoComplete="email"
				placeholder="Enter your email"
				value={email}
				onChange={(event) => setEmail(event.target.value)}
			/>
			<button type="submit">Subscribe</button>
		</form>
	);
}

export function Wordmark() {
	return (
		<Link className="wordmark" to="/" aria-label="Axiōma home">
			<img
				className="wordmark-logo wordmark-logo-light"
				src="/brand/axioma-logo.svg"
				alt=""
				width={120}
				height={27}
			/>
			<img
				className="wordmark-logo wordmark-logo-dark"
				src="/brand/axioma-logo-dark.svg"
				alt=""
				width={120}
				height={27}
			/>
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
				<ThemeToggle />
				<div className="mobile-nav">
					<DropdownMenu>
						<DropdownMenuTrigger className="mobile-nav-trigger">
							Menu
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="mobile-menu"
							aria-label="Mobile navigation"
						>
							{nav.map((item) => (
								<DropdownMenuItem key={item.to} asChild>
									<Link to={item.to} activeProps={{ "aria-current": "page" }}>
										{item.label}
									</Link>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	);
}

export function SiteFooter() {
	return (
		<footer className="site-footer">
			<div className="footer-panel">
				<div className="footer-top">
					<div className="footer-subscribe">
						<h2>
							Occasional notes on carrying an IT ticket from report to a checked
							outcome.
						</h2>
						<SubscribeForm />
						<p className="subscribe-note">
							Subscribing opens your email client. Nothing is submitted to or
							stored by this website.
						</p>
						<a className="contact-chip" href={`mailto:${CONTACT_EMAIL}`}>
							{CONTACT_EMAIL} <Arrow />
						</a>
					</div>
					<nav className="footer-columns" aria-label="Footer navigation">
						{footerColumns.map((column) => (
							<div key={column.heading}>
								<h3>{column.heading}</h3>
								<ul>
									{column.links.map((link) => (
										<li key={link.href}>
											<a
												className={
													"accent" in link && link.accent ? "accent" : undefined
												}
												href={link.href}
											>
												{link.label}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</nav>
				</div>
				<p className="footer-legal">© {new Date().getFullYear()} Axiōma</p>
				{/* The shipped brand files, not the inline wordmark: each carries the
				    approved fill for its ground (#008236 on light, #016630 on dark),
				    so the pair is swapped by theme rather than tinted by --brand.
				    The ™ lockup belongs to this footer alone; everywhere else uses
				    the plain wordmark in /brand/axioma-logo*.svg. Paths are
				    root-relative: a relative one resolves against /pricing and the
				    other nested routes, which 404s. */}
				<Link className="footer-logo" to="/" aria-label="Axiōma home">
					<img
						className="footer-logo-light"
						src="/brand/axioma-wordmark.svg"
						alt=""
						width={142}
						height={40}
					/>
					<img
						className="footer-logo-dark"
						src="/brand/axioma-wordmark-dark.svg"
						alt=""
						width={142}
						height={40}
					/>
				</Link>
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
	eyebrow?: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="page-intro shell">
			{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
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
