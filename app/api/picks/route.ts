import { NextResponse } from "next/server";
import { BetSuggestion } from "@/lib/bet-analyzer";
import { MatchData } from "@/lib/mock-data";

interface MatchWithBets extends MatchData {
  bets: BetSuggestion[];
}

interface Pick {
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

      picks.push({
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
      });
    }
  }

  // Sort by edge descending — highest value first
  picks.sort((a, b) => b.edge - a.edge);

  // Build summary
  const strong = picks.filter((p) => p.tier === "🔥 Strong").length;
  const lean = picks.filter((p) => p.tier === "✅ Lean").length;
  const marginal = picks.filter((p) => p.tier === "⚠️ Marginal").length;

  const payload = {
    generated: new Date().toISOString(),
    picks,
    summary: {
      total: picks.length,
      strong,
      lean,
      marginal,
    },
  };

  return NextResponse.json(payload, { headers: CORS_HEADERS });
}
