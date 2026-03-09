// Cloudbet Feed API — NRL + UFC odds source
// Docs: https://cloudbet.github.io/wiki/en/docs/sports/api/
// Base: https://sports-api.cloudbet.com/pub/v2/odds/
// Auth: X-API-Key header (Trading API key)
// Cache: 6h in-memory — consistent with API-Sports caching

const BASE = "https://sports-api.cloudbet.com/pub/v2/odds";
const CACHE_MS = 6 * 60 * 60 * 1000; // 6h

// ── Competition keys ─────────────────────────────────────────────────────────

const COMP = {
  NRL: "rugby-league-international-nrl",
  UFC: "mma-international-ufc",
  PFL: "mma-international-pfl",
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface CloudbetEvent {
  id: number;
  name: string;
  homeTeam: string;
  awayTeam: string;
  homeKey: string;
  awayKey: string;
  startTime: string | null;
  status: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds?: number;
  homeProb: number;
  awayProb: number;
}

export interface CloudbetSport {
  name: string;
  key: string;
  competitionCount: number;
  eventCount: number;
}

export interface CloudbetCompetition {
  name: string;
  key: string;
  eventCount: number;
  categoryName: string;
}

// ── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const nrlCache: { entry: CacheEntry<CloudbetEvent[]> | null } = { entry: null };
const ufcCache: { entry: CacheEntry<CloudbetEvent[]> | null } = { entry: null };

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.fetchedAt < CACHE_MS;
}

// ── Core fetch ───────────────────────────────────────────────────────────────

async function cloudbetFetch(path: string): Promise<unknown> {
  const key = process.env.CLOUDBET_API_KEY ?? "";
  if (!key) {
    console.error("[cloudbet] CLOUDBET_API_KEY not set");
    return null;
  }

  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "accept": "application/json",
      "X-API-Key": key,
      "Content-Type": "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    console.error(`[cloudbet] ${res.status} ${res.statusText} for ${path}`);
    return null;
  }

  return res.json();
}

// ── Parse competition events into CloudbetEvent[] ────────────────────────────

type MarketKey = string;

interface RawSelection {
  outcome: string;
  params: string;
  price: number;
  probability: number;
  status: string;
}

interface RawSubmarket {
  selections: RawSelection[];
}

interface RawMarket {
  submarkets: Record<string, RawSubmarket>;
}

interface RawEvent {
  id: number;
  name: string;
  home: { name: string; key: string } | null;
  away: { name: string; key: string } | null;
  startTime: string | null;
  status: string;
  markets: Record<MarketKey, RawMarket>;
}

interface CompetitionResponse {
  events: RawEvent[];
}

function parseEvents(
  data: CompetitionResponse | null,
  marketKey: string
): CloudbetEvent[] {
  if (!data?.events) return [];

  const results: CloudbetEvent[] = [];

  for (const ev of data.events) {
    if (!ev.home || !ev.away) continue; // skip outrights

    let homeOdds = 0;
    let awayOdds = 0;
    let drawOdds: number | undefined;
    let homeProb = 0;
    let awayProb = 0;

    const market = ev.markets?.[marketKey];
    if (market) {
      // Find the default/full-time submarket
      const subKey = Object.keys(market.submarkets ?? {})[0];
      const sub = subKey ? market.submarkets[subKey] : null;

      if (sub?.selections) {
        for (const sel of sub.selections) {
          if (sel.status !== "SELECTION_ENABLED" || sel.price <= 0) continue;
          if (sel.outcome === "home") {
            homeOdds = sel.price;
            homeProb = sel.probability;
          } else if (sel.outcome === "away") {
            awayOdds = sel.price;
            awayProb = sel.probability;
          } else if (sel.outcome === "draw") {
            drawOdds = sel.price;
          }
        }
      }
    }

    results.push({
      id: ev.id,
      name: ev.name,
      homeTeam: ev.home.name,
      awayTeam: ev.away.name,
      homeKey: ev.home.key,
      awayKey: ev.away.key,
      startTime: ev.startTime ?? null,
      status: ev.status,
      homeOdds,
      awayOdds,
      drawOdds,
      homeProb,
      awayProb,
    });
  }

  return results;
}

// ── Public: NRL events ───────────────────────────────────────────────────────

export async function getNRLEvents(): Promise<CloudbetEvent[]> {
  if (isFresh(nrlCache.entry)) return nrlCache.entry.data;

  try {
    const data = (await cloudbetFetch(
      `/competitions/${COMP.NRL}`
    )) as CompetitionResponse | null;

    // NRL uses rugby_league.match_odds for h2h (home/draw/away) or moneyline
    // Try multiple market keys
    let events = parseEvents(data, "rugby_league.match_odds");
    if (events.every((e) => e.homeOdds === 0)) {
      events = parseEvents(data, "rugby_league.moneyline");
    }
    if (events.every((e) => e.homeOdds === 0)) {
      events = parseEvents(data, "rugby_league.handicap");
    }

    // Filter to actual match events (not outrights) that have teams
    const matches = events.filter((e) => e.homeTeam && e.awayTeam);

    nrlCache.entry = { data: matches, fetchedAt: Date.now() };
    return matches;
  } catch (err) {
    console.error("[cloudbet] NRL fetch failed:", err);
    return [];
  }
}

// ── Public: UFC/MMA events ───────────────────────────────────────────────────

export async function getUFCEvents(): Promise<CloudbetEvent[]> {
  if (isFresh(ufcCache.entry)) return ufcCache.entry.data;

  try {
    // Fetch UFC + PFL in parallel
    const [ufcData, pflData] = await Promise.all([
      cloudbetFetch(`/competitions/${COMP.UFC}`) as Promise<CompetitionResponse | null>,
      cloudbetFetch(`/competitions/${COMP.PFL}`) as Promise<CompetitionResponse | null>,
    ]);

    const ufcEvents = parseEvents(ufcData, "mma.winner");
    const pflEvents = parseEvents(pflData, "mma.winner");
    const allEvents = [...ufcEvents, ...pflEvents];

    // Filter to actual fights with teams
    const fights = allEvents.filter((e) => e.homeTeam && e.awayTeam);

    ufcCache.entry = { data: fights, fetchedAt: Date.now() };
    return fights;
  } catch (err) {
    console.error("[cloudbet] UFC fetch failed:", err);
    return [];
  }
}

// ── Public: List all available sports + competitions ─────────────────────────

export async function getCloudbetSports(): Promise<CloudbetSport[]> {
  try {
    const data = (await cloudbetFetch("/sports")) as {
      sports: CloudbetSport[];
    } | null;
    return data?.sports?.filter((s) => s.eventCount > 0) ?? [];
  } catch {
    return [];
  }
}

export async function getCloudbetCompetitions(
  sportKey: string
): Promise<CloudbetCompetition[]> {
  try {
    const data = (await cloudbetFetch(`/sports/${sportKey}`)) as {
      categories?: Array<{
        name: string;
        key: string;
        competitions?: Array<{
          name: string;
          key: string;
          eventCount: number;
        }>;
      }>;
    } | null;

    const results: CloudbetCompetition[] = [];
    for (const cat of data?.categories ?? []) {
      for (const comp of cat.competitions ?? []) {
        if (comp.eventCount > 0) {
          results.push({
            name: comp.name,
            key: comp.key,
            eventCount: comp.eventCount,
            categoryName: cat.name,
          });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}
