#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const databaseUrl = String(process.env.DATABASE_URL || "").trim();

if (!databaseUrl) {
  console.error("[migrate] Missing DATABASE_URL. Create server/.env from server/.env.example and set DATABASE_URL.");
  process.exit(1);
}

const migrationsDir = path.resolve(__dirname, "..", "migrations");
const hasMigrationsDir = fs.existsSync(migrationsDir);
const migrationFiles = hasMigrationsDir
  ? fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()
  : [];

if (!migrationFiles.length) {
  console.log("[migrate] No migration files found.");
  process.exit(0);
}

const clientConfig = { connectionString: databaseUrl };
if (String(process.env.DB_SSL || "").toLowerCase() === "require") {
  clientConfig.ssl = { rejectUnauthorized: false };
}

const client = new pg.Client(clientConfig);

const ensureMigrationsTable = async () => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
};

const alreadyApplied = async (id) => {
  const result = await client.query("SELECT 1 FROM schema_migrations WHERE id = $1 LIMIT 1", [id]);
  return Boolean(result.rows[0]);
};

const applyMigration = async (id, sql) => {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};

const run = async () => {
  await client.connect();
  console.log("[migrate] Connected to database.");

  await ensureMigrationsTable();

  for (const fileName of migrationFiles) {
    const id = fileName.replace(/\.sql$/i, "");
    if (await alreadyApplied(id)) {
      console.log(`[migrate] skip ${fileName}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, fileName), "utf8");
    await applyMigration(id, sql);
    console.log(`[migrate] applied ${fileName}`);
  }

  console.log("[migrate] Done.");
};

run()
  .catch((err) => {
    console.error("[migrate] Failed:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => null);
  });
