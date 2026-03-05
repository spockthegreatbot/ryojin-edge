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
  home_team: { id: number };
  visitor_team: { id: number };
  home_team_score: number;
  visitor_team_score: number;
  status: string;
}

interface BDLSeasonAvg {
  pts: number;
}

export async function getTeamId(teamName: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${BASE}/teams?search=${encodeURIComponent(teamName)}`,
      {
        headers: authHeaders(),
        next: { revalidate: 3600 },
      }
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
      {
        headers: authHeaders(),
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const avgs: BDLSeasonAvg[] = data.data ?? [];
    return avgs[0]?.pts ?? null;
  } catch {
    return null;
  }
}

export async function getRecentForm(teamId: number): Promise<string[]> {
  try {
    const res = await fetch(
      `${BASE}/games?team_ids[]=${teamId}&per_page=5`,
      {
        headers: authHeaders(),
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const games: BDLGame[] = data.data ?? [];
    return games.map((g) => {
      const isHome = g.home_team.id === teamId;
      const teamScore = isHome ? g.home_team_score : g.visitor_team_score;
      const oppScore = isHome ? g.visitor_team_score : g.home_team_score;
      if (teamScore > oppScore) return "W";
      if (teamScore < oppScore) return "L";
      return "D";
    });
  } catch {
    return [];
  }
}
