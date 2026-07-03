import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET all payments (for admin review)
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT 
        p.id,
        p.reference_number,
        p.status,
        p.created_at,
        t.name AS tenant_name,
        b.title AS bill_title,
        b.per_person_amount
       FROM payments p
       JOIN tenants t ON t.id = p.tenant_id
       JOIN bills b ON b.id = p.bill_id
       ORDER BY p.created_at DESC`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST submit a payment (from tenant)
export async function POST(req: Request) {
  try {
    const { bill_id, tenant_id, reference_number } = await req.json();
    if (!bill_id || !tenant_id || !reference_number) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!/^\d{13}$/.test(reference_number)) {
      return NextResponse.json({ error: 'Reference number must be exactly 13 digits' }, { status: 400 });
    }
    // Upsert: If already exists, update reference number and set back to pending
    const result = await pool.query(
      `INSERT INTO payments (bill_id, tenant_id, reference_number, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (bill_id, tenant_id)
       DO UPDATE SET reference_number = EXCLUDED.reference_number, status = 'pending', created_at = NOW()
       RETURNING *`,
      [bill_id, tenant_id, reference_number]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error submitting payment:', error);
    return NextResponse.json({ error: 'Failed to submit payment' }, { status: 500 });
  }
}
