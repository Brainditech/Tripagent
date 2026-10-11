import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Server-side unit tests (Zod schemas, quota, Inngest function with @inngest/test).
// They run in Node and never touch Neon, Claude or Unsplash.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
