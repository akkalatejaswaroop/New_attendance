import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required");
}

declare global {
  // eslint-disable-next-line no-var
  var campusAttendPool: Pool | undefined;
}

export const pool = global.campusAttendPool ?? new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  ssl: connectionString ? { rejectUnauthorized: true } : undefined
});

if (process.env.NODE_ENV !== "production") global.campusAttendPool = pool;

export async function query<T extends import("pg").QueryResultRow = import("pg").QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  return pool.query<T>(text, values);
}
