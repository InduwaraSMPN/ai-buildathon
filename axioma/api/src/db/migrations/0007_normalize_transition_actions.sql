UPDATE "ticket_transitions" SET "action" = 'fail' WHERE "action" = 'failed';--> statement-breakpoint
UPDATE "ticket_transitions" SET "action" = 'exhaust' WHERE "action" = 'exhausted';--> statement-breakpoint
UPDATE "ticket_transitions" SET "action" = 'escalate' WHERE "action" = 'escalated';
