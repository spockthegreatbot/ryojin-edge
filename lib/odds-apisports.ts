// API-Sports football odds endpoint
// Bookmaker 8 = Bet365
// Endpoint: GET /odds?fixture={id}&bookmaker=8
// Auth: x-apisports-key header
// Cache: 3h in-memory (no next.revalidate — this runs server-side in-process)

const FOOTBALL_BASE = "https://v3.football.api-sports.io";
const CACHE_MS = 3 * 60 * 60 * 1000; // 3h

export interface FixtureOdds {
  homeOdds: number;
  drawOdds?: number;
  awayOdds: number;
}

interface CacheEntry {
  odds: FixtureOdds;
  fetchedAt: number;
}

const oddsCache = new Map<number, CacheEntry>();

export async function getFixtureOdds(fixtureId: number): Promise<FixtureOdds | null> {
  const key = process.env.API_SPORTS_KEY ?? "";
  if (!key) return null;

  const cached = oddsCache.get(fixtureId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    return cached.odds;
  }

  try {
    const url = `${FOOTBALL_BASE}/odds?fixture=${fixtureId}&bookmaker=8`;
    const res = await fetch(url, {
      headers: { "x-apisports-key": key },
    });
    if (!res.ok) return null;

    const json = await res.json();
    const response: Array<{
      bookmakers: Array<{
        id: number;
        name: string;
        bets: Array<{
          id: number;
          name: string;
          values: Array<{ value: string; odd: string }>;
        }>;
      }>;
    }> = json?.response ?? [];

    if (response.length === 0) return null;

    const bookmakers = response[0]?.bookmakers ?? [];
    if (bookmakers.length === 0) return null;

    const bk = bookmakers[0];
    const market = bk.bets.find((b) => b.name === "Match Winner");
    if (!market) return null;

    const homeVal = market.values.find((v) => v.value === "Home");
    const drawVal = market.values.find((v) => v.value === "Draw");
    const awayVal = market.values.find((v) => v.value === "Away");

    const homeOdds = parseFloat(homeVal?.odd ?? "0");
    const awayOdds = parseFloat(awayVal?.odd ?? "0");
    const drawOdds = drawVal ? parseFloat(drawVal.odd) : undefined;

    if (!homeOdds || homeOdds <= 1 || !awayOdds || awayOdds <= 1) return null;

    const odds: FixtureOdds = { homeOdds, drawOdds, awayOdds };
    oddsCache.set(fixtureId, { odds, fetchedAt: Date.now() });
    return odds;
  } catch {
    return null;
  }
}
