-- createEnvironment and the connector procedures are gated on the
-- admin.environments and admin.connectors capabilities, but no seeded role
-- ever received them: 0009 granted platform-engineer only admin.roles and
-- admin.settings, and 0045 added device.approve. The bootstrap administrator
-- is assigned platform-engineer, so a fresh install answered every account
-- with 403 Forbidden. Grant both capabilities here, mirroring the 0009 and
-- 0045 seed style so re-running stays idempotent.
INSERT INTO "role_capabilities" ("role_id", "capability") VALUES
	('platform-engineer', 'admin.environments'),
	('platform-engineer', 'admin.connectors')
ON CONFLICT DO NOTHING;
