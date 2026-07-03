import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// DELETE a tenant by ID
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });

    // Cascade deletes payments too (due to ON DELETE CASCADE in schema)
    const result = await pool.query('DELETE FROM tenants WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 });
  }
}

// PATCH update tenant details
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, room_number } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const result = await pool.query(
      'UPDATE tenants SET name = $1, room_number = $2 WHERE id = $3 RETURNING *',
      [name, room_number ?? null, id]
    );
    if (result.rowCount === 0) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tenant:', error);
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
  }
}
