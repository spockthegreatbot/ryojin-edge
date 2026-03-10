import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export async function POST(req: NextRequest) {
  const sql = neon(process.env.DATABASE_URL!)
  const { pickId, closingOdds } = await req.json()
  if (!pickId || !closingOdds) return NextResponse.json({ error: 'missing params' }, { status: 400 })

  const picks = await sql`SELECT odds FROM picks WHERE id = ${pickId}` as { odds: number }[]
  if (!picks.length) return NextResponse.json({ error: 'pick not found' }, { status: 404 })

  const openingOdds = picks[0].odds
  // CLV = how much better our odds were vs closing
  const clv = openingOdds && closingOdds ? ((openingOdds / closingOdds - 1) * 100) : null

  await sql`
    UPDATE picks
    SET closing_odds = ${closingOdds}, clv = ${clv}, updated_at = NOW()
    WHERE id = ${pickId}
  `

  return NextResponse.json({ success: true, clv })
}
