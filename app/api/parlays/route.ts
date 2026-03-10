import { NextResponse } from "next/server";
import { MatchData } from "@/lib/mock-data";
import { BetSuggestion } from "@/lib/bet-analyzer";
import { buildParlays } from "@/lib/parlays";

interface MatchWithBets extends MatchData {
  bets: BetSuggestion[];
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

  const parlays = buildParlays(
    matches.map((m) => ({
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      league: m.league,
      commenceTime: m.commenceTime,
      bets: m.bets ?? [],
    }))
  );

  const twoLeg = parlays.filter((p) => p.legs.length === 2);
  const threeLeg = parlays.filter((p) => p.legs.length === 3);

  const payload = {
    generated: new Date().toISOString(),
    parlays,
    twoLeg,
    threeLeg,
    summary: {
      total: parlays.length,
      byStrategy: {
        highConfidence: parlays.filter(p => p.strategy === 'best-bets').length,
        valueAccumulator: parlays.filter(p => p.strategy === 'value-accumulator').length,
        powerParlay: parlays.filter(p => p.strategy === 'best-bets').length,
        leagueSpread: parlays.filter(p => p.strategy === 'league-spread').length,
      },
    },
  };

  return NextResponse.json(payload, { headers: CORS_HEADERS });
}
