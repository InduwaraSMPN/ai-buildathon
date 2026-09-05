import {
	RiBookOpenLine as BookOpen,
	RiBox3Line as Boxes,
	RiCalendarScheduleLine as CalendarDays,
	RiBarChartBoxLine as ChartNoAxesCombined,
	RiSurveyLine as ClipboardList,
	RiDraftLine as Draft,
	RiGitPullRequestLine as GitPullRequest,
	RiInboxLine as Inbox,
	RiListView as LayoutList,
	RiLightbulbLine as Lightbulb,
	RiListCheck3 as ListChecks,
	RiMailSendLine as MailSend,
	RiComputerLine as MonitorCog,
	RiPlugLine as PlugZap,
	RiFileList3Line as ScrollText,
	RiServerLine as Server,
	RiShieldCheckLine as ShieldCheck,
	RiStore2Line as Store,
	RiTerminalBoxLine as Terminal,
	RiThumbUpLine as ThumbsUp,
	RiFlowChart as Workflow,
} from "@remixicon/react";
import { redirect } from "@tanstack/react-router";
import type { Capability } from "@/sdk/shared";

export const NAV_SECTIONS = [
	"Work",
	"Records",
	"Setup",
	"Mail",
	"Administration",
] as const;

export type NavSection = (typeof NAV_SECTIONS)[number];

/**
 * The single navigation registry for the staff dashboard.
 *
 * Every URL, label and capability gate is declared here exactly once. The
 * sidebar and command palette derive their entries from this table, and the
 * route guards derive their `beforeLoad` redirects from the same
 * `capabilities` field, so the three surfaces cannot drift apart.
 *
 * `capabilities` uses any-of semantics (mirroring the API's
 * `anyCapabilityProcedure`): a user who holds any listed capability may see
 * the entry. Absent means every staff user may see it.
 */
export const navigation = [
	{
		to: "/overview",
		label: "Overview",
		icon: ChartNoAxesCombined,
		section: "Work",
	},
	{
		to: "/tickets",
		label: "Ticket queue",
		icon: LayoutList,
		section: "Work",
	},
	{
		to: "/approvals",
		label: "Approvals",
		icon: ThumbsUp,
		capabilities: ["approval.read"],
		section: "Work",
	},
	{
		to: "/device-commands",
		label: "Device commands",
		icon: Terminal,
		capabilities: ["device.approve"],
		section: "Work",
	},
	{
		to: "/scheduled-work",
		label: "Scheduled work",
		icon: CalendarDays,
		section: "Work",
	},
	{
		to: "/devices",
		label: "Devices",
		icon: MonitorCog,
		capabilities: ["device.read", "device.enroll"],
		section: "Records",
	},
	{
		to: "/problems",
		label: "Problems",
		icon: Lightbulb,
		capabilities: ["problem.manage"],
		section: "Records",
	},
	{
		to: "/changes",
		label: "Changes",
		icon: GitPullRequest,
		capabilities: ["change.manage"],
		section: "Records",
	},
	{
		to: "/knowledge",
		label: "Knowledge",
		icon: BookOpen,
		capabilities: ["knowledge.read"],
		section: "Records",
	},
	{
		to: "/assets",
		label: "Assets",
		icon: Boxes,
		capabilities: ["admin.settings"],
		section: "Records",
	},
	{
		to: "/software-licences",
		label: "Software licences",
		icon: ScrollText,
		capabilities: ["admin.settings"],
		section: "Records",
	},
	{
		to: "/suppliers",
		label: "Suppliers & contracts",
		icon: Store,
		capabilities: ["admin.settings"],
		section: "Records",
	},
	{
		to: "/forms",
		label: "Request forms",
		icon: ClipboardList,
		capabilities: ["catalogue.manage"],
		section: "Setup",
	},
	{
		to: "/ticket-rules",
		label: "Ticket rules",
		icon: ListChecks,
		capabilities: ["admin.settings"],
		section: "Setup",
	},
	{
		to: "/workflows",
		label: "Workflows",
		icon: Workflow,
		capabilities: ["admin.settings"],
		section: "Setup",
	},
	{
		to: "/mail-log",
		label: "Mail send log",
		icon: MailSend,
		capabilities: ["admin.settings"],
		section: "Mail",
	},
	{
		to: "/mailboxes",
		label: "Mailboxes",
		icon: Inbox,
		capabilities: ["admin.settings"],
		section: "Mail",
	},
	{
		to: "/mail-templates",
		label: "Mail templates",
		icon: Draft,
		capabilities: ["admin.settings"],
		section: "Mail",
	},
	{
		to: "/admin/roles",
		label: "Roles",
		icon: ShieldCheck,
		capabilities: ["admin.roles"],
		section: "Administration",
	},
	{
		to: "/admin/connectors",
		label: "ITSM connectors",
		icon: PlugZap,
		capabilities: ["admin.connectors"],
		section: "Administration",
	},
	{
		to: "/admin/environments",
		label: "Environments",
		icon: Server,
		capabilities: ["admin.environments"],
		section: "Administration",
	},
] as const;

export type NavPath = (typeof navigation)[number]["to"];

type NavEntry = (typeof navigation)[number];

/** Any-of: true when no gate, or the user holds at least one required capability. */
export function permits(held: readonly Capability[], entry: NavEntry): boolean {
	if (!("capabilities" in entry) || !entry.capabilities) return true;
	return (entry.capabilities as readonly Capability[]).some(
		(capability: Capability) => held.includes(capability),
	);
}

/** The subset of the registry the given user may navigate to. */
export function visibleNavigation(held: readonly Capability[]) {
	return navigation.filter((entry) => permits(held, entry));
}

/** The registry grouped by section, in NAV_SECTIONS order, with empties dropped. */
export function visibleSections(held: readonly Capability[]) {
	const visible = visibleNavigation(held);
	return NAV_SECTIONS.flatMap((section) => {
		const entries = visible.filter((entry) => entry.section === section);
		return entries.length ? [{ section, entries }] : [];
	});
}

/** The single landing route. Every guard redirects here; it must stay ungated. */
export const LANDING = "/overview";

/** Look up a registry entry's `{ label, to }` for a breadcrumb trail. */
export function navCrumb(to: NavPath): { label: string; to: NavPath } {
	const entry = navigation.find((item) => item.to === to);
	if (!entry) throw new Error(`Unknown navigation path: ${to}`);
	return { label: entry.label, to: entry.to };
}

/** Throws a redirect to the landing route when the user lacks the entry's gate. */
export function requireNav(
	to: NavPath,
	context: { capabilities: Capability[] },
) {
	if (!permits(context.capabilities, navigation.find((e) => e.to === to)!)) {
		throw redirect({ to: LANDING });
	}
}
