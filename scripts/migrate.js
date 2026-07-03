const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.atburcjhnvlqgatxlsnu:9zyTiJlLzelEh6eH@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('Adding room_number column to tenants...');
    await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS room_number VARCHAR(20);`);
    console.log('Done.');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

run();
