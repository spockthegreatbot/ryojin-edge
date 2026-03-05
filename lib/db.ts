import { neon } from '@neondatabase/serverless';

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  return neon(process.env.DATABASE_URL);
}

export async function initSchema() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS picks (
      id SERIAL PRIMARY KEY,
      match_id TEXT NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      league TEXT NOT NULL,
      sport TEXT NOT NULL,
      kickoff TIMESTAMPTZ NOT NULL,
      market TEXT NOT NULL,
      pick TEXT NOT NULL,
      edge FLOAT NOT NULL,
      model_prob FLOAT,
      market_prob FLOAT,
      odds FLOAT,
      tier TEXT,
      kelly TEXT,
      recorded_at TIMESTAMPTZ DEFAULT NOW(),
      outcome TEXT DEFAULT NULL,
      resolved_at TIMESTAMPTZ DEFAULT NULL,
      api_fixture_id TEXT DEFAULT NULL,
      UNIQUE(match_id, market, pick)
    )
  `;

  // Feature 5: CLV tracking columns (safe to run multiple times)
  try {
    await sql`ALTER TABLE picks ADD COLUMN IF NOT EXISTS opening_odds FLOAT`;
    await sql`ALTER TABLE picks ADD COLUMN IF NOT EXISTS closing_odds FLOAT`;
    await sql`ALTER TABLE picks ADD COLUMN IF NOT EXISTS clv FLOAT`;
  } catch {
    // Columns may already exist — ignore
  }
}

/**
 * Feature 5: Update closing odds + CLV for a pick.
 * CLV = (opening_odds / closing_odds - 1) * 100
 * Positive CLV = we got better odds than market closed at = real edge.
 */
export async function updateClosingOdds(
  matchId: string,
  market: string,
  pick: string,
  closingOdds: number
): Promise<void> {
  const sql = getDb();
  // Fetch the opening_odds (the odds recorded when the pick was saved)
  const rows = await sql`
    SELECT id, odds, opening_odds FROM picks
    WHERE match_id = ${matchId}
      AND market = ${market}
      AND pick = ${pick}
    LIMIT 1
  `;

  if (!rows.length) return;

  const row = rows[0] as { id: number; odds: number | null; opening_odds: number | null };
  const openingOdds = row.opening_odds ?? row.odds; // fall back to recorded odds
  const clv = openingOdds && closingOdds > 1
    ? parseFloat(((openingOdds / closingOdds - 1) * 100).toFixed(2))
    : null;

  await sql`
    UPDATE picks
    SET closing_odds = ${closingOdds},
        clv = ${clv},
        opening_odds = COALESCE(opening_odds, odds)
    WHERE id = ${row.id}
  `;
}
