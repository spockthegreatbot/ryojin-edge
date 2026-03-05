import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';

export async function GET() {
  try {
    await initSchema();
    return NextResponse.json({ ok: true, message: 'Schema initialised' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
