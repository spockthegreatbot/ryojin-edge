import { NextResponse } from "next/server";
import { MatchData } from "@/lib/mock-data";
import { calcEdgeScore } from "@/lib/edge-calculator";
import { getLiveMatches } from "@/lib/odds-api";
import { getStandings, getUpcomingMatchesRange, enrichMatch } from "@/lib/football-data";
import { analyzeMatch } from "@/lib/bet-analyzer";
import { getTeamId, getTeamPtsAvg, getRecentForm, getUpcomingNBAGames } from "@/lib/balldontlie";

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

// Normalize team name for fuzzy matching against Odds API
function normName(n: string) {
  return n.toLowerCase()
    .replace(/\b(fc|cf|afc|sc|ac|bv|bvb|united|city|athletic|club|hotspur|albion|wanderers|rovers|county|town)\b/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamsMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  const wordsA = na.split(" ").filter(Boolean);
  const wordsB = nb.split(" ").filter(Boolean);
  // At least one significant word overlaps
  return wordsA.some(w => w.length > 3 && nb.includes(w)) ||
    wordsB.some(w => w.length > 3 && na.includes(w));
}

export async function GET() {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dateFrom = now.toISOString().split("T")[0];
  const dateTo = weekAhead.toISOString().split("T")[0];

  // Fetch all primary data sources in parallel
  const [plMatches, clMatches, plStandings, clStandings, nbaGames, oddsMatches] = await Promise.all([
    getUpcomingMatchesRange("PL", dateFrom, dateTo).catch(() => []),
    getUpcomingMatchesRange("CL", dateFrom, dateTo).catch(() => []),
    getStandings("PL").catch(() => []),
    getStandings("CL").catch(() => []),
    getUpcomingNBAGames(dateFrom, dateTo).catch(() => []),
    getLiveMatches().catch(() => []), // Optional — Odds API overlay (6h cache)
  ]);

  const results: MatchData[] = [];

  // --- SOCCER: football-data.org primary ---
  const soccerFixtures = [
    ...plMatches.slice(0, 10).map(m => ({ match: m, comp: "PL", league: "Premier League" })),
    ...clMatches.slice(0, 10).map(m => ({ match: m, comp: "CL", league: "Champions League" })),
  ];

  for (const { match, comp, league } of soccerFixtures) {
    const standings = comp === "CL" ? clStandings : plStandings;

    // Get real stats from standings + H2H
    let homeForm: string[] = [];
    let awayForm: string[] = [];
    let goalsAvgHome = 0;
    let goalsAvgAway = 0;
    let h2hHomeWins = 0;
    let h2hTotal = 0;
    let h2hDraws = 0;

    try {
      if (standings.length > 0) {
        const stats = await enrichMatch(match, standings);
        homeForm = stats.homeForm;
        awayForm = stats.awayForm;
        goalsAvgHome = stats.homeGoalsAvg;
        goalsAvgAway = stats.awayGoalsAvg;
        h2hHomeWins = stats.h2hHomeWins;
        h2hTotal = stats.h2hTotal;
        h2hDraws = stats.h2hDraws;
      }
    } catch { /* keep zeros */ }

    // Try to find odds from Odds API by team name match
    let homeOdds = 0;
    let awayOdds = 0;
    let drawOdds: number | undefined;
    const oddsMatch = oddsMatches.find(
      om => om.sport === "soccer" &&
        teamsMatch(om.homeTeam, match.homeTeam.name) &&
        teamsMatch(om.awayTeam, match.awayTeam.name)
    );
    if (oddsMatch) {
      homeOdds = oddsMatch.homeOdds;
      awayOdds = oddsMatch.awayOdds;
      drawOdds = oddsMatch.drawOdds;
    }

    results.push(applyEdge({
      id: `fd-${match.id}`,
      sport: "soccer",
      league,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      commenceTime: match.utcDate,
      homeOdds,
      awayOdds,
      drawOdds,
      homeForm,
      awayForm,
      goalsAvgHome,
      goalsAvgAway,
      h2hHomeWins,
      h2hTotal,
      h2hDraws,
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
    }));
  }

  // --- NBA: BallDontLie primary ---
  for (const game of nbaGames.slice(0, 15)) {
    let homeForm: string[] = [];
    let awayForm: string[] = [];
    let goalsAvgHome = 0;
    let goalsAvgAway = 0;

    try {
      const [homeId, awayId] = await Promise.all([
        getTeamId(game.homeTeam),
        getTeamId(game.awayTeam),
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
    } catch { /* keep zeros */ }

    // Try Odds API overlay for NBA
    let homeOdds = 0;
    let awayOdds = 0;
    const oddsMatch = oddsMatches.find(
      om => om.sport === "nba" &&
        teamsMatch(om.homeTeam, game.homeTeam) &&
        teamsMatch(om.awayTeam, game.awayTeam)
    );
    if (oddsMatch) {
      homeOdds = oddsMatch.homeOdds;
      awayOdds = oddsMatch.awayOdds;
    }

    results.push(applyEdge({
      id: `bdl-${game.id}`,
      sport: "nba",
      league: "NBA",
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      commenceTime: game.date,
      homeOdds,
      awayOdds,
      homeForm,
      awayForm,
      goalsAvgHome,
      goalsAvgAway,
      h2hHomeWins: 0,
      h2hTotal: 0,
      h2hDraws: 0,
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
    }));
  }

  // Sort by commenceTime ascending
  results.sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());

  return NextResponse.json(results, {
    headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" },
  });
}
