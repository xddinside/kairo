import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DIRECT_DATABASE_URL ?? "postgresql://migration@localhost/kairo_test" },
  strict: true,
  verbose: true,
});
