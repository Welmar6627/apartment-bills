import { Pool } from 'pg';

const globalForPg = globalThis as unknown as { pool: Pool };

const pool =
  globalForPg.pool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== 'production') globalForPg.pool = pool;

export default pool;
