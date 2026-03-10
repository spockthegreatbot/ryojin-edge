import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const API_SPORTS_KEY = process.env.API_SPORTS_KEY!

// Fetch match result from API-Sports by fixture ID
async function getFixtureResult(fixtureId: number): Promise<{ homeGoals: number; awayGoals: number; status: string } | null> {
  try {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
      headers: { 'x-apisports-key': API_SPORTS_KEY }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    const fix = data.response?.[0]
    if (!fix) return null
    return {
      homeGoals: fix.goals.home ?? 0,
      awayGoals: fix.goals.away ?? 0,
      status: fix.fixture.status.short,  // FT, HT, NS, etc.
    }
  } catch { return null }
}

interface PickRow { id: number; market: string; pick: string; match: string; odds: number; stake: number; fixture_id: number | null }

// Resolve a single pick outcome based on market type + result
function resolveOutcome(pick: PickRow, homeGoals: number, awayGoals: number): 'win' | 'loss' | 'push' | null {
  const market = pick.market?.toLowerCase() ?? ''
  const selection = pick.pick?.toLowerCase() ?? ''

  if (market.includes('match result') || market.includes('1x2')) {
    if (homeGoals > awayGoals && selection.includes('home')) return 'win'
    if (awayGoals > homeGoals && selection.includes('away')) return 'win'
    if (homeGoals === awayGoals && selection.includes('draw')) return 'win'
    return 'loss'
  }

  if (market.includes('btts') || market.includes('both teams')) {
    const btts = homeGoals > 0 && awayGoals > 0
    if (selection.includes('yes') && btts) return 'win'
    if (selection.includes('no') && !btts) return 'win'
    return 'loss'
  }

  if (market.includes('over') || market.includes('under')) {
    const total = homeGoals + awayGoals
    const lineMatch = market.match(/(\d+\.?\d*)/)
    const line = lineMatch ? parseFloat(lineMatch[1]) : 2.5
    if (selection.includes('over') && total > line) return 'win'
    if (selection.includes('under') && total < line) return 'win'
    if (total === line) return 'push'
    return 'loss'
  }

  return null  // unknown market — can't resolve
}

export async function GET(req: NextRequest) {
  // Vercel cron protection
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET ?? 'topbet-cron'}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sql = neon(process.env.DATABASE_URL!)

  // Get all pending picks where kickoff was > 2 hours ago
  const pending = await sql`
    SELECT * FROM picks
    WHERE outcome IS NULL
      AND kickoff IS NOT NULL
      AND kickoff < NOW() - INTERVAL '2 hours'
    LIMIT 50
  ` as PickRow[]

  const results = []

  for (const pick of pending) {
    if (!pick.fixture_id) {
      // No fixture ID stored — try to resolve by match name + date
      results.push({ id: pick.id, status: 'no_fixture_id' })
      continue
    }

    const result = await getFixtureResult(pick.fixture_id)
    if (!result || result.status !== 'FT') {
      results.push({ id: pick.id, status: 'not_finished', matchStatus: result?.status })
      continue
    }

    const outcome = resolveOutcome(pick, result.homeGoals, result.awayGoals)
    if (!outcome) {
      results.push({ id: pick.id, status: 'unknown_market' })
      continue
    }

    // Calculate result (profit/loss in units)
    const stake = pick.stake ?? 10
    const resultValue = outcome === 'win' ? (pick.odds - 1) * stake
      : outcome === 'loss' ? -stake
      : 0

    await sql`
      UPDATE picks
      SET outcome = ${outcome}, result = ${resultValue}, updated_at = NOW()
      WHERE id = ${pick.id}
    `

    results.push({ id: pick.id, match: pick.match, outcome, result: resultValue })
  }

  return NextResponse.json({ resolved: results.length, results })
}
