/**
 * Shared deterministic seed constants.
 *
 * Idempotency rules:
 * - Every demo row uses a fixed id (e.g. demo-user-eng-01) defined here — never crypto.randomUUID() for stable rows.
 * - Inserts use .onConflictDoNothing() keyed on that id (or natural key like ticketNumber).
 * - Timestamps are computed relative to SEED_EPOCH, never new Date() at insert time for backdated content.
 */

// ---------------------------------------------------------------------------
// Epoch + helpers
// ---------------------------------------------------------------------------

export const SEED_EPOCH = new Date("2026-08-01T00:00:00Z");

export function daysFromEpoch(days: number, hours = 9): Date {
	const d = new Date(SEED_EPOCH);
	d.setUTCDate(d.getUTCDate() + days);
	d.setUTCHours(hours, 0, 0, 0);
	return d;
}

export function hoursFromEpoch(hours: number): Date {
	return new Date(SEED_EPOCH.getTime() + hours * 3600_000);
}

/**
 * The two login-capable accounts are created by signing up through the UI, not
 * by this seed — it only references them so the demo has a staff assignee and a
 * portal reporter with visible requests. Their addresses are personal, so they
 * live in `.env` (gitignored) rather than in committed source.
 *
 * Set in axioma/api/.env:
 *   SEED_ADMIN_EMAIL=<the dashboard account>
 *   SEED_REPORTER_EMAIL=<the portal account>
 *
 * Unset is safe: the seed falls back to demo identities, so the dashboard still
 * populates and only the portal's "My requests" is left empty.
 */
export const REAL_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? null;
export const REAL_REPORTER_EMAIL = process.env.SEED_REPORTER_EMAIL ?? null;

// ---------------------------------------------------------------------------
// Departments / Teams
// ---------------------------------------------------------------------------

export const DEPARTMENTS = [
	{ id: "demo-dept-eng", name: "Engineering" },
	{ id: "demo-dept-sales", name: "Sales" },
	{ id: "demo-dept-finance", name: "Finance" },
	{ id: "demo-dept-it", name: "IT" },
] as const;

export const TEAMS = [
	{ id: "demo-team-platform", name: "Platform Engineering" },
	{ id: "demo-team-helpdesk", name: "Helpdesk" },
	{ id: "demo-team-sales-ops", name: "Sales Operations" },
	{ id: "demo-team-finance-ops", name: "Finance Operations" },
] as const;

export const DEPARTMENT_TEAMS: ReadonlyArray<{
	departmentId: string;
	teamId: string;
}> = [
	{ departmentId: "demo-dept-it", teamId: "demo-team-platform" },
	{ departmentId: "demo-dept-it", teamId: "demo-team-helpdesk" },
	{ departmentId: "demo-dept-sales", teamId: "demo-team-sales-ops" },
	{ departmentId: "demo-dept-finance", teamId: "demo-team-finance-ops" },
];

// ---------------------------------------------------------------------------
// Users — 13 demo users: 4 staff (1 platform-engineer + 3 it-analyst), 9 reporters
// ---------------------------------------------------------------------------

export type DemoUserDef = {
	id: string;
	name: string;
	email: string;
	kind: "staff" | "reporter";
	jobTitle: string;
	managerId?: string | null;
	departmentId?: string;
	teamId?: string;
};

export const DEMO_USERS: DemoUserDef[] = [
	// Staff — IT department
	{
		id: "demo-user-platform-01",
		name: "Alex Morgan",
		email: "alex.morgan@axioma.demo",
		kind: "staff",
		jobTitle: "Platform Engineer",
		departmentId: "demo-dept-it",
		teamId: "demo-team-platform",
	},
	{
		id: "demo-user-analyst-01",
		name: "Jamie Chen",
		email: "jamie.chen@axioma.demo",
		kind: "staff",
		jobTitle: "IT Analyst",
		departmentId: "demo-dept-it",
		teamId: "demo-team-helpdesk",
	},
	{
		id: "demo-user-analyst-02",
		name: "Priya Patel",
		email: "priya.patel@axioma.demo",
		kind: "staff",
		jobTitle: "IT Analyst",
		departmentId: "demo-dept-it",
		teamId: "demo-team-helpdesk",
	},
	{
		id: "demo-user-analyst-03",
		name: "Marcus Okafor",
		email: "marcus.okafor@axioma.demo",
		kind: "staff",
		jobTitle: "IT Analyst",
		departmentId: "demo-dept-it",
		teamId: "demo-team-platform",
	},
	// Reporters — Engineering (manager: demo-user-eng-01)
	{
		id: "demo-user-eng-01",
		name: "Elena Rodriguez",
		email: "elena.rodriguez@axioma.demo",
		kind: "reporter",
		jobTitle: "Engineering Manager",
		departmentId: "demo-dept-eng",
		teamId: "demo-team-platform",
	},
	{
		id: "demo-user-eng-02",
		name: "David Kim",
		email: "david.kim@axioma.demo",
		kind: "reporter",
		jobTitle: "Senior Engineer",
		departmentId: "demo-dept-eng",
		managerId: "demo-user-eng-01",
	},
	{
		id: "demo-user-eng-03",
		name: "Sofia Andersson",
		email: "sofia.andersson@axioma.demo",
		kind: "reporter",
		jobTitle: "Software Engineer",
		departmentId: "demo-dept-eng",
		managerId: "demo-user-eng-01",
	},
	// Reporters — Sales (manager: demo-user-sales-01)
	{
		id: "demo-user-sales-01",
		name: "Carlos Mendez",
		email: "carlos.mendez@axioma.demo",
		kind: "reporter",
		jobTitle: "Sales Manager",
		departmentId: "demo-dept-sales",
		teamId: "demo-team-sales-ops",
	},
	{
		id: "demo-user-sales-02",
		name: "Aisha Johnson",
		email: "aisha.johnson@axioma.demo",
		kind: "reporter",
		jobTitle: "Account Executive",
		departmentId: "demo-dept-sales",
		managerId: "demo-user-sales-01",
	},
	{
		id: "demo-user-sales-03",
		name: "Ryan Thompson",
		email: "ryan.thompson@axioma.demo",
		kind: "reporter",
		jobTitle: "Sales Representative",
		departmentId: "demo-dept-sales",
		managerId: "demo-user-sales-01",
	},
	// Reporters — Finance (manager: demo-user-finance-01)
	{
		id: "demo-user-finance-01",
		name: "Jennifer Walsh",
		email: "jennifer.walsh@axioma.demo",
		kind: "reporter",
		jobTitle: "Finance Manager",
		departmentId: "demo-dept-finance",
		teamId: "demo-team-finance-ops",
	},
	{
		id: "demo-user-finance-02",
		name: "Michael Brown",
		email: "michael.brown@axioma.demo",
		kind: "reporter",
		jobTitle: "Financial Analyst",
		departmentId: "demo-dept-finance",
		managerId: "demo-user-finance-01",
	},
	{
		id: "demo-user-finance-03",
		name: "Lisa Zhang",
		email: "lisa.zhang@axioma.demo",
		kind: "reporter",
		jobTitle: "Accountant",
		departmentId: "demo-dept-finance",
		managerId: "demo-user-finance-01",
	},
];

export const STAFF_USER_IDS = DEMO_USERS.filter((u) => u.kind === "staff").map(
	(u) => u.id,
);
export const REPORTER_USER_IDS = DEMO_USERS.filter(
	(u) => u.kind === "reporter",
).map((u) => u.id);

// ---------------------------------------------------------------------------
// CMDB
// ---------------------------------------------------------------------------

export const CMDB_OBJECTS = [
	{
		id: "demo-cmdb-01",
		classKey: "Server",
		externalId: "srv-prod-api-01",
		name: "prod-api-01",
	},
	{
		id: "demo-cmdb-02",
		classKey: "Server",
		externalId: "srv-prod-db-01",
		name: "prod-db-01",
	},
	{
		id: "demo-cmdb-03",
		classKey: "NetworkDevice",
		externalId: "sw-core-01",
		name: "core-switch-01",
	},
	{
		id: "demo-cmdb-04",
		classKey: "NetworkDevice",
		externalId: "fw-edge-01",
		name: "edge-firewall-01",
	},
	{
		id: "demo-cmdb-05",
		classKey: "ApplicationSolution",
		externalId: "app-axioma-portal",
		name: "Axioma Portal",
	},
	{
		id: "demo-cmdb-06",
		classKey: "ApplicationSolution",
		externalId: "app-axioma-api",
		name: "Axioma API",
	},
	{
		id: "demo-cmdb-07",
		classKey: "PC",
		externalId: "pc-sales-042",
		name: "SALES-LT-042",
	},
	{
		id: "demo-cmdb-08",
		classKey: "SoftwareInstance",
		externalId: "si-postgres-prod",
		name: "PostgreSQL prod instance",
	},
] as const;

export const CMDB_RELATIONSHIPS: ReadonlyArray<{
	id: string;
	typeKey: string;
	sourceId: string;
	targetId: string;
}> = [
	{
		id: "demo-cmdb-rel-01",
		typeKey: "runs_on",
		sourceId: "demo-cmdb-06",
		targetId: "demo-cmdb-01",
	},
	{
		id: "demo-cmdb-rel-02",
		typeKey: "runs_on",
		sourceId: "demo-cmdb-08",
		targetId: "demo-cmdb-02",
	},
	{
		id: "demo-cmdb-rel-03",
		typeKey: "depends_on",
		sourceId: "demo-cmdb-05",
		targetId: "demo-cmdb-06",
	},
	{
		id: "demo-cmdb-rel-04",
		typeKey: "connects_to",
		sourceId: "demo-cmdb-01",
		targetId: "demo-cmdb-03",
	},
	{
		id: "demo-cmdb-rel-05",
		typeKey: "connects_to",
		sourceId: "demo-cmdb-02",
		targetId: "demo-cmdb-03",
	},
	{
		id: "demo-cmdb-rel-06",
		typeKey: "depends_on",
		sourceId: "demo-cmdb-06",
		targetId: "demo-cmdb-08",
	},
];

// ---------------------------------------------------------------------------
// Asset statuses (not in baseline)
// ---------------------------------------------------------------------------

export const ASSET_STATUSES = [
	{ id: "demo-asset-status-active", name: "Active" },
	{ id: "demo-asset-status-repair", name: "In Repair" },
	{ id: "demo-asset-status-retired", name: "Retired" },
] as const;

export const ASSET_NAMES = [
	"MacBook Pro 16-inch (M3 Max)",
	"Dell XPS 15 9530",
	"Lenovo ThinkPad X1 Carbon",
	"HP EliteBook 840 G10",
	"MacBook Air 15-inch (M2)",
	"Dell Latitude 7440",
	"ThinkPad X1 Nano",
	"Mac Mini (M2 Pro)",
	"Dell UltraSharp 32 4K Monitor",
	"LG UltraWide 34WN80C-B",
	"Dell UltraSharp 27 4K Monitor",
	"Samsung Curved 32-inch Monitor",
	"iPhone 15 Pro",
	"iPhone 14",
	"Samsung Galaxy S24 Ultra",
	"Google Pixel 8 Pro",
	"iPad Pro 12.9-inch",
	"Surface Pro 9",
	"Cisco Meraki MR46 AP",
	"Ubiquiti Dream Machine Pro",
	"HP LaserJet Enterprise M607",
	"Epson WorkForce Pro WF-C5790",
	"Jabra Evolve2 85 Headset",
	"Logitech MX Master 3S",
	"Keychron K3 Pro Keyboard",
	"Dell Thunderbolt Dock WD22TB4",
	"Anker PowerConf S3 Speakerphone",
	"Poly Studio P15 Video Bar",
	"Apple Studio Display",
	"Lenovo ThinkCentre M90q Tiny",
] as const;

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

export const KNOWLEDGE_FOLDERS = [
	{
		id: "demo-kb-folder-01",
		name: "Getting Started",
		description: "New hire onboarding and first-day guides",
		parentId: null as string | null,
	},
	{
		id: "demo-kb-folder-02",
		name: "IT Support",
		description: "Troubleshooting and how-to guides",
		parentId: null,
	},
	{
		id: "demo-kb-folder-03",
		name: "Security & Compliance",
		description: "Security policies and compliance procedures",
		parentId: null,
	},
	{
		id: "demo-kb-folder-04",
		name: "VPN & Remote Access",
		description: "VPN setup and remote access troubleshooting",
		parentId: "demo-kb-folder-02",
	},
] as const;

export const KNOWLEDGE_TAGS = [
	{ id: "demo-tag-01", name: "vpn" },
	{ id: "demo-tag-02", name: "onboarding" },
	{ id: "demo-tag-03", name: "security" },
	{ id: "demo-tag-04", name: "email" },
	{ id: "demo-tag-05", name: "hardware" },
	{ id: "demo-tag-06", name: "troubleshooting" },
] as const;

export type KnowledgeArticleDef = {
	id: string;
	folderId: string | null;
	title: string;
	body: string;
	summary: string;
	status: "draft" | "published" | "archived";
	audience: "public" | "employees" | "staff";
	isRestricted: boolean;
	tags: string[];
};

// 18 articles: 4 draft, 14 published
export const KNOWLEDGE_ARTICLES: KnowledgeArticleDef[] = [
	{
		id: "demo-kb-article-01",
		folderId: "demo-kb-folder-04",
		title: "How to reset your VPN client",
		body: "If your VPN keeps disconnecting, follow these steps:\n\n1. Quit the VPN client completely\n2. Clear cached credentials from Keychain / Credential Manager\n3. Restart the client and re-authenticate with SSO\n4. If the issue persists, check that your device certificate is valid under Settings > Profiles\n\nFor split-tunnel issues, verify your routing table with `netstat -rn` and ensure 10.0.0.0/8 is routed via utun.",
		summary: "Step-by-step VPN reset procedure for all platforms",
		status: "published",
		audience: "public",
		isRestricted: false,
		tags: ["demo-tag-01", "demo-tag-06"],
	},
	{
		id: "demo-kb-article-02",
		folderId: "demo-kb-folder-01",
		title: "Onboarding checklist for new hires",
		body: "Welcome to Axioma! Complete these tasks in your first week:\n\n- [ ] Accept invite and set up SSO\n- [ ] Enroll your laptop via the Device Enrolment portal\n- [ ] Request access to Salesforce, Jira, and Slack via the Service Catalogue\n- [ ] Complete security awareness training (assigned in LMS)\n- [ ] Schedule 1:1 with your manager\n- [ ] Join #new-hires and #general on Slack\n\nEstimated time: 2 hours. Contact IT Helpdesk if blocked.",
		summary: "Complete onboarding in your first week",
		status: "published",
		audience: "public",
		isRestricted: false,
		tags: ["demo-tag-02"],
	},
	{
		id: "demo-kb-article-03",
		folderId: "demo-kb-folder-02",
		title: "Troubleshooting email delivery delays",
		body: "If outbound email is delayed:\n\n- Check the mail queue in the dashboard (Mail Log > Send Log)\n- Verify the recipient domain is not on the suppression list\n- Confirm SPF/DKIM alignment via the Email Templates diagnostic\n- For delays >30 minutes, escalate to Platform Engineering with the provider message ID",
		summary: "Diagnose and resolve email delivery delays",
		status: "published",
		audience: "staff",
		isRestricted: false,
		tags: ["demo-tag-04", "demo-tag-06"],
	},
	{
		id: "demo-kb-article-04",
		folderId: "demo-kb-folder-03",
		title: "MFA enrolment guide",
		body: "Multi-factor authentication is mandatory for all staff accounts.\n\n1. Install Microsoft Authenticator or equivalent\n2. Visit https://auth.axioma.demo/mfa-setup\n3. Scan the QR code and verify with a 6-digit code\n4. Save recovery codes in your password manager\n\nEnrolment must be completed within 24 hours of account creation.",
		summary: "Set up MFA for your Axioma account",
		status: "published",
		audience: "public",
		isRestricted: false,
		tags: ["demo-tag-03"],
	},
	{
		id: "demo-kb-article-05",
		folderId: "demo-kb-folder-02",
		title: "How to request a new laptop",
		body: "Submit via the Service Catalogue > Hardware Request form:\n\n- Select preferred model (MacBook Pro, Dell XPS, ThinkPad)\n- Justify business need\n- Manager approval is required for orders >€1500\n- Standard fulfilment: 5 business days\n\nFor urgent replacements, contact the Helpdesk directly.",
		summary: "Order new hardware through the catalogue",
		status: "published",
		audience: "public",
		isRestricted: false,
		tags: ["demo-tag-05"],
	},
	{
		id: "demo-kb-article-06",
		folderId: "demo-kb-folder-03",
		title: "Password policy and rotation schedule",
		body: "Passwords must be:\n\n- At least 14 characters\n- Rotated every 90 days\n- Unique (not reused across systems)\n- Stored in the approved password manager\n\nSSO-linked services inherit IdP policy — no separate rotation needed.",
		summary: "Current password requirements and schedule",
		status: "published",
		audience: "employees",
		isRestricted: false,
		tags: ["demo-tag-03"],
	},
	{
		id: "demo-kb-article-07",
		folderId: "demo-kb-folder-02",
		title: "Printer setup on macOS and Windows",
		body: "To add a network printer:\n\n**macOS:** System Settings > Printers > Add Printer > IP > Enter `print.axioma.demo` and select driver auto-detect.\n\n**Windows:** Settings > Printers > Add > The printer I want isn't listed > Provide `\\\\print.axioma.demo\\follow-me`",
		summary: "Add Axioma network printers to your device",
		status: "published",
		audience: "employees",
		isRestricted: false,
		tags: ["demo-tag-05", "demo-tag-06"],
	},
	{
		id: "demo-kb-article-08",
		folderId: "demo-kb-folder-01",
		title: "Slack channel directory",
		body: "#general — company-wide announcements\n#helpdesk — IT support requests (or open a ticket)\n#engineering — dev discussions\n#sales — sales ops\n#oncall — paging and incident coordination\n#random — non-work chat\n\nDo not post credentials or PII in any channel.",
		summary: "Key Slack channels and their purpose",
		status: "published",
		audience: "employees",
		isRestricted: false,
		tags: ["demo-tag-02"],
	},
	{
		id: "demo-kb-article-09",
		folderId: "demo-kb-folder-02",
		title: "Recovering deleted files from OneDrive",
		body: "Deleted files remain in OneDrive's recycle bin for 93 days.\n\n1. Open OneDrive in browser\n2. Click Recycle bin in left nav\n3. Select files and click Restore\n\nFor SharePoint library files, contact the site owner.",
		summary: "Restore accidentally deleted OneDrive files",
		status: "published",
		audience: "employees",
		isRestricted: false,
		tags: ["demo-tag-06"],
	},
	{
		id: "demo-kb-article-10",
		folderId: "demo-kb-folder-03",
		title: "Incident response runbook (staff)",
		body: "When a P1 incident is declared:\n\n1. Join #oncall and acknowledge page\n2. Open an incident ticket with P1 priority\n3. Post status update to status.axioma.demo\n4. Follow the escalation matrix for comms\n5. Document timeline in the incident ticket until resolved\n\nDo not close the incident ticket until the post-mortem is filed.",
		summary: "Steps for declaring and running a P1 incident",
		status: "published",
		audience: "staff",
		isRestricted: false,
		tags: ["demo-tag-03", "demo-tag-06"],
	},
	{
		id: "demo-kb-article-11",
		folderId: "demo-kb-folder-04",
		title: "Split-tunnel VPN configuration for engineers",
		body: "Engineering split-tunnel config:\n\n```\nAllowedIPs = 10.0.0.0/8, 172.16.0.0/12\nDNS = 10.0.0.53\n```\n\nAll other traffic bypasses the tunnel for performance. To force full tunnel, set `fullTunnel: true` in your client profile.",
		summary: "Advanced VPN config for engineering workloads",
		status: "published",
		audience: "staff",
		isRestricted: true,
		tags: ["demo-tag-01"],
	},
	{
		id: "demo-kb-article-12",
		folderId: "demo-kb-folder-02",
		title: "Setting up your Axioma email signature",
		body: "Use the Email Templates portal to generate your signature:\n\n1. My Profile > Email Signature\n2. Choose template (Standard / Compact)\n3. Preview and copy HTML\n4. Paste into Outlook / Gmail signature settings\n\nMarketing must approve custom signatures.",
		summary: "Generate a compliant email signature",
		status: "draft",
		audience: "employees",
		isRestricted: false,
		tags: ["demo-tag-04"],
	},
	{
		id: "demo-kb-article-13",
		folderId: "demo-kb-folder-03",
		title: "Data classification policy (draft)",
		body: "Draft v0.3 — pending legal review.\n\nPublic / Internal / Confidential / Restricted — definitions and handling requirements for each tier. Do not distribute externally until published.",
		summary: "Draft data classification tiers",
		status: "draft",
		audience: "staff",
		isRestricted: true,
		tags: ["demo-tag-03"],
	},
	{
		id: "demo-kb-article-14",
		folderId: "demo-kb-folder-01",
		title: "Expense reimbursement process",
		body: "Submit expenses via the Finance portal within 30 days:\n\n- Attach receipts (PDF or image)\n- Select cost centre and GL code\n- Manager approval >€500, Finance approval >€2000\n- Reimbursement in next pay run\n\nContact finance-ops@axioma.demo for questions.",
		summary: "How to claim expenses",
		status: "published",
		audience: "employees",
		isRestricted: false,
		tags: ["demo-tag-02"],
	},
	{
		id: "demo-kb-article-15",
		folderId: "demo-kb-folder-02",
		title: "Laptop encryption verification",
		body: "Verify encryption before travelling:\n\n**macOS:** `fdesetup status` should return FileVault is On\n**Windows:** `manage-bde -status C:` should show Percentage Encrypted: 100%\n\nIf encryption is off, contact Helpdesk immediately.",
		summary: "Confirm full-disk encryption is active",
		status: "published",
		audience: "employees",
		isRestricted: false,
		tags: ["demo-tag-03", "demo-tag-05"],
	},
	{
		id: "demo-kb-article-16",
		folderId: "demo-kb-folder-03",
		title: "Third-party vendor access procedure",
		body: "Vendor access requires:\n\n- Signed NDA on file (check Suppliers > Contracts)\n- Time-boxed account with expiry\n- Approver: Platform Engineering manager\n- Revocation checklist on contract end\n\nDo not share service accounts.",
		summary: "Grant and revoke vendor access correctly",
		status: "draft",
		audience: "staff",
		isRestricted: true,
		tags: ["demo-tag-03"],
	},
	{
		id: "demo-kb-article-17",
		folderId: "demo-kb-folder-02",
		title: "Conference room booking guide",
		body: "Book rooms via Outlook calendar:\n\n- Search for room list: `AXIOMA-ROOMS`\n- Check availability overlay\n- Add attendees and send invite\n\nCancellation policy: free cancellation up to 30 minutes before start.",
		summary: "Reserve meeting rooms efficiently",
		status: "draft",
		audience: "employees",
		isRestricted: false,
		tags: ["demo-tag-02"],
	},
	{
		id: "demo-kb-article-18",
		folderId: "demo-kb-folder-04",
		title: "Diagnosing intermittent API 502 errors",
		body: "If the Production API returns intermittent 502s:\n\n1. Check `kubectl get pods -n production` for crashlooping pods\n2. Review load balancer health checks (target group: `prod-api-tg`)\n3. Inspect Nginx error log on edge firewall\n4. Correlate with recent Changes in the dashboard\n\nKnown cause: upstream timeout after PostgreSQL failover — retry succeeds.",
		summary: "Runbook for the recurring API 502 issue",
		status: "published",
		audience: "staff",
		isRestricted: false,
		tags: ["demo-tag-06", "demo-tag-01"],
	},
];

// ---------------------------------------------------------------------------
// Suppliers / Software / Contracts
// ---------------------------------------------------------------------------

export const SUPPLIERS = [
	{
		id: "demo-supplier-01",
		name: "Acme Cloud Services",
		contactName: "Laura Smith",
		contactEmail: "laura.smith@acme.demo",
	},
	{
		id: "demo-supplier-02",
		name: "Global Hardware Ltd",
		contactName: "Kenji Tanaka",
		contactEmail: "kenji.tanaka@globalhw.demo",
	},
	{
		id: "demo-supplier-03",
		name: "SecureCorp MSP",
		contactName: "Fatima Al-Rashid",
		contactEmail: "fatima@securecorp.demo",
	},
	{
		id: "demo-supplier-04",
		name: "DataFlow Analytics",
		contactName: "James O'Connell",
		contactEmail: "james.oc@dataflow.demo",
	},
] as const;

/**
 * Licensable products. `installedName`/`installedPublisher` are the name and
 * publisher the agent actually reports for the application the licence covers,
 * and must match an INSTALLED_SOFTWARE entry exactly: the compliance join is on
 * softwareIdentityKey(name, publisher), so a product described by its
 * commercial name alone matches no install at all.
 */
export const SOFTWARE_PRODUCTS = [
	{
		id: "demo-sw-01",
		name: "Microsoft 365 E5",
		publisher: "Microsoft",
		installedName: "Microsoft 365 Apps for enterprise",
		installedPublisher: "Microsoft Corporation",
	},
	{
		id: "demo-sw-02",
		name: "Adobe Creative Cloud",
		publisher: "Adobe",
		installedName: "Adobe Acrobat Reader",
		installedPublisher: "Adobe Inc.",
	},
	{
		id: "demo-sw-03",
		name: "Slack Enterprise Grid",
		publisher: "Salesforce",
		installedName: "Slack",
		installedPublisher: "Slack Technologies",
	},
	{
		id: "demo-sw-04",
		name: "JetBrains All Products Pack",
		publisher: "JetBrains",
		installedName: "JetBrains Rider",
		installedPublisher: "JetBrains s.r.o.",
	},
	{
		id: "demo-sw-05",
		name: "CrowdStrike Falcon",
		publisher: "CrowdStrike",
		installedName: "CrowdStrike Falcon Sensor",
		installedPublisher: "CrowdStrike, Inc.",
	},
] as const;

/**
 * What the device agent reports as installed. The first five entries are the
 * applications SOFTWARE_PRODUCTS licences; the rest are deliberately
 * unlicensed, so the compliance dashboard has both states to show.
 */
export const INSTALLED_SOFTWARE = [
	{
		name: "Microsoft 365 Apps for enterprise",
		version: "16.92.24101",
		publisher: "Microsoft Corporation",
	},
	{
		name: "Adobe Acrobat Reader",
		version: "24.5.20320",
		publisher: "Adobe Inc.",
	},
	{ name: "Slack", version: "4.42.115", publisher: "Slack Technologies" },
	{
		name: "JetBrains Rider",
		version: "2024.3.2",
		publisher: "JetBrains s.r.o.",
	},
	{
		name: "CrowdStrike Falcon Sensor",
		version: "7.18.18604",
		publisher: "CrowdStrike, Inc.",
	},
	{ name: "Google Chrome", version: "141.0.7390.54", publisher: "Google LLC" },
	{
		name: "Visual Studio Code",
		version: "1.96.2",
		publisher: "Microsoft Corporation",
	},
	{
		name: "Zoom Workplace",
		version: "6.2.11",
		publisher: "Zoom Communications",
	},
	{ name: "1Password", version: "8.10.48", publisher: "AgileBits Inc." },
] as const;

// ---------------------------------------------------------------------------
// Ticket titles/bodies — 45 tickets mixed priorities/statuses
// ---------------------------------------------------------------------------

export type TicketDef = {
	id: string;
	title: string;
	body: string;
	impact: "high" | "medium" | "low";
	urgency: "high" | "medium" | "low";
	recordType: "incident" | "service_request";
	serviceId: string;
	serviceSubcategoryId: string;
	statusKind: string; // desired final status display kind (used for manual status patch)
	assigneeId?: string | null;
	teamId?: string | null;
};

export const TICKET_TITLES: Array<{
	title: string;
	body: string;
	impact: "high" | "medium" | "low";
	urgency: "high" | "medium" | "low";
	recordType: "incident" | "service_request";
	serviceId: string;
	serviceSubcategoryId: string;
}> = [
	{
		title: "Production API returning 502s intermittently",
		body: "Since 08:20 UTC the production API has been returning 502 Bad Gateway on ~5% of requests. Load balancer health checks show one target as unhealthy. Affects checkout flow.",
		impact: "high",
		urgency: "high",
		recordType: "incident",
		serviceId: "svc-infrastructure",
		serviceSubcategoryId: "ss-deployment",
	},
	{
		title: "VPN keeps disconnecting on new laptop",
		body: "My new Dell XPS disconnects from VPN every 15-20 minutes. Have reinstalled the client but the issue persists. Happens on both office wifi and home network.",
		impact: "medium",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-device",
		serviceSubcategoryId: "ss-network",
	},
	{
		title: "Request access to Salesforce for new hire",
		body: "New AE Aisha Johnson needs Salesforce access with standard sales profile. Manager approval attached. Start date is 2026-08-05.",
		impact: "low",
		urgency: "medium",
		recordType: "service_request",
		serviceId: "svc-access",
		serviceSubcategoryId: "ss-account",
	},
	{
		title: "Laptop screen flickering after update",
		body: "After the latest Windows update, my ThinkPad screen flickers intermittently. External monitor works fine. Suspect graphics driver issue.",
		impact: "medium",
		urgency: "low",
		recordType: "incident",
		serviceId: "svc-device",
		serviceSubcategoryId: "ss-network",
	},
	{
		title: "Unable to access expense portal",
		body: "Finance expense portal at expenses.axioma.demo returns 403 after SSO redirect. Cleared cookies and tried incognito — same result.",
		impact: "medium",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-access",
		serviceSubcategoryId: "ss-account",
	},
	{
		title: "Add new cost centre for Q3 marketing campaign",
		body: "Need cost centre CC-2026-MKTG-Q3 created in NetSuite with budget €50,000. Approver is Jennifer Walsh.",
		impact: "low",
		urgency: "low",
		recordType: "service_request",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Database replication lag on prod-db-01",
		body: "Replication lag on prod-db-01 exceeded 30s at 07:45 UTC. Replica is catching up but monitoring still shows lag warnings. No data loss observed.",
		impact: "high",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-infrastructure",
		serviceSubcategoryId: "ss-deployment",
	},
	{
		title: "Need new monitor for home office",
		body: "Requesting a Dell UltraSharp 27 4K monitor for home office setup. Current monitor is 1080p and causing eye strain during long sessions.",
		impact: "low",
		urgency: "low",
		recordType: "service_request",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Email signature not applying on Outlook mobile",
		body: "My email signature shows correctly on desktop Outlook but appears blank on Outlook for iOS. Re-synced account and reinstalled app — no change.",
		impact: "low",
		urgency: "low",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Provision Jira access for engineering contractor",
		body: "Contractor starting 2026-08-10 needs Jira access limited to ENG project, time-boxed to 3 months. NDA signed and filed under Suppliers > SecureCorp.",
		impact: "medium",
		urgency: "medium",
		recordType: "service_request",
		serviceId: "svc-access",
		serviceSubcategoryId: "ss-account",
	},
	{
		title: "CI pipeline failing on main branch after merge",
		body: "Build #3421 on main failed with 'node_modules cache miss' after merging feature/pipeline-caching. Re-ran pipeline and it passed locally. Suspect runner disk space.",
		impact: "high",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-infrastructure",
		serviceSubcategoryId: "ss-deployment",
	},
	{
		title: "Salesforce opportunity sync delay",
		body: "Opportunities created in Salesforce are not appearing in the reporting warehouse. Last sync was 14 hours ago, normally runs hourly. No errors in connector logs.",
		impact: "medium",
		urgency: "high",
		recordType: "incident",
		serviceId: "svc-access",
		serviceSubcategoryId: "ss-account",
	},
	{
		title: "Request standing desk for office",
		body: "Ergonomic assessment recommends a standing desk. Current desk is fixed height. Located on floor 3, desk 14.",
		impact: "low",
		urgency: "low",
		recordType: "service_request",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Edge firewall blocking legitimate traffic from partner API",
		body: "Partner DataFlow's IP range (203.0.113.0/24) is being blocked by edge-firewall-01. Whitelist request submitted last week but not applied. Partner launch is Monday.",
		impact: "high",
		urgency: "high",
		recordType: "incident",
		serviceId: "svc-infrastructure",
		serviceSubcategoryId: "ss-deployment",
	},
	{
		title: "Onboarding laptop not arrived for new finance hire",
		body: "Laptop ordered for Michael Brown (start 2026-08-04) has not arrived. Tracking shows delivered but nothing at reception. Carrier is investigating.",
		impact: "medium",
		urgency: "high",
		recordType: "incident",
		serviceId: "svc-device",
		serviceSubcategoryId: "ss-network",
	},
	{
		title: "Slack bot not posting deploy notifications",
		body: "Deploy notifications to #engineering stopped after the Slack app was reinstalled yesterday. Bot is installed but no messages for deploys in the last 12 hours.",
		impact: "low",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Rotate TLS certificates for api.axioma.io",
		body: "Current cert for api.axioma.io expires 2026-09-15. New cert issued and needs to be deployed to edge-firewall-01 and prod-api-01 before expiry.",
		impact: "medium",
		urgency: "medium",
		recordType: "service_request",
		serviceId: "svc-infrastructure",
		serviceSubcategoryId: "ss-deployment",
	},
	{
		title: "Finance report export returns empty CSV",
		body: "Monthly P&L export from NetSuite returns a CSV with headers but zero rows for July 2026. Filters look correct and data is visible in the UI.",
		impact: "medium",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Phone system call quality degraded",
		body: "Outbound calls via the VoIP system have static and drops since yesterday afternoon. Inbound calls sound fine. Network team aware.",
		impact: "medium",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Request budget approval for Q3 offsite",
		body: "Offsite for Engineering + Sales planned 2026-09-10 in Lisbon. Budget €25,000 needs Finance approval. Agenda and vendor quotes attached via document link.",
		impact: "low",
		urgency: "low",
		recordType: "service_request",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "CrowdStrike alert: suspicious process on SALES-LT-042",
		body: "Falcon alerted on suspicious PowerShell execution on SALES-LT-042 (pc-sales-042). User reports they clicked a link in an email. Machine isolated pending review.",
		impact: "high",
		urgency: "high",
		recordType: "incident",
		serviceId: "svc-device",
		serviceSubcategoryId: "ss-network",
	},
	{
		title: "Jira board columns not reflecting status changes",
		body: "Moving tickets from 'In Progress' to 'Done' on Jira board ENG does not update the Axioma ticket status. Webhook delivery shows 200 but no effect.",
		impact: "medium",
		urgency: "low",
		recordType: "incident",
		serviceId: "svc-access",
		serviceSubcategoryId: "ss-account",
	},
	{
		title: "Add secondary approver for laptop requests",
		body: "Update the laptop-request form to allow a secondary approver override when the primary manager is on leave. Currently single-approver only.",
		impact: "low",
		urgency: "low",
		recordType: "service_request",
		serviceId: "svc-access",
		serviceSubcategoryId: "ss-account",
	},
	{
		title: "Disk space critical on prod-api-01",
		body: "Disk usage on prod-api-01 at 92%. Log rotation appears to have failed for app logs. Manual cleanup recovered 5GB but root cause is unaddressed.",
		impact: "high",
		urgency: "high",
		recordType: "incident",
		serviceId: "svc-infrastructure",
		serviceSubcategoryId: "ss-deployment",
	},
	{
		title: "New supplier onboarding — Acme Cloud",
		body: "Acme Cloud Services contract signed. Need vendor accounts provisioned with time-boxed access and environment routes configured (see Suppliers).",
		impact: "low",
		urgency: "medium",
		recordType: "service_request",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Outlook calendar invites not syncing to phone",
		body: "Calendar invites accepted on desktop Outlook do not appear on iPhone calendar. Account re-added, same issue. Affects scheduling.",
		impact: "low",
		urgency: "low",
		recordType: "incident",
		serviceId: "svc-device",
		serviceSubcategoryId: "ss-network",
	},
	{
		title: "Budget forecast model returns wrong totals for March",
		body: "March 2026 forecast totals in the budget model are off by ~€120k vs manual calculation. Formula references look correct. Prior months are accurate.",
		impact: "medium",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Request access to production database (read-only)",
		body: "Need read-only access to prod-db-01 for a customer data investigation related to INC-2026-?? — ticket 502 follow-up. Time-boxed to 48 hours.",
		impact: "medium",
		urgency: "high",
		recordType: "service_request",
		serviceId: "svc-access",
		serviceSubcategoryId: "ss-account",
	},
	{
		title: "Office printer jam on 3rd floor",
		body: "Follow-me printer on floor 3 shows paper jam error E-2401. Tray 2 has paper but printer still reports jam after clearing. Needs technician.",
		impact: "low",
		urgency: "low",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "SSO login loop on portal after password reset",
		body: "After resetting my password, the portal SSO flow loops between /login and /callback without completing. Cleared cookies, tried different browser — same loop.",
		impact: "medium",
		urgency: "high",
		recordType: "incident",
		serviceId: "svc-access",
		serviceSubcategoryId: "ss-account",
	},
	{
		title: "Weekly sales report not generated on Monday",
		body: "Automated sales report that normally generates every Monday at 08:00 UTC did not generate on 2026-08-04. Job scheduler shows last run 2026-07-28.",
		impact: "medium",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Replace failing hard drive on prod-db-01",
		body: "SMART alerts show reallocated sectors above threshold on one disk in prod-db-01 RAID array. Replacement drive ordered from Global Hardware.",
		impact: "high",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-infrastructure",
		serviceSubcategoryId: "ss-deployment",
	},
	{
		title: "Background check delay for new hire Sofia Andersson",
		body: "Background check vendor reports delay — expected completion 2026-08-06 instead of 2026-08-02. Onboarding may be blocked. Expedite requested.",
		impact: "medium",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Request API rate limit increase for integration",
		body: "DataFlow integration hits rate limits at 100 req/min. Need temporary increase to 500 req/min for the migration window (Aug 10-12).",
		impact: "low",
		urgency: "low",
		recordType: "service_request",
		serviceId: "svc-infrastructure",
		serviceSubcategoryId: "ss-deployment",
	},
	{
		title: "VPN profile missing for finance team members",
		body: "Two finance team members report no VPN profile assigned after directory sync. Other departments are fine. Attribute mapping may be off.",
		impact: "medium",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-access",
		serviceSubcategoryId: "ss-account",
	},
	{
		title: "Teams meeting recording not available",
		body: "Recording of the Q3 planning meeting on 2026-08-01 does not appear in Teams or OneDrive. Other recordings from the same day are available.",
		impact: "low",
		urgency: "low",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Deploy hotfix for VAT calculation error",
		body: "VAT calculation on EU orders is applying the wrong rate for Germany (19% instead of 19% — but rounding is off by €0.01 per line). Hotfix branch ready for deploy.",
		impact: "high",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-infrastructure",
		serviceSubcategoryId: "ss-deployment",
	},
	{
		title: "Sales dashboard shows stale data from July 31",
		body: "Sales Operations dashboard has not refreshed since July 31. Data warehouse last successful run was July 31 02:00 UTC. Connector logs show auth failure.",
		impact: "medium",
		urgency: "high",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Request removal of departed employee access",
		body: "Employee who departed 2026-07-30 still shows active access to Salesforce and Slack. Directory sync leaver handling should have revoked it. Please verify.",
		impact: "high",
		urgency: "high",
		recordType: "service_request",
		serviceId: "svc-access",
		serviceSubcategoryId: "ss-account",
	},
	{
		title: "Keyboard not working after laptop resume from sleep",
		body: "External keyboard (Keychron K3 Pro) stops responding after the laptop resumes from sleep. Unplug/replug fixes it temporarily. Happens daily.",
		impact: "low",
		urgency: "low",
		recordType: "incident",
		serviceId: "svc-device",
		serviceSubcategoryId: "ss-network",
	},
	{
		title: "Monthly compliance attestation overdue",
		body: "Compliance attestation for July 2026 is overdue for 4 team members. Automated reminders have been sent but no responses. Escalate to managers.",
		impact: "medium",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "Provision staging environment for QA team",
		body: "QA team needs a staging environment with production-like data (anonymized) for regression testing the checkout flow before the August release.",
		impact: "low",
		urgency: "low",
		recordType: "service_request",
		serviceId: "svc-infrastructure",
		serviceSubcategoryId: "ss-deployment",
	},
	{
		title: "Door access card not working for new office",
		body: "New office access card issued last week does not unlock the 3rd floor entrance. Card is recognized (green light) but door does not release.",
		impact: "low",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
	{
		title: "YubiKey not recognized on new MacBook",
		body: "YubiKey 5 NFC is not detected when plugged into the new MacBook Pro (M3 Max). Works fine on the old laptop. Tried different ports and a hub.",
		impact: "medium",
		urgency: "low",
		recordType: "incident",
		serviceId: "svc-device",
		serviceSubcategoryId: "ss-network",
	},
	{
		title: "Invoice discrepancy for Acme Cloud — July",
		body: "July invoice from Acme Cloud is €4,200 above the contracted rate. Contract CC-ACME-2026-001 says €12,000/month; invoice shows €16,200. Query sent to Laura Smith.",
		impact: "medium",
		urgency: "medium",
		recordType: "incident",
		serviceId: "svc-general",
		serviceSubcategoryId: "ss-general",
	},
];

// ---------------------------------------------------------------------------
// Change / Problem titles
// ---------------------------------------------------------------------------

export const CHANGE_DEFS = [
	{
		id: "demo-change-01",
		title: "Upgrade PostgreSQL to 16 in production",
		description:
			"Upgrade prod-db-01 from PostgreSQL 14.12 to 16.4. Requires pg_upgrade and application downtime window.",
		changeType: "normal" as const,
		priority: "P2" as const,
		impact: "high" as const,
		status: "scheduled" as const,
		cabRequired: true,
		cabApprovalType: "all" as const,
	},
	{
		id: "demo-change-02",
		title: "Rotate TLS certificates for api.axioma.io",
		description:
			"Deploy renewed certificates to edge-firewall-01 and prod-api-01 before 2026-09-15 expiry.",
		changeType: "standard" as const,
		priority: "P3" as const,
		impact: "medium" as const,
		status: "approved" as const,
		cabRequired: false,
		cabApprovalType: "all" as const,
	},
	{
		id: "demo-change-03",
		title: "Migrate Salesforce integration to OAuth 2.0",
		description:
			"Replace deprecated API key auth with OAuth client credentials for the Salesforce connector. Requires field mapping update.",
		changeType: "normal" as const,
		priority: "P3" as const,
		impact: "medium" as const,
		status: "pending_approval" as const,
		cabRequired: true,
		cabApprovalType: "majority" as const,
	},
	{
		id: "demo-change-04",
		title: "Emergency fix: edge firewall rule correction",
		description:
			"Remove erroneous block rule that denied 203.0.113.0/24. Immediate deployment with expedited CAB review.",
		changeType: "emergency" as const,
		priority: "P1" as const,
		impact: "high" as const,
		status: "in_progress" as const,
		cabRequired: true,
		cabApprovalType: "majority" as const,
	},
	{
		id: "demo-change-05",
		title: "Deploy hotfix for VAT rounding error",
		description:
			"One-line fix in VAT calculation for DE orders. Requires QA sign-off and production deploy.",
		changeType: "normal" as const,
		priority: "P2" as const,
		impact: "medium" as const,
		status: "completed" as const,
		cabRequired: true,
		cabApprovalType: "all" as const,
	},
	{
		id: "demo-change-06",
		title: "Replace disk in prod-db-01 RAID array",
		description:
			"Hot-swap failing disk with replacement from Global Hardware. No downtime expected.",
		changeType: "standard" as const,
		priority: "P2" as const,
		impact: "medium" as const,
		status: "completed" as const,
		cabRequired: false,
		cabApprovalType: "all" as const,
	},
	{
		id: "demo-change-07",
		title: "Reconfigure log rotation on prod-api-01",
		description:
			"Fix broken logrotate config causing disk space growth to 92%. Add monitoring alert at 80%.",
		changeType: "normal" as const,
		priority: "P3" as const,
		impact: "low" as const,
		status: "draft" as const,
		cabRequired: true,
		cabApprovalType: "majority" as const,
	},
	{
		id: "demo-change-08",
		title: "Roll out CrowdStrike Falcon to remaining laptops",
		description:
			"Deploy Falcon sensor to 15 remaining unmanaged devices. Staged rollout over 2 weeks.",
		changeType: "normal" as const,
		priority: "P3" as const,
		impact: "medium" as const,
		status: "submitted" as const,
		cabRequired: true,
		cabApprovalType: "all" as const,
	},
	{
		id: "demo-change-09",
		title: "Update VPN client to 5.2.1 fleet-wide",
		description:
			"New VPN client fixes the 15-minute disconnect bug. Deploy via device commands with user notification.",
		changeType: "normal" as const,
		priority: "P2" as const,
		impact: "medium" as const,
		status: "approved" as const,
		cabRequired: true,
		cabApprovalType: "majority" as const,
	},
	{
		id: "demo-change-10",
		title: "Failed: attempted CDN cache purge that caused outage",
		description:
			"CDN cache purge command had a typo and cleared the wrong distribution, causing a 10-minute outage. Rolled back.",
		changeType: "normal" as const,
		priority: "P2" as const,
		impact: "high" as const,
		status: "failed" as const,
		cabRequired: true,
		cabApprovalType: "all" as const,
	},
] as const;

export const PROBLEM_DEFS = [
	{
		id: "demo-problem-01",
		title: "Recurring VPN disconnects across sales laptops",
		description:
			"Multiple sales team members report 15-20 minute VPN disconnect cycles. Root cause suspected to be client version 5.1.3 split-tunnel timeout. See linked incidents.",
		priority: "P2" as const,
		isKnownError: true,
		workaround:
			"Downgrade to client 5.0.9 or switch to full-tunnel profile as a temporary workaround.",
		rootCause:
			"VPN client 5.1.3 resets idle split-tunnel connections after 15 minutes due to keepalive regression.",
	},
	{
		id: "demo-problem-02",
		title: "Intermittent API 502s from production load balancer",
		description:
			"Production API returns 502 on ~5% of requests. Correlates with database failover events and load balancer health check flaps.",
		priority: "P1" as const,
		isKnownError: true,
		workaround:
			"Retry the request — upstream timeout recovers on second attempt in most cases.",
		rootCause:
			"Load balancer marks target unhealthy 2 seconds before database failover completes; retry succeeds against the other AZ target.",
	},
	{
		id: "demo-problem-03",
		title: "SSO login loop after password reset",
		description:
			"Users entering SSO after a password reset get stuck in a redirect loop between /login and /callback. Clears after 30 minutes or cookie wipe.",
		priority: "P2" as const,
		isKnownError: false,
		workaround: null,
		rootCause: null,
	},
	{
		id: "demo-problem-04",
		title: "Salesforce opportunity sync hourly delay",
		description:
			"Opportunities not appearing in warehouse for up to 14 hours. Connector last successful sync field is stale.",
		priority: "P3" as const,
		isKnownError: false,
		workaround: null,
		rootCause: null,
	},
	{
		id: "demo-problem-05",
		title: "Database replication lag spikes on prod-db-01",
		description:
			"Replication lag exceeds 30s intermittently, especially during nightly backup window. Replica catches up but triggers alerts.",
		priority: "P2" as const,
		isKnownError: true,
		workaround:
			"Mute replication-lag alerts during 02:00-04:00 UTC backup window; lag self-recovers.",
		rootCause:
			"Backup tool holds long-running snapshot causing WAL segment retention and lag.",
	},
	{
		id: "demo-problem-06",
		title: "CrowdStrike false positive on PowerShell",
		description:
			"Falcon flags legitimate PowerShell automation as suspicious on several endpoints. Needs tuning of detection rule threshold.",
		priority: "P3" as const,
		isKnownError: false,
		workaround: null,
		rootCause: null,
	},
	{
		id: "demo-problem-07",
		title: "Email delivery delays via outbound provider",
		description:
			"Outbound email queue shows 30+ minute delays. Provider API latency elevated; SPF/DKIM alignment intermittently fails.",
		priority: "P3" as const,
		isKnownError: false,
		workaround: null,
		rootCause: null,
	},
	{
		id: "demo-problem-08",
		title: "Expense portal 403 after SSO redirect",
		description:
			"Finance expense portal returns 403 after SSO. Suspected missing role mapping for finance cost-centre scoped resources.",
		priority: "P3" as const,
		isKnownError: false,
		workaround: null,
		rootCause: null,
	},
] as const;

export const WORKFLOW_DEFS = [
	{
		id: "demo-workflow-01",
		name: "Auto-assign P1 incidents to Platform Engineering",
		triggerEvent: "ticket.created",
		conditions: [{ field: "priority", operator: "equals", value: "P1" }],
		actions: [{ type: "assign", teamId: "demo-team-platform" }],
	},
	{
		id: "demo-workflow-02",
		name: "Notify approver on budget request",
		triggerEvent: "ticket.created",
		conditions: [
			{ field: "serviceId", operator: "equals", value: "svc-general" },
		],
		actions: [{ type: "notify", recipient: "approver" }],
	},
	{
		id: "demo-workflow-03",
		name: "Webhook: post P1 to #oncall",
		triggerEvent: "ticket.priority_changed",
		conditions: [{ field: "priority", operator: "equals", value: "P1" }],
		actions: [{ type: "webhook", url: "https://hooks.axioma.demo/oncall" }],
	},
] as const;

// For convenience: deterministic ticket ids prefix for idempotency keys
export function demoTicketId(n: number): string {
	return `demo-ticket-${String(n).padStart(3, "0")}`;
}
export function demoTicketIdempotencyKey(n: number): string {
	return `demo-ticket-idempotent-${String(n).padStart(3, "0")}`;
}
