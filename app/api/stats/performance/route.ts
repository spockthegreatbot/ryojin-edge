import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlRow = Record<string, any>

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!)

  // By sport
  const bySport = await sql`
    SELECT
      sport,
      COUNT(*) as total,
      SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) as pending,
      ROUND(SUM(COALESCE(result, 0))::numeric, 2) as pnl,
      ROUND(SUM(COALESCE(stake, 10))::numeric, 2) as staked,
      ROUND(AVG(closing_odds)::numeric, 4) as avg_closing_odds,
      ROUND(AVG(clv)::numeric, 4) as avg_clv
    FROM picks
    WHERE sport IS NOT NULL
    GROUP BY sport
    ORDER BY total DESC
  ` as SqlRow[]

  // By market
  const byMarket = await sql`
    SELECT
      market,
      COUNT(*) as total,
      SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) as pending,
      ROUND(SUM(COALESCE(result, 0))::numeric, 2) as pnl,
      ROUND(SUM(COALESCE(stake, 10))::numeric, 2) as staked,
      ROUND(AVG(closing_odds)::numeric, 4) as avg_closing_odds,
      ROUND(AVG(clv)::numeric, 4) as avg_clv
    FROM picks
    GROUP BY market
    ORDER BY total DESC
    LIMIT 10
  ` as SqlRow[]

  // By edge tier
  const byEdge = await sql`
    SELECT
      CASE
        WHEN edge >= 0.20 THEN '20%+'
        WHEN edge >= 0.15 THEN '15-20%'
        WHEN edge >= 0.10 THEN '10-15%'
        ELSE '6-10%'
      END as tier,
      COUNT(*) as total,
      SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END) as pending,
      ROUND(SUM(COALESCE(result, 0))::numeric, 2) as pnl,
      ROUND(SUM(COALESCE(stake, 10))::numeric, 2) as staked,
      ROUND(AVG(closing_odds)::numeric, 4) as avg_closing_odds,
      ROUND(AVG(clv)::numeric, 4) as avg_clv
    FROM picks
    WHERE edge IS NOT NULL
    GROUP BY tier
    ORDER BY MIN(edge) DESC
  ` as SqlRow[]

  // CLV summary (if data exists)
  const clvSummary = await sql`
    SELECT
      COUNT(*) as with_clv,
      ROUND(AVG(clv)::numeric, 2) as avg_clv,
      SUM(CASE WHEN clv > 0 THEN 1 ELSE 0 END) as beat_closing
    FROM picks
    WHERE clv IS NOT NULL
  ` as SqlRow[]

  return NextResponse.json({ bySport, byMarket, byEdge, clvSummary: clvSummary[0] })
}
