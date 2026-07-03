import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { billId, tenantId, receiptImage } = await req.json();

    if (!billId || !tenantId) {
      return NextResponse.json({ error: 'Missing billId or tenantId' }, { status: 400 });
    }

    // Generate a short placeholder ID for the reference_number column (VARCHAR 13)
    const refId = 'IMG_' + Math.floor(100000 + Math.random() * 900000).toString();

    // Upsert payment with the compressed base64 image
    await pool.query(
      `INSERT INTO payments (bill_id, tenant_id, reference_number, status, receipt_image)
       VALUES ($1, $2, $3, 'pending', $4)
       ON CONFLICT (bill_id, tenant_id)
       DO UPDATE SET reference_number = EXCLUDED.reference_number, status = 'pending', receipt_image = EXCLUDED.receipt_image, created_at = NOW()`,
      [billId, tenantId, refId, receiptImage ?? null]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error uploading receipt:', error);
    return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 });
  }
}
