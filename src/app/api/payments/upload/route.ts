import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function fileToBase64(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let billId: string | number | null = null;
    let tenantId: string | number | null = null;
    let receiptImage: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      billId = formData.get('billId') as string;
      tenantId = formData.get('tenantId') as string;
      const file = formData.get('receipt') as File | null;
      if (file && file.size > 0) {
        receiptImage = await fileToBase64(file);
      }
    } else {
      const body = await req.json();
      billId = body.billId;
      tenantId = body.tenantId;
      receiptImage = body.receiptImage ?? null;
    }

    if (!billId || !tenantId) {
      return NextResponse.json({ error: 'Missing billId or tenantId' }, { status: 400 });
    }

    const refId = 'IMG_' + Math.floor(100000 + Math.random() * 900000).toString();

    await pool.query(
      `INSERT INTO payments (bill_id, tenant_id, reference_number, status, receipt_image)
       VALUES ($1, $2, $3, 'pending', $4)
       ON CONFLICT (bill_id, tenant_id)
       DO UPDATE SET reference_number = EXCLUDED.reference_number, status = 'pending', receipt_image = EXCLUDED.receipt_image, created_at = NOW()`,
      [billId, tenantId, refId, receiptImage]
    );

    return NextResponse.json({ success: true, reference_number: refId });
  } catch (error) {
    console.error('Error uploading receipt:', error);
    return NextResponse.json({ error: 'Failed to upload receipt' }, { status: 500 });
  }
}
