INSERT INTO "pending_reasons" ("id", "name", "followup_frequency_minutes", "followups_before_resolution") VALUES
	('reporter-information', 'Waiting for reporter information', 1440, 3),
	('approval-required', 'Waiting for approval', 2880, 2),
	('scheduled-change', 'Waiting for scheduled change', 10080, 2)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "sla_notification_rules" ("id", "name", "policy_type", "policy_id", "trigger_type", "target_type", "threshold_percent", "recipient_type", "recipient") VALUES
	('default-sla-warning', 'Default SLA warning', 'sla', 'default-sla', 'warning', 'both', 80, 'assignee', NULL),
	('default-sla-breach', 'Default SLA breach', 'sla', 'default-sla', 'breach', 'both', 100, 'assignee', NULL),
	('default-ola-warning', 'Default OLA warning', 'ola', 'default-ola', 'warning', 'both', 80, 'assignee', NULL),
	('default-ola-breach', 'Default OLA breach', 'ola', 'default-ola', 'breach', 'both', 100, 'assignee', NULL)
ON CONFLICT ("id") DO NOTHING;
