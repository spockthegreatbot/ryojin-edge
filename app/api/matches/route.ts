import { NextResponse } from "next/server";
import { MatchData } from "@/lib/mock-data";
import { calcEdgeScore } from "@/lib/edge-calculator";
import { getLiveMatches } from "@/lib/odds-api";
import { getStandings, getUpcomingMatches, enrichMatch } from "@/lib/football-data";
import { analyzeMatch } from "@/lib/bet-analyzer";
import { getTeamId, getTeamPtsAvg, getRecentForm } from "@/lib/balldontlie";

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
  const liveMatches = await getLiveMatches();

  if (liveMatches.length === 0) {
    return NextResponse.json([]);
  }

  // Pre-fetch standings for soccer enrichment (1 call per competition)
  const [plStandings, clStandings] = await Promise.all([
    getStandings("PL").catch(() => []),
    getStandings("CL").catch(() => []),
  ]);

  const enriched: MatchData[] = await Promise.all(
    liveMatches.map(async (lm) => {
      // Base stats — null/0 by default (no fake data)
      let homeForm: string[] = [];
      let awayForm: string[] = [];
      let goalsAvgHome = 0;
      let goalsAvgAway = 0;
      let h2hHomeWins = 0;
      let h2hTotal = 0;
      let h2hDraws = 0;

      if (lm.sport === "soccer") {
        // Try to enrich soccer matches with real form/stats from football-data.org
        try {
          const compCode = lm.league === "Champions League" ? "CL" : "PL";
          const standings = compCode === "CL" ? clStandings : plStandings;
          const fdMatches = await getUpcomingMatches(compCode);
          const normalize = (n: string) =>
            n.toLowerCase().replace(/\b(fc|cf|united|city|athletic|club)\b/g, "").trim();
          const fdMatch = fdMatches.find(
            (m) =>
              normalize(m.homeTeam.name).includes(normalize(lm.homeTeam).split(" ")[0]) ||
              normalize(lm.homeTeam).includes(normalize(m.homeTeam.name).split(" ")[0])
          );
          if (fdMatch && standings.length > 0) {
            const stats = await enrichMatch(fdMatch, standings);
            homeForm = stats.homeForm;
            awayForm = stats.awayForm;
            goalsAvgHome = stats.homeGoalsAvg;
            goalsAvgAway = stats.awayGoalsAvg;
            h2hHomeWins = stats.h2hHomeWins;
            h2hTotal = stats.h2hTotal;
            h2hDraws = stats.h2hDraws;
          }
        } catch { /* silent fallback — keep nulls */ }
      } else if (lm.sport === "nba") {
        // Enrich NBA with BallDontLie real stats
        try {
          const [homeId, awayId] = await Promise.all([
            getTeamId(lm.homeTeam),
            getTeamId(lm.awayTeam),
          ]);

          const [homePts, awayPts, homeFormArr, awayFormArr] = await Promise.all([
            homeId ? getTeamPtsAvg(homeId) : Promise.resolve(null),
            awayId ? getTeamPtsAvg(awayId) : Promise.resolve(null),
            homeId ? getRecentForm(homeId) : Promise.resolve([]),
            awayId ? getRecentForm(awayId) : Promise.resolve([]),
          ]);

          homeForm = homeFormArr;
          awayForm = awayFormArr;
          goalsAvgHome = homePts ?? 0;
          goalsAvgAway = awayPts ?? 0;
        } catch { /* silent fallback — keep nulls */ }
      }

      return {
        // Soccer-specific fields default to 0/null — no fake data
        cornersAvgHome: 0,
        cornersAvgAway: 0,
        cardsAvgHome: 0,
        cardsAvgAway: 0,
        xgHome: 0,
        xgAway: 0,
        bttsProb: 0,
        cleanSheetHome: 0,
        cleanSheetAway: 0,
        firstHalfGoalsAvg: 0,
        varLikelihood: 0,
        props: [],
        // Real or empty stats
        homeForm,
        awayForm,
        goalsAvgHome,
        goalsAvgAway,
        h2hHomeWins,
        h2hTotal,
        h2hDraws,
        // Live match fields
        id: lm.id,
        sport: lm.sport,
        league: lm.league,
        homeTeam: lm.homeTeam,
        awayTeam: lm.awayTeam,
        commenceTime: lm.commenceTime,
        homeOdds: lm.homeOdds,
        awayOdds: lm.awayOdds,
        drawOdds: lm.drawOdds,
        // Extra fields
        isLive: true as unknown as undefined,
        dataSource: "The Odds API + football-data.org + BallDontLie" as unknown as undefined,
      } as MatchData;
    })
  );

  const matches = enriched.map(applyEdge);
  return NextResponse.json(matches, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
