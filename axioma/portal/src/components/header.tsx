import { Link } from "@tanstack/react-router";
import { ModeToggle } from "./mode-toggle";
import { NotificationCenter } from "./notification-center";
import UserMenu from "./user-menu";

const navPill =
	"inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 font-medium text-muted-foreground text-sm outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:bg-foreground data-[status=active]:text-background data-[status=active]:hover:bg-foreground/90";

export default function Header() {
	return (
		// Two grounds, then the bar. The bar surface stops at the PageShell column
		// instead of bleeding to the viewport edges, so the strips either side of it
		// have to repaint PageShell's own ground; otherwise the sticky header leaves
		// bare --background there while the page below it is bg-muted/20. That
		// ground is translucent and the header is sticky, so it needs an opaque
		// layer beneath or scrolled content shows through: bg-background on the
		// element, bg-muted/20 over it, which composites to the PageShell colour.
		<header className="sticky top-0 z-20 bg-background">
			<div className="bg-muted/20">
				{/* Same column as PageShell in ticket-ui.tsx, so the bar reads as the
				    top of the page content rather than a separate band. --card, not
				    --background: --muted sits below --background in light but above it
				    in dark, so on --background the bar reads raised in light and sunken
				    in dark. --card is white in light (an identical result) and a step
				    above the page ground in dark, so the bar reads raised in both. */}
				<div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 rounded-b-3xl border-x border-b bg-card px-4 sm:px-6 md:flex-nowrap lg:px-8">
					{/* The shipped brand files rather than the inline wordmark: each
					    carries the approved fill for its ground (#008236 on light,
					    #016630 on dark), so the pair is swapped by theme. */}
					<Link
						to="/home"
						aria-label="Axiōma"
						className="flex h-16 shrink-0 items-center sm:h-20"
					>
						<img
							src="/brand/axioma-logo.svg"
							alt=""
							width={120}
							height={27}
							className="h-7 w-auto dark:hidden"
						/>
						<img
							src="/brand/axioma-logo-dark.svg"
							alt=""
							width={120}
							height={27}
							className="hidden h-7 w-auto dark:block"
						/>
					</Link>
					<nav
						aria-label="Primary navigation"
						className="order-last ml-auto flex min-w-0 basis-full items-center justify-end gap-1 overflow-x-auto pt-1 pb-2 md:order-none md:basis-auto md:p-0"
					>
						<Link to="/home" className={navPill}>
							Home
						</Link>
						<Link to="/my-requests" className={navPill}>
							My requests
						</Link>
						<Link to="/connect-a-computer" className={navPill}>
							Connect a computer
						</Link>
						<Link to="/help-articles" className={navPill}>
							Help
						</Link>
					</nav>
					<div className="flex h-16 shrink-0 items-center gap-1 sm:h-20 sm:gap-2">
						<NotificationCenter />
						<ModeToggle />
						<UserMenu />
					</div>
				</div>
			</div>
		</header>
	);
}
