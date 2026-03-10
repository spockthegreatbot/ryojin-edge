// ESPN MMA fighter lookup — public API, no auth
// Primary: scoreboard endpoint (one call, all upcoming card fighters with records)

const ESPN_SCOREBOARD = 'http://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard'
const CACHE_MS = 12 * 60 * 60 * 1000 // 12h

export interface FighterStats {
  id: string
  name: string
  wins: number
  losses: number
  winRate: number       // wins / (wins + losses)
  recentForm: number    // 0.5 default (ESPN doesn't expose recent fight-by-fight results)
  strikingAcc: number   // 0-1, default 0.5 (not available in public ESPN API)
  takedownAcc: number   // 0-1, default 0.4
  finishRate: number    // 0-1, default 0.5
  weightClass: string
}

// Scoreboard cache: maps normalized name → FighterStats
interface ScoreboardCache { data: Map<string, FighterStats>; at: number }
let _scoreboardCache: ScoreboardCache | null = null

// Individual fighter cache (fallback lookups)
const fighterCache = new Map<string, { data: FighterStats; at: number }>()

function parseRecord(summary: string): { wins: number; losses: number } {
  // Summaries like "19-6-0" (W-L-D) or "19-6"
  const parts = summary.split('-').map(Number)
  const wins = parts[0] ?? 0
  const losses = parts[1] ?? 0
  return { wins: isNaN(wins) ? 0 : wins, losses: isNaN(losses) ? 0 : losses }
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function makeStats(id: string, name: string, wins: number, losses: number): FighterStats {
  const total = wins + losses || 1
  return {
    id,
    name,
    wins,
    losses,
    winRate: wins / total,
    recentForm: 0.5,
    strikingAcc: 0.5,
    takedownAcc: 0.4,
    finishRate: 0.5,
    weightClass: 'Unknown',
  }
}

async function loadScoreboard(): Promise<Map<string, FighterStats>> {
  if (_scoreboardCache && Date.now() - _scoreboardCache.at < CACHE_MS) {
    return _scoreboardCache.data
  }

  const map = new Map<string, FighterStats>()
  try {
    const res = await fetch(ESPN_SCOREBOARD)
    if (!res.ok) return map

    const data = await res.json()
    const events: unknown[] = data?.events ?? []

    for (const ev of events as Record<string, unknown>[]) {
      const competitions: unknown[] = (ev?.competitions as unknown[]) ?? []
      for (const comp of competitions as Record<string, unknown>[]) {
        const competitors: unknown[] = (comp?.competitors as unknown[]) ?? []
        for (const competitor of competitors as Record<string, unknown>[]) {
          const athlete = competitor?.athlete as Record<string, string> | undefined
          const records = competitor?.records as Array<Record<string, string>> | undefined
          const id = String(competitor?.id ?? '')
          const displayName = athlete?.displayName ?? ''
          if (!displayName || !id) continue

          const recordSummary = records?.[0]?.summary ?? '0-0-0'
          const { wins, losses } = parseRecord(recordSummary)

          const stats = makeStats(id, displayName, wins, losses)
          map.set(normalizeName(displayName), stats)
        }
      }
    }
  } catch (err) {
    console.error('[espn-mma] Failed to load scoreboard:', err)
  }

  _scoreboardCache = { data: map, at: Date.now() }
  return map
}

export async function getFighterStats(name: string): Promise<FighterStats | null> {
  const key = name.toLowerCase()
  const cached = fighterCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data

  // Try scoreboard first (fastest, most reliable)
  const board = await loadScoreboard()
  const normKey = normalizeName(name)
  const fromBoard = board.get(normKey)
  if (fromBoard) return fromBoard

  // Fuzzy match: check if any scoreboard name contains or starts with our name
  for (const [boardKey, stats] of board) {
    if (boardKey.includes(normKey) || normKey.includes(boardKey)) {
      return stats
    }
  }

  // Fallback: not in scoreboard — return null (no reliable name-search in ESPN public API)
  console.warn(`[espn-mma] Fighter not found in scoreboard: ${name}`)
  return null
}

// Fetch both fighters in a fight in parallel
export async function getFightStats(fighter1: string, fighter2: string): Promise<{
  f1: FighterStats | null
  f2: FighterStats | null
}> {
  const [f1, f2] = await Promise.all([
    getFighterStats(fighter1),
    getFighterStats(fighter2),
  ])
  return { f1, f2 }
}
