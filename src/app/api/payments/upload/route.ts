import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const billId = formData.get('billId');
    const receipt = formData.get('receipt') as File | null;

    if (!billId) {
      return NextResponse.json({ error: 'Missing billId' }, { status: 400 });
    }

    // Since we're keeping things simple, we'll store a placeholder URL.
    // In a real production app, you would upload the file to Supabase Storage here.
    const fileUrl = 'uploaded_receipt_' + Date.now() + '.jpg'; 

    // Look up the existing payment or create one.
    const billCheck = await pool.query('SELECT tenant_id FROM bills WHERE id = $1', [billId]);
    if (billCheck.rowCount === 0) {
        return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }
    const tenantId = billCheck.rows[0].tenant_id;

    // Insert or update payment record
    const paymentCheck = await pool.query('SELECT id FROM payments WHERE bill_id = $1 AND tenant_id = $2', [billId, tenantId]);
    
    if (paymentCheck.rowCount && paymentCheck.rowCount > 0) {
      // Update existing payment
      await pool.query(
        'UPDATE payments SET status = $1, reference_number = $2 WHERE id = $3',
        ['pending', fileUrl, paymentCheck.rows[0].id]
      );
    } else {
      // Insert new payment
      await pool.query(
        'INSERT INTO payments (bill_id, tenant_id, amount, status, reference_number) VALUES ($1, $2, (SELECT per_person_amount FROM bills WHERE id = $1), $3, $4)',
        [billId, tenantId, 'pending', fileUrl]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error uploading receipt:', error);
    return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 });
  }
}
