import { NextResponse } from "next/server";
import { MatchData } from "@/lib/mock-data";
import { calcEdgeScore } from "@/lib/edge-calculator";
import { getLiveMatches } from "@/lib/odds-api";
import { getStandings, getUpcomingMatchesRange, enrichMatch } from "@/lib/football-data";
import { analyzeMatch } from "@/lib/bet-analyzer";
import { getTeamId, getTeamPtsAvg, getRecentForm, getUpcomingNBAGames } from "@/lib/balldontlie";
import {
  getTeamStats,
  getFootballTeamId,
  getNBATeamStats,
  LEAGUE,
  NBA_SEASON,
} from "@/lib/api-sports";

// Extended MatchData with data source flags
export interface MatchDataExtended extends MatchData {
  dataSourceApiSports?: boolean;
  dataSourceFootballData?: boolean;
}

function applyEdge(match: MatchDataExtended) {
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
  return wordsA.some(w => w.length > 3 && nb.includes(w)) ||
    wordsB.some(w => w.length > 3 && na.includes(w));
}

// Determine which league ID to use based on competition code
function leagueIdForComp(comp: string): number {
  if (comp === "CL") return LEAGUE.UCL;
  return LEAGUE.EPL; // default to EPL
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
    getLiveMatches().catch(() => []),
  ]);

  const results: MatchDataExtended[] = [];

  // --- SOCCER: football-data.org primary + API-Sports for team stats ---
  const soccerFixtures = [
    ...plMatches.slice(0, 10).map(m => ({ match: m, comp: "PL", league: "Premier League" })),
    ...clMatches.slice(0, 10).map(m => ({ match: m, comp: "CL", league: "Champions League" })),
  ];

  for (const { match, comp, league } of soccerFixtures) {
    const standings = comp === "CL" ? clStandings : plStandings;
    const leagueId = leagueIdForComp(comp);

    // Baseline from football-data.org (H2H, form from standings)
    let homeForm: string[] = [];
    let awayForm: string[] = [];
    let goalsAvgHome = 0;
    let goalsAvgAway = 0;
    let h2hHomeWins = 0;
    let h2hTotal = 0;
    let h2hDraws = 0;
    let cornersAvgHome = 0;
    let cornersAvgAway = 0;
    let cardsAvgHome = 0;
    let cardsAvgAway = 0;
    let bttsProb = 0;
    let cleanSheetHome = 0;
    let cleanSheetAway = 0;
    let dataSourceFootballData = false;
    let dataSourceApiSports = false;

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
        dataSourceFootballData = true;
      }
    } catch { /* keep zeros */ }

    // API-Sports: fetch team IDs + stats in parallel
    try {
      const [homeId, awayId] = await Promise.all([
        getFootballTeamId(match.homeTeam.name, leagueId),
        getFootballTeamId(match.awayTeam.name, leagueId),
      ]);

      const [homeStats, awayStats] = await Promise.all([
        homeId ? getTeamStats(homeId, leagueId, 2024) : Promise.resolve(null),
        awayId ? getTeamStats(awayId, leagueId, 2024) : Promise.resolve(null),
      ]);

      if (homeStats) {
        homeForm = homeStats.form.length > 0 ? homeStats.form : homeForm;
        goalsAvgHome = homeStats.goalsForAvg > 0 ? homeStats.goalsForAvg : goalsAvgHome;
        cornersAvgHome = homeStats.cornersAvg;
        cardsAvgHome = homeStats.cardsAvg;
        cleanSheetHome = homeStats.cleanSheetPct;
        bttsProb = homeStats.bttsProb; // rough estimate
        dataSourceApiSports = true;
      }

      if (awayStats) {
        awayForm = awayStats.form.length > 0 ? awayStats.form : awayForm;
        goalsAvgAway = awayStats.goalsForAvg > 0 ? awayStats.goalsForAvg : goalsAvgAway;
        cornersAvgAway = awayStats.cornersAvg;
        cardsAvgAway = awayStats.cardsAvg;
        cleanSheetAway = awayStats.cleanSheetPct;
        // Average BTTS prob from both teams
        if (homeStats) {
          bttsProb = (homeStats.bttsProb + awayStats.bttsProb) / 2;
        }
        dataSourceApiSports = true;
      }
    } catch { /* keep football-data values */ }

    // Try to find odds from Odds API
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
      cornersAvgHome,
      cornersAvgAway,
      cardsAvgHome,
      cardsAvgAway,
      xgHome: 0,
      xgAway: 0,
      bttsProb,
      cleanSheetHome,
      cleanSheetAway,
      firstHalfGoalsAvg: 0,
      varLikelihood: 0,
      props: [],
      dataSourceApiSports,
      dataSourceFootballData,
    }));
  }

  // --- NBA: BallDontLie primary + API-Sports fallback ---
  for (const game of nbaGames.slice(0, 15)) {
    let homeForm: string[] = [];
    let awayForm: string[] = [];
    let goalsAvgHome = 0;
    let goalsAvgAway = 0;
    let dataSourceApiSports = false;

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

    // API-Sports Basketball fallback (or supplement) for team stats
    // Try to get team IDs from API-Sports using team name search
    // NBA teams in API-Sports use numeric IDs — skip ID lookup for now,
    // only augment if BallDontLie returned zeros
    if (goalsAvgHome === 0 || goalsAvgAway === 0) {
      try {
        // API-Sports Basketball team search
        const apiKey = process.env.API_SPORTS_KEY ?? "";
        if (apiKey) {
          const [homeSearch, awaySearch] = await Promise.all([
            fetch(`https://v1.basketball.api-sports.io/teams?name=${encodeURIComponent(game.homeTeam)}`, {
              headers: { "x-apisports-key": apiKey },
              next: { revalidate: 86400 },
            }).then(r => r.json()).catch(() => null),
            fetch(`https://v1.basketball.api-sports.io/teams?name=${encodeURIComponent(game.awayTeam)}`, {
              headers: { "x-apisports-key": apiKey },
              next: { revalidate: 86400 },
            }).then(r => r.json()).catch(() => null),
          ]);

          const homeTeamId: number | null = homeSearch?.response?.[0]?.id ?? null;
          const awayTeamId: number | null = awaySearch?.response?.[0]?.id ?? null;

          const [homeNBAStats, awayNBAStats] = await Promise.all([
            homeTeamId ? getNBATeamStats(homeTeamId, NBA_SEASON) : Promise.resolve(null),
            awayTeamId ? getNBATeamStats(awayTeamId, NBA_SEASON) : Promise.resolve(null),
          ]);

          if (homeNBAStats && goalsAvgHome === 0) {
            goalsAvgHome = homeNBAStats.ptsAvg;
            dataSourceApiSports = true;
          }
          if (awayNBAStats && goalsAvgAway === 0) {
            goalsAvgAway = awayNBAStats.ptsAvg;
            dataSourceApiSports = true;
          }
        }
      } catch { /* keep BallDontLie values */ }
    }

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
      dataSourceApiSports,
      dataSourceFootballData: false,
    }));
  }

  results.sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());

  return NextResponse.json(results, {
    headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" },
  });
}
