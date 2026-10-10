import { defineConfig } from "drizzle-kit";

// drizzle-kit loads `.env` by itself (dotenv/config), so DATABASE_URL is already in process.env.
// `generate` never connects; `migrate`, `push` and `studio` need DATABASE_URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
