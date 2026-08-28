import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { env } from "@/env";

export function createDb() {
	return drizzle(env.DATABASE_URL, { schema });
}

export const db = createDb();
