// HLTV data source for CS2 predictions
// Primary: scrape HLTV.org with browser-like UA
// Fallback: hardcoded rankings + Liquipedia match schedules

export interface CS2Team {
  name: string;
  rank: number;
  points: number;
}

export interface CS2Match {
  id: string;
  team1: string;
  team2: string;
  team1Rank: number;
  team2Rank: number;
  event: string;
  date: string; // ISO
  format: "BO1" | "BO3" | "BO5";
  isLan: boolean;
}

export interface CS2Result {
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  event: string;
  date: string;
}

// ─── Hardcoded HLTV Rankings (March 2026 — update weekly) ────────────────────
// Source: https://www.hltv.org/ranking/teams
const HLTV_RANKINGS: CS2Team[] = [
  { name: "Natus Vincere", rank: 1, points: 931 },
  { name: "Team Spirit", rank: 2, points: 822 },
  { name: "G2 Esports", rank: 3, points: 650 },
  { name: "FaZe Clan", rank: 4, points: 575 },
  { name: "Vitality", rank: 5, points: 548 },
  { name: "MOUZ", rank: 6, points: 472 },
  { name: "Liquid", rank: 7, points: 436 },
  { name: "Heroic", rank: 8, points: 310 },
  { name: "Virtus.pro", rank: 9, points: 285 },
  { name: "Complexity", rank: 10, points: 271 },
  { name: "FURIA", rank: 11, points: 260 },
  { name: "Astralis", rank: 12, points: 243 },
  { name: "Eternal Fire", rank: 13, points: 235 },
  { name: "Cloud9", rank: 14, points: 218 },
  { name: "paiN Gaming", rank: 15, points: 205 },
  { name: "3DMAX", rank: 16, points: 190 },
  { name: "BIG", rank: 17, points: 178 },
  { name: "GamerLegion", rank: 18, points: 165 },
  { name: "SAW", rank: 19, points: 152 },
  { name: "Monte", rank: 20, points: 140 },
  { name: "TheMongolz", rank: 21, points: 132 },
  { name: "fnatic", rank: 22, points: 125 },
  { name: "Imperial", rank: 23, points: 115 },
  { name: "Ninjas in Pyjamas", rank: 24, points: 108 },
  { name: "ENCE", rank: 25, points: 100 },
  { name: "Apeks", rank: 26, points: 95 },
  { name: "ECSTATIC", rank: 27, points: 88 },
  { name: "Falcons", rank: 28, points: 82 },
  { name: "Lynn Vision", rank: 29, points: 76 },
  { name: "BetBoom", rank: 30, points: 70 },
];

// ─── Recent Results (hardcoded seed — will be replaced by live scraping) ─────
const RECENT_RESULTS: CS2Result[] = [
  { team1: "Natus Vincere", team2: "Team Spirit", score1: 2, score2: 1, event: "BLAST Premier Spring Final", date: "2026-03-12T18:00:00Z" },
  { team1: "G2 Esports", team2: "FaZe Clan", score1: 2, score2: 0, event: "IEM Katowice", date: "2026-03-11T16:00:00Z" },
  { team1: "Vitality", team2: "MOUZ", score1: 1, score2: 2, event: "IEM Katowice", date: "2026-03-11T14:00:00Z" },
  { team1: "Liquid", team2: "Heroic", score1: 2, score2: 1, event: "ESL Pro League S21", date: "2026-03-10T20:00:00Z" },
  { team1: "FaZe Clan", team2: "Virtus.pro", score1: 2, score2: 0, event: "ESL Pro League S21", date: "2026-03-10T17:00:00Z" },
  { team1: "Team Spirit", team2: "Complexity", score1: 2, score2: 1, event: "BLAST Premier Spring", date: "2026-03-09T15:00:00Z" },
  { team1: "Natus Vincere", team2: "G2 Esports", score1: 2, score2: 1, event: "BLAST Premier Spring", date: "2026-03-09T18:00:00Z" },
  { team1: "FURIA", team2: "Astralis", score1: 1, score2: 2, event: "ESL Pro League S21", date: "2026-03-08T19:00:00Z" },
  { team1: "Eternal Fire", team2: "Cloud9", score1: 2, score2: 0, event: "ESL Pro League S21", date: "2026-03-08T16:00:00Z" },
  { team1: "MOUZ", team2: "Natus Vincere", score1: 0, score2: 2, event: "IEM Katowice", date: "2026-03-07T20:00:00Z" },
  { team1: "Vitality", team2: "FaZe Clan", score1: 2, score2: 1, event: "IEM Katowice", date: "2026-03-07T17:00:00Z" },
  { team1: "Liquid", team2: "FURIA", score1: 2, score2: 0, event: "ESL Pro League S21", date: "2026-03-06T21:00:00Z" },
  { team1: "G2 Esports", team2: "Team Spirit", score1: 1, score2: 2, event: "BLAST Premier Spring", date: "2026-03-06T18:00:00Z" },
  { team1: "Heroic", team2: "BIG", score1: 2, score2: 1, event: "ESL Pro League S21", date: "2026-03-05T15:00:00Z" },
  { team1: "Complexity", team2: "3DMAX", score1: 2, score2: 0, event: "ESL Pro League S21", date: "2026-03-05T12:00:00Z" },
  { team1: "Astralis", team2: "SAW", score1: 2, score2: 1, event: "ESL Pro League S21", date: "2026-03-04T19:00:00Z" },
  { team1: "Cloud9", team2: "Monte", score1: 0, score2: 2, event: "ESL Pro League S21", date: "2026-03-04T16:00:00Z" },
  { team1: "Virtus.pro", team2: "paiN Gaming", score1: 2, score2: 0, event: "BLAST Premier Spring", date: "2026-03-03T18:00:00Z" },
  { team1: "FaZe Clan", team2: "Liquid", score1: 1, score2: 2, event: "BLAST Premier Spring", date: "2026-03-03T15:00:00Z" },
  { team1: "Natus Vincere", team2: "Vitality", score1: 2, score2: 0, event: "IEM Katowice", date: "2026-03-02T20:00:00Z" },
];

// ─── Upcoming Matches (hardcoded seed) ───────────────────────────────────────
function generateUpcomingMatches(): CS2Match[] {
  const now = new Date();
  const matches: CS2Match[] = [
    {
      id: "cs2-001",
      team1: "Natus Vincere",
      team2: "FaZe Clan",
      team1Rank: 1,
      team2Rank: 4,
      event: "BLAST Premier Spring Final",
      date: new Date(now.getTime() + 4 * 3600000).toISOString(),
      format: "BO3",
      isLan: true,
    },
    {
      id: "cs2-002",
      team1: "Team Spirit",
      team2: "G2 Esports",
      team1Rank: 2,
      team2Rank: 3,
      event: "BLAST Premier Spring Final",
      date: new Date(now.getTime() + 7 * 3600000).toISOString(),
      format: "BO3",
      isLan: true,
    },
    {
      id: "cs2-003",
      team1: "Vitality",
      team2: "Liquid",
      team1Rank: 5,
      team2Rank: 7,
      event: "ESL Pro League Season 21",
      date: new Date(now.getTime() + 10 * 3600000).toISOString(),
      format: "BO3",
      isLan: false,
    },
    {
      id: "cs2-004",
      team1: "MOUZ",
      team2: "Heroic",
      team1Rank: 6,
      team2Rank: 8,
      event: "ESL Pro League Season 21",
      date: new Date(now.getTime() + 13 * 3600000).toISOString(),
      format: "BO3",
      isLan: false,
    },
    {
      id: "cs2-005",
      team1: "Complexity",
      team2: "FURIA",
      team1Rank: 10,
      team2Rank: 11,
      event: "ESL Pro League Season 21",
      date: new Date(now.getTime() + 24 * 3600000).toISOString(),
      format: "BO1",
      isLan: false,
    },
    {
      id: "cs2-006",
      team1: "Astralis",
      team2: "Eternal Fire",
      team1Rank: 12,
      team2Rank: 13,
      event: "ESL Pro League Season 21",
      date: new Date(now.getTime() + 26 * 3600000).toISOString(),
      format: "BO3",
      isLan: false,
    },
    {
      id: "cs2-007",
      team1: "Virtus.pro",
      team2: "BIG",
      team1Rank: 9,
      team2Rank: 17,
      event: "BLAST Premier Spring Groups",
      date: new Date(now.getTime() + 30 * 3600000).toISOString(),
      format: "BO1",
      isLan: true,
    },
    {
      id: "cs2-008",
      team1: "Cloud9",
      team2: "GamerLegion",
      team1Rank: 14,
      team2Rank: 18,
      event: "ESL Pro League Season 21",
      date: new Date(now.getTime() + 34 * 3600000).toISOString(),
      format: "BO3",
      isLan: false,
    },
  ];
  return matches;
}

// ─── HLTV Scraper (attempt live, fallback to hardcoded) ──────────────────────

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function tryFetchHLTV(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[hltv] ${url} returned ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[hltv] Failed to fetch ${url}:`, err);
    return null;
  }
}

// Parse simple team rankings from HLTV HTML (best effort)
function parseHLTVRankings(html: string): CS2Team[] | null {
  try {
    const teams: CS2Team[] = [];
    // HLTV ranking page has elements like: <div class="ranked-team standard-box">
    // with team name and points inside
    const teamBlocks = html.match(/class="ranked-team[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g);
    if (!teamBlocks || teamBlocks.length < 10) return null;

    for (let i = 0; i < Math.min(teamBlocks.length, 30); i++) {
      const block = teamBlocks[i];
      const nameMatch = block.match(/class="name"[^>]*>([^<]+)</);
      const pointsMatch = block.match(/class="points"[^>]*>\((\d+)\s*points?\)/);
      if (nameMatch && pointsMatch) {
        teams.push({
          name: nameMatch[1].trim(),
          rank: i + 1,
          points: parseInt(pointsMatch[1]),
        });
      }
    }
    return teams.length >= 10 ? teams : null;
  } catch {
    return null;
  }
}

// ─── Live scraper data reader ────────────────────────────────────────────────
import { readFileSync, statSync } from "fs";

const SCRAPED_DATA_PATH = "/tmp/hltv-data.json";
const SCRAPE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ScrapedData {
  rankings: { rank: number; name: string; points: number }[];
  matches: { team1: string; team2: string; event: string; time: string; format: string; stars: number }[];
  scraped_at: string;
}

function loadScrapedData(): ScrapedData | null {
  try {
    const stat = statSync(SCRAPED_DATA_PATH);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > SCRAPE_MAX_AGE_MS) {
      console.log(`[hltv] Scraped data is ${Math.round(ageMs / 3600000)}h old — stale, using hardcoded`);
      return null;
    }
    const raw = readFileSync(SCRAPED_DATA_PATH, "utf-8");
    const data = JSON.parse(raw) as ScrapedData;
    if (!data.rankings?.length) return null;
    console.log(`[hltv] Loaded scraped data (${data.rankings.length} teams, ${data.matches?.length ?? 0} matches)`);
    return data;
  } catch {
    return null;
  }
}

function scrapedRankingsToTeams(scraped: ScrapedData): CS2Team[] {
  return scraped.rankings.map((r) => ({
    name: r.name,
    rank: r.rank,
    points: r.points,
  }));
}

function scrapedMatchesToCS2(scraped: ScrapedData): CS2Match[] {
  return scraped.matches.map((m, i) => {
    const fmt = (m.format || "BO3").toUpperCase() as "BO1" | "BO3" | "BO5";
    const validFormat = ["BO1", "BO3", "BO5"].includes(fmt) ? fmt : "BO3" as const;
    // Look up ranks from scraped rankings
    const r1 = scraped.rankings.find((r) => r.name.toLowerCase() === m.team1.toLowerCase());
    const r2 = scraped.rankings.find((r) => r.name.toLowerCase() === m.team2.toLowerCase());
    return {
      id: `hltv-${i}`,
      team1: m.team1,
      team2: m.team2,
      team1Rank: r1?.rank ?? 99,
      team2Rank: r2?.rank ?? 99,
      event: m.event,
      date: m.time ? new Date(m.time.replace(" ", "T") + ":00Z").toISOString() : new Date().toISOString(),
      format: validFormat,
      isLan: m.stars >= 4, // high-star matches are typically LAN
    };
  });
}

// ─── Cache ───────────────────────────────────────────────────────────────────

let rankingsCache: { data: CS2Team[]; fetchedAt: number } | null = null;
let matchesCache: { data: CS2Match[]; fetchedAt: number } | null = null;
let resultsCache: { data: CS2Result[]; fetchedAt: number } | null = null;

const CACHE_TTL = 30 * 60 * 1000; // 30 min

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getCS2Rankings(): Promise<CS2Team[]> {
  if (rankingsCache && Date.now() - rankingsCache.fetchedAt < CACHE_TTL) {
    return rankingsCache.data;
  }

  // Try scraped data first (from scripts/scrape-hltv.mjs cron)
  const scraped = loadScrapedData();
  if (scraped) {
    const teams = scrapedRankingsToTeams(scraped);
    if (teams.length >= 10) {
      rankingsCache = { data: teams, fetchedAt: Date.now() };
      console.log(`[hltv] Using scraped rankings: ${teams.length} teams`);
      return teams;
    }
  }

  // Try live HTTP fetch (often blocked by Cloudflare)
  const html = await tryFetchHLTV("https://www.hltv.org/ranking/teams");
  if (html) {
    const parsed = parseHLTVRankings(html);
    if (parsed) {
      rankingsCache = { data: parsed, fetchedAt: Date.now() };
      console.log(`[hltv] Live rankings fetched: ${parsed.length} teams`);
      return parsed;
    }
  }

  // Fallback to hardcoded
  console.log("[hltv] Using hardcoded rankings");
  rankingsCache = { data: HLTV_RANKINGS, fetchedAt: Date.now() };
  return HLTV_RANKINGS;
}

export async function getCS2Matches(): Promise<CS2Match[]> {
  if (matchesCache && Date.now() - matchesCache.fetchedAt < CACHE_TTL) {
    return matchesCache.data;
  }

  // Try scraped data first
  const scraped = loadScrapedData();
  if (scraped && scraped.matches?.length > 0) {
    const matches = scrapedMatchesToCS2(scraped);
    if (matches.length > 0) {
      matchesCache = { data: matches, fetchedAt: Date.now() };
      console.log(`[hltv] Using scraped matches: ${matches.length}`);
      return matches;
    }
  }

  // Fallback to generated upcoming matches
  const matches = generateUpcomingMatches();
  matchesCache = { data: matches, fetchedAt: Date.now() };
  return matches;
}

export async function getCS2Results(): Promise<CS2Result[]> {
  if (resultsCache && Date.now() - resultsCache.fetchedAt < CACHE_TTL) {
    return resultsCache.data;
  }

  resultsCache = { data: RECENT_RESULTS, fetchedAt: Date.now() };
  return RECENT_RESULTS;
}

export function getTeamRank(teamName: string, rankings: CS2Team[]): CS2Team | null {
  const lower = teamName.toLowerCase();
  return rankings.find(t => t.name.toLowerCase() === lower) ?? null;
}

export function getTeamForm(teamName: string, results: CS2Result[]): string[] {
  const lower = teamName.toLowerCase();
  const form: string[] = [];
  for (const r of results) {
    if (form.length >= 5) break;
    const t1 = r.team1.toLowerCase();
    const t2 = r.team2.toLowerCase();
    if (t1 === lower) {
      form.push(r.score1 > r.score2 ? "W" : "L");
    } else if (t2 === lower) {
      form.push(r.score2 > r.score1 ? "W" : "L");
    }
  }
  return form;
}
