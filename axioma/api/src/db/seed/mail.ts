/**
 * Mail seed — mailboxes, inbound emails, attachments, activity log, send log.
 * Some linked via ticketMailOrigins to seeded tickets.
 */

import { db } from "@/db";
import {
	emailAttachments,
	emailSendLog,
	inboundEmails,
	mailboxActivityLog,
	mailboxes,
	ticketMailOrigins,
} from "@/db/schema/mail";
import { daysFromEpoch } from "./data";

export async function seedMail(ticketIds: string[]): Promise<void> {
	await db.transaction(async (tx) => {
		// Mailboxes — 2
		const mailboxDefs = [
			{
				id: "demo-mailbox-01",
				address: "support@axioma.demo",
				name: "Axioma Support",
				ticketOrigin: "email" as const,
			},
			{
				id: "demo-mailbox-02",
				address: "helpdesk@axioma.demo",
				name: "Axioma Helpdesk",
				ticketOrigin: "email" as const,
			},
		];
		for (const mb of mailboxDefs) {
			await tx
				.insert(mailboxes)
				.values({
					id: mb.id,
					address: mb.address,
					name: mb.name,
					ticketOrigin: mb.ticketOrigin,
					enabled: true,
					createdAt: daysFromEpoch(1, 9),
					updatedAt: daysFromEpoch(1, 9),
				})
				.onConflictDoNothing();
		}

		// Inbound emails — ~15
		const subjects = [
			"Re: VPN disconnecting every 15 minutes",
			"Help: cannot access expense portal",
			"Request: Salesforce access for new hire",
			"Fwd: Production API 502 errors — urgent",
			"Question about laptop request approval",
			"Invoice discrepancy for July — Acme Cloud",
			"YubiKey not detected on new MacBook",
			"Printer jam on floor 3",
			"SSO loop after password reset",
			"Door access card not working",
			"New supplier onboarding files attached",
			"Re: Database replication lag alert",
			"CrowdStrike alert follow-up",
			"Weekly sales report missing — follow up",
			"Expense reimbursement — receipts attached",
		];
		const fromAddresses = [
			"elena.rodriguez@axioma.demo",
			"david.kim@axioma.demo",
			"carlos.mendez@axioma.demo",
			"jennifer.walsh@axioma.demo",
			"aisha.johnson@axioma.demo",
			"lisa.zhang@axioma.demo",
			"customer@example.com",
			"partner@dataflow.demo",
			"vendor@acme.demo",
			"noreply@monitoring.demo",
		];

		for (let i = 0; i < 15; i++) {
			const id = `demo-inbound-${String(i + 1).padStart(2, "0")}`;
			const mailboxId = i % 3 === 0 ? "demo-mailbox-02" : "demo-mailbox-01";
			const subject = subjects[i % subjects.length]!;
			const fromAddress = fromAddresses[i % fromAddresses.length]!;
			const toAddress =
				mailboxId === "demo-mailbox-01"
					? "support@axioma.demo"
					: "helpdesk@axioma.demo";
			const receivedAt = daysFromEpoch(i + 2, 9 + (i % 8));
			const status =
				i % 5 === 4
					? "rejected"
					: i % 5 === 3
						? "failed"
						: i % 5 === 2
							? "received"
							: "processed";
			const processedAt =
				status !== "received" ? daysFromEpoch(i + 2, 10 + (i % 4)) : null;
			const ticketId =
				i < ticketIds.length && i % 3 !== 2 ? ticketIds[i]! : null;
			const providerMessageId = `demo-msgid-${String(i + 1).padStart(4, "0")}@axioma.demo`;
			await tx
				.insert(inboundEmails)
				.values({
					id,
					mailboxId,
					providerMessageId,
					fromAddress,
					toAddress,
					subject,
					textBody: `Demo email body for "${subject}" — this is seeded content for the mail log. Ticket reference: ${ticketId ?? "none"}. Please treat as synthetic.`,
					htmlBody: `<p>Demo email body for "${subject}"</p><p>Seeded content.</p>`,
					headers: { "Message-ID": providerMessageId, "X-Demo-Seed": "true" },
					status: status as typeof inboundEmails.$inferInsert.status,
					ticketId,
					receivedAt,
					processedAt,
					attemptCount: status === "failed" ? 3 : 1,
					lastError:
						status === "failed"
							? "Simulated processing failure for demo"
							: null,
				})
				.onConflictDoNothing();

			// Attachment for every 4th email
			if (i % 4 === 0) {
				const attachId = `demo-attach-${String(i + 1).padStart(2, "0")}`;
				await tx
					.insert(emailAttachments)
					.values({
						id: attachId,
						inboundEmailId: id,
						filename: `demo-attachment-${i + 1}.pdf`,
						contentType: "application/pdf",
						storageKey: `demo/attachments/${attachId}.pdf`,
						contentId: null,
						createdAt: receivedAt,
					})
					.onConflictDoNothing();
			}

			// Mailbox activity log per email
			const activityId = `demo-mail-activity-${String(i + 1).padStart(2, "0")}`;
			const decision =
				status === "processed" && ticketId
					? ("ticket_created" as const)
					: status === "processed"
						? ("threaded" as const)
						: status === "rejected"
							? ("rejected" as const)
							: ("failed" as const);
			await tx
				.insert(mailboxActivityLog)
				.values({
					id: activityId,
					mailboxId,
					inboundEmailId: id,
					decision,
					reason: `Demo decision: ${decision} — synthetic seed data`,
					ticketId,
					details: { seeded: true, subject },
					createdAt: receivedAt,
				})
				.onConflictDoNothing();

			// ticket_mail_origins linkage for emails that created tickets
			if (ticketId && decision === "ticket_created") {
				await tx
					.insert(ticketMailOrigins)
					.values({
						ticketId,
						mailboxId,
						ticketOrigin: "email",
						inboundEmailId: id,
						createdAt: receivedAt,
					})
					.onConflictDoNothing();
			}
		}

		// Email send log — ~15 entries across subsystems
		const sendSubsystems = [
			"ticket_notification",
			"workflow",
			"sla_escalation",
		];
		for (let i = 0; i < 15; i++) {
			const id = `demo-sendlog-${String(i + 1).padStart(2, "0")}`;
			const recipient = fromAddresses[i % fromAddresses.length]!;
			const subsystem = sendSubsystems[i % sendSubsystems.length]!;
			const ticketId = ticketIds[i % ticketIds.length]!;
			const outcome = i % 10 === 9 ? "failed" : "sent";
			const attemptedAt = daysFromEpoch(10 + i, 11);
			await tx
				.insert(emailSendLog)
				.values({
					id,
					recipient,
					subsystem,
					ticketId,
					templateId: "template-ticket-notification",
					subject: `Re: ${subjects[i % subjects.length]!}`,
					outcome: outcome as typeof emailSendLog.$inferInsert.outcome,
					providerMessageId:
						outcome === "sent"
							? `send-demo-${String(i + 1).padStart(4, "0")}@provider.demo`
							: null,
					providerText:
						outcome === "sent" ? "250 OK queued" : "550 Mailbox unavailable",
					attemptedAt,
				})
				.onConflictDoNothing();
		}
	});

	console.log(
		"[seed:mail] seeded mailboxes, inbound emails, attachments, activity, send log",
	);
}
