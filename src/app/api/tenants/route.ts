import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query('SELECT id, name FROM tenants ORDER BY id ASC');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
  }
}
