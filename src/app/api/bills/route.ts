import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT * FROM bills ORDER BY created_at DESC`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { title, total_amount, due_date } = await req.json();
    if (!title || !total_amount || !due_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const per_person_amount = parseFloat(total_amount) / 8;
    const result = await pool.query(
      `INSERT INTO bills (title, total_amount, per_person_amount, due_date, status)
       VALUES ($1, $2, $3, $4, 'open') RETURNING *`,
      [title, total_amount, per_person_amount, due_date]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating bill:', error);
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
  }
}
