// football-data.org API — free tier
// Covers: PL (Premier League), CL (Champions League) + more
// Auth: X-Auth-Token header
// Rate limit: 10 req/min on free tier

const BASE = "https://api.football-data.org/v4";
const KEY = process.env.FOOTBALL_DATA_KEY;

interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string; // 3-letter abbreviation
}

interface FDMatch {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED, LIVE, IN_PLAY, FINISHED
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: { fullTime: { home: number | null; away: number | null } };
  competition: { code: string; name: string };
}

interface FDStanding {
  position: number;
  team: FDTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string; // e.g. "W,W,D,L,W"
}

async function fdFetch<T>(path: string): Promise<T | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "X-Auth-Token": KEY },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Get upcoming matches for a competition
export async function getUpcomingMatches(competitionCode: string): Promise<FDMatch[]> {
  const data = await fdFetch<{ matches: FDMatch[] }>(
    `/competitions/${competitionCode}/matches?status=SCHEDULED&limit=10`
  );
  return data?.matches ?? [];
}

// Get standings (includes form for last 5)
export async function getStandings(competitionCode: string): Promise<FDStanding[]> {
  const data = await fdFetch<{ standings: { type: string; table: FDStanding[] }[] }>(
    `/competitions/${competitionCode}/standings`
  );
  const total = data?.standings?.find((s) => s.type === "TOTAL");
  return total?.table ?? [];
}

// Get head-to-head for two teams
export async function getH2H(matchId: number): Promise<FDMatch[]> {
  const data = await fdFetch<{ matches: FDMatch[] }>(`/matches/${matchId}/head2head?limit=10`);
  return data?.matches ?? [];
}

// Parse form string "W,W,D,L,W" → ["W","W","D","L","W"]
export function parseForm(formStr: string | null | undefined): string[] {
  if (!formStr) return ["W", "D", "W", "L", "W"]; // default
  return formStr.split(",").slice(-5);
}

// Enrich a match with standings data (form, goals avg)
export interface EnrichedSoccerStats {
  homeForm: string[];
  awayForm: string[];
  homeGoalsAvg: number;
  awayGoalsAvg: number;
  h2hHomeWins: number;
  h2hTotal: number;
  h2hDraws: number;
}

export async function enrichMatch(
  match: FDMatch,
  standings: FDStanding[]
): Promise<EnrichedSoccerStats> {
  const homeStanding = standings.find((s) => s.team.id === match.homeTeam.id);
  const awayStanding = standings.find((s) => s.team.id === match.awayTeam.id);

  const homeForm = parseForm(homeStanding?.form);
  const awayForm = parseForm(awayStanding?.form);

  const homeGoalsAvg = homeStanding && homeStanding.playedGames > 0
    ? homeStanding.goalsFor / homeStanding.playedGames
    : 1.4;
  const awayGoalsAvg = awayStanding && awayStanding.playedGames > 0
    ? awayStanding.goalsFor / awayStanding.playedGames
    : 1.2;

  // H2H
  const h2h = await getH2H(match.id);
  const finished = h2h.filter((m) => m.status === "FINISHED");
  const h2hHomeWins = finished.filter(
    (m) =>
      (m.homeTeam.id === match.homeTeam.id && (m.score.fullTime.home ?? 0) > (m.score.fullTime.away ?? 0)) ||
      (m.awayTeam.id === match.homeTeam.id && (m.score.fullTime.away ?? 0) > (m.score.fullTime.home ?? 0))
  ).length;
  const h2hDraws = finished.filter(
    (m) => m.score.fullTime.home === m.score.fullTime.away
  ).length;

  return {
    homeForm,
    awayForm,
    homeGoalsAvg,
    awayGoalsAvg,
    h2hHomeWins,
    h2hTotal: finished.length || 5,
    h2hDraws,
  };
}
