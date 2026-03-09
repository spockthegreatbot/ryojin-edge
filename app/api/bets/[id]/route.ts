import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 503 });
  }

  try {
    const { id } = await params;
    const betId = parseInt(id);
    const body = await req.json();
    const sql = getDb();

    const { result, payout, date, match, market, pick, odds, stake, sport, notes } = body;

    // Auto-calc payout when settling
    let finalPayout = payout ?? null;
    if (result && finalPayout === null) {
      const existing = await sql`SELECT odds, stake FROM bets WHERE id = ${betId}`;
      if (existing.length) {
        const bet = existing[0] as { odds: number; stake: number };
        if (result === 'win') finalPayout = bet.odds * bet.stake;
        else if (result === 'loss') finalPayout = 0;
        else if (result === 'void') finalPayout = bet.stake;
      }
    }

    const rows = await sql`
      UPDATE bets SET
        date = COALESCE(${date ?? null}::date, date),
        match = COALESCE(${match ?? null}::text, match),
        market = COALESCE(${market ?? null}::text, market),
        pick = COALESCE(${pick ?? null}::text, pick),
        odds = COALESCE(${odds ?? null}::float8, odds),
        stake = COALESCE(${stake ?? null}::float8, stake),
        result = COALESCE(${result ?? null}::text, result),
        payout = COALESCE(${finalPayout}::float8, payout),
        sport = COALESCE(${sport ?? null}::text, sport),
        notes = COALESCE(${notes ?? null}::text, notes)
      WHERE id = ${betId}
      RETURNING *
    `;

    if (!rows.length) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    }

    return NextResponse.json({ bet: rows[0] });
  } catch (err) {
    console.error('[api/bets/[id]] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update bet' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 503 });
  }

  try {
    const { id } = await params;
    const betId = parseInt(id);
    const sql = getDb();
    const rows = await sql`DELETE FROM bets WHERE id = ${betId} RETURNING id`;

    if (!rows.length) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id: betId });
  } catch (err) {
    console.error('[api/bets/[id]] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete bet' }, { status: 500 });
  }
}
