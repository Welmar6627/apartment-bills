const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.atburcjhnvlqgatxlsnu:9zyTiJlLzelEh6eH@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('Adding receipt_image column...');
    await pool.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_image TEXT;');
    console.log('Successfully altered table.');
  } catch (error) {
    console.error('Error altering table:', error);
  } finally {
    pool.end();
  }
}

run();
