import { NextResponse } from 'next/server';
import { getDb, updateClosingOdds } from '@/lib/db';
import { getFixtureOdds } from '@/lib/odds-apisports';

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 503 });
  }

  const sql = getDb();

  // Get unresolved picks with kickoff > 2h ago
  const pending = await sql`
    SELECT * FROM picks
    WHERE outcome IS NULL
    AND kickoff < NOW() - INTERVAL '2 hours'
    AND kickoff > NOW() - INTERVAL '7 days'
    LIMIT 20
  `;

  const API_KEY = process.env.API_SPORTS_KEY!;
  let resolved = 0;

  for (const pick of pending) {
    try {
      // Feature 5: Try to save closing odds via API-Sports fixture odds (best-effort)
      try {
        const kickoffTime = new Date(pick.kickoff as string).getTime();
        const now = Date.now();
        const diffMs = kickoffTime - now;
        if (diffMs <= 3600000 && diffMs >= -7200000) {
          // Within the closing window — fetch odds from API-Sports
          const fixtureId = pick.match_id.startsWith('apisports-')
            ? parseInt(pick.match_id.replace('apisports-', ''), 10)
            : null;

          if (fixtureId) {
            const fixtureOdds = await getFixtureOdds(fixtureId).catch(() => null);

            if (fixtureOdds) {
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
              }
            }
          }
        }
      } catch { /* CLV update non-fatal */ }
      // Extract fixture ID from match_id (format: "apisports-12345")
      const fixtureId = pick.match_id.startsWith('apisports-')
        ? pick.match_id.replace('apisports-', '')
        : null;

      if (!fixtureId) continue; // Can't resolve football-data.org IDs yet

      const res = await fetch(
        `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`,
        { headers: { 'x-apisports-key': API_KEY } }
      );
      const data = await res.json();
      const fixture = data.response?.[0];

      if (!fixture) continue;

      const status = fixture.fixture?.status?.short;
      if (!['FT', 'AET', 'PEN'].includes(status)) continue; // Not finished

      const homeGoals = fixture.goals?.home ?? 0;
      const awayGoals = fixture.goals?.away ?? 0;
      const totalGoals = homeGoals + awayGoals;

      // Determine outcome based on market + pick
      let outcome: 'win' | 'loss' | 'push' | 'void' = 'loss';

      const market = pick.market.toLowerCase();
      const pickVal = pick.pick.toLowerCase();

      if (market.includes('total goals') || market.includes('over/under') || market.includes('over 2.5') || market.includes('under 2.5')) {
        // Extract line from pick value (e.g. "Over 2.5", "Under 3.5")
        const lineMatch = pickVal.match(/(\d+\.?\d*)/);
        const line = lineMatch ? parseFloat(lineMatch[1]) : 2.5;
        if (pickVal.includes('over')) outcome = totalGoals > line ? 'win' : totalGoals === line ? 'push' : 'loss';
        else outcome = totalGoals < line ? 'win' : totalGoals === line ? 'push' : 'loss';
      } else if (market.includes('match result') || market.includes('1x2') || market.includes('winner')) {
        if (pickVal.includes('home') || pickVal.includes(pick.home_team.toLowerCase())) {
          outcome = homeGoals > awayGoals ? 'win' : 'loss';
        } else if (pickVal.includes('away') || pickVal.includes(pick.away_team.toLowerCase())) {
          outcome = awayGoals > homeGoals ? 'win' : 'loss';
        } else if (pickVal.includes('draw')) {
          outcome = homeGoals === awayGoals ? 'win' : 'loss';
        }
      } else if (market.includes('btts') || market.includes('both teams')) {
        const bttsResult = homeGoals > 0 && awayGoals > 0;
        outcome = pickVal.includes('yes') ? (bttsResult ? 'win' : 'loss') : (!bttsResult ? 'win' : 'loss');
      }

      await sql`
        UPDATE picks
        SET outcome = ${outcome}, resolved_at = NOW(), api_fixture_id = ${fixtureId}
        WHERE id = ${pick.id}
      `;
      resolved++;
    } catch (e) {
      console.error('Resolve error for pick', pick.id, e);
    }
  }

  return NextResponse.json({ resolved, checked: pending.length });
}
