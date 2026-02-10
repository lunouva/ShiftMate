import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

// Allow the server to boot even if DATABASE_URL is missing, so /api/health can
// report the problem and local dev onboarding is less brittle.
let pool = null;
if (DATABASE_URL) {
  pool = new pg.Pool({ connectionString: DATABASE_URL });
} else {
  // eslint-disable-next-line no-console
  console.warn(
    "[db] Missing DATABASE_URL. Live backend mode will not work until you create server/.env from server/.env.example and set DATABASE_URL."
  );
}

export const query = async (text, params) => {
  if (!pool) {
    throw new Error(
      "Missing DATABASE_URL. Create server/.env from server/.env.example and set DATABASE_URL (Postgres connection string)."
    );
  }
  return pool.query(text, params);
};

export default pool;
