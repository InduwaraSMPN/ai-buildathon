-- Starter automation, CMDB taxonomy, service SLA, and per-user dashboard arrangement.
INSERT INTO "ticket_rules" ("id", "name", "position", "criteria", "actions") VALUES
	('starter-device-human-triage', 'Route device requests to human triage', 0, '[{"field":"serviceId","operator":"equals","value":"svc-device"}]'::jsonb, '[{"type":"route_human"}]'::jsonb)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "cmdb_relationship_types" ("id", "key", "verb", "inverse_verb", "impact_direction") VALUES
	('cmdb-relationship-type-depends-on', 'depends_on', 'depends on', 'supports', 'reverse'),
	('cmdb-relationship-type-runs-on', 'runs_on', 'runs on', 'hosts', 'reverse'),
	('cmdb-relationship-type-connects-to', 'connects_to', 'connects to', 'connects from', 'both')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "cmdb_class_properties" ("id", "class_id", "property_key", "label", "property_type", "target_class_id", "spreads_impact") VALUES
	('cmdb-property-application-solution-depends-on', 'cmdb-class-application-solution', 'depends_on', 'Depends on', 'relationship', 'cmdb-class-functional-ci', true)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "slas" ("id", "name", "priority", "tto_working_minutes", "ttr_working_minutes", "calendar_id", "is_default") VALUES
	('device-service-sla', 'Device service SLA', NULL, 240, 1440, 'default-business-hours', false)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
UPDATE "services" SET "sla_id" = 'device-service-sla' WHERE "id" = 'svc-device';--> statement-breakpoint

INSERT INTO "dashboard_widgets" ("id", "user_id", "widget_key", "position", "width")
SELECT 'default-widget:' || "id" || ':' || widget."key", "id", widget."key", widget."position", widget."width"
FROM "user"
CROSS JOIN (VALUES
	('priority', 0, 2),
	('confirmation', 1, 1),
	('escalations', 2, 1),
	('resolution-rate', 3, 1),
	('median-ttr', 4, 1)
) AS widget("key", "position", "width")
ON CONFLICT ("user_id", "widget_key") DO NOTHING;
