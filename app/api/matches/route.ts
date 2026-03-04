import { NextResponse } from "next/server";
import { MOCK_MATCHES } from "@/lib/mock-data";
import { calcEdgeScore } from "@/lib/edge-calculator";

export async function GET() {
  const matches = MOCK_MATCHES.map((m) => ({
    ...m,
    ...calcEdgeScore({
      homeForm: m.homeForm,
      awayForm: m.awayForm,
      h2hHomeWins: m.h2hHomeWins,
      h2hTotal: m.h2hTotal,
    }),
  }));

  // Try to pull live odds from The Odds API — graceful fallback
  try {
    const key = process.env.ODDS_API_KEY;
    if (key) {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=${key}&regions=au&markets=h2h&oddsFormat=decimal&daysFrom=2`,
        { next: { revalidate: 300 } }
      );
      if (res.ok) {
        // Live data available — could merge here in future
        // For now mock data is the base
      }
    }
  } catch {
    // Silent fallback to mock
  }

  return NextResponse.json(matches);
}
