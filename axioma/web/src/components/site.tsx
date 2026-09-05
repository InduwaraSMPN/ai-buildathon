import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
	CONTACT_EMAIL,
	footerColumns,
	nav,
	PILOT_MAILTO,
} from "../content/site";
import { ThemeToggle } from "./theme-toggle";

/**
 * The site stores nothing, so "subscribe" hands the address to the visitor's
 * own mail client rather than posting it anywhere. Swap the handler out once a
 * real list endpoint exists. The disclosure sits above the field and is wired
 * to the input with aria-describedby.
 */
function SubscribeForm() {
	const [email, setEmail] = useState("");
	const [handedOff, setHandedOff] = useState(false);

	return (
		<>
			<form
				className="subscribe-field"
				onSubmit={(event) => {
					event.preventDefault();
					const subject = encodeURIComponent("Axiōma updates");
					const body = encodeURIComponent(
						`Please add ${email} to the Axiōma updates list.`,
					);
					window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
					setHandedOff(true);
				}}
			>
				<label className="sr-only" htmlFor="subscribe-email">
					Email address
				</label>
				<input
					aria-describedby="subscribe-note"
					autoComplete="email"
					id="subscribe-email"
					name="email"
					onChange={(event) => setEmail(event.target.value)}
					placeholder="Enter your email"
					required
					type="email"
					value={email}
				/>
				<button type="submit">Subscribe</button>
			</form>
			<p className="subscribe-note" id="subscribe-note" role="status">
				{handedOff
					? "Your email client should now hold the request. Send it to finish."
					: "Subscribing opens your email client. Nothing is submitted to or stored by this website."}
			</p>
		</>
	);
}

/** Trailing glyph on the footer contact chip. */
function Arrow() {
	return <span aria-hidden="true">↗</span>;
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

/**
 * The masthead is a floating rounded bar on the page ground, not a full-bleed
 * band: wordmark, links, and the three-state theme control.
 */
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

/**
 * A rounded panel inset on a brand-green band, closing with the oversized
 * trademark wordmark. This is the one part of the site that is not hard-edged.
 */
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
										<li key={link.label}>
											{"to" in link ? (
												<Link to={link.to}>{link.label}</Link>
											) : (
												<a href={link.href}>{link.label}</a>
											)}
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

/** Page title and lede, set side by side so an intro fills the measure. */
export function PageIntro({
	title,
	lede,
	children,
}: {
	title: string;
	lede?: string;
	children?: ReactNode;
}) {
	return (
		<section className="page-intro shell">
			<h1>{title}</h1>
			{lede || children ? (
				<div className="lede">
					{lede ? <p>{lede}</p> : null}
					{children}
				</div>
			) : null}
		</section>
	);
}

export type ContactBandProps = {
	title?: string;
	body?: string;
	primaryLabel?: string;
	secondary?: boolean | string;
};

/**
 * Shadow-mode pilot band. The primary action is a mailto to PILOT_MAILTO and
 * the secondary action links to the home run replay. Plain text only.
 */
export function ContactBand({
	title = "Run it in shadow mode for a fortnight.",
	body = "Shadow mode refuses every write and records the attempt. Compare each proposal with what your team did.",
	primaryLabel = "Start a shadow-mode pilot",
	secondary = true,
}: ContactBandProps) {
	const showSecondary = secondary !== false;
	const secondaryLabel =
		typeof secondary === "string" ? secondary : "Watch a run";

	return (
		<section className="cta-band">
			<div className="shell cta-inner">
				<div>
					<h2>{title}</h2>
					{body ? <p>{body}</p> : null}
				</div>
				<div className="cta-actions">
					<a className="button" href={PILOT_MAILTO}>
						{primaryLabel}
					</a>
					{showSecondary ? (
						<Link className="button-secondary" to="/" hash="run">
							{secondaryLabel}
						</Link>
					) : null}
				</div>
			</div>
		</section>
	);
}
