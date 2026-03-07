import { NextResponse } from "next/server";
import { MatchData } from "@/lib/mock-data";
import { calcEdgeScore } from "@/lib/edge-calculator";
import { getLiveMatches } from "@/lib/odds-api";
import { getStandings, getUpcomingMatchesRange, enrichMatch } from "@/lib/football-data";
import { analyzeMatch, BetSuggestion } from "@/lib/bet-analyzer";
import {
  getTeamStats,
  getFootballTeamId,
  getUpcomingFixtures,
  getNBAGames,
  LEAGUE,
  SEASON,
} from "@/lib/api-sports";
import { teamEloFromPosition } from "@/lib/elo";
import {
  getTeamId as getBDLTeamId,
  getTeamInjuries,
  isTeamOnBackToBack,
  getTeamRecentForm,
  getTeamSeasonRecord,
} from "@/lib/balldontlie";
import type { InjuredPlayer, TeamSeasonRecord } from "@/lib/balldontlie";
import { generateReasoning, generateHeadline } from "@/lib/ai-reasoning";
import { getRefereeStats } from "@/lib/referees";
import { getTeamXG } from "@/lib/understat";
import { getMatchWeather } from "@/lib/weather";

// Extended MatchData with data source flags
export interface MatchDataExtended extends MatchData {
  dataSourceApiSports?: boolean;
  dataSourceFootballData?: boolean;
  venue?: string;
  // NBA smart context
  homeInjuries?: InjuredPlayer[];
  awayInjuries?: InjuredPlayer[];
  homeOnBackToBack?: boolean;
  awayOnBackToBack?: boolean;
  homeRecentForm?: string[];
  awayRecentForm?: string[];
  homeRecord?: TeamSeasonRecord | null;
  awayRecord?: TeamSeasonRecord | null;
  // AI reasoning
  aiReasoning?: string;
  aiHeadline?: string;
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
  const aiReasoning = generateReasoning({
    sport: match.sport,
    league: match.league,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeOdds: match.homeOdds,
    awayOdds: match.awayOdds,
    drawOdds: match.drawOdds,
    homeForm: match.homeForm,
    awayForm: match.awayForm,
    h2hHomeWins: match.h2hHomeWins,
    h2hTotal: match.h2hTotal,
    goalsAvgHome: match.goalsAvgHome,
    goalsAvgAway: match.goalsAvgAway,
    xgHome: match.xgHome,
    xgAway: match.xgAway,
    bttsProb: match.bttsProb,
    cornersAvgHome: match.cornersAvgHome,
    cornersAvgAway: match.cornersAvgAway,
    homeElo: match.homeElo,
    awayElo: match.awayElo,
    homeTablePos: match.homeTablePos,
    awayTablePos: match.awayTablePos,
    referee: match.referee,
    weather: match.weather,
    homeInjuries: match.homeInjuries,
    awayInjuries: match.awayInjuries,
    homeOnBackToBack: match.homeOnBackToBack,
    awayOnBackToBack: match.awayOnBackToBack,
    homeRecentForm: match.homeRecentForm,
    awayRecentForm: match.awayRecentForm,
    homeRecord: match.homeRecord,
    awayRecord: match.awayRecord,
    totalLine: match.totalLine,
  });
  const aiHeadline = generateHeadline({
    sport: match.sport,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeOdds: match.homeOdds,
    awayOdds: match.awayOdds,
    homeInjuries: match.homeInjuries,
    awayInjuries: match.awayInjuries,
    homeOnBackToBack: match.homeOnBackToBack,
    awayOnBackToBack: match.awayOnBackToBack,
  });
  return { ...match, ...edge, bets, aiReasoning, aiHeadline };
}

// Normalize team name for fuzzy matching against Odds API
const TEAM_ALIASES: Record<string,string> = {
  "münchen":"munich","munchen":"munich","atalanta bc":"atalanta",
  "bayer 04 leverkusen":"leverkusen","bayer leverkusen":"leverkusen",
  "paris saint-germain":"psg","paris saint germain":"psg","paris sg":"psg",
  "brighton and hove albion":"brighton","wolverhampton wanderers":"wolves",
  "tottenham hotspur":"tottenham","west ham united":"west ham",
  "manchester united":"man united","manchester city":"man city",
  "newcastle united":"newcastle","nottingham forest":"forest",
  "borussia dortmund":"dortmund","rb leipzig":"leipzig",
  "inter milan":"inter","ac milan":"milan","as roma":"roma",
  "atletico madrid":"atletico","galatasaray":"galatasaray",
};
function normName(n:string):string {
  const s = n.toLowerCase()
    .replace(/[àáâãäå]/g,'a').replace(/[èéêë]/g,'e')
    .replace(/[ìíîï]/g,'i').replace(/[òóôõöø]/g,'o')
    .replace(/[ùúûü]/g,'u').replace(/ñ/g,'n').replace(/ç/g,'c')
    .replace(/\b(fc|cf|afc|sc|ac)\b/g,'')
    .replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
  return TEAM_ALIASES[s] ?? s;
}

function teamsMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (na === nb) return true;
  const wordsA = na.split(" ").filter(Boolean);
  const wordsB = nb.split(" ").filter(Boolean);
  // Significant word match (> 3 chars, not common filler)
  const filler = new Set(["city","united","club","real","sport","athletic","union","inter","county"]);
  const sigA = wordsA.filter(w => w.length > 3 && !filler.has(w));
  const sigB = wordsB.filter(w => w.length > 3 && !filler.has(w));
  // Any significant word from A appears in full B string or vice versa
  if (sigA.some(w => nb.includes(w)) || sigB.some(w => na.includes(w))) return true;
  // Short-name fallback: first word of each (handles "Bayern" vs "Bayern Munich")
  const firstA = wordsA[0]; const firstB = wordsB[0];
  if (firstA && firstB && firstA.length > 3 && (firstA === firstB || nb.startsWith(firstA) || na.startsWith(firstB))) return true;
  return false;
}

// Determine which league ID to use based on competition code
function leagueIdForComp(comp: string): number {
  if (comp === "CL") return LEAGUE.UCL;
  if (comp === "LL") return LEAGUE.LALIGA;
  if (comp === "BL") return LEAGUE.BUNDESLIGA;
  if (comp === "SA") return LEAGUE.SERIE_A;
  return LEAGUE.EPL;
}

export async function GET() {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dateFrom = now.toISOString().split("T")[0];
  const dateTo = weekAhead.toISOString().split("T")[0];

  // Build date array for next 7 days (for NBA parallel fetch)
  const nbaDateRange = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() + i * 86400000);
    return d.toISOString().split("T")[0];
  });

  // Fetch all primary data sources in parallel
  const [plMatches, clMatches, plStandings, clStandings, eplFixtures, uclFixtures, laligaFixtures, bundesligaFixtures, serieAFixtures, nbaGamesRaw, oddsMatches] = await Promise.all([
    getUpcomingMatchesRange("PL", dateFrom, dateTo).catch(() => []),
    getUpcomingMatchesRange("CL", dateFrom, dateTo).catch(() => []),
    getStandings("PL").catch(() => []),
    getStandings("CL").catch(() => []),
    getUpcomingFixtures(LEAGUE.EPL, SEASON).catch(() => []),
    getUpcomingFixtures(LEAGUE.UCL, SEASON).catch(() => []),
    getUpcomingFixtures(LEAGUE.LALIGA, SEASON).catch(() => []),
    getUpcomingFixtures(LEAGUE.BUNDESLIGA, SEASON).catch(() => []),
    getUpcomingFixtures(LEAGUE.SERIE_A, SEASON).catch(() => []),
    Promise.all(nbaDateRange.map(d => getNBAGames(d).catch(() => []))).then(all => all.flat()),
    getLiveMatches().catch(() => []),
  ]);

  // Deduplicate NBA games by id
  const nbaGamesMap = new Map<number, typeof nbaGamesRaw[number]>();
  for (const g of nbaGamesRaw) nbaGamesMap.set(g.id, g);
  const nbaGames = Array.from(nbaGamesMap.values());

  const results: MatchDataExtended[] = [];

  // --- SOCCER: API-Sports primary (paid plan), football-data.org as fallback ---

  // Check if API-Sports returned fixtures
  const useApiSportsPrimary = eplFixtures.length > 0 || uclFixtures.length > 0;

  if (useApiSportsPrimary) {
    // API-Sports fixtures available — use as primary source
    const allApiFixtures = [
      ...eplFixtures.slice(0, 8).map(f => ({ f, comp: "PL" })),
      ...uclFixtures.slice(0, 8).map(f => ({ f, comp: "CL" })),
      ...laligaFixtures.slice(0, 8).map(f => ({ f, comp: "LL" })),
      ...bundesligaFixtures.slice(0, 8).map(f => ({ f, comp: "BL" })),
      ...serieAFixtures.slice(0, 8).map(f => ({ f, comp: "SA" })),
    ];

    for (const { f, comp } of allApiFixtures) {
      const standings = comp === "CL" ? clStandings : plStandings;
      const leagueId = leagueIdForComp(comp);

      let homeForm: string[] = [];
      let awayForm: string[] = [];
      let goalsAvgHome = 0;
      let goalsAvgAway = 0;
      const h2hHomeWins = 0;
      const h2hTotal = 0;
      const h2hDraws = 0;
      let cornersAvgHome = 0;
      let cornersAvgAway = 0;
      let cardsAvgHome = 0;
      let cardsAvgAway = 0;
      let bttsProb = 0;
      let cleanSheetHome = 0;
      let cleanSheetAway = 0;

      // API-Sports team stats
      let homeTablePos: number | undefined;
      let awayTablePos: number | undefined;
      try {
        const [homeId, awayId] = await Promise.all([
          getFootballTeamId(f.homeTeam, leagueId),
          getFootballTeamId(f.awayTeam, leagueId),
        ]);

        const [homeStats, awayStats] = await Promise.all([
          homeId ? getTeamStats(homeId, leagueId, SEASON) : Promise.resolve(null),
          awayId ? getTeamStats(awayId, leagueId, SEASON) : Promise.resolve(null),
        ]);

        if (homeStats) {
          homeForm = homeStats.form.length > 0 ? homeStats.form : homeForm;
          goalsAvgHome = homeStats.goalsForAvg > 0 ? homeStats.goalsForAvg : goalsAvgHome;
          cornersAvgHome = homeStats.cornersAvg;
          cardsAvgHome = homeStats.cardsAvg;
          cleanSheetHome = homeStats.cleanSheetPct;
          bttsProb = homeStats.bttsProb;
        }

        if (awayStats) {
          awayForm = awayStats.form.length > 0 ? awayStats.form : awayForm;
          goalsAvgAway = awayStats.goalsForAvg > 0 ? awayStats.goalsForAvg : goalsAvgAway;
          cornersAvgAway = awayStats.cornersAvg;
          cardsAvgAway = awayStats.cardsAvg;
          cleanSheetAway = awayStats.cleanSheetPct;
          if (homeStats) bttsProb = (homeStats.bttsProb + awayStats.bttsProb) / 2;
        }
      } catch { /* keep zeros */ }

      // Extract table positions from standings
      const totalTeams = standings.length || 20;
      const homeStanding = standings.find((s) => s.team.name === f.homeTeam);
      const awayStanding = standings.find((s) => s.team.name === f.awayTeam);
      if (homeStanding) homeTablePos = homeStanding.position;
      if (awayStanding) awayTablePos = awayStanding.position;

      // Feature 1: Fetch xG from understat in parallel
      const [homeXG, awayXG] = await Promise.all([
        getTeamXG(f.homeTeam).catch(() => null),
        getTeamXG(f.awayTeam).catch(() => null),
      ]);
      const xgHome = homeXG?.xgFor ?? 0;
      const xgAway = awayXG?.xgFor ?? 0;
      const dataSource = (xgHome > 0 && xgAway > 0) ? "xG" as const : "goals_avg" as const;

      // Feature 2: Fetch weather
      const venue = (f as { venue?: string }).venue ?? "";
      const weather = await getMatchWeather(venue, f.date).catch(() => null);

      // Odds overlay
      let homeOdds = 0;
      let awayOdds = 0;
      let drawOdds: number | undefined;
      const oddsMatch = oddsMatches.find(
        om => om.sport === "soccer" &&
          teamsMatch(om.homeTeam, f.homeTeam) &&
          teamsMatch(om.awayTeam, f.awayTeam)
      );
      if (oddsMatch) {
        homeOdds = oddsMatch.homeOdds;
        awayOdds = oddsMatch.awayOdds;
        drawOdds = oddsMatch.drawOdds;
      }

      // Elo from standings
      const homeElo = homeStanding ? teamEloFromPosition(homeStanding.position, totalTeams) : 1500;
      const awayElo = awayStanding ? teamEloFromPosition(awayStanding.position, totalTeams) : 1500;

      // Referee stats
      const refereeStats = f.referee ? getRefereeStats(f.referee) : null;
      const varLikelihoodCalc = refereeStats ? Math.round(refereeStats.varInterventionsPerGame * 100) : 0;

      results.push(applyEdge({
        id: `apisports-${f.id}`,
        sport: "soccer",
        league: f.league,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        commenceTime: f.date,
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
        xgHome,
        xgAway,
        bttsProb,
        cleanSheetHome,
        cleanSheetAway,
        firstHalfGoalsAvg: 0,
        varLikelihood: varLikelihoodCalc,
        props: [],
        dataSourceApiSports: true,
        dataSourceFootballData: false,
        homeElo,
        awayElo,
        referee: f.referee,
        refereeStats,
        weather,
        homeTablePos,
        awayTablePos,
        dataSource,
        // Feature 3: Best book odds
        bestOddsHome: oddsMatch?.bestOddsHome,
        bestOddsHomeBook: oddsMatch?.bestOddsHomeBook,
        bestOddsAway: oddsMatch?.bestOddsAway,
        bestOddsAwayBook: oddsMatch?.bestOddsAwayBook,
        bestOddsDraw: oddsMatch?.bestOddsDraw,
        bestOddsDrawBook: oddsMatch?.bestOddsDrawBook,
        allBookOdds: oddsMatch?.allBookOdds,
      }));
    }
  }

  // Fallback: use football-data.org if API-Sports returned nothing
  const soccerFixtures = useApiSportsPrimary ? [] : [
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
    let homeTablePos: number | undefined;
    let awayTablePos: number | undefined;

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

    // Extract table positions from standings
    const fdHomeStanding = standings.find((s) => s.team.id === match.homeTeam.id);
    const fdAwayStanding = standings.find((s) => s.team.id === match.awayTeam.id);
    if (fdHomeStanding) homeTablePos = fdHomeStanding.position;
    if (fdAwayStanding) awayTablePos = fdAwayStanding.position;

    // API-Sports: fetch team IDs + stats in parallel
    try {
      const [homeId, awayId] = await Promise.all([
        getFootballTeamId(match.homeTeam.name, leagueId),
        getFootballTeamId(match.awayTeam.name, leagueId),
      ]);

      const [homeStats, awayStats] = await Promise.all([
        homeId ? getTeamStats(homeId, leagueId, SEASON) : Promise.resolve(null),
        awayId ? getTeamStats(awayId, leagueId, SEASON) : Promise.resolve(null),
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

    // Feature 1: Fetch xG from understat in parallel
    const [homeXGFd, awayXGFd] = await Promise.all([
      getTeamXG(match.homeTeam.name).catch(() => null),
      getTeamXG(match.awayTeam.name).catch(() => null),
    ]);
    const xgHome = homeXGFd?.xgFor ?? 0;
    const xgAway = awayXGFd?.xgFor ?? 0;
    const dataSourceFd = (xgHome > 0 && xgAway > 0) ? "xG" as const : "goals_avg" as const;

    // Feature 2: Fetch weather (no venue from football-data.org, skip)
    const weather = null;

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

    // Compute Elo ratings from league table position
    const totalTeams = standings.length || 20;
    const homeStanding = standings.find((s) => s.team.id === match.homeTeam.id);
    const awayStanding = standings.find((s) => s.team.id === match.awayTeam.id);
    const homeElo = homeStanding
      ? teamEloFromPosition(homeStanding.position, totalTeams)
      : 1500;
    const awayElo = awayStanding
      ? teamEloFromPosition(awayStanding.position, totalTeams)
      : 1500;

    // Referee intelligence
    const refName = (match.referees?.[0]?.name) ?? null;
    const refereeStats = refName ? getRefereeStats(refName) : null;

    // VAR likelihood boosted by referee data
    const varLikelihoodCalc = refereeStats
      ? Math.round(refereeStats.varInterventionsPerGame * 100)
      : 0;

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
      xgHome,
      xgAway,
      bttsProb,
      cleanSheetHome,
      cleanSheetAway,
      firstHalfGoalsAvg: 0,
      varLikelihood: varLikelihoodCalc,
      props: [],
      dataSourceApiSports,
      dataSourceFootballData,
      homeElo,
      awayElo,
      referee: refName,
      refereeStats,
      weather,
      homeTablePos,
      awayTablePos,
      dataSource: dataSourceFd,
      // Feature 3: Best book odds
      bestOddsHome: oddsMatch?.bestOddsHome,
      bestOddsHomeBook: oddsMatch?.bestOddsHomeBook,
      bestOddsAway: oddsMatch?.bestOddsAway,
      bestOddsAwayBook: oddsMatch?.bestOddsAwayBook,
      bestOddsDraw: oddsMatch?.bestOddsDraw,
      bestOddsDrawBook: oddsMatch?.bestOddsDrawBook,
      allBookOdds: oddsMatch?.allBookOdds,
    }));
  }

  // --- NBA: enrich with BallDontLie (injuries, B2B, form, record) ---
  const nbaResults = (await Promise.all(
    nbaGames.slice(0, 10).map(async (game) => {
      const oddsMatch = oddsMatches.find(
        om => om.sport === "nba" &&
          teamsMatch(om.homeTeam, game.homeTeam) &&
          teamsMatch(om.awayTeam, game.awayTeam)
      );

      // BDL enrichment — all parallel, all fail-safe
      const [homeId, awayId] = await Promise.all([
        getBDLTeamId(game.homeTeam).catch(() => null),
        getBDLTeamId(game.awayTeam).catch(() => null),
      ]);

      const [homeInjuries, awayInjuries, homeB2B, awayB2B, homeForm, awayForm, homeRecord, awayRecord] =
        await Promise.all([
          homeId ? getTeamInjuries(homeId).catch(() => []) : Promise.resolve([]),
          awayId ? getTeamInjuries(awayId).catch(() => []) : Promise.resolve([]),
          homeId ? isTeamOnBackToBack(homeId).catch(() => false) : Promise.resolve(false),
          awayId ? isTeamOnBackToBack(awayId).catch(() => false) : Promise.resolve(false),
          homeId ? getTeamRecentForm(homeId).catch(() => []) : Promise.resolve([]),
          awayId ? getTeamRecentForm(awayId).catch(() => []) : Promise.resolve([]),
          homeId ? getTeamSeasonRecord(homeId).catch(() => null) : Promise.resolve(null),
          awayId ? getTeamSeasonRecord(awayId).catch(() => null) : Promise.resolve(null),
        ]);

      return applyEdge({
        id: `basketball-${game.id}`,
        sport: "nba",
        league: "NBA",
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        commenceTime: game.date,
        homeOdds: oddsMatch?.homeOdds ?? 0,
        awayOdds: oddsMatch?.awayOdds ?? 0,
        homeForm: homeForm.slice(0, 5),
        awayForm: awayForm.slice(0, 5),
        goalsAvgHome: 0,
        goalsAvgAway: 0,
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
        dataSourceApiSports: true,
        dataSourceFootballData: false,
        totalLine: oddsMatch?.totalLine,
        // NBA smart context
        homeInjuries,
        awayInjuries,
        homeOnBackToBack: homeB2B,
        awayOnBackToBack: awayB2B,
        homeRecentForm: homeForm,
        awayRecentForm: awayForm,
        homeRecord,
        awayRecord,
      });
    }).map(p => p.catch(() => null))
  )).filter((r): r is MatchDataExtended & ReturnType<typeof applyEdge> => r !== null);
  results.push(...nbaResults);

  // --- UFC/MMA: main card only (≥18 books = main card / co-main) ---
  const ufcOddsMatches = oddsMatches
    .filter(om => om.sport === "ufc" && om.bookCount >= 18)
    .sort((a, b) => b.bookCount - a.bookCount)
    .slice(0, 12);

  const ufcResults = ufcOddsMatches.map(om => {
    // Simple 2-outcome edge: de-vig odds vs raw implied
    const implied = 1 / om.homeOdds + 1 / om.awayOdds;
    const homeProb = (1 / om.homeOdds) / implied;
    const awayProb = (1 / om.awayOdds) / implied;
    const bets: BetSuggestion[] = [
      {
        market: "Fight Winner",
        pick: om.homeOdds < om.awayOdds ? om.homeTeam : om.awayTeam,
        edge: Math.abs(homeProb - awayProb) * 0.15,
        modelProb: om.homeOdds < om.awayOdds ? homeProb : awayProb,
        marketProb: om.homeOdds < om.awayOdds ? homeProb : awayProb,
        odds: Math.min(om.homeOdds, om.awayOdds),
        value: Math.min(om.homeOdds, om.awayOdds) >= 1.35,
        confidence: Math.round(Math.max(homeProb, awayProb) * 100),
        tier: om.bookCount >= 25 ? "🔥 Main Event" : "⚡ Co-Main",
        kellySuggestion: "$5–15",
        reasoning: `${om.bookCount} books covering. Favourite at ${Math.min(om.homeOdds, om.awayOdds).toFixed(2)}. Sharp consensus: ${Math.round(Math.max(homeProb,awayProb)*100)}% implied.`,
      }
    ];
    return {
      id: `ufc-${om.id}`,
      sport: "ufc" as const,
      league: "UFC/MMA",
      homeTeam: om.homeTeam,
      awayTeam: om.awayTeam,
      commenceTime: om.commenceTime,
      homeOdds: om.homeOdds,
      awayOdds: om.awayOdds,
      homeForm: [], awayForm: [],
      goalsAvgHome: 0, goalsAvgAway: 0,
      h2hHomeWins: 0, h2hTotal: 0, h2hDraws: 0,
      cornersAvgHome: 0, cornersAvgAway: 0,
      cardsAvgHome: 0, cardsAvgAway: 0,
      xgHome: 0, xgAway: 0, bttsProb: 0,
      cleanSheetHome: 0, cleanSheetAway: 0,
      firstHalfGoalsAvg: 0, varLikelihood: 0, props: [],
      bestOddsHome: om.bestOddsHome, bestOddsHomeBook: om.bestOddsHomeBook,
      bestOddsAway: om.bestOddsAway, bestOddsAwayBook: om.bestOddsAwayBook,
      allBookOdds: om.allBookOdds,
      score: bets[0].value ? 72 : 55,
      color: bets[0].value ? "green" as const : "yellow" as const,
      bets,
    };
  });
  results.push(...ufcResults);

  // --- NRL: odds-only (no deep stats API) ---
  const nrlOddsMatches = oddsMatches.filter(om => om.sport === "nrl");
  const nrlResults = nrlOddsMatches.slice(0, 10).map((om) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bets = analyzeMatch({ sport: "soccer", homeTeam: om.homeTeam, awayTeam: om.awayTeam, homeOdds: om.homeOdds, awayOdds: om.awayOdds, homeForm: [], awayForm: [], h2hHomeWins: 0, h2hTotal: 0, h2hDraws: 0, goalsAvgHome: 0, goalsAvgAway: 0, cornersAvgHome: 0, cornersAvgAway: 0, xgHome: 0, xgAway: 0, bttsProb: 0, cleanSheetHome: 0, cleanSheetAway: 0 } as any);
    const edge = calcEdgeScore({ homeForm: [], awayForm: [], h2hHomeWins: 0, h2hTotal: 0, homeTeam: om.homeTeam, awayTeam: om.awayTeam });
    return {
      id: `nrl-${om.id}`,
      sport: "nrl" as const,
      league: "NRL",
      homeTeam: om.homeTeam,
      awayTeam: om.awayTeam,
      commenceTime: om.commenceTime,
      homeOdds: om.homeOdds,
      awayOdds: om.awayOdds,
      homeForm: [],
      awayForm: [],
      goalsAvgHome: 0,
      goalsAvgAway: 0,
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
      ...edge,
      bets,
      bestOddsHome: om.bestOddsHome,
      bestOddsHomeBook: om.bestOddsHomeBook,
      bestOddsAway: om.bestOddsAway,
      bestOddsAwayBook: om.bestOddsAwayBook,
      allBookOdds: om.allBookOdds,
    };
  });
  results.push(...nrlResults);

  // --- FALLBACK: Odds API soccer matches not matched to any stats fixture ---
  // Collect all Odds API soccer match IDs that already appeared in results
  const usedOddsIds = new Set(results.map(r => {
    // Extract the odds match that was used for this result by matching teams
    const om = oddsMatches.find(o =>
      o.sport === "soccer" &&
      teamsMatch(o.homeTeam, r.homeTeam) &&
      teamsMatch(o.awayTeam, r.awayTeam)
    );
    return om?.id ?? null;
  }).filter(Boolean));

  const unmatchedSoccer = oddsMatches.filter(om =>
    om.sport === "soccer" &&
    om.homeOdds > 1 &&
    !usedOddsIds.has(om.id)
  );

  const fallbackSoccer = unmatchedSoccer.slice(0, 20).map(om => {
    const edge = calcEdgeScore({ homeForm: [], awayForm: [], h2hHomeWins: 0, h2hTotal: 0, homeTeam: om.homeTeam, awayTeam: om.awayTeam });
    const bets = analyzeMatch({
      sport: "soccer", homeTeam: om.homeTeam, awayTeam: om.awayTeam,
      homeOdds: om.homeOdds, awayOdds: om.awayOdds,
      homeForm: [], awayForm: [], h2hHomeWins: 0, h2hTotal: 0, h2hDraws: 0,
      goalsAvgHome: 0, goalsAvgAway: 0, cornersAvgHome: 0, cornersAvgAway: 0,
      xgHome: 0, xgAway: 0, bttsProb: 0, cleanSheetHome: 0, cleanSheetAway: 0,
    } as Parameters<typeof analyzeMatch>[0]);
    return {
      id: `odds-${om.id}`,
      sport: "soccer" as const,
      league: om.league,
      homeTeam: om.homeTeam,
      awayTeam: om.awayTeam,
      commenceTime: om.commenceTime,
      homeOdds: om.homeOdds,
      awayOdds: om.awayOdds,
      drawOdds: om.drawOdds,
      homeForm: [], awayForm: [],
      goalsAvgHome: 0, goalsAvgAway: 0,
      h2hHomeWins: 0, h2hTotal: 0, h2hDraws: 0,
      cornersAvgHome: 0, cornersAvgAway: 0,
      cardsAvgHome: 0, cardsAvgAway: 0,
      xgHome: 0, xgAway: 0, bttsProb: 0,
      cleanSheetHome: 0, cleanSheetAway: 0,
      firstHalfGoalsAvg: 0, varLikelihood: 0, props: [],
      bestOddsHome: om.bestOddsHome, bestOddsHomeBook: om.bestOddsHomeBook,
      bestOddsAway: om.bestOddsAway, bestOddsAwayBook: om.bestOddsAwayBook,
      allBookOdds: om.allBookOdds,
      ...edge,
      bets,
    };
  });

  results.push(...fallbackSoccer);

  results.sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());

  return NextResponse.json(results, {
    headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200" },
  });
}
