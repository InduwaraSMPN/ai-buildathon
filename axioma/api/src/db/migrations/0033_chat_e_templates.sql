
INSERT INTO "email_templates" ("id", "name", "subject", "text_body", "enabled") VALUES
  ('template-ticket-notification', 'Ticket notification', '[ticket_reference] [ticket_url]', '[ticket_reference] [ticket_url]\n\n[body]', true)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "email_template_rules" ("id", "template_id", "scope", "match_value", "enabled") VALUES
  ('template-rule-catch-all', 'template-ticket-notification', 'catch_all', NULL, true)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
