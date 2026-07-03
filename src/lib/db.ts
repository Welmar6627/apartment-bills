import { Pool } from 'pg';

const globalForPg = globalThis as unknown as { pool: Pool };

const pool =
  globalForPg.pool ||
  new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:9zyTiJlLzelEh6eH@db.atburcjhnvlqgatxlsnu.supabase.co:6543/postgres?pgbouncer=true',
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== 'production') globalForPg.pool = pool;

export default pool;
