import { db } from "@/db";
import {
	backfillSearchEmbeddings,
	type EmbeddingBackfillCursor,
} from "./index";

let total = 0;
let failed = 0;
let cursor: EmbeddingBackfillCursor | undefined;
do {
	const batch = await backfillSearchEmbeddings(db, 100, cursor);
	total += batch.updated;
	failed += batch.failed;
	cursor = batch.nextCursor ?? undefined;
	if (batch.scanned < 100) break;
} while (cursor);
console.log(`Backfilled ${total} search embeddings; ${failed} failed.`);
