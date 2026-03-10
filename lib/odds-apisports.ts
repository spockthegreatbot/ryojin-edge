// API-Sports odds integration — primary odds source for TopBet
// Football: bookmaker 8 = Bet365 (v3.football.api-sports.io)
// Basketball: bookmaker 4 = Bet365, 12 = Pinnacle (v1.basketball.api-sports.io)
// Auth: x-apisports-key header
// Cache: 6h in-memory — odds don't change fast enough to justify burning quota

const FOOTBALL_BASE = "https://v3.football.api-sports.io";
const BASKETBALL_BASE = "https://v1.basketball.api-sports.io";
const CACHE_MS = 6 * 60 * 60 * 1000; // 6h

// ── Types ────────────────────────────────────────────────────────────────────

export interface FixtureOdds {
  homeOdds: number;
  drawOdds?: number;
  awayOdds: number;
}

export interface NBAGameOdds {
  homeOdds: number;
  awayOdds: number;
  totalLine?: number;
}

export interface LeagueOddsMap {
  /** Map of fixtureId → odds */
  [fixtureId: number]: FixtureOdds;
}

export interface NBAOddsMap {
  /** Map of gameId → odds */
  [gameId: number]: NBAGameOdds;
}

// ── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// Per-fixture cache (legacy — kept for single-fixture lookups)
const fixtureOddsCache = new Map<number, CacheEntry<FixtureOdds>>();

// Bulk league cache: leagueId → map of fixtureId → odds
const leagueOddsCache = new Map<number, CacheEntry<LeagueOddsMap>>();

// NBA cache: season key → map of gameId → odds
const nbaOddsCache: { entry: CacheEntry<NBAOddsMap> | null } = { entry: null };

function isFresh<T>(entry: CacheEntry<T> | undefined | null): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.fetchedAt < CACHE_MS;
}

// ── Football: Single fixture odds (backward compat) ──────────────────────────

export async function getFixtureOdds(fixtureId: number): Promise<FixtureOdds | null> {
  const key = process.env.API_SPORTS_KEY ?? "";
  if (!key) return null;

  const cached = fixtureOddsCache.get(fixtureId);
  if (isFresh(cached)) return cached.data;

  try {
    const url = `${FOOTBALL_BASE}/odds?fixture=${fixtureId}&bookmaker=8`;
    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 8000);
    const res = await fetch(url, { headers: { "x-apisports-key": key }, signal: ctrl1.signal });
    clearTimeout(t1);
    if (!res.ok) return null;

    const json = await res.json();
    const parsed = parseFootballOddsResponse(json);

    // Cache all returned fixtures
    for (const [id, odds] of Object.entries(parsed)) {
      fixtureOddsCache.set(Number(id), { data: odds, fetchedAt: Date.now() });
    }

    return parsed[fixtureId] ?? null;
  } catch {
    return null;
  }
}

// ── Football: Bulk league odds (1 API call for all fixtures in a league) ─────

export async function getLeagueOdds(leagueId: number, season: number): Promise<LeagueOddsMap> {
  const key = process.env.API_SPORTS_KEY ?? "";
  if (!key) return {};

  const cached = leagueOddsCache.get(leagueId);
  if (isFresh(cached)) return cached.data;

  try {
    // Fetch all pages — API-Sports paginates odds (10 per page)
    let allOdds: LeagueOddsMap = {};
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= 5) {
      const url = `${FOOTBALL_BASE}/odds?league=${leagueId}&season=${season}&bookmaker=8&page=${page}`;
      const ctrlL = new AbortController();
      const tL = setTimeout(() => ctrlL.abort(), 8000);
      const res = await fetch(url, { headers: { "x-apisports-key": key }, signal: ctrlL.signal });
      clearTimeout(tL);
      if (!res.ok) break;

      const json = await res.json();
      totalPages = json?.paging?.total ?? 1;

      const parsed = parseFootballOddsResponse(json);
      allOdds = { ...allOdds, ...parsed };
      page++;
    }

    leagueOddsCache.set(leagueId, { data: allOdds, fetchedAt: Date.now() });

    // Also populate per-fixture cache
    for (const [id, odds] of Object.entries(allOdds)) {
      fixtureOddsCache.set(Number(id), { data: odds, fetchedAt: Date.now() });
    }

    return allOdds;
  } catch {
    return {};
  }
}

// ── Basketball: NBA odds (bulk fetch) ────────────────────────────────────────

const NBA_LEAGUE = 12;
const NBA_SEASON = "2025-2026";

export async function getNBAOdds(): Promise<NBAOddsMap> {
  const key = process.env.API_SPORTS_KEY ?? "";
  if (!key) return {};

  if (isFresh(nbaOddsCache.entry)) return nbaOddsCache.entry.data;

  try {
    let allOdds: NBAOddsMap = {};
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= 5) {
      // Prefer Bet365 (id=4), fall back to any bookmaker
      const url = `${BASKETBALL_BASE}/odds?league=${NBA_LEAGUE}&season=${NBA_SEASON}&bookmaker=4&page=${page}`;
      const ctrlN = new AbortController();
      const tN = setTimeout(() => ctrlN.abort(), 8000);
      const res = await fetch(url, { headers: { "x-apisports-key": key }, signal: ctrlN.signal });
      clearTimeout(tN);
      if (!res.ok) break;

      const json = await res.json();
      totalPages = json?.paging?.total ?? 1;

      const parsed = parseBasketballOddsResponse(json);
      allOdds = { ...allOdds, ...parsed };
      page++;
    }

    // If Bet365 returned nothing, try without bookmaker filter
    if (Object.keys(allOdds).length === 0) {
      const url = `${BASKETBALL_BASE}/odds?league=${NBA_LEAGUE}&season=${NBA_SEASON}`;
      const ctrlFb = new AbortController();
      const tFb = setTimeout(() => ctrlFb.abort(), 8000);
      const res = await fetch(url, { headers: { "x-apisports-key": key }, signal: ctrlFb.signal });
      clearTimeout(tFb);
      if (res.ok) {
        const json = await res.json();
        allOdds = parseBasketballOddsResponse(json);
      }
    }

    nbaOddsCache.entry = { data: allOdds, fetchedAt: Date.now() };
    return allOdds;
  } catch {
    return {};
  }
}

// ── Parsers ──────────────────────────────────────────────────────────────────

function parseFootballOddsResponse(json: {
  response?: Array<{
    fixture: { id: number };
    bookmakers: Array<{
      id: number;
      name: string;
      bets: Array<{
        id: number;
        name: string;
        values: Array<{ value: string; odd: string }>;
      }>;
    }>;
  }>;
}): LeagueOddsMap {
  const result: LeagueOddsMap = {};
  const response = json?.response ?? [];

  for (const entry of response) {
    const fixtureId = entry.fixture?.id;
    if (!fixtureId) continue;

    const bookmakers = entry.bookmakers ?? [];
    if (bookmakers.length === 0) continue;

    // Use first bookmaker (should be Bet365 since we filtered by bookmaker=8)
    const bk = bookmakers[0];
    const market = bk.bets.find((b) => b.name === "Match Winner");
    if (!market) continue;

    const homeVal = market.values.find((v) => v.value === "Home");
    const drawVal = market.values.find((v) => v.value === "Draw");
    const awayVal = market.values.find((v) => v.value === "Away");

    const homeOdds = parseFloat(homeVal?.odd ?? "0");
    const awayOdds = parseFloat(awayVal?.odd ?? "0");
    const drawOdds = drawVal ? parseFloat(drawVal.odd) : undefined;

    if (!homeOdds || homeOdds <= 1 || !awayOdds || awayOdds <= 1) continue;

    result[fixtureId] = { homeOdds, drawOdds, awayOdds };
  }

  return result;
}

function parseBasketballOddsResponse(json: {
  response?: Array<{
    game: { id: number };
    bookmakers: Array<{
      id: number;
      name: string;
      bets: Array<{
        id: number;
        name: string;
        values: Array<{ value: string; odd: string }>;
      }>;
    }>;
  }>;
}): NBAOddsMap {
  const result: NBAOddsMap = {};
  const response = json?.response ?? [];

  for (const entry of response) {
    const gameId = entry.game?.id;
    if (!gameId) continue;

    const bookmakers = entry.bookmakers ?? [];
    if (bookmakers.length === 0) continue;

    const bk = bookmakers[0];

    // Find moneyline / match winner market
    // Basketball API uses "Home/Away" or "3Way Result" or "Match Winner"
    const moneyline = bk.bets.find(
      (b) => b.name === "Home/Away" || b.name === "Match Winner" || b.name === "3Way Result"
    );

    if (!moneyline) continue;

    const homeVal = moneyline.values.find((v) => v.value === "Home" || v.value === "1");
    const awayVal = moneyline.values.find((v) => v.value === "Away" || v.value === "2");

    const homeOdds = parseFloat(homeVal?.odd ?? "0");
    const awayOdds = parseFloat(awayVal?.odd ?? "0");

    if (!homeOdds || homeOdds <= 1 || !awayOdds || awayOdds <= 1) continue;

    // Try to find Over/Under line
    const totals = bk.bets.find(
      (b) => b.name === "Over/Under" || b.name === "Total" || b.name.includes("Total")
    );
    let totalLine: number | undefined;
    if (totals) {
      const overVal = totals.values.find((v) => v.value.startsWith("Over"));
      if (overVal) {
        const lineMatch = overVal.value.match(/[\d.]+/);
        if (lineMatch) totalLine = parseFloat(lineMatch[0]);
      }
    }

    result[gameId] = { homeOdds, awayOdds, totalLine };
  }

  return result;
}
