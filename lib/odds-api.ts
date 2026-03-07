// The Odds API — live match data
// Docs: https://the-odds-api.com

const BASE = "https://api.the-odds-api.com/v4";

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string;
    markets: {
      key: string; // h2h | totals
      outcomes: { name: string; price: number; point?: number }[];
    }[];
  }[];
}

const SPORTS = [
  { key: "soccer_epl",                  label: "Premier League",   sport: "soccer" as const },
  { key: "soccer_fa_cup",               label: "FA Cup",           sport: "soccer" as const },
  { key: "soccer_england_efl_cup",      label: "EFL Cup",          sport: "soccer" as const },
  { key: "soccer_uefa_champs_league",   label: "Champions League", sport: "soccer" as const },
  { key: "soccer_uefa_europa_league",   label: "Europa League",    sport: "soccer" as const },
  { key: "basketball_nba",              label: "NBA",              sport: "nba"    as const },
  { key: "rugbyleague_nrl",             label: "NRL",              sport: "nrl"    as const },
  { key: "mma_mixed_martial_arts",      label: "UFC/MMA",          sport: "ufc"    as const },
];

async function fetchEvents(sportKey: string): Promise<OddsEvent[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(
      `${BASE}/sports/${sportKey}/odds?apiKey=${apiKey}&regions=us,uk,eu,au&markets=h2h,totals&oddsFormat=decimal&daysFrom=14`,
      { next: { revalidate: 21600 } } // 6h cache — preserves 500 free credits/month
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface LiveMatch {
  id: string;
  sport: "soccer" | "nba" | "nrl" | "ufc";
  league: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds?: number;
  totalLine?: number; // over/under line
  // Multi-book edge detection
  pinnacleHome?: number;
  pinnacleAway?: number;
  pinnacleDraw?: number;
  bookCount: number;
  isLive: true;
  // Best available odds across all bookmakers
  bestOddsHome?: number;
  bestOddsHomeBook?: string;
  bestOddsAway?: number;
  bestOddsAwayBook?: string;
  bestOddsDraw?: number;
  bestOddsDrawBook?: string;
  // All bookmakers for comparison table
  allBookOdds?: { book: string; home: number; away: number; draw?: number }[];
}

interface ExtractedOdds {
  home: number;
  away: number;
  draw?: number;
  total?: number;
  pinnacleHome?: number;
  pinnacleAway?: number;
  pinnacleDraw?: number;
  bookCount: number;
  bestOddsHome?: number;
  bestOddsHomeBook?: string;
  bestOddsAway?: number;
  bestOddsAwayBook?: string;
  bestOddsDraw?: number;
  bestOddsDrawBook?: string;
  allBookOdds?: { book: string; home: number; away: number; draw?: number }[];
}

function extractBookOdds(
  bookmaker: OddsEvent["bookmakers"][0],
  homeTeam: string,
  awayTeam: string
): { home: number; away: number; draw?: number; total?: number } {
  const h2h = bookmaker.markets.find((m) => m.key === "h2h");
  const totals = bookmaker.markets.find((m) => m.key === "totals");

  const homeOutcome = h2h?.outcomes.find((o) => o.name === homeTeam);
  const awayOutcome = h2h?.outcomes.find((o) => o.name === awayTeam);
  const drawOutcome = h2h?.outcomes.find((o) => o.name === "Draw");
  const overOutcome = totals?.outcomes.find((o) => o.name === "Over");

  return {
    home: homeOutcome?.price ?? 2.0,
    away: awayOutcome?.price ?? 2.0,
    draw: drawOutcome?.price,
    total: overOutcome?.point,
  };
}

// Display-friendly book names
const BOOK_DISPLAY: Record<string, string> = {
  pinnacle: "Pinnacle",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  unibet: "Unibet",
  betfair_ex_uk: "Betfair",
  bet365: "Bet365",
  williamhill: "William Hill",
  betway: "Betway",
  ladbrokes_au: "Ladbrokes",
  pointsbetau: "PointsBet",
  tab: "TAB",
  sportsbet: "Sportsbet",
  neds: "Neds",
  bluebet: "BlueBet",
  betr: "Betr",
};

function bookDisplayName(key: string): string {
  return BOOK_DISPLAY[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractOdds(event: OddsEvent): ExtractedOdds {
  const bookCount = event.bookmakers.length;

  // Separately extract Pinnacle odds
  const pinnacleBook = event.bookmakers.find((b) => b.key === "pinnacle");
  let pinnacleHome: number | undefined;
  let pinnacleAway: number | undefined;
  let pinnacleDraw: number | undefined;

  if (pinnacleBook) {
    const pOdds = extractBookOdds(pinnacleBook, event.home_team, event.away_team);
    pinnacleHome = pOdds.home;
    pinnacleAway = pOdds.away;
    pinnacleDraw = pOdds.draw;
  }

  // Best available odds (prefer pinnacle for accuracy, then sharp books)
  const preferred = ["pinnacle", "draftkings", "fanduel", "betmgm", "unibet", "betfair_ex_uk"];
  const bookmaker = event.bookmakers.find((b) => preferred.includes(b.key)) ?? event.bookmakers[0];
  if (!bookmaker) return { home: 2.0, away: 2.0, bookCount };

  const main = extractBookOdds(bookmaker, event.home_team, event.away_team);

  // Track best odds across all bookmakers
  let bestOddsHome = 0;
  let bestOddsHomeBook = "";
  let bestOddsAway = 0;
  let bestOddsAwayBook = "";
  let bestOddsDraw: number | undefined;
  let bestOddsDrawBook: string | undefined;
  const allBookOdds: { book: string; home: number; away: number; draw?: number }[] = [];

  for (const bk of event.bookmakers) {
    const bOdds = extractBookOdds(bk, event.home_team, event.away_team);
    const displayName = bookDisplayName(bk.key);
    allBookOdds.push({ book: displayName, home: bOdds.home, away: bOdds.away, draw: bOdds.draw });

    if (bOdds.home > bestOddsHome) { bestOddsHome = bOdds.home; bestOddsHomeBook = displayName; }
    if (bOdds.away > bestOddsAway) { bestOddsAway = bOdds.away; bestOddsAwayBook = displayName; }
    if (bOdds.draw && (!bestOddsDraw || bOdds.draw > bestOddsDraw)) {
      bestOddsDraw = bOdds.draw;
      bestOddsDrawBook = displayName;
    }
  }

  return {
    ...main,
    pinnacleHome,
    pinnacleAway,
    pinnacleDraw,
    bookCount,
    bestOddsHome: bestOddsHome || undefined,
    bestOddsHomeBook: bestOddsHomeBook || undefined,
    bestOddsAway: bestOddsAway || undefined,
    bestOddsAwayBook: bestOddsAwayBook || undefined,
    bestOddsDraw,
    bestOddsDrawBook,
    allBookOdds: allBookOdds.length > 0 ? allBookOdds : undefined,
  };
}

export async function getLiveMatches(): Promise<LiveMatch[]> {
  const results = await Promise.allSettled(SPORTS.map((s) => fetchEvents(s.key)));

  const matches: LiveMatch[] = [];

  results.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    const events = result.value;
    const sportMeta = SPORTS[i];

    // Filter out events that have already started
    // Show events starting within the next 14 days (matches daysFrom=14 API param)
    const now = new Date();
    const twoWeeksAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const upcoming = events.filter((e) => {
      const t = new Date(e.commence_time);
      return t > now && t <= twoWeeksAhead;
    });
    upcoming.slice(0, 15).forEach((event) => {
      const odds = extractOdds(event);
      matches.push({
        id: event.id,
        sport: sportMeta.sport,
        league: sportMeta.label,
        homeTeam: event.home_team,
        awayTeam: event.away_team,
        commenceTime: event.commence_time,
        homeOdds: odds.home,
        awayOdds: odds.away,
        drawOdds: odds.draw,
        totalLine: odds.total,
        pinnacleHome: odds.pinnacleHome,
        pinnacleAway: odds.pinnacleAway,
        pinnacleDraw: odds.pinnacleDraw,
        bookCount: odds.bookCount,
        isLive: true,
        bestOddsHome: odds.bestOddsHome,
        bestOddsHomeBook: odds.bestOddsHomeBook,
        bestOddsAway: odds.bestOddsAway,
        bestOddsAwayBook: odds.bestOddsAwayBook,
        bestOddsDraw: odds.bestOddsDraw,
        bestOddsDrawBook: odds.bestOddsDrawBook,
        allBookOdds: odds.allBookOdds,
      });
    });
  });

  return matches;
}
