// Elo rating utilities for TopBet algorithm

/**
 * Expected win probability for home team using Elo ratings.
 * homeAdvantage default: 50 Elo points.
 */
export function eloWinProb(homeElo: number, awayElo: number, homeAdvantage = 50): number {
  return 1 / (1 + Math.pow(10, (awayElo - homeElo - homeAdvantage) / 400));
}

/**
 * Approximate team Elo from league table position.
 * Position 1 → ~1750, last position → ~1250 (linear interpolation).
 */
export function teamEloFromPosition(position: number, totalTeams: number): number {
  if (totalTeams <= 1) return 1500;
  return 1750 - ((position - 1) / (totalTeams - 1)) * 500;
}

/**
 * Approximate NBA team Elo from win percentage.
 * 0.7 win% → ~1700, 0.3 win% → ~1300, 0.5 → ~1500.
 */
export function teamEloFromWinPct(winPct: number): number {
  return 1250 + winPct * 500;
}

// ─── ClubElo.com integration ──────────────────────────────────────────────────
// Free, no auth. URL: http://api.clubelo.com/{Slug}
// CSV format: Rank,Club,Country,Level,Elo,From,To
// Last row = most recent rating. Cache 24h in-memory.

const CLUBELO_CACHE_MS = 24 * 60 * 60 * 1000;
const clubEloCache = new Map<string, { elo: number; fetchedAt: number }>();

const CLUBELO_SLUGS: Record<string, string> = {
  // EPL
  "arsenal": "Arsenal",
  "manchester city": "ManCity",
  "man city": "ManCity",
  "manchester united": "ManUtd",
  "man united": "ManUtd",
  "liverpool": "Liverpool",
  "chelsea": "Chelsea",
  "tottenham hotspur": "Spurs",
  "tottenham": "Spurs",
  "newcastle united": "Newcastle",
  "newcastle": "Newcastle",
  "aston villa": "AstonVilla",
  "brighton": "Brighton",
  "brighton and hove albion": "Brighton",
  "west ham united": "WestHam",
  "west ham": "WestHam",
  "fulham": "Fulham",
  "brentford": "Brentford",
  "crystal palace": "CrystalPalace",
  "wolverhampton wanderers": "Wolves",
  "wolverhampton": "Wolves",
  "wolves": "Wolves",
  "everton": "Everton",
  "nottingham forest": "Forest",
  "forest": "Forest",
  "bournemouth": "Bournemouth",
  "leicester city": "Leicester",
  "leicester": "Leicester",
  "southampton": "Southampton",
  "ipswich town": "Ipswich",
  "ipswich": "Ipswich",
  // UCL / European
  "real madrid": "RealMadrid",
  "fc barcelona": "Barcelona",
  "barcelona": "Barcelona",
  "bayern munich": "BayernMunchen",
  "fc bayern münchen": "BayernMunchen",
  "paris saint-germain": "PSG",
  "paris saint germain": "PSG",
  "psg": "PSG",
  "borussia dortmund": "Dortmund",
  "dortmund": "Dortmund",
  "inter milan": "Inter",
  "inter": "Inter",
  "ac milan": "Milan",
  "milan": "Milan",
  "juventus": "Juventus",
  "atletico madrid": "Atletico",
  "atletico": "Atletico",
  "atalanta": "Atalanta",
  "bayer 04 leverkusen": "Leverkusen",
  "bayer leverkusen": "Leverkusen",
  "leverkusen": "Leverkusen",
  "rb leipzig": "RBLeipzig",
  "leipzig": "RBLeipzig",
  "porto": "Porto",
  "benfica": "Benfica",
  "ajax": "Ajax",
  "celtic": "Celtic",
  "rangers": "Rangers",
  "sevilla": "Sevilla",
  "villarreal": "Villarreal",
  "monaco": "Monaco",
  "psv": "PSV",
  "feyenoord": "Feyenoord",
};

function toClubEloSlug(teamName: string): string | null {
  const lower = teamName
    .toLowerCase()
    .replace(/\b(fc|cf|afc|sc|ac)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return CLUBELO_SLUGS[lower] ?? null;
}

export async function getClubElo(teamName: string): Promise<number | null> {
  const slug = toClubEloSlug(teamName);
  if (!slug) return null;

  const cached = clubEloCache.get(slug);
  if (cached && Date.now() - cached.fetchedAt < CLUBELO_CACHE_MS) {
    return cached.elo;
  }

  try {
    const url = `http://api.clubelo.com/${slug}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const text = await res.text();
    const lines = text.trim().split("\n");
    // Skip header row, take last data row
    if (lines.length < 2) return null;
    const lastLine = lines[lines.length - 1];
    const cols = lastLine.split(",");
    // CSV: Rank,Club,Country,Level,Elo,From,To
    const elo = parseFloat(cols[4]);
    if (isNaN(elo) || elo <= 0) return null;

    clubEloCache.set(slug, { elo, fetchedAt: Date.now() });
    return elo;
  } catch {
    return null;
  }
}
