import assert from "node:assert/strict";
import test from "node:test";
import { createRouterClient, ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { forms, serviceSubcategories } from "@/db/schema";
import type { Capability } from "@/shared";
import { catalogueRouter } from "./catalogue";

const context = (userId: string, capabilities: Capability[]) =>
	({
		auth: null,
		session: null,
		userId,
		capabilities: new Set(capabilities),
	}) as never;

test("published forms can be attached and detached from a subcategory", async () => {
	const suffix = crypto.randomUUID();
	const publishedId = `published-${suffix}`;
	const draftId = `draft-${suffix}`;
	const subcategoryId = "ss-deployment";
	const original = (
		await db
			.select({ formId: serviceSubcategories.formId })
			.from(serviceSubcategories)
			.where(eq(serviceSubcategories.id, subcategoryId))
	)[0];
	assert.ok(original);
	await db.insert(forms).values([
		{
			id: publishedId,
			key: publishedId,
			version: 1,
			name: "Published attachment test",
			status: "published",
			publishedAt: new Date(),
		},
		{
			id: draftId,
			key: draftId,
			version: 1,
			name: "Draft attachment test",
		},
	]);

	try {
		const client = createRouterClient(catalogueRouter, {
			context: context("catalogue-test", ["catalogue.manage"]),
		});
		assert.equal(
			(await client.setSubcategoryForm({ subcategoryId, formId: publishedId }))
				.formId,
			publishedId,
		);
		await assert.rejects(
			() => client.setSubcategoryForm({ subcategoryId, formId: draftId }),
			(error) => error instanceof ORPCError && error.code === "BAD_REQUEST",
		);
		assert.equal(
			(await client.setSubcategoryForm({ subcategoryId, formId: null })).formId,
			null,
		);
	} finally {
		await db
			.update(serviceSubcategories)
			.set({ formId: original.formId })
			.where(eq(serviceSubcategories.id, subcategoryId));
		await db.delete(forms).where(eq(forms.id, publishedId));
		await db.delete(forms).where(eq(forms.id, draftId));
	}
});
