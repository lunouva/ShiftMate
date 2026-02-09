import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL. Create server/.env from server/.env.example and set DATABASE_URL (Postgres connection string)."
  );
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const query = (text, params) => pool.query(text, params);

export default pool;
