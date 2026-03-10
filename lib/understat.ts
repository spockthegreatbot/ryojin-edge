// Scrape team xG averages from understat.com (free, no API key)
// Returns: { xgFor: number, xgAgainst: number } averaged over last 10 matches

export interface TeamXG {
  xgFor: number;      // Expected goals scored per game
  xgAgainst: number;  // Expected goals conceded per game
}

const slugMap: Record<string, string> = {
  "Manchester City": "Manchester_City",
  "Man City": "Manchester_City",
  "Manchester United": "Manchester_United",
  "Man United": "Manchester_United",
  "Arsenal": "Arsenal",
  "Chelsea": "Chelsea",
  "Liverpool": "Liverpool",
  "Tottenham": "Tottenham",
  "Newcastle": "Newcastle",
  "Aston Villa": "Aston_Villa",
  "Brighton": "Brighton",
  "West Ham": "West_Ham",
  "Fulham": "Fulham",
  "Brentford": "Brentford",
  "Crystal Palace": "Crystal_Palace",
  "Wolves": "Wolverhampton_Wanderers",
  "Wolverhampton": "Wolverhampton_Wanderers",
  "Everton": "Everton",
  "Leicester": "Leicester",
  "Southampton": "Southampton",
  "Ipswich": "Ipswich",
  "Nottingham Forest": "Nottingham_Forest",
  "Forest": "Nottingham_Forest",
  "Bournemouth": "Bournemouth",
  // La Liga
  "Barcelona": "Barcelona",
  "FC Barcelona": "Barcelona",
  "Real Madrid": "Real_Madrid",
  "Atletico Madrid": "Atletico_Madrid",
  "Atletico": "Atletico_Madrid",
  // Bundesliga
  "Bayern Munich": "Bayern_Munich",
  "FC Bayern München": "Bayern_Munich",
  "Bayern": "Bayern_Munich",
  "Borussia Dortmund": "Borussia_Dortmund",
  "Dortmund": "Borussia_Dortmund",
  // Serie A
  "Inter Milan": "Internazionale",
  "Inter": "Internazionale",
  "Juventus": "Juventus",
  // Ligue 1
  "Paris Saint-Germain": "Paris_Saint_Germain",
  "Paris Saint Germain": "Paris_Saint_Germain",
  "PSG": "Paris_Saint_Germain",
};

export async function getTeamXG(teamName: string): Promise<TeamXG | null> {
  const slug = Object.entries(slugMap).find(([k]) =>
    teamName.toLowerCase().includes(k.toLowerCase())
  )?.[1];

  if (!slug) return null;

  try {
    const url = `https://understat.com/team/${slug}/2025`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 21600 }, // 6h cache
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();

    // understat embeds JSON data in script tags
    // Look for datesData which has per-match xG
    const match = html.match(/datesData\s*=\s*JSON\.parse\('(.+?)'\)/);
    if (!match) return null;

    const raw = match[1].replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
    const matches = JSON.parse(raw) as Array<{
      xG: string; xGA: string; h_a: string; result: string;
    }>;

    // Last 10 matches
    const last10 = matches.slice(-10);
    if (!last10.length) return null;

    const xgFor = last10.reduce((s, m) => s + parseFloat(m.xG || "0"), 0) / last10.length;
    const xgAgainst = last10.reduce((s, m) => s + parseFloat(m.xGA || "0"), 0) / last10.length;

    return {
      xgFor: Math.round(xgFor * 100) / 100,
      xgAgainst: Math.round(xgAgainst * 100) / 100,
    };
  } catch {
    return null;
  }
}
