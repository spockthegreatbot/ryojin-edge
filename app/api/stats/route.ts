import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const FLAT_STAKE = 10;
const NO_STORE = { 'Cache-Control': 'no-store' };

// ── Simulation helpers ──────────────────────────────────────────────────────
function calcResult(outcome: string, odds: number | null): number {
  if (outcome === 'win') return parseFloat(((( odds ?? 2) - 1) * FLAT_STAKE).toFixed(2));
  if (outcome === 'loss') return -FLAT_STAKE;
  return 0; // push / void
}

interface RawPick {
  id: number;
  match_id: string;
  home_team: string;
  away_team: string;
  league: string;
  sport: string;
  market: string;
  pick: string;
  edge: number;
  odds: number | null;
  tier: string | null;
  outcome: string | null;
  kickoff: string;
  recorded_at: string;
  resolved_at: string | null;
}

function emptyStats() {
  return {
    overall: { total: 0, wins: 0, losses: 0, pending: 0, win_rate: null, avg_edge_wins: null, avg_edge_all: null },
    bySport: [],
    byMarket: [],
    byTier: [],
    recentPicks: [],
    totalStaked: 0,
    totalProfit: 0,
    roi: 0,
    dailyPnl: [],
    monthlyPnl: [],
  };
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(emptyStats(), { headers: NO_STORE });
  }

  try {
    const sql = getDb();

    // Fetch everything in parallel
    const [overallRows, bySport, byMarket, byTier, allResolved, recentRows] = await Promise.all([
      sql`
        SELECT
          COUNT(*)::int                                                                    AS total,
          COUNT(CASE WHEN outcome = 'win'  THEN 1 END)::int                              AS wins,
          COUNT(CASE WHEN outcome = 'loss' THEN 1 END)::int                              AS losses,
          COUNT(CASE WHEN outcome IS NULL  THEN 1 END)::int                              AS pending,
          ROUND(
            COUNT(CASE WHEN outcome = 'win' THEN 1 END)::numeric
            / NULLIF(COUNT(CASE WHEN outcome IN ('win','loss') THEN 1 END),0)
            * 100, 1
          )                                                                               AS win_rate,
          ROUND(AVG(CASE WHEN outcome = 'win' THEN edge END) * 100, 1)                  AS avg_edge_wins,
          ROUND(AVG(edge) * 100, 1)                                                      AS avg_edge_all
        FROM picks
      `,

      sql`
        SELECT sport,
          COUNT(*)::int                                                                   AS total,
          COUNT(CASE WHEN outcome = 'win' THEN 1 END)::int                              AS wins,
          ROUND(
            COUNT(CASE WHEN outcome = 'win' THEN 1 END)::numeric
            / NULLIF(COUNT(CASE WHEN outcome IN ('win','loss') THEN 1 END),0)
            * 100, 1
          )                                                                              AS win_rate
        FROM picks GROUP BY sport ORDER BY total DESC
      `,

      sql`
        SELECT market,
          COUNT(*)::int                                                                   AS total,
          COUNT(CASE WHEN outcome = 'win' THEN 1 END)::int                              AS wins,
          ROUND(
            COUNT(CASE WHEN outcome = 'win' THEN 1 END)::numeric
            / NULLIF(COUNT(CASE WHEN outcome IN ('win','loss') THEN 1 END),0)
            * 100, 1
          )                                                                              AS win_rate
        FROM picks GROUP BY market ORDER BY total DESC LIMIT 10
      `,

      sql`
        SELECT tier,
          COUNT(*)::int                                                                   AS total,
          COUNT(CASE WHEN outcome = 'win' THEN 1 END)::int                              AS wins,
          ROUND(
            COUNT(CASE WHEN outcome = 'win' THEN 1 END)::numeric
            / NULLIF(COUNT(CASE WHEN outcome IN ('win','loss') THEN 1 END),0)
            * 100, 1
          )                                                                              AS win_rate
        FROM picks GROUP BY tier ORDER BY total DESC
      `,

      // All settled picks for simulation (date-ordered)
      sql`
        SELECT id, home_team, away_team, market, pick, edge, odds, outcome, resolved_at, kickoff
        FROM picks
        WHERE outcome IN ('win','loss','push','void')
        ORDER BY resolved_at ASC
      ` as unknown as Promise<RawPick[]>,

      // Latest 30 picks (settled + pending) for table
      sql`
        SELECT home_team, away_team, league, market, pick, edge, odds, outcome,
               kickoff, recorded_at, resolved_at, tier
        FROM picks
        ORDER BY recorded_at DESC LIMIT 30
      ` as unknown as Promise<RawPick[]>,
    ]);

    // ── Simulation: P&L per settled pick ──────────────────────────────────
    const settledPicks = (allResolved as RawPick[]).filter(
      (p) => p.outcome === 'win' || p.outcome === 'loss'
    );

    const totalStaked = settledPicks.length * FLAT_STAKE;
    const totalProfit = parseFloat(
      settledPicks.reduce((sum, p) => sum + calcResult(p.outcome!, p.odds), 0).toFixed(2)
    );
    const roi = totalStaked > 0 ? parseFloat(((totalProfit / totalStaked) * 100).toFixed(2)) : 0;

    // ── Daily P&L for last 30 days ─────────────────────────────────────────
    const now = Date.now();
    const dailyMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = 0;
    }

    for (const p of settledPicks) {
      const day = (p.resolved_at ?? p.kickoff).split('T')[0];
      if (day in dailyMap) {
        dailyMap[day] += calcResult(p.outcome!, p.odds);
      }
    }

    let cumulative = 0;
    const dailyPnl = Object.entries(dailyMap).map(([date, daily]) => {
      cumulative = parseFloat((cumulative + daily).toFixed(2));
      return {
        date,
        label: new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
        dailyPnl: parseFloat(daily.toFixed(2)),
        cumulativePnl: cumulative,
      };
    });

    // ── Monthly P&L ────────────────────────────────────────────────────────
    const monthMap: Record<string, number> = {};
    for (const p of settledPicks) {
      const d = new Date(p.resolved_at ?? p.kickoff);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = (monthMap[key] ?? 0) + calcResult(p.outcome!, p.odds);
    }
    const monthlyPnl = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, pnl]) => ({
        month: new Date(key + '-01').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
        pnl: parseFloat(pnl.toFixed(2)),
      }));

    // ── Enrich recentPicks with simulated result ────────────────────────────
    const recentPicks = (recentRows as RawPick[]).map((p) => ({
      date: p.recorded_at,
      match: `${p.home_team} v ${p.away_team}`,
      market: p.market,
      pick: p.pick,
      stake: FLAT_STAKE,
      odds: p.odds,
      outcome: p.outcome,
      result: p.outcome ? calcResult(p.outcome, p.odds) : null,
      tier: p.tier,
      edge: p.edge,
    }));

    return NextResponse.json({
      overall: overallRows[0],
      bySport,
      byMarket,
      byTier,
      recentPicks,
      totalStaked,
      totalProfit,
      roi,
      dailyPnl,
      monthlyPnl,
    }, { headers: NO_STORE });

  } catch (e) {
    console.error('Stats API error:', e);
    return NextResponse.json(emptyStats(), { headers: NO_STORE });
  }
}
