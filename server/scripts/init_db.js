import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const sqlPath = path.resolve(process.cwd(), "scripts", "init_db.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Create server/.env from server/.env.example and set DATABASE_URL first.");
  console.error("Example: DATABASE_URL=postgres://postgres:postgres@localhost:5432/shiftway");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(sql);
  console.log("Database initialized.");
} catch (err) {
  if (err && typeof err === "object" && err.code === "ECONNREFUSED") {
    console.error("Could not connect to Postgres (connection refused). Is your DB running?");

    let hasDocker = false;
    try {
      execSync("command -v docker", { stdio: "ignore" });
      hasDocker = true;
    } catch {
      hasDocker = false;
    }

    if (!hasDocker) {
      console.error("Docker does not appear to be installed on this machine.");
      console.error("Install Docker Desktop / Docker Engine, then run:");
      console.error("  npm run db:up");
    } else {
      console.error("If you're using Docker, start it with:");
      console.error("  npm run db:up");
      console.error("  # (or) docker compose -f docker-compose.yml up -d");
      console.error("  # (or from repo root) docker compose -f server/docker-compose.yml up -d");
    }

    console.error("Then re-run: npm run db:init");
  }
  console.error(err);
  process.exitCode = 1;
} finally {
  await client.end();
}
