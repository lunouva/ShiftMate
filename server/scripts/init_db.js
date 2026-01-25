import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const sqlPath = path.resolve(process.cwd(), "scripts", "init_db.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

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
