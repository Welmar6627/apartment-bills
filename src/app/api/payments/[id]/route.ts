import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// PATCH approve or reject a payment
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await req.json();

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Status must be "approved" or "rejected"' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE payments SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}
