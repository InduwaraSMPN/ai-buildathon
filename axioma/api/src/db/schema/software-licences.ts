import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { user } from "./auth";

export const softwareProducts = pgTable(
	"software_products",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		publisher: text("publisher"),
		identityKey: text("identity_key").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("software_products_identity_uidx").on(t.identityKey)],
);

export const softwareLicenceEntitlements = pgTable(
	"software_licence_entitlements",
	{
		id: text("id").primaryKey(),
		productId: text("product_id")
			.notNull()
			.references(() => softwareProducts.id, {
				onDelete: "cascade",
			}),
		licenceKey: text("licence_key"),
		seatCount: integer("seat_count").notNull(),
		validFrom: timestamp("valid_from"),
		expiresAt: timestamp("expires_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("software_entitlements_product_idx").on(t.productId, t.expiresAt),
		check("software_entitlements_seats_positive", sql`${t.seatCount} > 0`),
		check(
			"software_entitlements_dates_valid",
			sql`${t.validFrom} is null or ${t.expiresAt} is null or ${t.expiresAt} >= ${t.validFrom}`,
		),
	],
);

export const softwareLicenceAllocations = pgTable(
	"software_licence_allocations",
	{
		id: text("id").primaryKey(),
		entitlementId: text("entitlement_id")
			.notNull()
			.references(() => softwareLicenceEntitlements.id, {
				onDelete: "cascade",
			}),
		assetId: text("asset_id").references(() => assets.id, {
			onDelete: "cascade",
		}),
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		allocatedAt: timestamp("allocated_at").defaultNow().notNull(),
		revokedAt: timestamp("revoked_at"),
	},
	(t) => [
		index("software_allocations_entitlement_idx").on(
			t.entitlementId,
			t.revokedAt,
		),
		index("software_allocations_asset_idx").on(t.assetId),
		index("software_allocations_user_idx").on(t.userId),
		check(
			"software_allocations_one_target",
			sql`(${t.assetId} is not null)::int + (${t.userId} is not null)::int = 1`,
		),
	],
);
