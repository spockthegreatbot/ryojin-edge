import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export async function POST(req: NextRequest) {
  const secret = process.env.API_SECRET;
  if (secret && req.headers.get('x-api-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!)
  const { pickId, closingOdds } = await req.json()
  if (!pickId || !closingOdds) return NextResponse.json({ error: 'missing params' }, { status: 400 })

  const picks = await sql`SELECT odds FROM picks WHERE id = ${pickId}` as { odds: number }[]
  if (!picks.length) return NextResponse.json({ error: 'pick not found' }, { status: 404 })

  const openingOdds = picks[0].odds
  // CLV = ((closing_odds / opening_odds) - 1) * 100  (percentage, positive = we had value)
  const clv = openingOdds && closingOdds ? (((closingOdds / openingOdds) - 1) * 100) : null

  await sql`
    UPDATE picks
    SET closing_odds = ${closingOdds}, clv = ${clv}, updated_at = NOW()
    WHERE id = ${pickId}
  `

  return NextResponse.json({ success: true, clv })
}
