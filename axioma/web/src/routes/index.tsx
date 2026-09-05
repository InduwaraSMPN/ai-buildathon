import { createFileRoute, Link } from "@tanstack/react-router";
import { FeatureGrid } from "../components/feature-grid";
import { LimitsList } from "../components/limits-list";
import { RunReplay } from "../components/run-replay";
import { ContactBand } from "../components/site";
import { SourceRef, SourcesList } from "../components/sources";
import { Transcript } from "../components/transcript";
import { facts } from "../content/facts";
import { limits } from "../content/limits";
import { platformGroups } from "../content/platform";
import { sources } from "../content/research";
import { checkoutFix, proxyLaptopFix, reportingRefusal } from "../content/runs";
import { PILOT_MAILTO } from "../content/site";
import { pageMeta } from "../lib/seo";
import { createSourceIndex } from "../lib/sources";

const homeSources = ["R9", "R14", "R5", "M1", "M2", "M3"];
const sourceIndex = createSourceIndex(homeSources);
const ref = (id: string) => sourceIndex.get(id) ?? 0;

const runRules = [
	[
		"Knowledge first",
		"knowledge_search is always the first call. It combines lexical and vector retrieval.",
	],
	[
		"One typed tool per turn",
		"Axel names one tool and supplies typed parameters. It cannot compose a command. Ticket text is fenced as data.",
	],
	[
		"Every write names its read",
		"A write returning OK means the call was accepted. The verifying read is stamped by the API, not claimed by the model.",
	],
	[
		"An observation before closure",
		"cmdb_record_observation must succeed before resolve_ticket is accepted.",
	],
	[
		"Bounded",
		`${facts.maxToolCalls} tool calls, ${facts.maxModelTurns} model turns, ${facts.runDeadlineSeconds} seconds. A run ends resolved, escalated, failed, or exhausted.`,
	],
] as const;

export const Route = createFileRoute("/")({
	head: () =>
		pageMeta({
			title: "Axiōma — IT support that verifies its own fixes",
			description:
				"Axiōma is an IT service management platform with an agent inside it. Axel fixes the ticket, verifies the fix, or escalates with the evidence.",
			path: "/",
		}),
	component: HomePage,
});

function HomePage() {
	return (
		<>
			<section className="hero shell">
				<h1>
					<span className="hero-line">Fixes the ticket.</span>{" "}
					<span className="hero-line">Refuses the wrong fix.</span>{" "}
					<span className="hero-line">Shows its work.</span>
				</h1>
				<div className="hero-side">
					<p className="hero-lede">
						Axiōma is an IT service management platform with an agent inside it.
						Axel reads the ticket, gathers evidence, applies a typed fix where
						one exists, and reads the state back before it closes anything. When
						the fix is a policy decision, it escalates with a diagnosis instead.
					</p>
					<div className="hero-actions">
						<a className="button" href={PILOT_MAILTO}>
							Start a shadow-mode pilot
						</a>
						<Link className="button-secondary" to="/product">
							See the tools and limits
						</Link>
					</div>
				</div>
				<div className="hero-run">
					<RunReplay
						id="run"
						left={checkoutFix}
						right={reportingRefusal}
						caption={
							<>
								One fix and one refusal, side by side, on the demo stack. Tool
								names and evidence are the real ones; reasoning is shortened.
								Timings are measured on the demo stack and should be re-measured
								on yours. <SourceRef id="M1" index={ref("M1")} />{" "}
								<SourceRef id="M2" index={ref("M2")} />
							</>
						}
					/>
				</div>
			</section>

			<section className="shell" aria-labelledby="cost-heading">
				<div className="section-heading">
					<h2 id="cost-heading">What one ticket costs today</h2>
				</div>
				<div className="grid-3 facts-grid">
					<article>
						<strong>$22 → $70 → $100</strong>
						<p>
							Cost per ticket from level one through desktop support to level
							three, in North America in 2019 dollars.{" "}
							<SourceRef id="R9" index={ref("R9")} />
						</p>
					</article>
					<article>
						<strong>28 minutes</strong>
						<p>
							Employee time lost per IT issue in an industry survey.{" "}
							<SourceRef id="R14" index={ref("R14")} />
						</p>
					</article>
					<article>
						<strong>70.2%</strong>
						<p>
							Incident time spent diagnosing and mitigating after the right team
							has it, in a peer-reviewed study.{" "}
							<SourceRef id="R5" index={ref("R5")} />
						</p>
					</article>
				</div>
				<p>
					<Link className="inline-link" to="/impact">
						Read the research
					</Link>
				</p>
			</section>

			<section className="shell" aria-labelledby="rules-heading">
				<div className="section-heading">
					<h2 id="rules-heading">Every run follows the same five rules</h2>
				</div>
				<ol className="sequence">
					{runRules.map(([title, body]) => (
						<li key={title}>
							<h3>{title}</h3>
							<p>{body}</p>
						</li>
					))}
				</ol>
			</section>

			<section className="shell" aria-labelledby="laptop-heading">
				<div className="section-heading">
					<h2 id="laptop-heading">
						The same loop reaches the employee’s laptop
					</h2>
					<p>
						<code>axel-cli</code> runs typed actions only. It does not reason,
						connects outbound, runs non-admin, and is claimed by the employee
						with a code.
					</p>
				</div>
				<Transcript
					run={proxyLaptopFix}
					frame={proxyLaptopFix.steps.length}
					headingLevel={3}
				/>
				<p className="meta">
					Typed actions only, and no remote session.{" "}
					<SourceRef id="M3" index={ref("M3")} />
				</p>
			</section>

			<section className="shell" aria-labelledby="changes-heading">
				<div className="section-heading">
					<h2 id="changes-heading">What Axel may change is a short list</h2>
				</div>
				<div className="scope-grid grid-3">
					<article>
						<span className="state" data-tone="ok">
							Typed action
						</span>
						<h3>Cluster</h3>
						<p>
							One field: an image tag or digest. A dry-run comes first. Apply
							creates a standard change record with a rollback plan and a
							five-minute verification deadline.
						</p>
					</article>
					<article>
						<span className="state" data-tone="ok">
							Typed action
						</span>
						<h3>Laptop</h3>
						<p>
							Seventeen typed actions. Each is paired with the facet that
							observes its result.
						</p>
					</article>
					<article>
						<span className="state" data-tone="warn">
							Proposal
						</span>
						<h3>Anything else</h3>
						<p>
							Axel proposes it for a named person. The approver cannot be the
							person who started the run. Axel holds no credentials; the API
							executes every side effect.
						</p>
					</article>
				</div>
			</section>

			<section className="shell" aria-labelledby="platform-heading">
				<div className="section-heading">
					<h2 id="platform-heading">
						The service desk around the agent is a full one
					</h2>
				</div>
				<FeatureGrid groups={platformGroups} limit={6} />
				<p>
					<Link className="inline-link" to="/product" hash="platform">
						See the full platform
					</Link>
				</p>
			</section>

			<section className="shell" aria-labelledby="limits-heading">
				<div className="section-heading">
					<h2 id="limits-heading">What it does not do</h2>
				</div>
				<LimitsList limits={limits} />
			</section>
			<section
				className="shell sources-compact"
				aria-labelledby="home-sources-heading"
			>
				<div className="section-heading">
					<h2 id="home-sources-heading">Sources</h2>
				</div>
				<SourcesList ids={homeSources} sources={sources} />
			</section>
			<ContactBand />
		</>
	);
}
