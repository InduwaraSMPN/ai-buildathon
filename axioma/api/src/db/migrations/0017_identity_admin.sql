ALTER TABLE "role_grants" DROP CONSTRAINT "role_grants_action_check";--> statement-breakpoint
ALTER TABLE "role_grants" DROP CONSTRAINT "role_grants_target_type_check";--> statement-breakpoint
ALTER TABLE "role_grants" ALTER COLUMN "role_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "role_grants" ALTER COLUMN "role_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_role_check" CHECK (("role_grants"."target_type" = 'user_kind') = ("role_grants"."role_id" is null and "role_grants"."role_name" is null));--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_action_check" CHECK ("role_grants"."action" in ('grant', 'revoke', 'set_kind'));--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_target_type_check" CHECK ("role_grants"."target_type" in ('user', 'team', 'capability', 'user_kind'));--> statement-breakpoint

