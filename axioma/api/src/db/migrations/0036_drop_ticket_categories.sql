DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "tickets" t
		LEFT JOIN "service_subcategories" s
			ON s."id" = t."service_subcategory_id" AND s."service_id" = t."service_id"
		WHERE s."id" IS NULL
	) THEN
		RAISE EXCEPTION 'tickets contain invalid service/subcategory pairs';
	END IF;
	IF EXISTS (
		SELECT 1 FROM "ticket_rules"
		WHERE "criteria"::text LIKE '%"category"%' OR "actions"::text LIKE '%"set_category"%'
	) THEN
		RAISE EXCEPTION 'ticket rules still reference legacy category fields';
	END IF;
END $$;--> statement-breakpoint

ALTER TABLE "tickets" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "subcategory";
