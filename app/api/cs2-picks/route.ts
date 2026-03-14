import { NextResponse } from "next/server";
import { getCS2Rankings, getCS2Matches, getCS2Results } from "@/lib/hltv";
import { predictAllCS2Matches, CS2Prediction } from "@/lib/cs2-elo";

export const revalidate = 1800; // 30 min cache

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const [rankings, matches, results] = await Promise.all([
      getCS2Rankings(),
      getCS2Matches(),
      getCS2Results(),
    ]);

    const predictions = predictAllCS2Matches(matches, rankings, results);

    // Sort by confidence descending
    predictions.sort((a, b) => b.confidence - a.confidence);

    // Build unified picks format for integration with main picks endpoint
    const picks = predictions.map((pred: CS2Prediction) => ({
      matchId: pred.matchId,
      homeTeam: pred.team1,
      awayTeam: pred.team2,
      match: `${pred.team1} vs ${pred.team2}`,
      league: pred.event,
      sport: "cs2" as const,
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
      kellySuggestion: pred.marketOdds
        ? `${Math.round(((pred.pickProb * pred.marketOdds - 1) / (pred.marketOdds - 1)) * 100) / 10}% of bankroll`
        : "No market odds",
      // CS2-specific fields
      format: pred.format,
      isLan: pred.isLan,
      team1Rank: pred.team1Rank,
      team2Rank: pred.team2Rank,
      team1Elo: pred.team1Elo,
      team2Elo: pred.team2Elo,
      team1Form: pred.team1Form,
      team2Form: pred.team2Form,
      team1WinProb: pred.team1WinProb,
      team2WinProb: pred.team2WinProb,
      homeForm: pred.team1Form,
      awayForm: pred.team2Form,
    }));

    const locks = picks.filter(p => p.tier === "🔒 LOCK").length;
    const strong = picks.filter(p => p.tier === "🎯 STRONG").length;
    const spec = picks.filter(p => p.tier === "⚡ SPEC").length;

    return NextResponse.json({
      generated: new Date().toISOString(),
      sport: "cs2",
      picks,
      summary: {
        total: picks.length,
        locks,
        strong,
        spec,
      },
    }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[cs2-picks]", err);
    return NextResponse.json(
      { error: "Failed to generate CS2 picks" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
