import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST: Mark a tenant's bill as paid in cash
export async function POST(req: Request) {
  try {
    const { bill_id, tenant_id } = await req.json();
    if (!bill_id || !tenant_id) {
      return NextResponse.json({ error: 'Missing bill_id or tenant_id' }, { status: 400 });
    }

    // Upsert payment with status=approved and reference_number='CASH' to bypass GCash validation
    await pool.query(
      `INSERT INTO payments (bill_id, tenant_id, reference_number, status)
       VALUES ($1, $2, 'CASH', 'approved')
       ON CONFLICT (bill_id, tenant_id)
       DO UPDATE SET reference_number = 'CASH', status = 'approved', created_at = NOW()`,
      [bill_id, tenant_id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking cash payment:', error);
    return NextResponse.json({ error: 'Failed to record cash payment' }, { status: 500 });
  }
}
