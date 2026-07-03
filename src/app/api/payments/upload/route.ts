import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const billId = formData.get('billId');
    const receipt = formData.get('receipt') as File | null;

    const tenantId = formData.get('tenantId');

    if (!billId || !tenantId) {
      return NextResponse.json({ error: 'Missing billId or tenantId' }, { status: 400 });
    }

    // In a real production app, you would upload the file to Supabase Storage here.
    // The reference_number column is limited to VARCHAR(13), so we generate a short 13-character ID:
    const fileUrl = 'IMG_' + Date.now().toString().slice(-9);

    // Insert or update payment record
    await pool.query(
      `INSERT INTO payments (bill_id, tenant_id, reference_number, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (bill_id, tenant_id)
       DO UPDATE SET reference_number = EXCLUDED.reference_number, status = 'pending', created_at = NOW()`,
      [billId, tenantId, fileUrl]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error uploading receipt:', error);
    return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 });
  }
}
