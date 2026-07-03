import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET all tenants
export async function GET() {
  try {
    const result = await pool.query('SELECT id, name, room_number FROM tenants ORDER BY id ASC');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
  }
}

// POST create a new tenant
export async function POST(req: Request) {
  try {
    const { first_name, last_name, room_number } = await req.json();
    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 });
    }
    const name = `${first_name.trim()} ${last_name.trim()}`;
    const result = await pool.query(
      'INSERT INTO tenants (name, room_number) VALUES ($1, $2) RETURNING *',
      [name, room_number?.trim() || null]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
  }
}
