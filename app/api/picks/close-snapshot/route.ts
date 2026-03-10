import { NextResponse } from 'next/server';
import { getDb, updateClosingOdds } from '@/lib/db';
import { getFixtureOdds } from '@/lib/odds-apisports';

/**
 * GET /api/picks/close-snapshot
 * Fetches current odds from API-Sports for picks where kickoff has passed
 * but closing_odds have not yet been recorded.
 * Intended to be called by a cron job shortly after each kickoff.
 */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 503 });
  }

  const sql = getDb();

  // Picks where kickoff has passed and closing odds not yet recorded
  const pending = await sql`
    SELECT * FROM picks
    WHERE kickoff < NOW()
      AND closing_odds IS NULL
      AND outcome IS NULL
    LIMIT 20
  `;

  let updated = 0;

  for (const pick of pending) {
    try {
      const fixtureId = (pick.match_id as string).startsWith('apisports-')
        ? parseInt((pick.match_id as string).replace('apisports-', ''), 10)
        : null;

      if (!fixtureId) continue;

      const fixtureOdds = await getFixtureOdds(fixtureId).catch(() => null);
      if (!fixtureOdds) continue;

      const market = (pick.market as string).toLowerCase();
      const pickVal = (pick.pick as string).toLowerCase();
      let closingOdds: number | undefined;

      if (market.includes('match result') || market.includes('1x2')) {
        if (pickVal.includes('home') || pickVal.includes((pick.home_team as string).toLowerCase())) {
          closingOdds = fixtureOdds.homeOdds;
        } else if (pickVal.includes('away') || pickVal.includes((pick.away_team as string).toLowerCase())) {
          closingOdds = fixtureOdds.awayOdds;
        } else if (pickVal.includes('draw')) {
          closingOdds = fixtureOdds.drawOdds;
        }
      }

      if (closingOdds && closingOdds > 1) {
        await updateClosingOdds(
          pick.match_id as string,
          pick.market as string,
          pick.pick as string,
          closingOdds
        );
        updated++;
      }
    } catch (e) {
      console.error('close-snapshot error for pick', pick.id, e);
    }
  }

  return NextResponse.json({ updated, checked: pending.length });
}
