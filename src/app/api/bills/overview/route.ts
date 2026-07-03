import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET bill status overview for admin - who paid vs pending per bill
export async function GET() {
  try {
    const bills = await pool.query(
      `SELECT * FROM bills WHERE status = 'open' ORDER BY due_date ASC`
    );
    const tenants = await pool.query(`SELECT id, name FROM tenants ORDER BY id ASC`);
    const payments = await pool.query(
      `SELECT p.id as payment_id, p.bill_id, p.tenant_id, p.status FROM payments p`
    );

    const overview = bills.rows.map((bill) => ({
      ...bill,
      tenants: tenants.rows.map((tenant) => {
        const payment = payments.rows.find(
          (p) => p.bill_id === bill.id && p.tenant_id === tenant.id
        );
        return {
          ...tenant,
          payment_id: payment?.payment_id || null,
          payment_status: payment?.status || 'unpaid',
        };
      }),
    }));

    return NextResponse.json(overview);
  } catch (error) {
    console.error('Error fetching bill overview:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
