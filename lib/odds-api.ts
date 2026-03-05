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
  { key: "soccer_epl", label: "Premier League", sport: "soccer" as const },
  { key: "soccer_uefa_champs_league", label: "Champions League", sport: "soccer" as const },
  { key: "basketball_nba", label: "NBA", sport: "nba" as const },
];

async function fetchEvents(sportKey: string): Promise<OddsEvent[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(
      `${BASE}/sports/${sportKey}/odds?apiKey=${apiKey}&regions=us,uk,au&markets=h2h,totals&oddsFormat=decimal&daysFrom=3`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface LiveMatch {
  id: string;
  sport: "soccer" | "nba";
  league: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds?: number;
  totalLine?: number; // over/under line
  isLive: true;
}

function extractOdds(event: OddsEvent): { home: number; away: number; draw?: number; total?: number } {
  // Prefer pinnacle, then draftkings, then first available
  const preferred = ["pinnacle", "draftkings", "fanduel", "betmgm", "unibet", "betfair_ex_uk"];
  const bookmaker = event.bookmakers.find((b) => preferred.includes(b.key)) ?? event.bookmakers[0];
  if (!bookmaker) return { home: 2.0, away: 2.0 };

  const h2h = bookmaker.markets.find((m) => m.key === "h2h");
  const totals = bookmaker.markets.find((m) => m.key === "totals");

  const homeOutcome = h2h?.outcomes.find((o) => o.name === event.home_team);
  const awayOutcome = h2h?.outcomes.find((o) => o.name === event.away_team);
  const drawOutcome = h2h?.outcomes.find((o) => o.name === "Draw");
  const overOutcome = totals?.outcomes.find((o) => o.name === "Over");

  return {
    home: homeOutcome?.price ?? 2.0,
    away: awayOutcome?.price ?? 2.0,
    draw: drawOutcome?.price,
    total: overOutcome?.point,
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
    const upcoming = events.filter((e) => new Date(e.commence_time) > new Date());
    upcoming.slice(0, 5).forEach((event) => {
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
        isLive: true,
      });
    });
  });

  return matches;
}
