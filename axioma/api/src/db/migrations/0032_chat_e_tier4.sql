
INSERT INTO "ticket_origins" ("id", "key", "name") VALUES
  ('origin-portal', 'portal', 'Portal'),
  ('origin-email', 'email', 'Email'),
  ('origin-chat', 'chat', 'Chat'),
  ('origin-monitoring', 'monitoring', 'Monitoring'),
  ('origin-phone', 'phone', 'Phone')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

UPDATE "mailboxes" SET "ticket_origin" = 'email'
WHERE "ticket_origin" NOT IN (SELECT "key" FROM "ticket_origins");--> statement-breakpoint
UPDATE "messaging_threads" SET "origin_key" = 'chat'
WHERE "origin_key" NOT IN (SELECT "key" FROM "ticket_origins");--> statement-breakpoint
UPDATE "ticket_mail_origins" SET "ticket_origin" = 'email'
WHERE "ticket_origin" NOT IN (SELECT "key" FROM "ticket_origins");--> statement-breakpoint

ALTER TABLE "mailboxes"
  ADD CONSTRAINT "mailboxes_ticket_origin_fk"
  FOREIGN KEY ("ticket_origin") REFERENCES "ticket_origins"("key") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "messaging_threads"
  ADD CONSTRAINT "messaging_threads_origin_key_fk"
  FOREIGN KEY ("origin_key") REFERENCES "ticket_origins"("key") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "ticket_mail_origins"
  ADD CONSTRAINT "ticket_mail_origins_ticket_origin_fk"
  FOREIGN KEY ("ticket_origin") REFERENCES "ticket_origins"("key") ON DELETE restrict;--> statement-breakpoint
