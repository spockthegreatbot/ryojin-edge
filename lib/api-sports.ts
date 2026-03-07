// api-sports.ts — API-Sports.io integration
// Football: https://v3.football.api-sports.io
// Basketball: https://v1.basketball.api-sports.io
// Auth: x-apisports-key header
// Free plan: 100 req/day — use 24h cache aggressively

const FOOTBALL_BASE = "https://v3.football.api-sports.io";
const BASKETBALL_BASE = "https://v1.basketball.api-sports.io";
const KEY = process.env.API_SPORTS_KEY ?? "";

const CACHE_24H = { next: { revalidate: 86400 } } as const;

function footballHeaders() {
  return { "x-apisports-key": KEY };
}

function basketballHeaders() {
  return { "x-apisports-key": KEY };
}

// League IDs
export const LEAGUE = {
  EPL: 39,
  UCL: 2,
  LALIGA: 140,
  BUNDESLIGA: 78,
  SERIE_A: 135,
} as const;

export const SEASON = 2025;
export const NBA_LEAGUE = 12;
export const NBA_SEASON = "2025-2026";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiSportsTeamStats {
  form: string[];           // last 5 results e.g. ["W","L","D","W","W"]
  goalsForAvg: number;      // avg goals scored per game
  goalsAgainstAvg: number;  // avg goals conceded per game
  cornersAvg: number;       // 0 on free plan
  cardsAvg: number;         // yellow cards per game
  cleanSheetPct: number;    // 0–1
  bttsProb: number;         // 0–1 estimated
}

export interface ApiSportsFixture {
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  league: string;
  referee: string | null;
  venue: string | null;
}

export interface ApiSportsPrediction {
  winner: "home" | "away" | "draw" | null;
  winnerName: string | null;
  goalsHome: number;
  goalsAway: number;
  overUnder: string | null;       // e.g. "2.5"
  advice: string;
}

export interface NBAGame {
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
}

// ---------------------------------------------------------------------------
// Football helpers
// ---------------------------------------------------------------------------

function safeFloat(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function parseCardAvg(
  cards: Record<string, Record<string, { total: number | null }>> | undefined,
  matchesPlayed: number
): number {
  if (!cards || matchesPlayed <= 0) return 0;
  let total = 0;
  for (const bucket of Object.values(cards)) {
    for (const slot of Object.values(bucket)) {
      total += slot?.total ?? 0;
    }
  }
  return total / matchesPlayed;
}

// ---------------------------------------------------------------------------
// Football: getTeamStats
// ---------------------------------------------------------------------------

export async function getTeamStats(
  teamId: number,
  leagueId: number,
  season: number
): Promise<ApiSportsTeamStats | null> {
  if (!KEY) return null;

  try {
    const url = `${FOOTBALL_BASE}/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`;
    const res = await fetch(url, {
      headers: footballHeaders(),
      ...CACHE_24H,
    });

    if (!res.ok) return null;

    const json = await res.json();
    const r = json?.response;
    if (!r) return null;

    const matchesPlayed: number = r.fixtures?.played?.total ?? 0;
    const formStr: string = r.form ?? "";
    const form = formStr.slice(-5).split("") as string[];

    const goalsForAvg = safeFloat(r.goals?.for?.average?.total);
    const goalsAgainstAvg = safeFloat(r.goals?.against?.average?.total);

    // Corners — only available on paid plan; graceful fallback
    const cornersAvg = safeFloat(r.biggest?.corners?.for ?? 0); // usually null on free

    // Yellow cards per game
    const cardsAvg = parseCardAvg(r.cards?.yellow, matchesPlayed);

    // Clean sheet % — from fixtures.draws + fixtures.wins where clean sheet
    // API returns fixtures.wins/draws/loses but not directly cleanSheets on free tier
    // Use goals against as proxy: if goalsAgainstAvg < 0.8 → high clean sheet pct
    const cleanSheetPct = Math.max(0, Math.min(1, 1 - goalsAgainstAvg / 2));

    // BTTS estimate from Poisson
    const pHomeScores = 1 - Math.exp(-goalsForAvg);
    const pAwayScores = 1 - Math.exp(-goalsAgainstAvg);
    const bttsProb = pHomeScores * pAwayScores;

    return {
      form,
      goalsForAvg,
      goalsAgainstAvg,
      cornersAvg,
      cardsAvg,
      cleanSheetPct,
      bttsProb,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Football: getFootballTeamId
// ---------------------------------------------------------------------------

// In-memory cache for team ID lookups (lives for process lifetime)
const teamIdCache = new Map<string, number | null>();

export async function getFootballTeamId(
  teamName: string,
  leagueId: number
): Promise<number | null> {
  if (!KEY) return null;

  const cacheKey = `${teamName}:${leagueId}`;
  if (teamIdCache.has(cacheKey)) return teamIdCache.get(cacheKey)!;

  try {
    const encoded = encodeURIComponent(teamName);
    const url = `${FOOTBALL_BASE}/teams?name=${encoded}&league=${leagueId}&season=${SEASON}`;
    const res = await fetch(url, {
      headers: footballHeaders(),
      ...CACHE_24H,
    });

    if (!res.ok) {
      teamIdCache.set(cacheKey, null);
      return null;
    }

    const json = await res.json();
    const teams: Array<{ team: { id: number; name: string } }> = json?.response ?? [];

    if (teams.length > 0) {
      const id = teams[0].team.id;
      teamIdCache.set(cacheKey, id);
      return id;
    }

    // Try fuzzy: search without league filter
    const url2 = `${FOOTBALL_BASE}/teams?search=${encoded}`;
    const res2 = await fetch(url2, {
      headers: footballHeaders(),
      ...CACHE_24H,
    });
    if (res2.ok) {
      const json2 = await res2.json();
      const teams2: Array<{ team: { id: number; name: string } }> = json2?.response ?? [];
      if (teams2.length > 0) {
        const id = teams2[0].team.id;
        teamIdCache.set(cacheKey, id);
        return id;
      }
    }

    teamIdCache.set(cacheKey, null);
    return null;
  } catch {
    teamIdCache.set(cacheKey, null);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Football: getUpcomingFixtures (paid plan returns data; free returns [])
// ---------------------------------------------------------------------------

export async function getUpcomingFixtures(
  leagueId: number,
  season: number,
): Promise<ApiSportsFixture[]> {
  if (!KEY) return [];

  try {
    const today = new Date().toISOString().split("T")[0];
    const next14 = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const url = `${FOOTBALL_BASE}/fixtures?league=${leagueId}&season=${season}&from=${today}&to=${next14}`;
    const res = await fetch(url, {
      headers: footballHeaders(),
      next: { revalidate: 3600 }, // 1h for fixtures
    });

    if (!res.ok) return [];

    const json = await res.json();
    const items: Array<{
      fixture: { id: number; date: string; referee: string | null; venue: { name: string | null } };
      league: { name: string };
      teams: {
        home: { id: number; name: string };
        away: { id: number; name: string };
      };
    }> = json?.response ?? [];

    return items.map((item) => ({
      id: item.fixture.id,
      date: item.fixture.date,
      homeTeam: item.teams.home.name,
      awayTeam: item.teams.away.name,
      homeTeamId: item.teams.home.id,
      awayTeamId: item.teams.away.id,
      league: item.league.name,
      referee: item.fixture.referee ?? null,
      venue: item.fixture.venue?.name ?? null,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Football: getFixturePrediction
// ---------------------------------------------------------------------------

export async function getFixturePrediction(
  fixtureId: number
): Promise<ApiSportsPrediction | null> {
  if (!KEY) return null;

  try {
    const url = `${FOOTBALL_BASE}/predictions?fixture=${fixtureId}`;
    const res = await fetch(url, {
      headers: footballHeaders(),
      ...CACHE_24H,
    });

    if (!res.ok) return null;

    const json = await res.json();
    const pred = json?.response?.[0]?.predictions;
    if (!pred) return null;

    const winnerName: string | null = pred.winner?.name ?? null;
    const winnerSide: string | null = pred.winner?.comment ?? null;

    let winner: "home" | "away" | "draw" | null = null;
    if (winnerSide) {
      const lc = winnerSide.toLowerCase();
      if (lc.includes("home")) winner = "home";
      else if (lc.includes("away")) winner = "away";
      else if (lc.includes("draw")) winner = "draw";
    }

    return {
      winner,
      winnerName,
      goalsHome: safeFloat(pred.goals?.home),
      goalsAway: safeFloat(pred.goals?.away),
      overUnder: pred.under_over ?? null,
      advice: pred.advice ?? "",
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Basketball: getNBATeamStats
// ---------------------------------------------------------------------------

export async function getNBATeamStats(
  teamId: number,
  season: string
): Promise<{ ptsAvg: number; winPct: number } | null> {
  if (!KEY) return null;

  try {
    const url = `${BASKETBALL_BASE}/teams/statistics?id=${teamId}&season=${season}&league=${NBA_LEAGUE}`;
    const res = await fetch(url, {
      headers: basketballHeaders(),
      ...CACHE_24H,
    });

    if (!res.ok) return null;

    const json = await res.json();
    const r = json?.response;
    if (!r || !Array.isArray(r) || r.length === 0) return null;

    // Average across all entries
    let totalPts = 0;
    let wins = 0;
    let losses = 0;
    for (const entry of r) {
      totalPts += safeFloat(entry.points?.for?.average?.all ?? entry.scores?.for?.average?.all ?? 0);
      wins += entry.games?.wins?.all?.total ?? 0;
      losses += entry.games?.loses?.all?.total ?? 0;
    }

    const count = r.length;
    const ptsAvg = count > 0 ? totalPts / count : 0;
    const totalGames = wins + losses;
    const winPct = totalGames > 0 ? wins / totalGames : 0.5;

    return { ptsAvg, winPct };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Basketball: getNBAGames (single date — call in parallel for multiple dates)
// ---------------------------------------------------------------------------

export async function getNBAGames(date: string): Promise<NBAGame[]> {
  if (!KEY) return [];

  try {
    const url = `${BASKETBALL_BASE}/games?league=${NBA_LEAGUE}&season=${NBA_SEASON}&date=${date}`;
    const res = await fetch(url, {
      headers: basketballHeaders(),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const json = await res.json();
    const items: Array<{
      id: number;
      date: string;
      teams: {
        home: { name: string };
        away: { name: string };
      };
      scores: {
        home: { total: number | null };
        away: { total: number | null };
      };
      status: { short: string };
    }> = json?.response ?? [];

    // Only return upcoming (not started) games
    return items
      .filter((g) => g.status?.short === "NS")
      .map((g) => ({
        id: g.id,
        date: g.date,
        homeTeam: g.teams.home.name,
        awayTeam: g.teams.away.name,
      }));
  } catch {
    return [];
  }
}
