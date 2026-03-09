import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ bets: [] }, { headers: NO_STORE });
  }

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, date, match, market, pick, odds, stake, result, payout, sport, notes, created_at
      FROM bets
      ORDER BY date DESC, created_at DESC
    `;
    return NextResponse.json({ bets: rows }, { headers: NO_STORE });
  } catch (err) {
    console.error('[api/bets] GET error:', err);
    return NextResponse.json({ bets: [], error: 'Failed to fetch bets' }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { date, match, market, pick, odds, stake, sport, notes } = body;

    if (!match || !pick || !odds || !stake) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const sql = getDb();
    const rows = await sql`
      INSERT INTO bets (date, match, market, pick, odds, stake, sport, notes)
      VALUES (${date || new Date().toISOString().slice(0, 10)}, ${match}, ${market || 'Match Winner'}, ${pick}, ${odds}, ${stake}, ${sport || 'soccer'}, ${notes || null})
      RETURNING *
    `;

    return NextResponse.json({ bet: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[api/bets] POST error:', err);
    return NextResponse.json({ error: 'Failed to create bet' }, { status: 500 });
  }
}
