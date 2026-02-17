import fs from "node:fs";
import path from "node:path";
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
  console.error(err);
  process.exitCode = 1;
} finally {
  await client.end();
}
