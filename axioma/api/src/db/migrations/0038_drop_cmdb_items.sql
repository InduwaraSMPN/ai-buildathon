DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "cmdb_items" i
		LEFT JOIN "cmdb_objects" o ON o."id" = i."id"
		WHERE o."id" IS NULL
			OR o."source_ticket_id" IS DISTINCT FROM i."source_ticket_id"
			OR o."source_run_id" IS DISTINCT FROM i."source_run_id"
			OR o."source_step_id" IS DISTINCT FROM i."source_step_id"
			OR o."observed_at" IS DISTINCT FROM i."observed_at"
	) THEN
		RAISE EXCEPTION 'cmdb_items rows are missing from cmdb_objects or have mismatched provenance';
	END IF;
END $$;--> statement-breakpoint

DROP TABLE "cmdb_items";
