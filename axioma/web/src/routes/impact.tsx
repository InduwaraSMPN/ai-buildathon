import { createFileRoute } from "@tanstack/react-router";
import { ImpactCalculator } from "@/components/impact-calculator";
import { ContactBand } from "@/components/site";
import { SourceRef, SourcesList } from "@/components/sources";
import { coverage, footnoteOrder, timeSplit } from "@/content/impact";
import { sources } from "@/content/research";
import { pageMeta } from "@/lib/seo";
import { createSourceIndex } from "@/lib/sources";

export const Route = createFileRoute("/impact")({
	head: () =>
		pageMeta({
			title: "Impact — where IT support time goes — Axiōma",
			description:
				"Third-party research on the cost and time of IT support, an editable estimate from published benchmarks, and the ticket classes Axel covers.",
			path: "/impact",
		}),
	component: ImpactPage,
});

function ImpactPage() {
	const index = createSourceIndex(footnoteOrder);
	function ref(id: string): number {
		return index.get(id) ?? 0;
	}

	return (
		<>
			<section className="page-intro shell">
				<h1>
					Where the time goes in IT support, and what a bounded agent can
					return.
				</h1>
				<div className="lede">
					<p>
						The figures on this page are third-party research and industry
						benchmarks. They describe the domain. They do not measure Axiōma.
					</p>
				</div>
			</section>

			<section id="domain" className="shell" aria-labelledby="domain-heading">
				<div className="section-heading">
					<h2 id="domain-heading">
						Support costs time on both sides of the ticket
					</h2>
				</div>
				<p>
					Time-diary studies record 42.7% to 43.7% of computer time lost to
					frustrating experiences, counting time to fix and time to recover lost
					work. <SourceRef id="R1" index={ref("R1")} /> A related study puts the
					range at 33% to 50% of computer time.{" "}
					<SourceRef id="R2" index={ref("R2")} />
				</p>
				<p>
					An industry survey of more than 2,000 employees finds 49% lose one to
					five hours a week to IT issues, and 23% lose six or more hours.{" "}
					<SourceRef id="R13" index={ref("R13")} /> Another industry survey
					records about 28 minutes lost per IT issue, about two issues a week,
					and about 50 hours a year, with about half of issues unreported.{" "}
					<SourceRef id="R14" index={ref("R14")} />
				</p>
				<p>
					An independent benchmark prices a ticket at about $22 at level one,
					about $70 for desktop support, and about $100 at level three, in North
					America in 2019 dollars. Self-help costs about $2 and vendor support
					about $600 on the same scale. <SourceRef id="R9" index={ref("R9")} />
				</p>
				<p>
					An industry survey of Kubernetes operations finds 79% of production
					issues stem from a recent change. Median time to detect is about 40
					minutes and median time to resolve a high-impact outage is over 50
					minutes. Over 60% of operations time is troubleshooting, and only 20%
					of incidents resolve without escalation.{" "}
					<SourceRef id="R17" index={ref("R17")} />
				</p>
				<p>
					Market research values ITSM software at about $13.5B in 2024 and
					forecasts about $29.9B by 2030, a 14.4% compound annual growth rate.{" "}
					<SourceRef id="R19" index={ref("R19")} />
				</p>
				<p>
					The employer cost of a US civilian worker is $48.78 per hour worked, a
					government statistic. <SourceRef id="R20" index={ref("R20")} />
				</p>
			</section>

			<section id="time" className="shell" aria-labelledby="time-heading">
				<div className="section-heading">
					<h2 id="time-heading">Most of the time goes after triage</h2>
				</div>
				<p>
					Across 20 online-service systems, 70.2% of time to mitigate is spent
					after the right team has the incident. Initial triage is 15.4% and
					reassignment is 14.4%. <SourceRef id="R5" index={ref("R5")} />
				</p>
				<div
					className="time-split-bar"
					role="img"
					aria-label="Share of time to mitigate: 70.2 percent after triage, 15.4 percent initial triage, 14.4 percent reassignment"
				>
					{timeSplit.map((part) => (
						<div
							key={part.label}
							className="time-split-segment"
							style={{ width: `${part.value}%` }}
						>
							<span>{part.value}%</span>
							<span>{part.label}</span>
						</div>
					))}
				</div>
				<ul className="sr-only">
					{timeSplit.map((part) => (
						<li key={part.label}>
							{part.label}: {part.value}%
						</li>
					))}
				</ul>
				<p>
					Reassignment is common, affecting 4.11% to 91.58% of incidents per
					system, and it raises triage time by up to 10.16×.{" "}
					<SourceRef id="R6" index={ref("R6")} />
				</p>
				<p>
					Customer-reported incidents take longest because reporters describe
					symptoms, not causes. <SourceRef id="R5" index={ref("R5")} />
				</p>
			</section>

			<section id="bounded" className="shell" aria-labelledby="bounded-heading">
				<div className="section-heading">
					<h2 id="bounded-heading">
						A bounded agent moves the numbers that an unbounded one harms
					</h2>
				</div>
				<p>
					AI assistance raised issues resolved per hour by 14% on average and
					34% for novices across 5,179 support agents.{" "}
					<SourceRef id="R3" index={ref("R3")} />
				</p>
				<p>
					LLM-based on-call root-cause analysis reached 76.6% root-cause
					accuracy on a year of production incidents.{" "}
					<SourceRef id="R8" index={ref("R8")} />
				</p>
				<p>
					An industry benchmark of more than 50,000 tickets records median
					resolution of 4.4 hours with heavy AI automation against 71 hours
					without. <SourceRef id="R12" index={ref("R12")} />
				</p>
				<p>
					Consultants with GPT-4 finished 12.2% more tasks 25.1% faster at over
					40% higher quality inside the frontier of the tool, but were 19
					percentage points less likely to be correct outside it.{" "}
					<SourceRef id="R4" index={ref("R4")} /> That gap is why the refusal
					path exists.
				</p>
				<p>
					Analysts forecast that agentic AI resolves 80% of common
					customer-service issues by 2029. That forecast covers customer
					service, not IT support, and the same analysts expect over 40% of
					agentic AI projects to be cancelled by 2027.{" "}
					<SourceRef id="R21" index={ref("R21")} />
				</p>
			</section>

			<section
				id="estimate"
				className="shell"
				aria-labelledby="estimate-heading"
			>
				<div className="section-heading">
					<h2 id="estimate-heading">An estimate from published benchmarks</h2>
				</div>
				<p>
					Change the inputs. The formula is printed with the outputs, and every
					default links to the benchmark it comes from.
				</p>
				<ImpactCalculator />
			</section>

			<section
				id="coverage"
				className="shell"
				aria-labelledby="coverage-heading"
			>
				<div className="section-heading">
					<h2 id="coverage-heading">The ticket classes Axel covers</h2>
				</div>
				<p>
					Each row names the facet that observes the fault, the typed action
					that changes it, and the verifying read that checks the result.
					Password and access issues are 20% to 50% of help-desk calls by
					analyst estimate. <SourceRef id="R11" index={ref("R11")} /> A password
					reset is not a typed action today, so the last row says so plainly.
				</p>
				<div className="coverage-scroll">
					<table className="coverage-table">
						<thead>
							<tr>
								<th scope="col">Ticket class</th>
								<th scope="col">Facet</th>
								<th scope="col">Action</th>
								<th scope="col">Verifying read</th>
							</tr>
						</thead>
						<tbody>
							{coverage.map((row) => (
								<tr key={row.ticket}>
									<td>{row.ticket}</td>
									<td>
										<code>{row.facet}</code>
									</td>
									<td>
										<code>{row.action}</code>
									</td>
									<td>
										<code>{row.verifyingRead}</code>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<section id="sources" className="shell" aria-labelledby="sources-heading">
				<div className="section-heading">
					<h2 id="sources-heading">Sources</h2>
				</div>
				<SourcesList ids={footnoteOrder} sources={sources} />
			</section>

			<ContactBand title="Start with the ticket class you want to close." />
		</>
	);
}
