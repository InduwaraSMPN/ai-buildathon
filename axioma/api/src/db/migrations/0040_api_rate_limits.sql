CREATE TABLE "api_rate_limits" (
	"scope" text PRIMARY KEY NOT NULL,
	"request_limit" integer NOT NULL,
	"per_key_limit" integer NOT NULL,
	"window_seconds" integer NOT NULL,
	"window_started_at" timestamp with time zone,
	"request_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_rate_limits_scope_check" CHECK ("api_rate_limits"."scope" = 'global'),
	CONSTRAINT "api_rate_limits_values_check" CHECK ("api_rate_limits"."request_limit" > 0 AND "api_rate_limits"."per_key_limit" > 0 AND "api_rate_limits"."window_seconds" > 0 AND "api_rate_limits"."request_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "api_key_rate_limits" (
	"api_key_id" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_key_rate_limits_api_key_id_window_started_at_pk" PRIMARY KEY("api_key_id","window_started_at"),
	CONSTRAINT "api_key_rate_limits_count_check" CHECK ("api_key_rate_limits"."request_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "api_key_rate_limits" ADD CONSTRAINT "api_key_rate_limits_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "api_rate_limits" ("scope", "request_limit", "per_key_limit", "window_seconds") VALUES ('global', 2000, 120, 60);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION consume_api_rate_limit(p_api_key_id text, p_now timestamptz DEFAULT clock_timestamp())
RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamptz, retry_after_ms integer)
LANGUAGE plpgsql
AS $$
DECLARE
	policy api_rate_limits%ROWTYPE;
	window_start timestamptz;
	key_count integer;
BEGIN
	SELECT * INTO policy FROM api_rate_limits WHERE scope = 'global' FOR UPDATE;
	IF NOT FOUND THEN RAISE EXCEPTION 'API rate-limit policy is not configured'; END IF;

	window_start := to_timestamp(floor(extract(epoch FROM p_now) / policy.window_seconds) * policy.window_seconds);
	IF policy.window_started_at IS DISTINCT FROM window_start THEN
		UPDATE api_rate_limits SET window_started_at = window_start, request_count = 0 WHERE scope = 'global';
		policy.window_started_at := window_start;
		policy.request_count := 0;
	END IF;

	INSERT INTO api_key_rate_limits (api_key_id, window_started_at, request_count)
	VALUES (p_api_key_id, window_start, 0)
	ON CONFLICT (api_key_id, window_started_at) DO NOTHING;
	SELECT request_count INTO key_count FROM api_key_rate_limits
	WHERE api_key_id = p_api_key_id AND window_started_at = window_start FOR UPDATE;

	reset_at := window_start + make_interval(secs => policy.window_seconds);
	IF policy.request_count >= policy.request_limit OR key_count >= policy.per_key_limit THEN
		allowed := false;
		remaining := 0;
		retry_after_ms := greatest(1, ceil(extract(epoch FROM (reset_at - p_now)) * 1000)::integer);
		RETURN NEXT;
		RETURN;
	END IF;

	UPDATE api_rate_limits SET request_count = request_count + 1 WHERE scope = 'global';
	UPDATE api_key_rate_limits SET request_count = request_count + 1
	WHERE api_key_id = p_api_key_id AND window_started_at = window_start;
	allowed := true;
	remaining := least(policy.request_limit - policy.request_count - 1, policy.per_key_limit - key_count - 1);
	retry_after_ms := 0;
	RETURN NEXT;
END;
$$;
