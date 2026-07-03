import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET unpaid bills for a specific tenant
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenant_id');

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
  }

  try {
    // Get all open bills and check which ones have an approved/pending payment from this tenant
    const result = await pool.query(
      `SELECT 
        b.*,
        p.id AS payment_id,
        p.status AS payment_status,
        p.reference_number
       FROM bills b
       LEFT JOIN payments p ON p.bill_id = b.id AND p.tenant_id = $1
       WHERE b.status = 'open'
       ORDER BY b.due_date ASC`,
      [tenantId]
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching tenant bills:', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}
