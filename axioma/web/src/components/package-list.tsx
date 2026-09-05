import { Link } from "@tanstack/react-router";
import type { Package } from "../content/packages";

export function PackageList({ packages }: { packages: Package[] }) {
	return (
		<div className="package-grid">
			{packages.map((pkg) => (
				<article key={pkg.id}>
					<span className="mode-chip">{pkg.mode}</span>
					<h3>{pkg.name}</h3>
					<p>{pkg.body}</p>
					<ul>
						{pkg.includes.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
					<Link className="button" to={pkg.ctaTo}>
						{pkg.ctaLabel}
					</Link>
				</article>
			))}
		</div>
	);
}
