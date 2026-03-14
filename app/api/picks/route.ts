import { NextResponse } from "next/server";
import { BetSuggestion } from "@/lib/bet-analyzer";
import { MatchData } from "@/lib/mock-data";
import { getDb } from "@/lib/db";
import { buildParlays } from "@/lib/parlays";
import { sendPickAlert } from "@/lib/alerts";
import { getCS2Rankings, getCS2Matches, getCS2Results } from "@/lib/hltv";
import { predictAllCS2Matches } from "@/lib/cs2-elo";

interface MatchWithBets extends MatchData {
  bets: BetSuggestion[];
}

interface Pick {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  match: string;
  league: string;
  sport: string;
  kickoff: string;
  market: string;
  pick: string;
  edge: number;
  edgePct: string;
  confidence: number;
  modelProb: number;
  marketProb: number;
  odds: number | null;
  tier: string;
  reasoning: string;
  kellySuggestion: string | null;
  factors?: { label: string; impact: number; direction: "+" | "-" | "=" }[];
  refereeNote?: string;
  // Form data for streak badges
  homeForm: string[];
  awayForm: string[];
  // xG context (Task 3)
  homeXg?: number;
  awayXg?: number;
  // Elo context (Task 2)
  eloHome?: number;
  eloAway?: number;
  eloGap?: number;
  // CLV tracking
  closing_odds?: number | null;
  clv?: number | null;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  // Fetch from internal /api/matches to reuse existing data pipeline
  const matchesRes = await fetch(`${origin}/api/matches`, {
    headers: { "Cache-Control": "no-store" },
    next: { revalidate: 0 },
  });

  if (!matchesRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch matches", status: matchesRes.status },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  const matches: MatchWithBets[] = await matchesRes.json();

  // Collect all value bets from all matches
  const picks: Pick[] = [];

  for (const match of matches) {
    if (!Array.isArray(match.bets)) continue;

    const matchLabel = `${match.homeTeam} vs ${match.awayTeam}`;

    for (const bet of match.bets) {
      // Only surface value bets (edge >= 0.05)
      if (!bet.value) continue;

      const eloHome = match.homeElo ?? undefined;
      const eloAway = match.awayElo ?? undefined;
      const eloGap = (eloHome !== undefined && eloAway !== undefined)
        ? Math.round(Math.abs(eloHome - eloAway))
        : undefined;

      picks.push({
        matchId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        match: matchLabel,
        league: match.league,
        sport: match.sport,
        kickoff: match.commenceTime,
        market: bet.market,
        pick: bet.pick,
        edge: Math.round(bet.edge * 1000) / 1000,
        edgePct: `+${Math.round(bet.edge * 100)}%`,
        confidence: bet.confidence,
        modelProb: Math.round(bet.modelProb * 1000) / 1000,
        marketProb: Math.round(bet.marketProb * 1000) / 1000,
        odds: bet.odds ?? null,
        tier: bet.tier,
        reasoning: bet.reasoning,
        kellySuggestion: bet.kellySuggestion ?? null,
        factors: bet.factors,
        refereeNote: bet.refereeNote,
        homeForm: match.homeForm ?? [],
        awayForm: match.awayForm ?? [],
        homeXg: match.xgHome > 0 ? match.xgHome : undefined,
        awayXg: match.xgAway > 0 ? match.xgAway : undefined,
        eloHome,
        eloAway,
        eloGap,
      });
    }
  }

  // ── Merge CS2 picks ──────────────────────────────────────────────────────
  try {
    const [cs2Rankings, cs2Matches, cs2Results] = await Promise.all([
      getCS2Rankings(),
      getCS2Matches(),
      getCS2Results(),
    ]);
    const cs2Predictions = predictAllCS2Matches(cs2Matches, cs2Rankings, cs2Results);
    for (const pred of cs2Predictions) {
      picks.push({
        matchId: pred.matchId,
        homeTeam: pred.team1,
        awayTeam: pred.team2,
        match: `${pred.team1} vs ${pred.team2}`,
        league: pred.event,
        sport: "cs2",
        kickoff: pred.date,
        market: "Match Winner",
        pick: pred.pick,
        edge: pred.edge,
        edgePct: `+${Math.round(pred.edge * 100)}%`,
        confidence: pred.confidence,
        modelProb: pred.pickProb,
        marketProb: pred.marketProb ?? 0.5,
        odds: pred.marketOdds,
        tier: pred.tier,
        reasoning: pred.reasoning,
        kellySuggestion: "No market odds",
        homeForm: pred.team1Form,
        awayForm: pred.team2Form,
      });
    }
  } catch (e) {
    console.error("[picks] CS2 merge failed:", e);
  }

  // Sort by edge descending — highest value first
  picks.sort((a, b) => b.edge - a.edge);

  // Fire alerts for high-edge picks (non-blocking)
  picks.filter(p => p.edge >= 0.15 && p.odds !== null).forEach(p => sendPickAlert({ ...p, odds: p.odds! }).catch(() => {}));

  // ── Upsert picks to Neon DB (non-fatal) ──────────────────────────────────
  if (process.env.DATABASE_URL) {
    try {
      const sql = getDb();
      for (const pick of picks) {
        await sql`
          INSERT INTO picks (
            match_id, home_team, away_team, league, sport, kickoff,
            market, pick, edge, model_prob, market_prob, odds, tier, kelly,
            opening_odds
          ) VALUES (
            ${pick.matchId}, ${pick.homeTeam}, ${pick.awayTeam},
            ${pick.league}, ${pick.sport}, ${pick.kickoff},
            ${pick.market}, ${pick.pick}, ${pick.edge},
            ${pick.modelProb ?? null}, ${pick.marketProb ?? null},
            ${pick.odds ?? null}, ${pick.tier}, ${pick.kellySuggestion ?? null},
            ${pick.odds ?? null}
          )
          ON CONFLICT (match_id, market, pick) DO NOTHING
        `;
      }

      // Merge closing_odds and clv from DB into picks response
      if (picks.length > 0) {
        const matchIds = [...new Set(picks.map(p => p.matchId))];
        const dbRows = await sql`
          SELECT match_id, market, pick, closing_odds, clv
          FROM picks
          WHERE match_id = ANY(${matchIds})
            AND closing_odds IS NOT NULL
        ` as Array<{ match_id: string; market: string; pick: string; closing_odds: number | null; clv: number | null }>;

        const clvMap = new Map(dbRows.map(r => [`${r.match_id}::${r.market}::${r.pick}`, r]));
        for (const p of picks) {
          const key = `${p.matchId}::${p.market}::${p.pick}`;
          const row = clvMap.get(key);
          if (row) {
            p.closing_odds = row.closing_odds;
            p.clv = row.clv;
          }
        }
      }
    } catch (e) {
      // Non-fatal — don't break the picks endpoint if DB is down
      console.error("DB upsert failed:", e);
    }
  }

  // Build summary
  const strong = picks.filter((p) => p.tier === "🔥 Strong").length;
  const lean = picks.filter((p) => p.tier === "✅ Lean").length;
  const marginal = picks.filter((p) => p.tier === "⚠️ Marginal").length;

  // Build top 3 parlays for Gordon multi-leg execution
  const topParlays = buildParlays(
    matches.map((m) => ({
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      league: m.league,
      commenceTime: m.commenceTime,
      bets: m.bets ?? [],
    }))
  ).slice(0, 3);

  const payload = {
    generated: new Date().toISOString(),
    picks,
    parlays: topParlays,
    summary: {
      total: picks.length,
      strong,
      lean,
      marginal,
    },
  };

  return NextResponse.json(payload, { headers: CORS_HEADERS });
}
