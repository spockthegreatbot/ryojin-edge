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
}
