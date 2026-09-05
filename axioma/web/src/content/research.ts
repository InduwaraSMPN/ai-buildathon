// Research basis: third-party benchmarks plus measured demo-stack timings.

export type SourceGrade =
	| "peer-reviewed"
	| "independent-benchmark"
	| "independent-survey"
	| "vendor-benchmark"
	| "vendor-survey"
	| "vendor-telemetry"
	| "analyst-estimate"
	| "analyst-forecast"
	| "government"
	| "market"
	| "industry-reference"
	| "measured";

export interface Source {
	id: string;
	title: string;
	publisher: string;
	year: number | string;
	url: string;
	grade: SourceGrade;
	figures: string[];
	note?: string;
}

export const sources: Source[] = [
	{
		id: "R1",
		title: "Workplace user frustration with computers: causes and severity",
		publisher: "Behaviour & Information Technology",
		year: 2006,
		url: "https://www.tandfonline.com/journals/tbit20",
		grade: "peer-reviewed",
		figures: ["42.7%", "43.7%", "50-user"],
		note: "Lazar, Jones & Shneiderman (2006), 25(3). 50-user time-diary study; time to fix + time to recover lost work.",
	},
	{
		id: "R2",
		title: "Determining causes and severity of end-user frustration",
		publisher: "International Journal of Human-Computer Interaction",
		year: 2004,
		url: "https://www.tandfonline.com/journals/hihc20",
		grade: "peer-reviewed",
		figures: ["33%", "50%"],
		note: "Ceaparu, Lazar, Bessiere, Robinson & Shneiderman (2004).",
	},
	{
		id: "R3",
		title: "Generative AI at Work",
		publisher: "The Quarterly Journal of Economics",
		year: 2025,
		url: "https://www.nber.org/papers/w31161",
		grade: "peer-reviewed",
		figures: ["+14%", "+34%", "5,179"],
		note: "Brynjolfsson, Li & Raymond, QJE 140(2), 2025 (NBER w31161). 5,179 agents; issues resolved per hour.",
	},
	{
		id: "R4",
		title: "Navigating the Jagged Technological Frontier",
		publisher: "Organization Science",
		year: 2025,
		url: "https://pubsonline.informs.org/journal/orsc",
		grade: "peer-reviewed",
		figures: ["12.2%", "25.1%", ">40%", "−19 pp"],
		note: "Dell'Acqua et al., Organization Science (2025); HBS WP 24-013. −19 percentage points on tasks outside the AI frontier.",
	},
	{
		id: "R5",
		title:
			"How Long Will it Take to Mitigate this Incident for Online Service Systems?",
		publisher: "ISSRE",
		year: 2021,
		url: "https://ieeexplore.ieee.org",
		grade: "peer-reviewed",
		figures: ["70.20%", "70.2%", "15.42%", "15.4%", "14.38%", "14.4%", "20"],
		note: "Wang et al., ISSRE 2021. 20 Microsoft online-service systems, 2017–2020; customer-reported incidents take longest.",
	},
	{
		id: "R6",
		title:
			"An Empirical Investigation of Incident Triage for Online Service Systems",
		publisher: "ICSE-SEIP",
		year: 2019,
		url: "https://ieeexplore.ieee.org",
		grade: "peer-reviewed",
		figures: ["4.11%", "91.58%", "10.16×"],
		note: "Chen et al., ICSE-SEIP 2019. Reassignment raises triage time by up to 10.16×.",
	},
	{
		id: "R7",
		title:
			"Recommending Root-Cause and Mitigation Steps for Cloud Incidents using LLMs",
		publisher: "ICSE",
		year: 2023,
		url: "https://conf.researchr.org/home/icse-2023",
		grade: "peer-reviewed",
		figures: ["40,000+"],
		note: "Ahmed et al., ICSE 2023. 40,000+ Microsoft production incidents; owners rated recommendations useful.",
	},
	{
		id: "R8",
		title: "Automatic Root Cause Analysis via LLMs for Cloud Incidents",
		publisher: "EuroSys",
		year: 2024,
		url: "https://www.eurosys.org/events/eurosys-2024/",
		grade: "peer-reviewed",
		figures: ["76.6%"],
		note: "Chen et al., EuroSys 2024. Root-cause accuracy on a year of Microsoft incidents.",
	},
	{
		id: "R9",
		title: "Metrics Unleashed: Shift-Left / Cost per Ticket",
		publisher: "MetricNet; HDI",
		year: "2020 / 2011",
		url: "https://www.metricnet.com/it-service-and-support-benchmarking/",
		grade: "independent-benchmark",
		figures: ["$2", "$22", "$70", "$100", "$220", "$600", "$62", "$27", "$490"],
		note: "North America, 2019 dollars. Self-help ≈$2, level-1 ≈$22, desktop ≈$70, level-3 ≈$100, field ≈$220, vendor ≈$600; desktop average $62 (range $27–$490) in 2010.",
	},
	{
		id: "R10",
		title: "Metric of the Month: Tickets per User per Month",
		publisher: "HDI",
		year: 2012,
		url: "https://www.thinkhdi.com/",
		grade: "independent-benchmark",
		figures: ["0.41", "1.14", "5.4", "28.4", "1,000"],
		note: "Rumburg, HDI (2012). 0.41 (healthcare) to 1.14 (business services) tickets per seat per month; 5.4–28.4 technicians per 1,000 seats.",
	},
	{
		id: "R11",
		title:
			"Password and access share of help-desk calls; cost of a password reset",
		publisher: "Gartner; Forrester",
		year: "n.d.",
		url: "https://www.gartner.com",
		grade: "analyst-estimate",
		figures: ["20%", "50%", "$70"],
		note: "Widely cited; originals paywalled. Password/access issues are 20–50% of help-desk calls (Gartner); one reset ≈$70 fully loaded (Forrester).",
	},
	{
		id: "R12",
		title: "2026 IT Help Desk Benchmark Report",
		publisher: "Fixify",
		year: 2026,
		url: "https://www.fixify.com/",
		grade: "vendor-benchmark",
		figures: [
			"4.4 h",
			"71 h",
			"22%",
			"15.9%",
			"16.6%",
			"2.4%",
			"8.4%",
			"1.6",
			"100",
			"50,000+",
			"30+",
		],
		note: "Mar 2026. 50,000+ tickets, 30+ orgs, Jan 2025–Feb 2026. Say industry benchmark, never study.",
	},
	{
		id: "R13",
		title: "From Surviving to Thriving in Hybrid Work",
		publisher: "Unisys; HFS Research",
		year: 2023,
		url: "https://www.unisys.com/",
		grade: "vendor-survey",
		figures: ["49%", "23%", "2,000+"],
		note: "Mar 2023. 2,000+ respondents, US/UK/DE/AU. Say industry survey, never study.",
	},
	{
		id: "R14",
		title: "Digital employee experience: time lost per IT issue",
		publisher: "Nexthink; Vanson Bourne",
		year: "2020 / 2025",
		url: "https://www.nexthink.com/",
		grade: "vendor-survey",
		figures: ["28 min", "2", "50 h/yr", "50 hours", "14", "20M", "474"],
		note: "Vendor survey + telemetry. ≈28 minutes lost per IT issue, ≈2 issues a week, ≈50 hours a year; about half unreported. 2025 telemetry: 14 negative experiences per employee per week (20M endpoints, 474 firms).",
	},
	{
		id: "R15",
		title: "2024 Hourly Cost of Downtime",
		publisher: "ITIC",
		year: 2024,
		url: "https://itic-corp.com/",
		grade: "independent-survey",
		figures: [">$300,000", "90%", "41%", "$1M", "$5M+", "1,000+"],
		note: "1,000+ firms. One hour of downtime costs >$300,000 for over 90% of mid-size and large enterprises.",
	},
	{
		id: "R16",
		title: "Annual Outage Analysis 2025",
		publisher: "Uptime Institute",
		year: 2025,
		url: "https://uptimeinstitute.com/",
		grade: "independent-survey",
		figures: ["54%", "20%", ">$100,000", ">$1M"],
		note: "54% of significant outages cost >$100,000; ~20% cost >$1M.",
	},
	{
		id: "R17",
		title: "2025 Enterprise Kubernetes Report",
		publisher: "Komodor",
		year: 2025,
		url: "https://komodor.com/",
		grade: "vendor-survey",
		figures: ["79%", "40 min", "50 min", ">60%", "20%"],
		note: "Sep 2025. Say industry survey, never study. Only 20% of incidents resolve without escalation.",
	},
	{
		id: "R18",
		title: "Site Reliability Engineering: How Google Runs Production Systems",
		publisher: "Google",
		year: "2016 / 2018",
		url: "https://sre.google/books/",
		grade: "industry-reference",
		figures: ["<50%", "33%"],
		note: "SRE book and workbook. Toil kept under 50% of engineer time; measured average ≈33%.",
	},
	{
		id: "R19",
		title: "ITSM software market size and forecast",
		publisher: "Grand View Research; Mordor Intelligence",
		year: "2024 / 2025",
		url: "https://www.grandviewresearch.com/",
		grade: "market",
		figures: ["$13.5B", "$29.9B", "14.4%", "$12.8B", "$27.8B"],
		note: "Grand View: ≈$13.5B (2024) → ≈$29.9B (2030), 14.4% CAGR; Mordor: $12.8B (2025) → $27.8B (2030).",
	},
	{
		id: "R20",
		title:
			"Employer Costs for Employee Compensation; Occupational Outlook Handbook: Computer User Support Specialists",
		publisher: "US Bureau of Labor Statistics",
		year: 2025,
		url: "https://www.bls.gov/",
		grade: "government",
		figures: ["$48.78", "$61,860/yr", "48,700"],
		note: "$48.78 per hour worked (Dec 2025, ECEC); median $61,860/yr (May 2025, OOH), ~48,700 openings a year.",
	},
	{
		id: "R21",
		title: "Agentic AI forecasts for customer service and project outcomes",
		publisher: "Gartner",
		year: 2025,
		url: "https://www.gartner.com/en/newsroom/press-releases",
		grade: "analyst-forecast",
		figures: ["80%", "30%", ">40%"],
		note: "Customer service, not IT. 80% of common customer-service issues resolved by agentic AI by 2029, cutting operational cost 30% (Mar 2025); >40% of agentic AI projects cancelled by 2027 (Jun 2025). Use only as analysts-expect context or not at all.",
	},
	{
		id: "M1",
		title: "Checkout fix on the demo stack",
		publisher: "Axiōma (demo stack)",
		year: 2026,
		url: "https://axioma.dev",
		grade: "measured",
		figures: ["30 s", "8 tool calls"],
		note: "Measured on the demo stack; re-measure on yours. Source: context/plans/demo-plan.md, context/idea/idea.md.",
	},
	{
		id: "M2",
		title: "Reporting refusal on the demo stack",
		publisher: "Axiōma (demo stack)",
		year: 2026,
		url: "https://axioma.dev",
		grade: "measured",
		figures: ["20 s"],
		note: "Measured on the demo stack; re-measure on yours. Source: context/plans/demo-plan.md, context/idea/idea.md.",
	},
	{
		id: "M3",
		title:
			"Proxy laptop fix with UI Automation look and screen facet on the demo stack",
		publisher: "Axiōma (demo stack)",
		year: 2026,
		url: "https://axioma.dev",
		grade: "measured",
		figures: ["57 s", "8 tool calls", "1,200 tokens", "3.6 s", "2.9 KB"],
		note: "Measured on the demo stack; re-measure on yours. Proxy laptop fix 57 s / 8 tool calls; UI Automation look ≈1,200 tokens; screen facet 3.6 s / 2.9 KB. Source: context/plans/demo-plan.md, context/idea/idea.md.",
	},
];
