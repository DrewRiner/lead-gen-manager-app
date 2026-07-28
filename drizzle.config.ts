import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local for drizzle-kit CLI (generate/migrate/studio).
// This is migration tooling, not runtime app code — the "only lib/db/index.ts
// reads the DB URL" rule governs the running application.
config({ path: ".env.local" });

// Migrations prefer a direct/session-pooler connection (DIRECT_URL, port 5432).
// Falls back to DATABASE_URL when DIRECT_URL is not provided.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("Neither DIRECT_URL nor DATABASE_URL is set");
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl },
  // Manage only the public schema. Never touch auth / storage / other schemas.
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
