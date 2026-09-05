-- The starter automation matched every ticket on the Device service and routed
-- it to human triage, which suppresses agent dispatch. That switched the device
-- path off on a fresh install: a reported fault on a claimed machine — the class
-- of work the device agent exists for — never reached a run, and the queue
-- looked exactly as it would have without the agent at all.
--
-- A service request on a device is different. A replacement laptop, a monitor,
-- a docking station: nothing an agent can do on the machine settles those, and
-- they should still land with a person. So the rule keeps its intent and gains
-- the record type it was always about.
UPDATE "ticket_rules"
SET "criteria" = '[{"field":"serviceId","operator":"equals","value":"svc-device"},{"field":"recordType","operator":"equals","value":"service_request"}]'::jsonb,
	"name" = 'Route device service requests to human triage',
	"updated_at" = now()
WHERE "id" = 'starter-device-human-triage';
