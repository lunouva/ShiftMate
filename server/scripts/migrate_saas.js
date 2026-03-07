/**
 * ShiftWay SaaS Migration Runner
 * Usage: node scripts/migrate_saas.js
 *
 * Reads migrate_saas.sql and executes it against the configured DATABASE_URL.
 * Safe to re-run — all statements are idempotent.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("[migrate_saas] ERROR: DATABASE_URL not set in server/.env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  console.log("[migrate_saas] Connected to database.");

  const sql = readFileSync(join(__dirname, "migrate_saas.sql"), "utf8");

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("[migrate_saas] ✅ Migration applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[migrate_saas] ❌ Migration failed, rolled back:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
