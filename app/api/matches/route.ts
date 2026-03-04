import { NextResponse } from "next/server";
import { MOCK_MATCHES } from "@/lib/mock-data";
import { calcEdgeScore } from "@/lib/edge-calculator";

export async function GET() {
  const matches = MOCK_MATCHES.map((m) => {
    const edge = calcEdgeScore({
      homeForm: m.homeForm,
      awayForm: m.awayForm,
      h2hHomeWins: m.h2hHomeWins,
      h2hTotal: m.h2hTotal,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
    });
    return { ...m, ...edge };
  });

  // Try live odds from The Odds API — silent fallback
  try {
    const key = process.env.ODDS_API_KEY;
    if (key) {
      await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=${key}&regions=au&markets=h2h&oddsFormat=decimal&daysFrom=2`,
        { next: { revalidate: 300 } }
      );
    }
  } catch { /* silent */ }

  return NextResponse.json(matches);
}
