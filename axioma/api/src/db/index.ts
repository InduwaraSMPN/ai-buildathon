import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { env } from "@/env";

/**
 * Every `timestamp` column in this schema is naive, and the application writes
 * UTC into all of them. `now()` compared against such a column is cast using the
 * *session* time zone, so on a server whose default is not UTC — most managed
 * Postgres offerings — every `expires_at > now()` comparison silently skews by
 * the offset, and device enrolment tokens are born expired. Pinning the session
 * removes the dependency on how the server happens to be configured.
 */
const SESSION_OPTIONS = "-c timezone=UTC";

/**
 * `createTicketInTransaction` and its callers each hold a client for the whole
 * transaction, so the default of ten is the ceiling on concurrent writes. The
 * acquire timeout matters more than the size: `pg-pool` queues acquisitions
 * forever by default, so a leaked client turned into a permanent hang with no
 * error rather than a failure anyone could see.
 */
export function createDb() {
	const pool = new Pool({
		connectionString: env.DATABASE_URL,
		max: env.DATABASE_POOL_MAX,
		connectionTimeoutMillis: 10_000,
		options: SESSION_OPTIONS,
	});
	return drizzle(pool, { schema });
}

export const db = createDb();
