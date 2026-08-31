-- carried from 0011_tier2_service_management
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"started_by_id" text,
	"status" text DEFAULT 'running' NOT NULL,
	"model" text,
	"outcome" text,
	"worker_id" text,
	"accepted_at" timestamp,
	"lease_expires_at" timestamp,
	"environment_id" text,
	"environment_key" text,
	"environment_source" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"kind" text NOT NULL,
	"reasoning" text,
	"tool_name" text,
	"tool_input" jsonb,
	"tool_output" jsonb,
	"error" text,
	"evidence" text,
	"notice" text DEFAULT '' NOT NULL,
	"evidence_tone" text DEFAULT 'neutral' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"call_id" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"secret_hash" text NOT NULL,
	"capabilities" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_prefix_unique" UNIQUE("prefix")
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
CREATE TABLE "api_rate_limits" (
	"scope" text PRIMARY KEY NOT NULL,
	"request_limit" integer NOT NULL,
	"per_key_limit" integer NOT NULL,
	"window_seconds" integer NOT NULL,
	"window_started_at" timestamp with time zone,
	"request_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_rate_limits_scope_check" CHECK ("api_rate_limits"."scope" = 'global'),
	CONSTRAINT "api_rate_limits_values_check" CHECK ("api_rate_limits"."request_limit" > 0 and "api_rate_limits"."per_key_limit" > 0 and "api_rate_limits"."window_seconds" > 0 and "api_rate_limits"."request_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"approver_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"submission_id" text,
	"status" text DEFAULT 'waiting_for_approval' NOT NULL,
	"request_note" text,
	"decision_note" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "asset_checkout_log" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"custodian_id" text,
	"checked_out_at" timestamp NOT NULL,
	"checked_in_at" timestamp,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "asset_history" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_id" text,
	"changes" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_import_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"identity_key" text NOT NULL,
	"asset_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_import_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"identity_columns" text[] NOT NULL,
	"dynamic_field_columns" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_import_rejections" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"row_number" integer NOT NULL,
	"reason" text NOT NULL,
	"row" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_import_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text,
	"file_name" text,
	"total_rows" integer NOT NULL,
	"accepted_rows" integer NOT NULL,
	"rejected_rows" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"asset_tag" text,
	"serial_number" text,
	"status_id" text,
	"custodian_id" text,
	"attributes" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"kind" text DEFAULT 'reporter' NOT NULL,
	"job_title" text,
	"phone" text,
	"manager_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_kind_check" CHECK ("user"."kind" in ('staff', 'reporter')),
	CONSTRAINT "user_manager_not_self_check" CHECK ("user"."manager_id" is null or "user"."manager_id" <> "user"."id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"calendar_id" text NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"calendar_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "calendar_hours_weekday_check" CHECK ("calendar_hours"."weekday" between 0 and 6),
	CONSTRAINT "calendar_hours_range_check" CHECK ("calendar_hours"."start_time" < "calendar_hours"."end_time")
);
--> statement-breakpoint
CREATE TABLE "calendars" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_families" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_subcategories" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"approver_override_id" text,
	"form_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sla_id" text,
	"ola_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_cab_members" (
	"id" text PRIMARY KEY NOT NULL,
	"change_id" text NOT NULL,
	"user_id" text NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_cab_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"vote" text NOT NULL,
	"comment" text,
	"voted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_ticket_links" (
	"id" text PRIMARY KEY NOT NULL,
	"change_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"link_type" text DEFAULT 'related' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"change_id" text NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"run_id" text,
	"step_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changes" (
	"id" text PRIMARY KEY NOT NULL,
	"change_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"reason_for_change" text,
	"change_type" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"priority" text DEFAULT 'P3' NOT NULL,
	"impact" text DEFAULT 'medium' NOT NULL,
	"category" text,
	"requester_id" text,
	"assigned_to_id" text,
	"approver_id" text,
	"approval_at" timestamp,
	"work_start_at" timestamp,
	"work_end_at" timestamp,
	"outage_start_at" timestamp,
	"outage_end_at" timestamp,
	"implementation_plan" text,
	"test_plan" text,
	"rollback_plan" text,
	"risk_evaluation" text,
	"risk_likelihood" integer,
	"risk_impact_score" integer,
	"risk_score" integer,
	"risk_level" text,
	"cab_required" boolean DEFAULT false NOT NULL,
	"cab_approval_type" text DEFAULT 'all' NOT NULL,
	"pir_review" text,
	"pir_was_successful" boolean,
	"pir_actual_start_at" timestamp,
	"pir_actual_end_at" timestamp,
	"pir_lessons_learned" text,
	"pir_follow_up" text,
	"created_by_id" text,
	"source_run_id" text,
	"source_step_id" text,
	"verification_deadline_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "changes_work_range" CHECK ("changes"."work_end_at" is null or "changes"."work_start_at" is null or "changes"."work_end_at" >= "changes"."work_start_at"),
	CONSTRAINT "changes_outage_range" CHECK ("changes"."outage_end_at" is null or "changes"."outage_start_at" is null or "changes"."outage_end_at" >= "changes"."outage_start_at"),
	CONSTRAINT "changes_pir_range" CHECK ("changes"."pir_actual_end_at" is null or "changes"."pir_actual_start_at" is null or "changes"."pir_actual_end_at" >= "changes"."pir_actual_start_at")
);
--> statement-breakpoint
CREATE TABLE "channel_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"external_message_id" text NOT NULL,
	"direction" text NOT NULL,
	"sender_ref" text,
	"body" text NOT NULL,
	"raw" jsonb,
	"received_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messaging_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"default_origin_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messaging_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"external_thread_id" text NOT NULL,
	"ticket_id" text,
	"origin_key" text NOT NULL,
	"participant_ref" text,
	"opened_at" timestamp NOT NULL,
	"last_message_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_origins" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_cmdb_objects" (
	"ticket_id" text NOT NULL,
	"object_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_cmdb_objects_ticket_id_object_id_pk" PRIMARY KEY("ticket_id","object_id")
);
--> statement-breakpoint
CREATE TABLE "cmdb_class_properties" (
	"id" text PRIMARY KEY NOT NULL,
	"class_id" text NOT NULL,
	"property_key" text NOT NULL,
	"label" text NOT NULL,
	"property_type" text NOT NULL,
	"target_class_id" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"spreads_impact" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cmdb_classes" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"parent_class_id" text
);
--> statement-breakpoint
CREATE TABLE "cmdb_object_environments" (
	"object_id" text NOT NULL,
	"environment_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cmdb_object_properties" (
	"id" text PRIMARY KEY NOT NULL,
	"object_id" text NOT NULL,
	"property_id" text NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cmdb_object_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"type_id" text NOT NULL,
	"source_object_id" text NOT NULL,
	"target_object_id" text NOT NULL,
	"property_id" text
);
--> statement-breakpoint
CREATE TABLE "cmdb_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"class_id" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"source_ticket_id" text,
	"source_run_id" text,
	"source_step_id" text,
	"observed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cmdb_relationship_types" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"verb" text NOT NULL,
	"inverse_verb" text NOT NULL,
	"impact_direction" text DEFAULT 'none' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itsm_connector_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"connector_id" text NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"dispatched_count" integer DEFAULT 0 NOT NULL,
	"quarantined_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"summary" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itsm_connectors" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"vendor" text NOT NULL,
	"label" text NOT NULL,
	"base_url" text NOT NULL,
	"auth_type" text DEFAULT 'oauth_client_credentials' NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_encrypted" text NOT NULL,
	"record_filter" text DEFAULT '' NOT NULL,
	"ticket_origin" text NOT NULL,
	"default_environment_id" text NOT NULL,
	"fallback_reporter_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"disabled_reason" text,
	"poll_interval_seconds" integer DEFAULT 120 NOT NULL,
	"create_ceiling" integer DEFAULT 50 NOT NULL,
	"dispatch_ceiling" integer DEFAULT 3 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"watermark" timestamp,
	"cursor" text,
	"last_successful_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "itsm_connectors_poll_interval_positive" CHECK ("itsm_connectors"."poll_interval_seconds" > 0),
	CONSTRAINT "itsm_connectors_create_ceiling_positive" CHECK ("itsm_connectors"."create_ceiling" > 0),
	CONSTRAINT "itsm_connectors_dispatch_ceiling_positive" CHECK ("itsm_connectors"."dispatch_ceiling" > 0)
);
--> statement-breakpoint
CREATE TABLE "itsm_dispatch_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"trigger_key" text NOT NULL,
	"outcome" text NOT NULL,
	"detail" text,
	"run_id" text,
	"dispatched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itsm_environment_routes" (
	"id" text PRIMARY KEY NOT NULL,
	"connector_id" text NOT NULL,
	"source_field" text NOT NULL,
	"source_value" text NOT NULL,
	"environment_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itsm_field_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"connector_id" text NOT NULL,
	"source_field" text NOT NULL,
	"target_field" text NOT NULL,
	"value_map" jsonb NOT NULL,
	"on_unmapped" text DEFAULT 'quarantine' NOT NULL,
	"default_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itsm_proposal_verdicts" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"call_ordinal" integer NOT NULL,
	"verdict" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"note" text,
	"decided_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itsm_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"suppressed_calls" jsonb NOT NULL,
	"posted_at" timestamp,
	"opened_at" timestamp,
	"foreign_resolution" text,
	"foreign_closed_by" text,
	"observed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itsm_ticket_origins" (
	"ticket_id" text PRIMARY KEY NOT NULL,
	"connector_id" text NOT NULL,
	"external_id" text NOT NULL,
	"external_key" text NOT NULL,
	"external_url" text,
	"foreign_updated_at" timestamp NOT NULL,
	"last_written_at" timestamp,
	"dispatch_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "itsm_ticket_origins_dispatch_count_nonnegative" CHECK ("itsm_ticket_origins"."dispatch_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "itsm_writebacks" (
	"id" text PRIMARY KEY NOT NULL,
	"connector_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"run_id" text,
	"kind" text DEFAULT 'work_note' NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp,
	"claimed_at" timestamp,
	"response_status" integer,
	"last_error" text,
	"external_receipt_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "itsm_writebacks_attempt_nonnegative" CHECK ("itsm_writebacks"."attempt_count" >= 0),
	CONSTRAINT "itsm_writebacks_max_attempts_positive" CHECK ("itsm_writebacks"."max_attempts" > 0),
	CONSTRAINT "itsm_writebacks_attempt_within_max" CHECK ("itsm_writebacks"."attempt_count" <= "itsm_writebacks"."max_attempts")
);
--> statement-breakpoint
CREATE TABLE "dashboard_widgets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"widget_key" text NOT NULL,
	"position" integer NOT NULL,
	"width" integer DEFAULT 1 NOT NULL,
	"settings" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_widgets_position_nonnegative" CHECK ("dashboard_widgets"."position" >= 0),
	CONSTRAINT "dashboard_widgets_width_check" CHECK ("dashboard_widgets"."width" between 1 and 2)
);
--> statement-breakpoint
CREATE TABLE "device_command_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"run_id" text,
	"step_id" text,
	"command" jsonb NOT NULL,
	"digest" text NOT NULL,
	"requested_by_id" text,
	"reason" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"approved_by_id" text,
	"decided_at" timestamp,
	"decision_note" text,
	"expires_at" timestamp NOT NULL,
	"dispatched_command_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"run_id" text,
	"step_id" text,
	"proposal_id" text,
	"sequence" integer NOT NULL,
	"tool" text NOT NULL,
	"input" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"output" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"dispatched_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "device_enrolment_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"used_by_device_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"hostname" text NOT NULL,
	"username" text,
	"platform" text,
	"release" text,
	"agent_version" text,
	"credential_hash" text,
	"credential_rotated_at" timestamp,
	"revoked_at" timestamp,
	"execution_enabled" boolean DEFAULT false NOT NULL,
	"connected" text DEFAULT 'offline' NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"enrolled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"display_name" text NOT NULL,
	"media_type" text,
	"sha256" text,
	"stored_filename" text,
	"url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dynamic_field_values" (
	"field_id" text NOT NULL,
	"object_id" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dynamic_field_values_object_not_blank" CHECK (length(trim("dynamic_field_values"."object_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "dynamic_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"object_type" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dynamic_fields_key_not_blank" CHECK (length(trim("dynamic_fields"."key")) > 0),
	CONSTRAINT "dynamic_fields_label_not_blank" CHECK (length(trim("dynamic_fields"."label")) > 0),
	CONSTRAINT "dynamic_fields_object_type_not_blank" CHECK (length(trim("dynamic_fields"."object_type")) > 0)
);
--> statement-breakpoint
CREATE TABLE "environments" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"connection_type" text NOT NULL,
	"context_name" text,
	"credential_encrypted" text,
	"mode" text DEFAULT 'act' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_environments" (
	"service_id" text NOT NULL,
	"environment_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_environments_service_id_environment_id_pk" PRIMARY KEY("service_id","environment_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_environments" (
	"ticket_id" text PRIMARY KEY NOT NULL,
	"environment_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"ordinal" integer NOT NULL,
	"options" jsonb,
	"validation" jsonb,
	"condition" jsonb,
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_readonly" boolean DEFAULT false NOT NULL,
	"predefined_value" jsonb,
	CONSTRAINT "form_fields_ordinal_nonnegative" CHECK ("form_fields"."ordinal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"submitter_id" text,
	"ticket_id" text,
	"values" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	CONSTRAINT "forms_version_positive" CHECK ("forms"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "auth_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"discovery_url" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_encrypted" text NOT NULL,
	"scopes" text[] DEFAULT '{"openid","profile","email"}' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_providers_provider_id_check" CHECK ("auth_providers"."provider_id" ~ '^[a-z0-9][a-z0-9_-]*$')
);
--> statement-breakpoint
CREATE TABLE "directory_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"external_id" text NOT NULL,
	"department" text,
	"leaver" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"previous_count" integer NOT NULL,
	"found_count" integer NOT NULL,
	"created_count" integer NOT NULL,
	"updated_count" integer NOT NULL,
	"leaver_count" integer NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"device_id" text NOT NULL,
	"last_reported_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_disks" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_device_id" text NOT NULL,
	"device_key" text NOT NULL,
	"model" text,
	"serial_number" text,
	"size_bytes" text,
	"raw" text,
	"observed_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_hardware" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_device_id" text NOT NULL,
	"manufacturer" text,
	"model" text,
	"serial_number" text,
	"cpu" text,
	"memory_bytes" text,
	"bios_version" text,
	"raw" text,
	"observed_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_device_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"reported_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_inventory_apps" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_device_id" text NOT NULL,
	"identity_key" text NOT NULL,
	"name" text NOT NULL,
	"version" text,
	"publisher" text,
	"install_date" text,
	"raw" text,
	"observed_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"field_name" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_time_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"user_id" text NOT NULL,
	"minutes" integer NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_time_entries_minutes_positive" CHECK ("ticket_time_entries"."minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "knowledge_acl" (
	"id" text PRIMARY KEY NOT NULL,
	"article_id" text,
	"folder_id" text,
	"principal_type" text NOT NULL,
	"principal_id" text NOT NULL,
	"permission" text DEFAULT 'read' NOT NULL,
	CONSTRAINT "knowledge_acl_one_target_check" CHECK (("knowledge_acl"."article_id" is not null) <> ("knowledge_acl"."folder_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "knowledge_article_tags" (
	"article_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "knowledge_article_tags_article_id_tag_id_pk" PRIMARY KEY("article_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_article_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"article_id" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"summary" text,
	"author_id" text,
	"change_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"folder_id" text,
	"author_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"summary" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"audience" text DEFAULT 'employees' NOT NULL,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"embedding" vector(1536),
	"embedding_model" text,
	"metadata" jsonb,
	"published_at" timestamp,
	"next_review_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_articles_version_positive" CHECK ("knowledge_articles"."current_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "knowledge_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_gap_clusters" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"keywords" text[],
	"status" text DEFAULT 'open' NOT NULL,
	"article_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_gap_tickets" (
	"cluster_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_gap_tickets_cluster_id_ticket_id_pk" PRIMARY KEY("cluster_id","ticket_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "knowledge_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ticket_links" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"target_ticket_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_links_not_self" CHECK ("ticket_links"."ticket_id" <> "ticket_links"."target_ticket_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_merges" (
	"id" text PRIMARY KEY NOT NULL,
	"source_ticket_id" text NOT NULL,
	"target_ticket_id" text NOT NULL,
	"source_previous_status" text NOT NULL,
	"merged_by" text NOT NULL,
	"merged_at" timestamp DEFAULT now() NOT NULL,
	"undone_by" text,
	"undone_at" timestamp,
	CONSTRAINT "ticket_merges_not_self" CHECK ("ticket_merges"."source_ticket_id" <> "ticket_merges"."target_ticket_id")
);
--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"inbound_email_id" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_send_log" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"subsystem" text NOT NULL,
	"ticket_id" text,
	"template_id" text,
	"subject" text NOT NULL,
	"outcome" text NOT NULL,
	"provider_message_id" text,
	"provider_text" text NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"mailbox_id" text NOT NULL,
	"provider_message_id" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"text_body" text,
	"html_body" text,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"ticket_id" text,
	"received_at" timestamp NOT NULL,
	"processed_at" timestamp,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "mailbox_activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"mailbox_id" text NOT NULL,
	"inbound_email_id" text,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"ticket_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mailboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"name" text NOT NULL,
	"ticket_origin" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mailboxes_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "ticket_mail_origins" (
	"ticket_id" text PRIMARY KEY NOT NULL,
	"mailbox_id" text NOT NULL,
	"ticket_origin" text NOT NULL,
	"inbound_email_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_id" text,
	"author_type" text NOT NULL,
	"body" text NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"actor_id" text,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_count" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_event_count_positive" CHECK ("notifications"."event_count" > 0),
	CONSTRAINT "notifications_not_own_action" CHECK ("notifications"."actor_id" IS NULL OR "notifications"."actor_id" <> "notifications"."recipient_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_number_counters" (
	"prefix" text NOT NULL,
	"year" text NOT NULL,
	"last_value" bigint NOT NULL,
	CONSTRAINT "ticket_number_counters_prefix_year_pk" PRIMARY KEY("prefix","year")
);
--> statement-breakpoint
CREATE TABLE "ticket_number_history" (
	"number" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department_teams" (
	"department_id" text NOT NULL,
	"team_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "department_teams_department_id_team_id_pk" PRIMARY KEY("department_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "pending_followups" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"reason_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_reasons" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"followup_frequency_minutes" integer NOT NULL,
	"followups_before_resolution" integer NOT NULL,
	CONSTRAINT "pending_reasons_frequency_positive" CHECK ("pending_reasons"."followup_frequency_minutes" > 0),
	CONSTRAINT "pending_reasons_followups_positive" CHECK ("pending_reasons"."followups_before_resolution" > 0)
);
--> statement-breakpoint
CREATE TABLE "ticket_csat_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"token" text NOT NULL,
	"rating" integer,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	CONSTRAINT "ticket_csat_rating_bounds" CHECK ("ticket_csat_responses"."rating" is null or ("ticket_csat_responses"."rating" >= 1 and "ticket_csat_responses"."rating" <= 5)),
	CONSTRAINT "ticket_csat_response_complete" CHECK (("ticket_csat_responses"."rating" is null and "ticket_csat_responses"."responded_at" is null) or ("ticket_csat_responses"."rating" is not null and "ticket_csat_responses"."responded_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "ticket_presence" (
	"ticket_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "ticket_presence_ticket_id_user_id_pk" PRIMARY KEY("ticket_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "problem_tickets" (
	"problem_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "problem_tickets_problem_id_ticket_id_pk" PRIMARY KEY("problem_id","ticket_id")
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" text PRIMARY KEY NOT NULL,
	"problem_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'P3' NOT NULL,
	"assignee_id" text,
	"root_cause" text,
	"workaround" text,
	"is_known_error" boolean DEFAULT false NOT NULL,
	"service_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_capabilities" (
	"role_id" text NOT NULL,
	"capability" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_capabilities_role_id_capability_pk" PRIMARY KEY("role_id","capability"),
	CONSTRAINT "role_capabilities_key_check" CHECK ("role_capabilities"."capability" in ('ticket.read.own', 'ticket.read.all', 'ticket.create', 'ticket.update', 'ticket.resolve', 'ticket.close', 'ticket.escalate', 'ticket.reclassify', 'ticket.assign', 'ticket.reopen', 'run.start', 'run.cancel', 'run.read', 'device.read', 'device.enroll', 'device.command', 'device.approve', 'stats.read', 'problem.manage', 'change.manage', 'change.approve', 'knowledge.read', 'knowledge.manage', 'approval.read', 'approval.decide', 'catalogue.manage', 'admin.roles', 'admin.settings', 'admin.environments', 'admin.connectors'))
);
--> statement-breakpoint
CREATE TABLE "role_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"role_id" text,
	"role_name" text,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_grants_action_check" CHECK ("role_grants"."action" in ('grant', 'revoke', 'set_kind')),
	CONSTRAINT "role_grants_target_type_check" CHECK ("role_grants"."target_type" in ('user', 'team', 'capability', 'user_kind')),
	CONSTRAINT "role_grants_role_check" CHECK (("role_grants"."target_type" = 'user_kind') = ("role_grants"."role_id" is null and "role_grants"."role_name" is null)),
	CONSTRAINT "role_grants_capability_check" CHECK ("role_grants"."target_type" <> 'capability' or "role_grants"."target_id" in ('ticket.read.own', 'ticket.read.all', 'ticket.create', 'ticket.update', 'ticket.resolve', 'ticket.close', 'ticket.escalate', 'ticket.reclassify', 'ticket.assign', 'ticket.reopen', 'run.start', 'run.cancel', 'run.read', 'device.read', 'device.enroll', 'device.command', 'device.approve', 'stats.read', 'problem.manage', 'change.manage', 'change.approve', 'knowledge.read', 'knowledge.manage', 'approval.read', 'approval.decide', 'catalogue.manage', 'admin.roles', 'admin.settings', 'admin.environments', 'admin.connectors'))
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "team_roles" (
	"team_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_roles_team_id_role_id_pk" PRIMARY KEY("team_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_rule_firings" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"rule_position" integer NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"criteria" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_rules_position_nonnegative" CHECK ("ticket_rules"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recurring_ticket_occurrences" (
	"id" text PRIMARY KEY NOT NULL,
	"recurring_ticket_id" text NOT NULL,
	"occurs_at" timestamp NOT NULL,
	"idempotency_key" text NOT NULL,
	"generated_ticket_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"source_ticket_id" text NOT NULL,
	"frequency" text NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"starts_at" timestamp NOT NULL,
	"until" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_tickets_interval_positive" CHECK ("recurring_tickets"."interval" > 0),
	CONSTRAINT "recurring_tickets_until_check" CHECK ("recurring_tickets"."until" IS NULL OR "recurring_tickets"."until" >= "recurring_tickets"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "ticket_scheduling" (
	"ticket_id" text PRIMARY KEY NOT NULL,
	"work_start_at" timestamp,
	"work_end_at" timestamp,
	"work_all_day" boolean DEFAULT false NOT NULL,
	"snoozed_until" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_scheduling_work_range_check" CHECK (("ticket_scheduling"."work_start_at" IS NULL AND "ticket_scheduling"."work_end_at" IS NULL) OR ("ticket_scheduling"."work_start_at" IS NOT NULL AND "ticket_scheduling"."work_end_at" IS NOT NULL AND "ticket_scheduling"."work_end_at" >= "ticket_scheduling"."work_start_at"))
);
--> statement-breakpoint
CREATE TABLE "search_documents" (
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" vector(1536),
	"embedding_model" text,
	"source_updated_at" timestamp NOT NULL,
	"indexed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_documents_object_type_object_id_pk" PRIMARY KEY("object_type","object_id")
);
--> statement-breakpoint
CREATE TABLE "search_reconciliation_state" (
	"key" text PRIMARY KEY NOT NULL,
	"last_reconciled_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "olas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"priority" text,
	"tto_working_minutes" integer NOT NULL,
	"ttr_working_minutes" integer NOT NULL,
	"calendar_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "olas_tto_positive" CHECK ("olas"."tto_working_minutes" > 0),
	CONSTRAINT "olas_ttr_positive" CHECK ("olas"."ttr_working_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "sla_escalation_events" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"ticket_id" text NOT NULL,
	"stopwatch_id" text NOT NULL,
	"rule_id" text,
	"trigger_type" text NOT NULL,
	"target_type" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_notification_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"policy_type" text NOT NULL,
	"policy_id" text NOT NULL,
	"trigger_type" text NOT NULL,
	"target_type" text NOT NULL,
	"threshold_percent" integer DEFAULT 100 NOT NULL,
	"recipient_type" text NOT NULL,
	"recipient" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sla_notification_rules_threshold_range" CHECK ("sla_notification_rules"."threshold_percent" > 0 AND "sla_notification_rules"."threshold_percent" <= 100),
	CONSTRAINT "sla_notification_rules_recipient_shape" CHECK (("sla_notification_rules"."recipient_type" = 'assignee' AND "sla_notification_rules"."recipient" IS NULL) OR ("sla_notification_rules"."recipient_type" <> 'assignee' AND "sla_notification_rules"."recipient" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "slas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"priority" text,
	"tto_working_minutes" integer NOT NULL,
	"ttr_working_minutes" integer NOT NULL,
	"calendar_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slas_tto_positive" CHECK ("slas"."tto_working_minutes" > 0),
	CONSTRAINT "slas_ttr_positive" CHECK ("slas"."ttr_working_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "ticket_stopwatches" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"policy_type" text NOT NULL,
	"policy_id" text NOT NULL,
	"target_type" text NOT NULL,
	"accumulated_ms" bigint DEFAULT 0 NOT NULL,
	"pending_ms" bigint DEFAULT 0 NOT NULL,
	"running" boolean DEFAULT true NOT NULL,
	"started_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_stopwatches_accumulated_nonnegative" CHECK ("ticket_stopwatches"."accumulated_ms" >= 0),
	CONSTRAINT "ticket_stopwatches_pending_nonnegative" CHECK ("ticket_stopwatches"."pending_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "software_licence_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"entitlement_id" text NOT NULL,
	"asset_id" text,
	"user_id" text,
	"allocated_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "software_allocations_one_target" CHECK (("software_licence_allocations"."asset_id" is not null)::int + ("software_licence_allocations"."user_id" is not null)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "software_licence_entitlements" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"licence_key" text,
	"seat_count" integer NOT NULL,
	"valid_from" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "software_entitlements_seats_positive" CHECK ("software_licence_entitlements"."seat_count" > 0),
	CONSTRAINT "software_entitlements_dates_valid" CHECK ("software_licence_entitlements"."valid_from" is null or "software_licence_entitlements"."expires_at" is null or "software_licence_entitlements"."expires_at" >= "software_licence_entitlements"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "software_products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"publisher" text,
	"identity_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_impact_levels" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"counts_as_downtime" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"impact_level" text NOT NULL,
	"title" text NOT NULL,
	"planned_maintenance" boolean DEFAULT false NOT NULL,
	"started_at" timestamp NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_coverage_windows" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"sla_id" text NOT NULL,
	"timezone" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "contract_coverage_windows_weekday_check" CHECK ("contract_coverage_windows"."weekday" between 0 and 6),
	CONSTRAINT "contract_coverage_windows_minutes_check" CHECK ("contract_coverage_windows"."start_minute" >= 0 AND "contract_coverage_windows"."start_minute" < "contract_coverage_windows"."end_minute" AND "contract_coverage_windows"."end_minute" <= 1440)
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"service_id" text NOT NULL,
	"name" text NOT NULL,
	"reference" text,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_date_range_check" CHECK ("contracts"."ends_on" IS NULL OR "contracts"."ends_on" >= "contracts"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_template_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"scope" text NOT NULL,
	"match_value" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_template_rules_match_shape" CHECK (("email_template_rules"."scope" = 'catch_all' AND "email_template_rules"."match_value" IS NULL) OR ("email_template_rules"."scope" <> 'catch_all' AND "email_template_rules"."match_value" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"text_body" text NOT NULL,
	"html_body" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_creation_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"ticket_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"action" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"device_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"record_type" text DEFAULT 'incident' NOT NULL,
	"impact" text DEFAULT 'medium' NOT NULL,
	"urgency" text DEFAULT 'medium' NOT NULL,
	"priority" text DEFAULT 'P3' NOT NULL,
	"service_id" text DEFAULT 'svc-general' NOT NULL,
	"service_subcategory_id" text DEFAULT 'ss-general' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"route" text,
	"resolution" text,
	"resolution_code" text,
	"escalation_note" text,
	"progress_marker" text,
	"assignee_id" text,
	"owner_id" text,
	"team_id" text,
	"merged_into_id" text,
	"number" text,
	"pending_reason_id" text,
	"pending_until" timestamp,
	"last_pending_at" timestamp,
	"pending_followups" integer DEFAULT 0 NOT NULL,
	"escalation_flag" text DEFAULT 'none' NOT NULL,
	"escalation_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"reopened_at" timestamp,
	"last_human_transition_at" timestamp,
	CONSTRAINT "tickets_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"name" text NOT NULL,
	"object_type" text,
	"filters" jsonb NOT NULL,
	"sort" jsonb,
	"columns" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_views_user_owner_check" CHECK ("saved_views"."owner_type" <> 'user' OR "saved_views"."owner_id" = "saved_views"."created_by_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_status_transitions" (
	"from_status" text NOT NULL,
	"action" text NOT NULL,
	"to_status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_statuses" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"state_type" text NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"pauses_sla" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"execution_id" text,
	"url" text NOT NULL,
	"request_headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp,
	"response_status" integer,
	"response_headers" jsonb,
	"response_body" text,
	"last_error" text,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "webhook_deliveries_attempt_count_nonnegative" CHECK ("webhook_deliveries"."attempt_count" >= 0),
	CONSTRAINT "webhook_deliveries_max_attempts_positive" CHECK ("webhook_deliveries"."max_attempts" > 0),
	CONSTRAINT "webhook_deliveries_attempts_bounded" CHECK ("webhook_deliveries"."attempt_count" <= "webhook_deliveries"."max_attempts")
);
--> statement-breakpoint
CREATE TABLE "workflow_executions" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"trigger_event" text NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"claimed_at" timestamp,
	"lease_expires_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trigger_event" text NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_status" text,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_runs_ticket_idx" ON "agent_runs" USING btree ("ticket_id","started_at");
--> statement-breakpoint
CREATE INDEX "agent_runs_expired_lease_idx" ON "agent_runs" USING btree ("lease_expires_at") WHERE "agent_runs"."status" = 'running';
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_steps_run_ordinal_uidx" ON "agent_steps" USING btree ("run_id","ordinal");
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_tool_calls_run_call_uidx" ON "agent_tool_calls" USING btree ("run_id","call_id");
--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "api_keys_expires_idx" ON "api_keys" USING btree ("expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_active_ticket_uidx" ON "approvals" USING btree ("ticket_id") WHERE "approvals"."status" = 'waiting_for_approval';
--> statement-breakpoint
CREATE INDEX "approvals_approver_status_idx" ON "approvals" USING btree ("approver_id","status","requested_at");
--> statement-breakpoint
CREATE INDEX "approvals_requester_idx" ON "approvals" USING btree ("requester_id","requested_at");
--> statement-breakpoint
CREATE INDEX "approvals_submission_id_idx" ON "approvals" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX "asset_checkout_asset_idx" ON "asset_checkout_log" USING btree ("asset_id","checked_out_at");
--> statement-breakpoint
CREATE INDEX "asset_checkout_log_custodian_id_idx" ON "asset_checkout_log" USING btree ("custodian_id");
--> statement-breakpoint
CREATE INDEX "asset_history_asset_idx" ON "asset_history" USING btree ("asset_id","created_at");
--> statement-breakpoint
CREATE INDEX "asset_history_actor_id_idx" ON "asset_history" USING btree ("actor_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_import_identity_uidx" ON "asset_import_identities" USING btree ("profile_id","identity_key");
--> statement-breakpoint
CREATE INDEX "asset_import_identity_asset_idx" ON "asset_import_identities" USING btree ("asset_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_import_profiles_name_uidx" ON "asset_import_profiles" USING btree ("name");
--> statement-breakpoint
CREATE INDEX "asset_import_rejections_run_idx" ON "asset_import_rejections" USING btree ("run_id","row_number");
--> statement-breakpoint
CREATE INDEX "asset_import_runs_profile_idx" ON "asset_import_runs" USING btree ("profile_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_statuses_name_uidx" ON "asset_statuses" USING btree ("name");
--> statement-breakpoint
CREATE UNIQUE INDEX "assets_tag_uidx" ON "assets" USING btree ("asset_tag");
--> statement-breakpoint
CREATE INDEX "assets_serial_idx" ON "assets" USING btree ("serial_number");
--> statement-breakpoint
CREATE INDEX "assets_status_idx" ON "assets" USING btree ("status_id");
--> statement-breakpoint
CREATE INDEX "assets_custodian_idx" ON "assets" USING btree ("custodian_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "user_manager_idx" ON "user" USING btree ("manager_id");
--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_holidays_calendar_date_uidx" ON "calendar_holidays" USING btree ("calendar_id","date");
--> statement-breakpoint
CREATE INDEX "calendar_hours_calendar_idx" ON "calendar_hours" USING btree ("calendar_id","weekday");
--> statement-breakpoint
CREATE INDEX "calendars_default_idx" ON "calendars" USING btree ("is_default");
--> statement-breakpoint
CREATE UNIQUE INDEX "service_families_name_uidx" ON "service_families" USING btree ("name");
--> statement-breakpoint
CREATE UNIQUE INDEX "service_subcategories_service_name_uidx" ON "service_subcategories" USING btree ("service_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "service_subcategories_id_service_uidx" ON "service_subcategories" USING btree ("id","service_id");
--> statement-breakpoint
CREATE INDEX "service_subcategories_approver_idx" ON "service_subcategories" USING btree ("approver_override_id");
--> statement-breakpoint
CREATE INDEX "service_subcategories_form_id_idx" ON "service_subcategories" USING btree ("form_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "services_family_name_uidx" ON "services" USING btree ("family_id","name");
--> statement-breakpoint
CREATE INDEX "services_sla_idx" ON "services" USING btree ("sla_id");
--> statement-breakpoint
CREATE INDEX "services_ola_idx" ON "services" USING btree ("ola_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "change_cab_members_change_user_uidx" ON "change_cab_members" USING btree ("change_id","user_id");
--> statement-breakpoint
CREATE INDEX "change_cab_members_user_idx" ON "change_cab_members" USING btree ("user_id","change_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "change_cab_votes_member_uidx" ON "change_cab_votes" USING btree ("member_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "change_ticket_links_pair_uidx" ON "change_ticket_links" USING btree ("change_id","ticket_id","link_type");
--> statement-breakpoint
CREATE INDEX "change_ticket_links_ticket_idx" ON "change_ticket_links" USING btree ("ticket_id");
--> statement-breakpoint
CREATE INDEX "change_transitions_change_idx" ON "change_transitions" USING btree ("change_id","created_at");
--> statement-breakpoint
CREATE INDEX "change_transitions_run_idx" ON "change_transitions" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "change_transitions_step_idx" ON "change_transitions" USING btree ("step_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "changes_number_uidx" ON "changes" USING btree ("change_number");
--> statement-breakpoint
CREATE INDEX "changes_status_schedule_idx" ON "changes" USING btree ("status","work_start_at");
--> statement-breakpoint
CREATE INDEX "changes_type_status_idx" ON "changes" USING btree ("change_type","status");
--> statement-breakpoint
CREATE INDEX "changes_priority_idx" ON "changes" USING btree ("priority","created_at");
--> statement-breakpoint
CREATE INDEX "changes_assignee_idx" ON "changes" USING btree ("assigned_to_id","status");
--> statement-breakpoint
CREATE INDEX "changes_requester_idx" ON "changes" USING btree ("requester_id");
--> statement-breakpoint
CREATE INDEX "changes_approver_idx" ON "changes" USING btree ("approver_id");
--> statement-breakpoint
CREATE INDEX "changes_risk_idx" ON "changes" USING btree ("risk_level","risk_score");
--> statement-breakpoint
CREATE INDEX "changes_source_run_idx" ON "changes" USING btree ("source_run_id");
--> statement-breakpoint
CREATE INDEX "changes_source_step_idx" ON "changes" USING btree ("source_step_id");
--> statement-breakpoint
CREATE INDEX "changes_created_by_id_idx" ON "changes" USING btree ("created_by_id");
--> statement-breakpoint
CREATE INDEX "changes_verification_deadline_idx" ON "changes" USING btree ("verification_deadline_at") WHERE "changes"."status" = 'in_progress';
--> statement-breakpoint
CREATE UNIQUE INDEX "channel_messages_external_uidx" ON "channel_messages" USING btree ("thread_id","external_message_id");
--> statement-breakpoint
CREATE INDEX "channel_messages_thread_idx" ON "channel_messages" USING btree ("thread_id","received_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_channels_key_uidx" ON "messaging_channels" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "messaging_channels_default_origin_id_idx" ON "messaging_channels" USING btree ("default_origin_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_threads_external_uidx" ON "messaging_threads" USING btree ("channel_id","external_thread_id");
--> statement-breakpoint
CREATE INDEX "messaging_threads_ticket_idx" ON "messaging_threads" USING btree ("ticket_id","last_message_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_origins_key_uidx" ON "ticket_origins" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "ticket_cmdb_objects_object_idx" ON "ticket_cmdb_objects" USING btree ("object_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "cmdb_class_properties_key_uidx" ON "cmdb_class_properties" USING btree ("class_id","property_key");
--> statement-breakpoint
CREATE INDEX "cmdb_class_properties_target_idx" ON "cmdb_class_properties" USING btree ("target_class_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "cmdb_classes_key_uidx" ON "cmdb_classes" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "cmdb_classes_parent_class_id_idx" ON "cmdb_classes" USING btree ("parent_class_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "cmdb_object_environments_object_uidx" ON "cmdb_object_environments" USING btree ("object_id");
--> statement-breakpoint
CREATE INDEX "cmdb_object_environments_environment_idx" ON "cmdb_object_environments" USING btree ("environment_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "cmdb_object_properties_uidx" ON "cmdb_object_properties" USING btree ("object_id","property_id");
--> statement-breakpoint
CREATE INDEX "cmdb_object_properties_property_id_idx" ON "cmdb_object_properties" USING btree ("property_id");
--> statement-breakpoint
CREATE INDEX "cmdb_object_relationships_source_idx" ON "cmdb_object_relationships" USING btree ("source_object_id");
--> statement-breakpoint
CREATE INDEX "cmdb_object_relationships_target_idx" ON "cmdb_object_relationships" USING btree ("target_object_id");
--> statement-breakpoint
CREATE INDEX "cmdb_object_relationships_property_id_idx" ON "cmdb_object_relationships" USING btree ("property_id");
--> statement-breakpoint
CREATE INDEX "cmdb_object_relationships_type_id_idx" ON "cmdb_object_relationships" USING btree ("type_id");
--> statement-breakpoint
CREATE INDEX "cmdb_objects_lookup_idx" ON "cmdb_objects" USING btree ("class_id","external_id","observed_at");
--> statement-breakpoint
CREATE INDEX "cmdb_objects_source_idx" ON "cmdb_objects" USING btree ("source_ticket_id");
--> statement-breakpoint
CREATE INDEX "cmdb_objects_run_idx" ON "cmdb_objects" USING btree ("source_run_id");
--> statement-breakpoint
CREATE INDEX "cmdb_objects_step_idx" ON "cmdb_objects" USING btree ("source_step_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "cmdb_relationship_types_key_uidx" ON "cmdb_relationship_types" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "itsm_connector_runs_connector_idx" ON "itsm_connector_runs" USING btree ("connector_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "itsm_connectors_key_uidx" ON "itsm_connectors" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "itsm_connectors_enabled_idx" ON "itsm_connectors" USING btree ("enabled");
--> statement-breakpoint
CREATE UNIQUE INDEX "itsm_dispatch_ledger_trigger_uidx" ON "itsm_dispatch_ledger" USING btree ("ticket_id","trigger_key");
--> statement-breakpoint
CREATE INDEX "itsm_dispatch_ledger_connector_idx" ON "itsm_dispatch_ledger" USING btree ("connector_id","dispatched_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "itsm_environment_routes_match_uidx" ON "itsm_environment_routes" USING btree ("connector_id","source_field","source_value");
--> statement-breakpoint
CREATE INDEX "itsm_environment_routes_order_idx" ON "itsm_environment_routes" USING btree ("connector_id","position");
--> statement-breakpoint
CREATE UNIQUE INDEX "itsm_field_mappings_target_uidx" ON "itsm_field_mappings" USING btree ("connector_id","target_field");
--> statement-breakpoint
CREATE UNIQUE INDEX "itsm_proposal_verdicts_call_uidx" ON "itsm_proposal_verdicts" USING btree ("proposal_id","call_ordinal","reviewer_id");
--> statement-breakpoint
CREATE INDEX "itsm_proposal_verdicts_reviewer_idx" ON "itsm_proposal_verdicts" USING btree ("reviewer_id","decided_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "itsm_proposals_run_uidx" ON "itsm_proposals" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "itsm_proposals_connector_idx" ON "itsm_proposals" USING btree ("connector_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "itsm_ticket_origins_external_uidx" ON "itsm_ticket_origins" USING btree ("connector_id","external_id");
--> statement-breakpoint
CREATE INDEX "itsm_ticket_origins_connector_idx" ON "itsm_ticket_origins" USING btree ("connector_id");
--> statement-breakpoint
CREATE INDEX "itsm_writebacks_due_idx" ON "itsm_writebacks" USING btree ("status","next_attempt_at");
--> statement-breakpoint
CREATE INDEX "itsm_writebacks_ticket_idx" ON "itsm_writebacks" USING btree ("ticket_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_widgets_user_key_uidx" ON "dashboard_widgets" USING btree ("user_id","widget_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_widgets_user_position_uidx" ON "dashboard_widgets" USING btree ("user_id","position");
--> statement-breakpoint
CREATE INDEX "dashboard_widgets_user_idx" ON "dashboard_widgets" USING btree ("user_id","position");
--> statement-breakpoint
CREATE INDEX "device_command_proposals_status_idx" ON "device_command_proposals" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX "device_command_proposals_device_idx" ON "device_command_proposals" USING btree ("device_id","status");
--> statement-breakpoint
CREATE INDEX "device_command_proposals_ticket_idx" ON "device_command_proposals" USING btree ("ticket_id");
--> statement-breakpoint
CREATE INDEX "device_command_proposals_run_idx" ON "device_command_proposals" USING btree ("run_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "device_commands_seq_idx" ON "device_commands" USING btree ("device_id","sequence");
--> statement-breakpoint
CREATE INDEX "device_commands_status_idx" ON "device_commands" USING btree ("device_id","status");
--> statement-breakpoint
CREATE INDEX "device_commands_run_idx" ON "device_commands" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "device_commands_step_idx" ON "device_commands" USING btree ("step_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "device_enrolment_tokens_hash_uidx" ON "device_enrolment_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "devices_owner_idx" ON "devices" USING btree ("owner_id");
--> statement-breakpoint
CREATE INDEX "devices_connected_idx" ON "devices" USING btree ("connected");
--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_target_uidx" ON "document_links" USING btree ("document_id","target_type","target_id");
--> statement-breakpoint
CREATE INDEX "document_links_target_idx" ON "document_links" USING btree ("target_type","target_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "documents_sha256_uidx" ON "documents" USING btree ("sha256");
--> statement-breakpoint
CREATE UNIQUE INDEX "documents_stored_filename_uidx" ON "documents" USING btree ("stored_filename");
--> statement-breakpoint
CREATE UNIQUE INDEX "dynamic_field_values_field_object_uidx" ON "dynamic_field_values" USING btree ("field_id","object_id");
--> statement-breakpoint
CREATE INDEX "dynamic_field_values_object_idx" ON "dynamic_field_values" USING btree ("object_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "dynamic_fields_object_key_uidx" ON "dynamic_fields" USING btree ("object_type","key");
--> statement-breakpoint
CREATE INDEX "dynamic_fields_active_idx" ON "dynamic_fields" USING btree ("object_type","is_active","display_order");
--> statement-breakpoint
CREATE UNIQUE INDEX "environments_key_uidx" ON "environments" USING btree ("key");
--> statement-breakpoint
CREATE UNIQUE INDEX "environments_default_uidx" ON "environments" USING btree ("is_default") WHERE "environments"."is_default" = true;
--> statement-breakpoint
CREATE INDEX "service_environments_environment_idx" ON "service_environments" USING btree ("environment_id");
--> statement-breakpoint
CREATE INDEX "ticket_environments_environment_idx" ON "ticket_environments" USING btree ("environment_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "form_fields_form_key_uidx" ON "form_fields" USING btree ("form_id","key");
--> statement-breakpoint
CREATE UNIQUE INDEX "form_fields_form_ordinal_uidx" ON "form_fields" USING btree ("form_id","ordinal");
--> statement-breakpoint
CREATE INDEX "form_submissions_form_idx" ON "form_submissions" USING btree ("form_id","created_at");
--> statement-breakpoint
CREATE INDEX "form_submissions_submitter_idx" ON "form_submissions" USING btree ("submitter_id");
--> statement-breakpoint
CREATE INDEX "form_submissions_ticket_idx" ON "form_submissions" USING btree ("ticket_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "forms_key_version_uidx" ON "forms" USING btree ("key","version");
--> statement-breakpoint
CREATE INDEX "forms_status_idx" ON "forms" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_providers_provider_id_uidx" ON "auth_providers" USING btree ("provider_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "directory_identities_provider_external_uidx" ON "directory_identities" USING btree ("provider_id","external_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "directory_identities_provider_user_uidx" ON "directory_identities" USING btree ("provider_id","user_id");
--> statement-breakpoint
CREATE INDEX "directory_identities_leaver_idx" ON "directory_identities" USING btree ("provider_id","leaver");
--> statement-breakpoint
CREATE INDEX "directory_identities_user_id_idx" ON "directory_identities" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "directory_sync_runs_provider_created_idx" ON "directory_sync_runs" USING btree ("provider_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_devices_device_uidx" ON "asset_devices" USING btree ("device_id");
--> statement-breakpoint
CREATE INDEX "asset_devices_asset_idx" ON "asset_devices" USING btree ("asset_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_disks_device_key_uidx" ON "asset_disks" USING btree ("asset_device_id","device_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_hardware_device_uidx" ON "asset_hardware" USING btree ("asset_device_id");
--> statement-breakpoint
CREATE INDEX "inventory_reports_device_idx" ON "inventory_reports" USING btree ("asset_device_id","reported_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "software_inventory_identity_uidx" ON "software_inventory_apps" USING btree ("asset_device_id","identity_key");
--> statement-breakpoint
CREATE INDEX "software_inventory_name_idx" ON "software_inventory_apps" USING btree ("name");
--> statement-breakpoint
CREATE INDEX "ticket_audit_ticket_idx" ON "ticket_audit" USING btree ("ticket_id","created_at");
--> statement-breakpoint
CREATE INDEX "ticket_time_entries_ticket_idx" ON "ticket_time_entries" USING btree ("ticket_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_acl_article_grant_uidx" ON "knowledge_acl" USING btree ("article_id","principal_type","principal_id","permission") WHERE "knowledge_acl"."article_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_acl_folder_grant_uidx" ON "knowledge_acl" USING btree ("folder_id","principal_type","principal_id","permission") WHERE "knowledge_acl"."folder_id" is not null;
--> statement-breakpoint
CREATE INDEX "knowledge_acl_article_idx" ON "knowledge_acl" USING btree ("article_id");
--> statement-breakpoint
CREATE INDEX "knowledge_acl_folder_idx" ON "knowledge_acl" USING btree ("folder_id");
--> statement-breakpoint
CREATE INDEX "knowledge_acl_principal_idx" ON "knowledge_acl" USING btree ("principal_type","principal_id");
--> statement-breakpoint
CREATE INDEX "knowledge_article_tags_tag_id_idx" ON "knowledge_article_tags" USING btree ("tag_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_article_versions_article_version_uidx" ON "knowledge_article_versions" USING btree ("article_id","version");
--> statement-breakpoint
CREATE INDEX "knowledge_article_versions_author_id_idx" ON "knowledge_article_versions" USING btree ("author_id");
--> statement-breakpoint
CREATE INDEX "knowledge_articles_folder_idx" ON "knowledge_articles" USING btree ("folder_id");
--> statement-breakpoint
CREATE INDEX "knowledge_articles_author_id_idx" ON "knowledge_articles" USING btree ("author_id");
--> statement-breakpoint
CREATE INDEX "knowledge_articles_publication_idx" ON "knowledge_articles" USING btree ("status","audience","is_restricted");
--> statement-breakpoint
CREATE INDEX "knowledge_articles_lexical_idx" ON "knowledge_articles" USING gin (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("body", '')));
--> statement-breakpoint
CREATE INDEX "knowledge_folders_parent_idx" ON "knowledge_folders" USING btree ("parent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_folders_parent_name_uidx" ON "knowledge_folders" USING btree ("parent_id","name") WHERE "knowledge_folders"."parent_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_folders_root_name_uidx" ON "knowledge_folders" USING btree ("name") WHERE "knowledge_folders"."parent_id" is null;
--> statement-breakpoint
CREATE INDEX "knowledge_gap_clusters_status_idx" ON "knowledge_gap_clusters" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX "knowledge_gap_clusters_article_id_idx" ON "knowledge_gap_clusters" USING btree ("article_id");
--> statement-breakpoint
CREATE INDEX "knowledge_gap_tickets_ticket_idx" ON "knowledge_gap_tickets" USING btree ("ticket_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_links_relation_uidx" ON "ticket_links" USING btree ("ticket_id","target_ticket_id","relation_type");
--> statement-breakpoint
CREATE INDEX "ticket_links_target_idx" ON "ticket_links" USING btree ("target_ticket_id");
--> statement-breakpoint
CREATE INDEX "ticket_merges_source_idx" ON "ticket_merges" USING btree ("source_ticket_id","merged_at");
--> statement-breakpoint
CREATE INDEX "ticket_merges_target_idx" ON "ticket_merges" USING btree ("target_ticket_id","merged_at");
--> statement-breakpoint
CREATE INDEX "email_attachments_inbound_idx" ON "email_attachments" USING btree ("inbound_email_id");
--> statement-breakpoint
CREATE INDEX "email_send_log_ticket_idx" ON "email_send_log" USING btree ("ticket_id","attempted_at");
--> statement-breakpoint
CREATE INDEX "email_send_log_recipient_idx" ON "email_send_log" USING btree ("recipient","attempted_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_emails_mailbox_provider_uidx" ON "inbound_emails" USING btree ("mailbox_id","provider_message_id");
--> statement-breakpoint
CREATE INDEX "inbound_emails_ticket_idx" ON "inbound_emails" USING btree ("ticket_id","received_at");
--> statement-breakpoint
CREATE INDEX "mailbox_activity_mailbox_idx" ON "mailbox_activity_log" USING btree ("mailbox_id","created_at");
--> statement-breakpoint
CREATE INDEX "mailbox_activity_log_inbound_email_id_idx" ON "mailbox_activity_log" USING btree ("inbound_email_id");
--> statement-breakpoint
CREATE INDEX "mailbox_activity_log_ticket_id_idx" ON "mailbox_activity_log" USING btree ("ticket_id");
--> statement-breakpoint
CREATE INDEX "ticket_mail_origins_mailbox_idx" ON "ticket_mail_origins" USING btree ("mailbox_id");
--> statement-breakpoint
CREATE INDEX "ticket_mail_origins_inbound_email_id_idx" ON "ticket_mail_origins" USING btree ("inbound_email_id");
--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_idx" ON "ticket_messages" USING btree ("ticket_id","created_at");
--> statement-breakpoint
CREATE INDEX "ticket_messages_author_id_idx" ON "ticket_messages" USING btree ("author_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_recipient_record_event_uidx" ON "notifications" USING btree ("recipient_id","record_type","record_id","event_type");
--> statement-breakpoint
CREATE INDEX "notifications_actor_id_idx" ON "notifications" USING btree ("actor_id");
--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("recipient_id","read_at","updated_at");
--> statement-breakpoint
CREATE INDEX "ticket_number_history_ticket_idx" ON "ticket_number_history" USING btree ("ticket_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "department_teams_team_uidx" ON "department_teams" USING btree ("team_id");
--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_members" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "pending_followups_ticket_idx" ON "pending_followups" USING btree ("ticket_id","created_at");
--> statement-breakpoint
CREATE INDEX "pending_followups_reason_id_idx" ON "pending_followups" USING btree ("reason_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_csat_ticket_idx" ON "ticket_csat_responses" USING btree ("ticket_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_csat_token_idx" ON "ticket_csat_responses" USING btree ("token");
--> statement-breakpoint
CREATE INDEX "ticket_presence_expiry_idx" ON "ticket_presence" USING btree ("ticket_id","expires_at");
--> statement-breakpoint
CREATE INDEX "ticket_presence_user_id_idx" ON "ticket_presence" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "problem_tickets_ticket_idx" ON "problem_tickets" USING btree ("ticket_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "problems_number_uidx" ON "problems" USING btree ("problem_number");
--> statement-breakpoint
CREATE INDEX "problems_status_priority_idx" ON "problems" USING btree ("status","priority");
--> statement-breakpoint
CREATE INDEX "problems_assignee_idx" ON "problems" USING btree ("assignee_id");
--> statement-breakpoint
CREATE INDEX "problems_service_idx" ON "problems" USING btree ("service_id");
--> statement-breakpoint
CREATE INDEX "problems_known_error_idx" ON "problems" USING btree ("is_known_error","status");
--> statement-breakpoint
CREATE INDEX "role_grants_target_idx" ON "role_grants" USING btree ("target_type","target_id","created_at");
--> statement-breakpoint
CREATE INDEX "role_grants_role_idx" ON "role_grants" USING btree ("role_id","created_at");
--> statement-breakpoint
CREATE INDEX "role_grants_actor_id_idx" ON "role_grants" USING btree ("actor_id");
--> statement-breakpoint
CREATE INDEX "team_roles_role_idx" ON "team_roles" USING btree ("role_id");
--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");
--> statement-breakpoint
CREATE INDEX "ticket_rule_firings_ticket_idx" ON "ticket_rule_firings" USING btree ("ticket_id","created_at");
--> statement-breakpoint
CREATE INDEX "ticket_rule_firings_rule_id_idx" ON "ticket_rule_firings" USING btree ("rule_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_rules_position_uidx" ON "ticket_rules" USING btree ("position");
--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_ticket_occurrences_slot_uidx" ON "recurring_ticket_occurrences" USING btree ("recurring_ticket_id","occurs_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_ticket_occurrences_key_uidx" ON "recurring_ticket_occurrences" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "recurring_ticket_occurrences_ticket_idx" ON "recurring_ticket_occurrences" USING btree ("generated_ticket_id");
--> statement-breakpoint
CREATE INDEX "recurring_tickets_due_idx" ON "recurring_tickets" USING btree ("enabled","starts_at");
--> statement-breakpoint
CREATE INDEX "recurring_tickets_source_ticket_id_idx" ON "recurring_tickets" USING btree ("source_ticket_id");
--> statement-breakpoint
CREATE INDEX "ticket_scheduling_calendar_idx" ON "ticket_scheduling" USING btree ("work_start_at","work_end_at");
--> statement-breakpoint
CREATE INDEX "ticket_scheduling_snooze_idx" ON "ticket_scheduling" USING btree ("snoozed_until");
--> statement-breakpoint
CREATE INDEX "search_documents_fts_idx" ON "search_documents" USING gin ((
				setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
				setweight(to_tsvector('english', coalesce("body", '')), 'B')
			));
--> statement-breakpoint
CREATE INDEX "search_documents_changed_idx" ON "search_documents" USING btree ("object_type","source_updated_at");
--> statement-breakpoint
CREATE INDEX "search_documents_embedding_idx" ON "search_documents" USING hnsw ("embedding" vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX "olas_priority_idx" ON "olas" USING btree ("priority");
--> statement-breakpoint
CREATE INDEX "olas_calendar_id_idx" ON "olas" USING btree ("calendar_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "sla_escalation_events_idempotency_uidx" ON "sla_escalation_events" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "sla_escalation_events_ticket_idx" ON "sla_escalation_events" USING btree ("ticket_id","created_at");
--> statement-breakpoint
CREATE INDEX "sla_escalation_events_stopwatch_id_idx" ON "sla_escalation_events" USING btree ("stopwatch_id");
--> statement-breakpoint
CREATE INDEX "sla_escalation_events_rule_id_idx" ON "sla_escalation_events" USING btree ("rule_id");
--> statement-breakpoint
CREATE INDEX "sla_notification_rules_policy_idx" ON "sla_notification_rules" USING btree ("policy_type","policy_id");
--> statement-breakpoint
CREATE INDEX "slas_priority_idx" ON "slas" USING btree ("priority");
--> statement-breakpoint
CREATE INDEX "slas_calendar_id_idx" ON "slas" USING btree ("calendar_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_stopwatches_target_uidx" ON "ticket_stopwatches" USING btree ("ticket_id","policy_type","target_type");
--> statement-breakpoint
CREATE INDEX "ticket_stopwatches_running_idx" ON "ticket_stopwatches" USING btree ("running","started_at");
--> statement-breakpoint
CREATE INDEX "software_allocations_entitlement_idx" ON "software_licence_allocations" USING btree ("entitlement_id","revoked_at");
--> statement-breakpoint
CREATE INDEX "software_allocations_asset_idx" ON "software_licence_allocations" USING btree ("asset_id");
--> statement-breakpoint
CREATE INDEX "software_allocations_user_idx" ON "software_licence_allocations" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "software_entitlements_product_idx" ON "software_licence_entitlements" USING btree ("product_id","expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "software_products_identity_uidx" ON "software_products" USING btree ("identity_key");
--> statement-breakpoint
CREATE INDEX "status_incidents_service_time_idx" ON "status_incidents" USING btree ("service_id","started_at");
--> statement-breakpoint
CREATE INDEX "status_incidents_impact_level_idx" ON "status_incidents" USING btree ("impact_level");
--> statement-breakpoint
CREATE INDEX "contract_coverage_windows_contract_idx" ON "contract_coverage_windows" USING btree ("contract_id","weekday");
--> statement-breakpoint
CREATE INDEX "contract_coverage_windows_sla_id_idx" ON "contract_coverage_windows" USING btree ("sla_id");
--> statement-breakpoint
CREATE INDEX "contracts_service_dates_idx" ON "contracts" USING btree ("service_id","starts_on","ends_on");
--> statement-breakpoint
CREATE INDEX "contracts_supplier_idx" ON "contracts" USING btree ("supplier_id");
--> statement-breakpoint
CREATE INDEX "email_template_rules_template_id_idx" ON "email_template_rules" USING btree ("template_id");
--> statement-breakpoint
CREATE INDEX "email_template_rules_lookup_idx" ON "email_template_rules" USING btree ("enabled","scope","match_value");
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_creation_claims_reporter_key_uidx" ON "ticket_creation_claims" USING btree ("reporter_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX "ticket_creation_claims_expiry_idx" ON "ticket_creation_claims" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "ticket_transitions_ticket_idx" ON "ticket_transitions" USING btree ("ticket_id","created_at");
--> statement-breakpoint
CREATE INDEX "tickets_reporter_idx" ON "tickets" USING btree ("reporter_id");
--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "tickets" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX "tickets_priority_idx" ON "tickets" USING btree ("priority","created_at");
--> statement-breakpoint
CREATE INDEX "tickets_type_idx" ON "tickets" USING btree ("record_type","status");
--> statement-breakpoint
CREATE INDEX "tickets_device_idx" ON "tickets" USING btree ("device_id");
--> statement-breakpoint
CREATE INDEX "tickets_service_idx" ON "tickets" USING btree ("service_id","service_subcategory_id");
--> statement-breakpoint
CREATE INDEX "tickets_assignee_id_idx" ON "tickets" USING btree ("assignee_id");
--> statement-breakpoint
CREATE INDEX "tickets_owner_id_idx" ON "tickets" USING btree ("owner_id");
--> statement-breakpoint
CREATE INDEX "tickets_team_id_idx" ON "tickets" USING btree ("team_id");
--> statement-breakpoint
CREATE INDEX "tickets_pending_reason_id_idx" ON "tickets" USING btree ("pending_reason_id");
--> statement-breakpoint
CREATE INDEX "tickets_merged_into_id_idx" ON "tickets" USING btree ("merged_into_id");
--> statement-breakpoint
CREATE INDEX "tickets_service_subcategory_id_service_id_idx" ON "tickets" USING btree ("service_subcategory_id","service_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_owner_name_uidx" ON "saved_views" USING btree ("owner_type","owner_id","name");
--> statement-breakpoint
CREATE INDEX "saved_views_creator_idx" ON "saved_views" USING btree ("created_by_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_status_transitions_lookup_idx" ON "ticket_status_transitions" USING btree ("from_status","action");
--> statement-breakpoint
CREATE INDEX "ticket_status_transitions_to_status_idx" ON "ticket_status_transitions" USING btree ("to_status");
--> statement-breakpoint
CREATE INDEX "ticket_statuses_order_idx" ON "ticket_statuses" USING btree ("is_active","display_order");
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_due_idx" ON "webhook_deliveries" USING btree ("status","next_attempt_at");
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_execution_idx" ON "webhook_deliveries" USING btree ("execution_id","created_at");
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_delivering_idx" ON "webhook_deliveries" USING btree ("claimed_at") WHERE "webhook_deliveries"."status" = 'delivering';
--> statement-breakpoint
CREATE INDEX "workflow_executions_workflow_idx" ON "workflow_executions" USING btree ("workflow_id","started_at");
--> statement-breakpoint
CREATE INDEX "workflow_executions_record_idx" ON "workflow_executions" USING btree ("record_type","record_id");
--> statement-breakpoint
CREATE INDEX "workflow_executions_expired_lease_idx" ON "workflow_executions" USING btree ("lease_expires_at") WHERE "workflow_executions"."status" = 'running';
--> statement-breakpoint
CREATE INDEX "workflows_trigger_idx" ON "workflows" USING btree ("is_active","trigger_event");
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_started_by_id_user_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api_key_rate_limits" ADD CONSTRAINT "api_key_rate_limits_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_checkout_log" ADD CONSTRAINT "asset_checkout_log_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_checkout_log" ADD CONSTRAINT "asset_checkout_log_custodian_id_user_id_fk" FOREIGN KEY ("custodian_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_import_identities" ADD CONSTRAINT "asset_import_identities_profile_id_asset_import_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."asset_import_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_import_identities" ADD CONSTRAINT "asset_import_identities_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_import_rejections" ADD CONSTRAINT "asset_import_rejections_run_id_asset_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."asset_import_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_import_runs" ADD CONSTRAINT "asset_import_runs_profile_id_asset_import_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."asset_import_profiles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_status_id_asset_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."asset_statuses"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_custodian_id_user_id_fk" FOREIGN KEY ("custodian_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_manager_id_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_holidays" ADD CONSTRAINT "calendar_holidays_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_hours" ADD CONSTRAINT "calendar_hours_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_subcategories" ADD CONSTRAINT "service_subcategories_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_subcategories" ADD CONSTRAINT "service_subcategories_approver_override_id_user_id_fk" FOREIGN KEY ("approver_override_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_subcategories" ADD CONSTRAINT "service_subcategories_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_family_id_service_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."service_families"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_sla_id_fkey" FOREIGN KEY ("sla_id") REFERENCES "public"."slas"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_ola_id_fkey" FOREIGN KEY ("ola_id") REFERENCES "public"."olas"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "change_cab_members" ADD CONSTRAINT "change_cab_members_change_id_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."changes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "change_cab_members" ADD CONSTRAINT "change_cab_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "change_cab_votes" ADD CONSTRAINT "change_cab_votes_member_id_change_cab_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."change_cab_members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "change_ticket_links" ADD CONSTRAINT "change_ticket_links_change_id_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."changes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "change_ticket_links" ADD CONSTRAINT "change_ticket_links_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "change_transitions" ADD CONSTRAINT "change_transitions_change_id_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."changes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "change_transitions" ADD CONSTRAINT "change_transitions_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "change_transitions" ADD CONSTRAINT "change_transitions_step_id_agent_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."agent_steps"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_source_run_id_agent_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_source_step_id_agent_steps_id_fk" FOREIGN KEY ("source_step_id") REFERENCES "public"."agent_steps"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_thread_id_messaging_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."messaging_threads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "messaging_channels" ADD CONSTRAINT "messaging_channels_default_origin_id_ticket_origins_id_fk" FOREIGN KEY ("default_origin_id") REFERENCES "public"."ticket_origins"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "messaging_threads" ADD CONSTRAINT "messaging_threads_channel_id_messaging_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."messaging_channels"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "messaging_threads" ADD CONSTRAINT "messaging_threads_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "messaging_threads" ADD CONSTRAINT "messaging_threads_origin_key_ticket_origins_key_fk" FOREIGN KEY ("origin_key") REFERENCES "public"."ticket_origins"("key") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_cmdb_objects" ADD CONSTRAINT "ticket_cmdb_objects_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_cmdb_objects" ADD CONSTRAINT "ticket_cmdb_objects_object_id_cmdb_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."cmdb_objects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_class_properties" ADD CONSTRAINT "cmdb_class_properties_class_id_cmdb_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."cmdb_classes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_class_properties" ADD CONSTRAINT "cmdb_class_properties_target_class_id_cmdb_classes_id_fk" FOREIGN KEY ("target_class_id") REFERENCES "public"."cmdb_classes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_classes" ADD CONSTRAINT "cmdb_classes_parent_class_id_cmdb_classes_id_fk" FOREIGN KEY ("parent_class_id") REFERENCES "public"."cmdb_classes"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_object_environments" ADD CONSTRAINT "cmdb_object_environments_object_id_cmdb_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."cmdb_objects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_object_environments" ADD CONSTRAINT "cmdb_object_environments_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_object_properties" ADD CONSTRAINT "cmdb_object_properties_object_id_cmdb_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."cmdb_objects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_object_properties" ADD CONSTRAINT "cmdb_object_properties_property_id_cmdb_class_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."cmdb_class_properties"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_object_relationships" ADD CONSTRAINT "cmdb_object_relationships_type_id_cmdb_relationship_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."cmdb_relationship_types"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_object_relationships" ADD CONSTRAINT "cmdb_object_relationships_source_object_id_cmdb_objects_id_fk" FOREIGN KEY ("source_object_id") REFERENCES "public"."cmdb_objects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_object_relationships" ADD CONSTRAINT "cmdb_object_relationships_target_object_id_cmdb_objects_id_fk" FOREIGN KEY ("target_object_id") REFERENCES "public"."cmdb_objects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_object_relationships" ADD CONSTRAINT "cmdb_object_relationships_property_id_cmdb_class_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."cmdb_class_properties"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_objects" ADD CONSTRAINT "cmdb_objects_class_id_cmdb_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."cmdb_classes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_objects" ADD CONSTRAINT "cmdb_objects_source_ticket_id_tickets_id_fk" FOREIGN KEY ("source_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_objects" ADD CONSTRAINT "cmdb_objects_source_run_id_agent_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cmdb_objects" ADD CONSTRAINT "cmdb_objects_source_step_id_agent_steps_id_fk" FOREIGN KEY ("source_step_id") REFERENCES "public"."agent_steps"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_connector_runs" ADD CONSTRAINT "itsm_connector_runs_connector_id_itsm_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."itsm_connectors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_connectors" ADD CONSTRAINT "itsm_connectors_ticket_origin_ticket_origins_key_fk" FOREIGN KEY ("ticket_origin") REFERENCES "public"."ticket_origins"("key") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_connectors" ADD CONSTRAINT "itsm_connectors_default_environment_id_environments_id_fk" FOREIGN KEY ("default_environment_id") REFERENCES "public"."environments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_dispatch_ledger" ADD CONSTRAINT "itsm_dispatch_ledger_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_dispatch_ledger" ADD CONSTRAINT "itsm_dispatch_ledger_connector_id_itsm_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."itsm_connectors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_dispatch_ledger" ADD CONSTRAINT "itsm_dispatch_ledger_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_environment_routes" ADD CONSTRAINT "itsm_environment_routes_connector_id_itsm_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."itsm_connectors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_environment_routes" ADD CONSTRAINT "itsm_environment_routes_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_field_mappings" ADD CONSTRAINT "itsm_field_mappings_connector_id_itsm_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."itsm_connectors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_proposal_verdicts" ADD CONSTRAINT "itsm_proposal_verdicts_proposal_id_itsm_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."itsm_proposals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_proposals" ADD CONSTRAINT "itsm_proposals_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_proposals" ADD CONSTRAINT "itsm_proposals_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_proposals" ADD CONSTRAINT "itsm_proposals_connector_id_itsm_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."itsm_connectors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_ticket_origins" ADD CONSTRAINT "itsm_ticket_origins_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_ticket_origins" ADD CONSTRAINT "itsm_ticket_origins_connector_id_itsm_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."itsm_connectors"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_writebacks" ADD CONSTRAINT "itsm_writebacks_connector_id_itsm_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."itsm_connectors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_writebacks" ADD CONSTRAINT "itsm_writebacks_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "itsm_writebacks" ADD CONSTRAINT "itsm_writebacks_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_command_proposals" ADD CONSTRAINT "device_command_proposals_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_command_proposals" ADD CONSTRAINT "device_command_proposals_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_command_proposals" ADD CONSTRAINT "device_command_proposals_step_id_agent_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."agent_steps"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_command_proposals" ADD CONSTRAINT "device_command_proposals_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_command_proposals" ADD CONSTRAINT "device_command_proposals_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_step_id_agent_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."agent_steps"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_enrolment_tokens" ADD CONSTRAINT "device_enrolment_tokens_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dynamic_field_values" ADD CONSTRAINT "dynamic_field_values_field_id_dynamic_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."dynamic_fields"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_environments" ADD CONSTRAINT "service_environments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "service_environments" ADD CONSTRAINT "service_environments_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_environments" ADD CONSTRAINT "ticket_environments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_environments" ADD CONSTRAINT "ticket_environments_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_submitter_id_user_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "directory_identities" ADD CONSTRAINT "directory_identities_provider_id_auth_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."auth_providers"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "directory_identities" ADD CONSTRAINT "directory_identities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "directory_sync_runs" ADD CONSTRAINT "directory_sync_runs_provider_id_auth_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."auth_providers"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_devices" ADD CONSTRAINT "asset_devices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_devices" ADD CONSTRAINT "asset_devices_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_disks" ADD CONSTRAINT "asset_disks_asset_device_id_asset_devices_id_fk" FOREIGN KEY ("asset_device_id") REFERENCES "public"."asset_devices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_hardware" ADD CONSTRAINT "asset_hardware_asset_device_id_asset_devices_id_fk" FOREIGN KEY ("asset_device_id") REFERENCES "public"."asset_devices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory_reports" ADD CONSTRAINT "inventory_reports_asset_device_id_asset_devices_id_fk" FOREIGN KEY ("asset_device_id") REFERENCES "public"."asset_devices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_inventory_apps" ADD CONSTRAINT "software_inventory_apps_asset_device_id_asset_devices_id_fk" FOREIGN KEY ("asset_device_id") REFERENCES "public"."asset_devices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_audit" ADD CONSTRAINT "ticket_audit_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_time_entries" ADD CONSTRAINT "ticket_time_entries_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_acl" ADD CONSTRAINT "knowledge_acl_article_id_knowledge_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_articles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_acl" ADD CONSTRAINT "knowledge_acl_folder_id_knowledge_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."knowledge_folders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_article_tags" ADD CONSTRAINT "knowledge_article_tags_article_id_knowledge_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_articles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_article_tags" ADD CONSTRAINT "knowledge_article_tags_tag_id_knowledge_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."knowledge_tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_article_versions" ADD CONSTRAINT "knowledge_article_versions_article_id_knowledge_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_articles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_article_versions" ADD CONSTRAINT "knowledge_article_versions_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_folder_id_knowledge_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."knowledge_folders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_folders" ADD CONSTRAINT "knowledge_folders_parent_id_knowledge_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."knowledge_folders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_gap_clusters" ADD CONSTRAINT "knowledge_gap_clusters_article_id_knowledge_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_articles"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_gap_tickets" ADD CONSTRAINT "knowledge_gap_tickets_cluster_id_knowledge_gap_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."knowledge_gap_clusters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "knowledge_gap_tickets" ADD CONSTRAINT "knowledge_gap_tickets_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_target_ticket_id_tickets_id_fk" FOREIGN KEY ("target_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_merges" ADD CONSTRAINT "ticket_merges_source_ticket_id_tickets_id_fk" FOREIGN KEY ("source_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_merges" ADD CONSTRAINT "ticket_merges_target_ticket_id_tickets_id_fk" FOREIGN KEY ("target_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_inbound_email_id_inbound_emails_id_fk" FOREIGN KEY ("inbound_email_id") REFERENCES "public"."inbound_emails"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mailbox_activity_log" ADD CONSTRAINT "mailbox_activity_log_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mailbox_activity_log" ADD CONSTRAINT "mailbox_activity_log_inbound_email_id_inbound_emails_id_fk" FOREIGN KEY ("inbound_email_id") REFERENCES "public"."inbound_emails"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mailbox_activity_log" ADD CONSTRAINT "mailbox_activity_log_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_ticket_origin_ticket_origins_key_fk" FOREIGN KEY ("ticket_origin") REFERENCES "public"."ticket_origins"("key") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_mail_origins" ADD CONSTRAINT "ticket_mail_origins_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_mail_origins" ADD CONSTRAINT "ticket_mail_origins_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_mail_origins" ADD CONSTRAINT "ticket_mail_origins_ticket_origin_ticket_origins_key_fk" FOREIGN KEY ("ticket_origin") REFERENCES "public"."ticket_origins"("key") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_mail_origins" ADD CONSTRAINT "ticket_mail_origins_inbound_email_id_inbound_emails_id_fk" FOREIGN KEY ("inbound_email_id") REFERENCES "public"."inbound_emails"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_number_history" ADD CONSTRAINT "ticket_number_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "department_teams" ADD CONSTRAINT "department_teams_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "department_teams" ADD CONSTRAINT "department_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pending_followups" ADD CONSTRAINT "pending_followups_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pending_followups" ADD CONSTRAINT "pending_followups_reason_id_pending_reasons_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."pending_reasons"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_csat_responses" ADD CONSTRAINT "ticket_csat_responses_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_presence" ADD CONSTRAINT "ticket_presence_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_presence" ADD CONSTRAINT "ticket_presence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "problem_tickets" ADD CONSTRAINT "problem_tickets_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "problem_tickets" ADD CONSTRAINT "problem_tickets_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_status_ticket_statuses_key_fk" FOREIGN KEY ("status") REFERENCES "public"."ticket_statuses"("key") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "role_capabilities" ADD CONSTRAINT "role_capabilities_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_roles" ADD CONSTRAINT "team_roles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_roles" ADD CONSTRAINT "team_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_rule_firings" ADD CONSTRAINT "ticket_rule_firings_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_rule_firings" ADD CONSTRAINT "ticket_rule_firings_rule_id_ticket_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."ticket_rules"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_ticket_occurrences" ADD CONSTRAINT "recurring_ticket_occurrences_recurring_ticket_id_recurring_tickets_id_fk" FOREIGN KEY ("recurring_ticket_id") REFERENCES "public"."recurring_tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_ticket_occurrences" ADD CONSTRAINT "recurring_ticket_occurrences_generated_ticket_id_tickets_id_fk" FOREIGN KEY ("generated_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_tickets" ADD CONSTRAINT "recurring_tickets_source_ticket_id_tickets_id_fk" FOREIGN KEY ("source_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_scheduling" ADD CONSTRAINT "ticket_scheduling_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "olas" ADD CONSTRAINT "olas_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sla_escalation_events" ADD CONSTRAINT "sla_escalation_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sla_escalation_events" ADD CONSTRAINT "sla_escalation_events_stopwatch_id_ticket_stopwatches_id_fk" FOREIGN KEY ("stopwatch_id") REFERENCES "public"."ticket_stopwatches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sla_escalation_events" ADD CONSTRAINT "sla_escalation_events_rule_id_sla_notification_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."sla_notification_rules"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "slas" ADD CONSTRAINT "slas_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_stopwatches" ADD CONSTRAINT "ticket_stopwatches_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_licence_allocations" ADD CONSTRAINT "software_licence_allocations_entitlement_id_software_licence_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."software_licence_entitlements"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_licence_allocations" ADD CONSTRAINT "software_licence_allocations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_licence_allocations" ADD CONSTRAINT "software_licence_allocations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "software_licence_entitlements" ADD CONSTRAINT "software_licence_entitlements_product_id_software_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."software_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "status_incidents" ADD CONSTRAINT "status_incidents_service_id_status_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."status_services"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "status_incidents" ADD CONSTRAINT "status_incidents_impact_level_service_impact_levels_key_fk" FOREIGN KEY ("impact_level") REFERENCES "public"."service_impact_levels"("key") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contract_coverage_windows" ADD CONSTRAINT "contract_coverage_windows_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contract_coverage_windows" ADD CONSTRAINT "contract_coverage_windows_sla_id_slas_id_fk" FOREIGN KEY ("sla_id") REFERENCES "public"."slas"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_template_rules" ADD CONSTRAINT "email_template_rules_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_creation_claims" ADD CONSTRAINT "ticket_creation_claims_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_creation_claims" ADD CONSTRAINT "ticket_creation_claims_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_transitions" ADD CONSTRAINT "ticket_transitions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_ticket_statuses_key_fk" FOREIGN KEY ("status") REFERENCES "public"."ticket_statuses"("key") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_subcategory_service_fk" FOREIGN KEY ("service_subcategory_id","service_id") REFERENCES "public"."service_subcategories"("id","service_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_merged_into_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_pending_reason_fk" FOREIGN KEY ("pending_reason_id") REFERENCES "public"."pending_reasons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_status_transitions" ADD CONSTRAINT "ticket_status_transitions_from_status_ticket_statuses_key_fk" FOREIGN KEY ("from_status") REFERENCES "public"."ticket_statuses"("key") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_status_transitions" ADD CONSTRAINT "ticket_status_transitions_to_status_ticket_statuses_key_fk" FOREIGN KEY ("to_status") REFERENCES "public"."ticket_statuses"("key") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_execution_id_workflow_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."workflow_executions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- carried from 0008_tier1_core
INSERT INTO "ticket_statuses" ("key","label","state_type","is_closed","pauses_sla","is_default","display_order") VALUES
 ('open','Open','new',false,false,true,10), ('routing','Routing','open',false,false,false,20),
 ('resolving','Resolving','open',false,false,false,30), ('pending','Waiting for reply','pending',false,true,false,40),
 ('resolved','Resolved','resolved',false,false,false,50), ('escalated','Escalated','open',false,false,false,60),
 ('closed','Closed','closed',true,false,false,70) ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- carried from 0008_tier1_core
INSERT INTO "ticket_status_transitions" ("from_status","action","to_status") VALUES
 ('open','startRun','routing'),('open','reclassify','open'),('open','assign','open'),('open','add_detail','open'),('open','pend','pending'),
 ('routing','firstTool','resolving'),('routing','reclassify','routing'),('routing','assign','routing'),('routing','add_detail','routing'),('routing','pend','pending'),
 ('resolving','resolve','resolved'),('resolving','reclassify','resolving'),('resolving','assign','resolving'),('resolving','add_detail','resolving'),('resolving','escalate','escalated'),('resolving','fail','escalated'),('resolving','exhaust','escalated'),('resolving','pend','pending'),
 ('pending','unpend','open'),('pending','add_detail','pending'),('pending','resolve','resolved'),
 ('resolved','close','closed'),('resolved','escalate','escalated'),('resolved','reclassify','resolved'),('resolved','assign','resolved'),
 ('escalated','startRun','routing'),('escalated','close','closed'),('escalated','escalate','escalated'),('escalated','reclassify','escalated'),('escalated','assign','escalated'),
 ('closed','reopen','open') ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- carried from 0008_tier1_core
INSERT INTO "calendars" ("id","name","timezone","is_default") VALUES ('default-business-hours','Default business hours','UTC',true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "calendar_hours" ("id","calendar_id","weekday","start_time","end_time") SELECT 'default-hours-' || d,'default-business-hours',d,'09:00','17:00' FROM generate_series(1,5) d ON CONFLICT ("id") DO NOTHING;
INSERT INTO "slas" ("id","name","priority","tto_working_minutes","ttr_working_minutes","calendar_id","is_default") VALUES ('default-sla','Default SLA',NULL,480,2400,'default-business-hours',true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "olas" ("id","name","priority","tto_working_minutes","ttr_working_minutes","calendar_id","is_default") VALUES ('default-ola','Default OLA',NULL,240,1440,'default-business-hours',true) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0009_tier0_identity_rbac
INSERT INTO "roles" ("id", "name", "description") VALUES
	('employee', 'Employee', 'Employee self-service access'),
	('it-analyst', 'IT Analyst', 'Ticket, run, device and reporting operations'),
	('platform-engineer', 'Platform Engineer', 'IT Analyst plus platform administration')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0009_tier0_identity_rbac
INSERT INTO "role_capabilities" ("role_id", "capability") VALUES
	('employee', 'ticket.create'),
	('employee', 'ticket.read.own'),
	('it-analyst', 'ticket.read.own'),
	('it-analyst', 'ticket.read.all'),
	('it-analyst', 'ticket.create'),
	('it-analyst', 'ticket.resolve'),
	('it-analyst', 'ticket.close'),
	('it-analyst', 'ticket.escalate'),
	('it-analyst', 'ticket.reclassify'),
	('it-analyst', 'ticket.assign'),
	('it-analyst', 'ticket.reopen'),
	('it-analyst', 'run.start'),
	('it-analyst', 'run.cancel'),
	('it-analyst', 'run.read'),
	('it-analyst', 'device.read'),
	('it-analyst', 'device.enroll'),
	('it-analyst', 'device.command'),
	('it-analyst', 'stats.read')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- carried from 0009_tier0_identity_rbac
INSERT INTO "role_capabilities" ("role_id", "capability")
SELECT 'platform-engineer', "capability" FROM "role_capabilities" WHERE "role_id" = 'it-analyst'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- carried from 0009_tier0_identity_rbac
INSERT INTO "role_capabilities" ("role_id", "capability") VALUES
	('platform-engineer', 'admin.roles'),
	('platform-engineer', 'admin.settings')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- carried from 0011_tier2_service_management
INSERT INTO "service_families" ("id","name","description") VALUES
 ('sf-operations','IT Operations','Migrated MVP classifications'),
 ('sf-general','General Support','Fallback for previously unclassified tickets') ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- carried from 0011_tier2_service_management
INSERT INTO "services" ("id","family_id","name") VALUES
 ('svc-infrastructure','sf-operations','Infrastructure'),('svc-device','sf-operations','Device'),
 ('svc-access','sf-operations','Access'),('svc-general','sf-general','General') ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- carried from 0011_tier2_service_management
INSERT INTO "service_subcategories" ("id","service_id","name") VALUES
 ('ss-deployment','svc-infrastructure','Deployment'),('ss-network','svc-device','Network'),
 ('ss-account','svc-access','Account'),('ss-general','svc-general','General') ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- carried from 0011_tier2_service_management
INSERT INTO "role_capabilities" ("role_id", "capability") VALUES
 ('it-analyst','problem.manage'),('it-analyst','change.manage'),('it-analyst','change.approve'),
 ('it-analyst','knowledge.read'),('it-analyst','knowledge.manage'),('it-analyst','approval.read'),
 ('it-analyst','approval.decide'),('it-analyst','catalogue.manage') ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- carried from 0011_tier2_service_management
INSERT INTO "role_capabilities" ("role_id", "capability")
SELECT 'platform-engineer', "capability" FROM "role_capabilities" WHERE "role_id" = 'it-analyst'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- carried from 0012_tier3_extensible_platform
INSERT INTO "cmdb_classes" ("id", "key", "label", "parent_class_id") VALUES
  ('cmdb-class-functional-ci', 'FunctionalCI', 'Functional CI', NULL),
  ('cmdb-class-server', 'Server', 'Server', 'cmdb-class-functional-ci'),
  ('cmdb-class-pc', 'PC', 'PC', 'cmdb-class-functional-ci'),
  ('cmdb-class-network-device', 'NetworkDevice', 'Network Device', 'cmdb-class-functional-ci'),
  ('cmdb-class-application-solution', 'ApplicationSolution', 'Application Solution', 'cmdb-class-functional-ci'),
  ('cmdb-class-business-process', 'BusinessProcess', 'Business Process', 'cmdb-class-functional-ci'),
  ('cmdb-class-software', 'Software', 'Software', 'cmdb-class-functional-ci'),
  ('cmdb-class-software-instance', 'SoftwareInstance', 'Software Instance', 'cmdb-class-functional-ci'),
  ('cmdb-class-subnet', 'Subnet', 'Subnet', 'cmdb-class-functional-ci')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0012_tier3_extensible_platform
INSERT INTO "cmdb_class_properties" ("id", "class_id", "property_key", "label", "property_type") VALUES
  ('cmdb-property-functional-ci-legacy-attributes', 'cmdb-class-functional-ci', 'legacy_attributes', 'Legacy attributes', 'json'),
  ('cmdb-property-pc-legacy-attributes', 'cmdb-class-pc', 'legacy_attributes', 'Legacy attributes', 'json'),
  ('cmdb-property-application-solution-legacy-attributes', 'cmdb-class-application-solution', 'legacy_attributes', 'Legacy attributes', 'json'),
  ('cmdb-property-software-instance-legacy-attributes', 'cmdb-class-software-instance', 'legacy_attributes', 'Legacy attributes', 'json')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0015_ticket_update_capability
INSERT INTO "role_capabilities" ("role_id", "capability") VALUES ('employee', 'ticket.update'), ('it-analyst', 'ticket.update'), ('platform-engineer', 'ticket.update') ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- carried from 0024_chat_c_tier2
-- Tier 2 C: demonstrate the typed request path on a fresh database.
INSERT INTO forms (id, key, version, name, description, status, published_at)
VALUES ('form-laptop-request', 'laptop-request', 1, 'New laptop request', 'Equipment request details', 'published', now())
ON CONFLICT (key, version) DO NOTHING;
--> statement-breakpoint
-- carried from 0024_chat_c_tier2
INSERT INTO form_fields (id, form_id, key, label, type, ordinal, is_mandatory)
VALUES ('field-laptop-model', 'form-laptop-request', 'model', 'Preferred model', 'text', 0, true)
ON CONFLICT (form_id, key) DO NOTHING;
--> statement-breakpoint
-- carried from 0024_chat_c_tier2
UPDATE service_subcategories SET form_id = 'form-laptop-request' WHERE id = 'ss-account' AND form_id IS NULL;
--> statement-breakpoint
-- carried from 0024_chat_c_tier2
UPDATE services SET sla_id = 'default-sla' WHERE id = 'svc-device' AND sla_id IS NULL;
--> statement-breakpoint
-- carried from 0032_chat_e_tier4
INSERT INTO "ticket_origins" ("id", "key", "name") VALUES
  ('origin-portal', 'portal', 'Portal'),
  ('origin-email', 'email', 'Email'),
  ('origin-chat', 'chat', 'Chat'),
  ('origin-monitoring', 'monitoring', 'Monitoring'),
  ('origin-phone', 'phone', 'Phone')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- carried from 0033_chat_e_templates
INSERT INTO "email_templates" ("id", "name", "subject", "text_body", "enabled") VALUES
  ('template-ticket-notification', 'Ticket notification', '[ticket_reference] [ticket_url]', '[ticket_reference] [ticket_url]\n\n[body]', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0033_chat_e_templates
INSERT INTO "email_template_rules" ("id", "template_id", "scope", "match_value", "enabled") VALUES
  ('template-rule-catch-all', 'template-ticket-notification', 'catch_all', NULL, true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0034_tier1_reference_data_repair
-- Forward-only repair for the orphaned 0016 migration and partially applied 0024 data.
INSERT INTO "pending_reasons" ("id", "name", "followup_frequency_minutes", "followups_before_resolution") VALUES
	('reporter-information', 'Waiting for reporter information', 1440, 3),
	('approval-required', 'Waiting for approval', 2880, 2),
	('scheduled-change', 'Waiting for scheduled change', 10080, 2)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0034_tier1_reference_data_repair
INSERT INTO "sla_notification_rules" ("id", "name", "policy_type", "policy_id", "trigger_type", "target_type", "threshold_percent", "recipient_type", "recipient") VALUES
	('default-sla-warning', 'Default SLA warning', 'sla', 'default-sla', 'warning', 'both', 80, 'assignee', NULL),
	('default-sla-breach', 'Default SLA breach', 'sla', 'default-sla', 'breach', 'both', 100, 'assignee', NULL),
	('default-ola-warning', 'Default OLA warning', 'ola', 'default-ola', 'warning', 'both', 80, 'assignee', NULL),
	('default-ola-breach', 'Default OLA breach', 'ola', 'default-ola', 'breach', 'both', 100, 'assignee', NULL)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0034_tier1_reference_data_repair
UPDATE services SET sla_id = 'default-sla' WHERE id = 'svc-device' AND sla_id IS NULL;
--> statement-breakpoint
-- carried from 0035_starter_reference_data
-- Starter automation, CMDB taxonomy, service SLA, and per-user dashboard arrangement.
INSERT INTO "ticket_rules" ("id", "name", "position", "criteria", "actions") VALUES
	('starter-device-human-triage', 'Route device requests to human triage', 0, '[{"field":"serviceId","operator":"equals","value":"svc-device"}]'::jsonb, '[{"type":"route_human"}]'::jsonb)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0035_starter_reference_data
INSERT INTO "cmdb_relationship_types" ("id", "key", "verb", "inverse_verb", "impact_direction") VALUES
	('cmdb-relationship-type-depends-on', 'depends_on', 'depends on', 'supports', 'reverse'),
	('cmdb-relationship-type-runs-on', 'runs_on', 'runs on', 'hosts', 'reverse'),
	('cmdb-relationship-type-connects-to', 'connects_to', 'connects to', 'connects from', 'both')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0035_starter_reference_data
INSERT INTO "cmdb_class_properties" ("id", "class_id", "property_key", "label", "property_type", "target_class_id", "spreads_impact") VALUES
	('cmdb-property-application-solution-depends-on', 'cmdb-class-application-solution', 'depends_on', 'Depends on', 'relationship', 'cmdb-class-functional-ci', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0035_starter_reference_data
INSERT INTO "slas" ("id", "name", "priority", "tto_working_minutes", "ttr_working_minutes", "calendar_id", "is_default") VALUES
	('device-service-sla', 'Device service SLA', NULL, 240, 1440, 'default-business-hours', false)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- carried from 0035_starter_reference_data
UPDATE "services" SET "sla_id" = 'device-service-sla' WHERE "id" = 'svc-device';
--> statement-breakpoint
-- carried from 0040_api_rate_limits
INSERT INTO "api_rate_limits" ("scope", "request_limit", "per_key_limit", "window_seconds") VALUES ('global', 2000, 120, 60);
--> statement-breakpoint
-- carried from 0040_api_rate_limits
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
--> statement-breakpoint
-- carried from 0043_itsm_connector
-- Phase 6 — ITSM connector.
-- Nine tables, none of which touches "tickets": ticket provenance lives beside
-- the ticket, the way "ticket_mail_origins" does and for the same reason.

INSERT INTO "ticket_origins" ("id", "key", "name") VALUES
 ('origin-itsm', 'itsm', 'ITSM connector') ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- carried from 0045_device_command_proposals
-- Deliberately not it-analyst. The role that issues device commands must not be
-- the role that authorises a device to run something; that separation is the
-- whole reason this capability exists rather than reusing approval.decide.
INSERT INTO "role_capabilities" ("role_id", "capability") VALUES
	('platform-engineer', 'device.approve')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- carried from 0048_platform_engineer_environment_admin
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
