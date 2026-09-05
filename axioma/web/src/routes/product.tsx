import { createFileRoute, Link } from "@tanstack/react-router";
import { FeatureGrid } from "../components/feature-grid";
import { LimitsList } from "../components/limits-list";
import { ContactBand, PageIntro } from "../components/site";
import { facts } from "../content/facts";
import { coverage } from "../content/impact";
import { limits } from "../content/limits";
import { platformGroups } from "../content/platform";
import { pageMeta } from "../lib/seo";

const tools = [
	["knowledge_search", "Read", "—"],
	["knowledge_fetch", "Read", "—"],
	["ticket_read_messages", "Read", "—"],
	["cluster_read_pods", "Read", "—"],
	["cluster_read_deployment", "Read", "—"],
	["cluster_patch_image", "Write", "cluster_read_deployment"],
	["device_read_state", "Read", "—"],
	["device_run_action", "Write", "device_read_state"],
	["device_computer_use", "Write", "Refused by every device; not shipped"],
	["device_propose_command", "Proposal", "Named human approval"],
	["cmdb_record_observation", "Write", "API receipt"],
	["cmdb_impact", "Read", "—"],
] as const;

const rules = [
	["Knowledge first", "knowledge_search is always the first call."],
	[
		"One typed tool per turn",
		"Axel names one tool with typed parameters. Ticket text is fenced as data.",
	],
	[
		"Every write names its read",
		"The API stamps the read that verifies a write.",
	],
	[
		"An observation before closure",
		"cmdb_record_observation must succeed before resolve_ticket.",
	],
	[
		"Bounded",
		`${facts.maxToolCalls} tool calls, ${facts.maxModelTurns} model turns, and ${facts.runDeadlineSeconds} seconds. Terminal states are resolved, escalated, failed, or exhausted.`,
	],
] as const;

export const Route = createFileRoute("/product")({
	head: () =>
		pageMeta({
			title: "Product — the run, the tools, the limits — Axiōma",
			description:
				"Every run: knowledge first, one typed tool per turn, every write verified by a read, an observation before closure. Twelve tools, seventeen device actions, one cluster write.",
			path: "/product",
		}),
	component: ProductPage,
});

function ProductPage() {
	const actions = coverage
		.filter(
			(row) => row.facet !== "cluster" && !row.ticket.startsWith("Password"),
		)
		.flatMap((row) =>
			row.action.includes(",")
				? row.action.split(", ").map((action) => ({ ...row, action }))
				: row,
		);
	return (
		<>
			<PageIntro
				title="One loop, twelve tools, and a fixed list of things it may change."
				lede="Axel works inside a full service desk. The same ticket carries intake, evidence, typed action, verification, change history, and the final outcome."
			/>

			<section id="intake" className="shell">
				<div className="section-heading">
					<h2>Intake keeps the employee’s claim separate from the evidence</h2>
				</div>
				<div className="grid-3">
					<article>
						<h3>Portal</h3>
						<p>
							A streaming composer drafts the ticket, suggests articles, can
							read an optional screenshot, records field provenance, and lets
							the employee choose a device.
						</p>
					</article>
					<article>
						<h3>Email and messaging</h3>
						<p>
							Both create the same ticket record and retain their channel and
							thread.
						</p>
					</article>
					<article>
						<h3>ServiceNow co-existence</h3>
						<p>
							Your portal stays the front door. Axiōma posts results back as
							work notes. The ticket body is fenced and never selects a tool.
						</p>
					</article>
				</div>
			</section>

			<section id="run" className="shell">
				<div className="section-heading">
					<h2>Every run follows five rules</h2>
				</div>
				<ol className="sequence">
					{rules.map(([title, body]) => (
						<li key={title}>
							<h3>{title}</h3>
							<p>{body}</p>
						</li>
					))}
				</ol>
				<p>
					<Link className="button-secondary" to="/" hash="run">
						Watch a run
					</Link>
				</p>
			</section>

			<section id="tools" className="shell">
				<div className="section-heading">
					<h2>The twelve tools</h2>
					<p>
						Reads gather evidence. Writes declare the read that verifies them.
					</p>
				</div>
				<div className="coverage-scroll">
					<table className="coverage-table">
						<thead>
							<tr>
								<th scope="col">Tool</th>
								<th scope="col">Effect</th>
								<th scope="col">Verified by or disposition</th>
							</tr>
						</thead>
						<tbody>
							{tools.map(([name, effect, verified]) => (
								<tr key={name}>
									<td>
										<code>{name}</code>
									</td>
									<td>{effect}</td>
									<td>
										<code>{verified}</code>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<section id="actions" className="shell">
				<div className="section-heading">
					<h2>Seventeen device actions across eleven facets</h2>
					<p>
						The five <code>gui_*</code> actions drive Windows UI Automation by
						control name. They use no pixels and never move the cursor. A screen
						look is about 1,200 tokens on the demo stack and must be re-measured
						on yours.
					</p>
				</div>
				<div className="coverage-scroll">
					<table className="coverage-table">
						<thead>
							<tr>
								<th scope="col">Action</th>
								<th scope="col">Facet</th>
								<th scope="col">Verifying read</th>
							</tr>
						</thead>
						<tbody>
							{actions.map((row) => (
								<tr key={row.action}>
									<td>
										<code>{row.action}</code>
									</td>
									<td>
										<code>{row.facet}</code>
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

			<section id="governance" className="shell">
				<div className="section-heading">
					<h2>Governance is in the execution path</h2>
				</div>
				<div className="grid-3">
					<article>
						<h3>Change and provenance</h3>
						<p>
							Cluster writes create a change record with a rollback plan. CMDB
							observations carry ticket, run, step, and time.
						</p>
					</article>
					<article>
						<h3>Shadow and approval</h3>
						<p>
							Shadow mode refuses writes without telling the agent. Device
							proposals are digest-bound, single-use, expire undecided, require
							separation of duty, and run only on an operator-opted-in device.
						</p>
					</article>
					<article>
						<h3>Prompt-injection fence</h3>
						<p>
							Ticket text is data. It cannot select a tool, supply a command, or
							widen the available action set.
						</p>
					</article>
				</div>
			</section>

			<section id="platform" className="shell">
				<div className="section-heading">
					<h2>The service desk around the agent</h2>
				</div>
				<FeatureGrid groups={platformGroups} variant="index" />
			</section>

			<section id="deployment" className="shell">
				<div className="section-heading">
					<h2>One stack per customer</h2>
				</div>
				<div className="prose">
					<p>
						The Helm chart installs the API, agent, portal, dashboard, public
						web, and an optional pgvector-enabled PostgreSQL database inside
						your infrastructure.
					</p>
					<p>
						Bring an OpenAI-compatible model endpoint. Whether ticket text
						leaves your network is a value in the chart, not a residency
						guarantee. SSO and OIDC are supported.
					</p>
				</div>
			</section>

			<section id="roles" className="shell">
				<div className="section-heading">
					<h2>Three roles around one record</h2>
				</div>
				<div className="grid-3">
					<article>
						<h3>Employee</h3>
						<p>Opens the ticket, claims a device, and follows the outcome.</p>
					</article>
					<article>
						<h3>IT support</h3>
						<p>
							Reviews evidence, handles escalations, and owns human decisions.
						</p>
					</article>
					<article>
						<h3>Platform engineer</h3>
						<p>
							Registers environments, connectors, scopes, actions, and access.
						</p>
					</article>
				</div>
			</section>

			<section id="limits" className="shell">
				<div className="section-heading">
					<h2>What it does not do</h2>
				</div>
				<LimitsList limits={limits} />
			</section>
			<ContactBand secondary={false} />
		</>
	);
}
