import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set: put the connection string of the Neon dev branch in .env.");
}

/** Drizzle over Neon's HTTP driver: one fetch per query, nothing to keep alive. */
export const db = drizzle({ client: neon(databaseUrl), schema });
