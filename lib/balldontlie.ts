// BallDontLie API — NBA team stats
// Docs: https://www.balldontlie.io/

const BASE = "https://api.balldontlie.io/v1";

function authHeaders(): Record<string, string> {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) return {};
  return { Authorization: key };
}

interface BDLTeam {
  id: number;
  name: string;
  full_name: string;
  abbreviation: string;
}

interface BDLGame {
  id: number;
  date: string;
  home_team: { id: number; full_name: string };
  visitor_team: { id: number; full_name: string };
  home_team_score: number;
  visitor_team_score: number;
  status: string;
}

export interface NBAGame {
  id: number;
  date: string;
  datetime?: string;
  homeTeam: string;
  awayTeam: string;
}

interface BDLSeasonAvg {
  pts: number;
}

export interface InjuredPlayer {
  name: string;
  status: "Out" | "Doubtful" | "Questionable" | "Day-To-Day";
  tier: "superstar" | "allstar" | "starter" | "rotation" | "bench";
  ppg: number;
}

export interface TeamSeasonRecord {
  wins: number;
  losses: number;
  homeWins: number;
  homeLosses: number;
  roadWins: number;
  roadLosses: number;
  winPct: number;
  homeWinPct: number;
}

export async function getTeamId(teamName: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${BASE}/teams?search=${encodeURIComponent(teamName)}`,
      { headers: authHeaders(), next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const teams: BDLTeam[] = data.data ?? [];
    return teams[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function getTeamPtsAvg(teamId: number): Promise<number | null> {
  try {
    const res = await fetch(
      `${BASE}/season_averages/general/teams?season=2024&team_ids[]=${teamId}`,
      { headers: authHeaders(), next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const avgs: BDLSeasonAvg[] = data.data ?? [];
    return avgs[0]?.pts ?? null;
  } catch {
    return null;
  }
}

export async function getUpcomingNBAGames(dateFrom: string, dateTo: string): Promise<NBAGame[]> {
  try {
    const res = await fetch(
      `${BASE}/games?start_date=${dateFrom}&end_date=${dateTo}&per_page=30`,
      { headers: authHeaders(), next: { revalidate: 21600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const games: BDLGame[] = data.data ?? [];
    return games.map((g) => ({
      id: g.id,
      date: g.date,
      datetime: (g as BDLGame & { datetime?: string }).datetime ?? undefined,
      homeTeam: g.home_team.full_name,
      awayTeam: g.visitor_team.full_name,
    }));
  } catch {
    return [];
  }
}

// Last 10 completed games — W/L/D, newest first
export async function getTeamRecentForm(teamId: number): Promise<string[]> {
  try {
    const res = await fetch(
      `${BASE}/games?team_ids[]=${teamId}&per_page=10&seasons[]=2024`,
      { headers: authHeaders(), next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const games: BDLGame[] = (data.data ?? []).filter(
      (g: BDLGame) => g.status === "Final" || g.home_team_score > 0
    );
    return games.slice(0, 10).map((g) => {
      const isHome = g.home_team.id === teamId;
      const teamScore = isHome ? g.home_team_score : g.visitor_team_score;
      const oppScore = isHome ? g.visitor_team_score : g.home_team_score;
      return teamScore > oppScore ? "W" : "L";
    });
  } catch {
    return [];
  }
}

// Legacy alias
export async function getRecentForm(teamId: number): Promise<string[]> {
  return getTeamRecentForm(teamId);
}

// Returns true if team played a game yesterday (back-to-back detection)
export async function isTeamOnBackToBack(teamId: number): Promise<boolean> {
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const res = await fetch(
      `${BASE}/games?team_ids[]=${teamId}&dates[]=${yesterday}&per_page=5`,
      { headers: authHeaders(), next: { revalidate: 3600 } }
    );
    if (!res.ok) return false;
    const data = await res.json();
    const games: BDLGame[] = data.data ?? [];
    return games.some((g) => g.status === "Final" || g.home_team_score > 0);
  } catch {
    return false;
  }
}

// Season record from standings endpoint
export async function getTeamSeasonRecord(teamId: number): Promise<TeamSeasonRecord | null> {
  try {
    const res = await fetch(
      `${BASE}/standings?season=2024`,
      { headers: authHeaders(), next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    interface BDLStanding {
      team: { id: number };
      wins: number;
      losses: number;
      home_record?: string;
      road_record?: string;
    }
    const standings: BDLStanding[] = data.data ?? [];
    const team = standings.find((s) => s.team?.id === teamId);
    if (!team) return null;

    const totalGames = (team.wins + team.losses) || 1;
    // Parse "W-L" strings like "24-8"
    const parseRecord = (rec: string): [number, number] => {
      const parts = (rec ?? "").split("-").map(Number);
      return [parts[0] ?? 0, parts[1] ?? 0];
    };
    const [homeWins, homeLosses] = parseRecord(team.home_record ?? "0-0");
    const [roadWins, roadLosses] = parseRecord(team.road_record ?? "0-0");
    const homeGames = (homeWins + homeLosses) || 1;

    return {
      wins: team.wins,
      losses: team.losses,
      homeWins,
      homeLosses,
      roadWins,
      roadLosses,
      winPct: team.wins / totalGames,
      homeWinPct: homeWins / homeGames,
    };
  } catch {
    return null;
  }
}

// Injury report — tries the injuries endpoint, degrades gracefully if unavailable
export async function getTeamInjuries(teamId: number): Promise<InjuredPlayer[]> {
  try {
    const res = await fetch(
      `${BASE}/player_injuries?team_ids[]=${teamId}&per_page=20`,
      { headers: authHeaders(), next: { revalidate: 3600 } }
    );
    if (!res.ok) return []; // 404 on free plan — that's fine

    const data = await res.json();
    const injuries = data.data ?? [];

    // Classify tier by PPG proxy — fetch season averages for each player
    const enriched: InjuredPlayer[] = await Promise.all(
      injuries.slice(0, 8).map(async (inj: {
        player: { id: number; first_name: string; last_name: string };
        status: string;
      }) => {
        let ppg = 0;
        try {
          const avgRes = await fetch(
            `${BASE}/season_averages/general/players?season=2024&player_ids[]=${inj.player.id}`,
            { headers: authHeaders(), next: { revalidate: 86400 } }
          );
          if (avgRes.ok) {
            const avgData = await avgRes.json();
            ppg = avgData.data?.[0]?.pts ?? 0;
          }
        } catch { /* ignore */ }

        const tier: InjuredPlayer["tier"] =
          ppg > 25 ? "superstar" :
          ppg > 18 ? "allstar" :
          ppg > 12 ? "starter" :
          ppg > 5  ? "rotation" : "bench";

        const rawStatus = (inj.status ?? "").toLowerCase();
        const status: InjuredPlayer["status"] =
          rawStatus.includes("out") ? "Out" :
          rawStatus.includes("doubtful") ? "Doubtful" :
          rawStatus.includes("questionable") ? "Questionable" : "Day-To-Day";

        return {
          name: `${inj.player.first_name} ${inj.player.last_name}`,
          status,
          tier,
          ppg,
        };
      })
    );
    return enriched;
  } catch {
    return [];
  }
}
