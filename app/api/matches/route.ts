import { NextResponse } from "next/server";
import { MOCK_MATCHES, MatchData } from "@/lib/mock-data";
import { calcEdgeScore } from "@/lib/edge-calculator";
import { getLiveMatches } from "@/lib/odds-api";
import { getStandings, getUpcomingMatches, enrichMatch } from "@/lib/football-data";
import { analyzeMatch } from "@/lib/bet-analyzer";

// Default values for stats we can't source without API-Football yet
const soccerDefaults = {
  homeForm: ["W", "W", "D", "W", "L"] as string[],
  awayForm: ["W", "L", "W", "D", "W"] as string[],
  h2hHomeWins: 3,
  h2hTotal: 5,
  h2hDraws: 1,
  cornersAvgHome: 5.2,
  cornersAvgAway: 4.8,
  cardsAvgHome: 1.8,
  cardsAvgAway: 2.1,
  goalsAvgHome: 1.6,
  goalsAvgAway: 1.2,
  xgHome: 1.5,
  xgAway: 1.1,
  bttsProb: 52,
  cleanSheetHome: 28,
  cleanSheetAway: 22,
  firstHalfGoalsAvg: 0.9,
  varLikelihood: 35,
  props: [
    { label: "Both Teams to Score", value: "Yes", confidence: 62 },
    { label: "Total Goals", value: "Over 2.5", confidence: 58 },
    { label: "1st Half Goals", value: "Over 0.5", confidence: 71 },
    { label: "Corners", value: "Over 9.5", confidence: 65 },
  ],
};

const nbaDefaults = {
  homeForm: ["W", "W", "L", "W", "W"] as string[],
  awayForm: ["L", "W", "W", "L", "W"] as string[],
  h2hHomeWins: 3,
  h2hTotal: 5,
  h2hDraws: 0,
  cornersAvgHome: 0,
  cornersAvgAway: 0,
  cardsAvgHome: 0,
  cardsAvgAway: 0,
  goalsAvgHome: 112.5,
  goalsAvgAway: 108.2,
  xgHome: 0,
  xgAway: 0,
  bttsProb: 0,
  cleanSheetHome: 0,
  cleanSheetAway: 0,
  firstHalfGoalsAvg: 0,
  varLikelihood: 0,
  props: [
    { label: "Total Points", value: "Over 222.5", confidence: 66 },
    { label: "Spread", value: "Home -3.5", confidence: 60 },
    { label: "1st Half", value: "Over 110.5", confidence: 63 },
    { label: "Player Prop", value: "Star Player 25+ pts", confidence: 58 },
  ],
};

function applyEdge(match: MatchData) {
  const edge = calcEdgeScore({
    homeForm: match.homeForm,
    awayForm: match.awayForm,
    h2hHomeWins: match.h2hHomeWins,
    h2hTotal: match.h2hTotal,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
  });
  const bets = analyzeMatch({ ...match });
  return { ...match, ...edge, bets };
}

export async function GET() {
  // Try live data first
  try {
    const liveMatches = await getLiveMatches();

    if (liveMatches.length > 0) {
      // Pre-fetch standings for soccer enrichment (1 call per competition)
      const [plStandings, clStandings] = await Promise.all([
        getStandings("PL"),
        getStandings("CL"),
      ]);

      const enriched: MatchData[] = await Promise.all(
        liveMatches.map(async (lm) => {
          const defaults = lm.sport === "soccer" ? soccerDefaults : nbaDefaults;

          // Try to enrich soccer matches with real form/stats from football-data.org
          let soccerStats = {};
          if (lm.sport === "soccer") {
            try {
              const compCode = lm.league === "Champions League" ? "CL" : "PL";
              const standings = compCode === "CL" ? clStandings : plStandings;
              const fdMatches = await getUpcomingMatches(compCode);
              // Match by team name (fuzzy)
              const normalize = (n: string) =>
                n.toLowerCase().replace(/\b(fc|cf|united|city|athletic|club)\b/g, "").trim();
              const fdMatch = fdMatches.find(
                (m) =>
                  normalize(m.homeTeam.name).includes(normalize(lm.homeTeam).split(" ")[0]) ||
                  normalize(lm.homeTeam).includes(normalize(m.homeTeam.name).split(" ")[0])
              );
              if (fdMatch && standings.length > 0) {
                const stats = await enrichMatch(fdMatch, standings);
                soccerStats = {
                  homeForm: stats.homeForm,
                  awayForm: stats.awayForm,
                  goalsAvgHome: stats.homeGoalsAvg,
                  goalsAvgAway: stats.awayGoalsAvg,
                  h2hHomeWins: stats.h2hHomeWins,
                  h2hTotal: stats.h2hTotal,
                  h2hDraws: stats.h2hDraws,
                };
              }
            } catch { /* silent fallback */ }
          }

          return {
            ...defaults,
            ...soccerStats,
            id: lm.id,
            sport: lm.sport,
            league: lm.league,
            homeTeam: lm.homeTeam,
            awayTeam: lm.awayTeam,
            commenceTime: lm.commenceTime,
            homeOdds: lm.homeOdds,
            awayOdds: lm.awayOdds,
            drawOdds: lm.drawOdds,
            isLive: true as unknown as undefined,
            dataSource: "The Odds API + football-data.org" as unknown as undefined,
          };
        })
      );

      const matches = enriched.map(applyEdge);
      return NextResponse.json(matches, {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
      });
    }
  } catch (err) {
    console.error("[matches] Live data failed, falling back to mock:", err);
  }

  // Fallback: mock data
  const matches = MOCK_MATCHES.map(applyEdge);
  return NextResponse.json(matches);
}
