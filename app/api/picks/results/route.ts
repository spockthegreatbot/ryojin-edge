import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 503, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const sport = url.searchParams.get("sport");
  const market = url.searchParams.get("market");
  const tier = url.searchParams.get("tier");
  const days = parseInt(url.searchParams.get("days") ?? "30", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10), 500);

  const sql = getDb();

  try {
    // Build query with filters
    const rows = await sql`
      SELECT * FROM pick_results
      WHERE created_at > NOW() - INTERVAL '1 day' * ${days}
      ${sport ? sql`AND sport = ${sport}` : sql``}
      ${market ? sql`AND LOWER(market) LIKE ${"%" + market.toLowerCase() + "%"}` : sql``}
      ${tier ? sql`AND tier = ${tier}` : sql``}
      ORDER BY kickoff DESC NULLS LAST, created_at DESC
      LIMIT ${limit}
    `;

    // Calculate summary stats
    const allSettled = rows.filter((r: Record<string, unknown>) => r.result === "hit" || r.result === "miss");
    const hits = allSettled.filter((r: Record<string, unknown>) => r.result === "hit").length;
    const misses = allSettled.filter((r: Record<string, unknown>) => r.result === "miss").length;
    const pending = rows.filter((r: Record<string, unknown>) => r.result === "pending").length;
    const voided = rows.filter((r: Record<string, unknown>) => r.result === "void").length;

    // Stats by market
    const marketStats: Record<string, { total: number; hits: number }> = {};
    for (const r of allSettled) {
      const m = (r as Record<string, unknown>).market as string;
      if (!marketStats[m]) marketStats[m] = { total: 0, hits: 0 };
      marketStats[m].total++;
      if ((r as Record<string, unknown>).result === "hit") marketStats[m].hits++;
    }

    // Stats by tier
    const tierStats: Record<string, { total: number; hits: number }> = {};
    for (const r of allSettled) {
      const t = ((r as Record<string, unknown>).tier as string) ?? "Unknown";
      if (!tierStats[t]) tierStats[t] = { total: 0, hits: 0 };
      tierStats[t].total++;
      if ((r as Record<string, unknown>).result === "hit") tierStats[t].hits++;
    }

    // Stats by sport
    const sportStats: Record<string, { total: number; hits: number }> = {};
    for (const r of allSettled) {
      const s = ((r as Record<string, unknown>).sport as string) ?? "soccer";
      if (!sportStats[s]) sportStats[s] = { total: 0, hits: 0 };
      sportStats[s].total++;
      if ((r as Record<string, unknown>).result === "hit") sportStats[s].hits++;
    }

    // Parlay combos — find 2-leg and 3-leg same-day combos that would have hit
    const parlayResults = calculateParlayResults(rows as PickRow[]);

    return NextResponse.json({
      results: rows,
      summary: {
        total: rows.length,
        hits,
        misses,
        pending,
        voided,
        hitRate: allSettled.length > 0 ? Math.round((hits / allSettled.length) * 100) : null,
      },
      byMarket: Object.entries(marketStats).map(([m, s]) => ({
        market: m,
        total: s.total,
        hits: s.hits,
        hitRate: Math.round((s.hits / s.total) * 100),
      })),
      byTier: Object.entries(tierStats).map(([t, s]) => ({
        tier: t,
        total: s.total,
        hits: s.hits,
        hitRate: Math.round((s.hits / s.total) * 100),
      })),
      bySport: Object.entries(sportStats).map(([sp, s]) => ({
        sport: sp,
        total: s.total,
        hits: s.hits,
        hitRate: Math.round((s.hits / s.total) * 100),
      })),
      parlayResults,
    }, { headers: CORS_HEADERS });
  } catch (e) {
    console.error("[results] Error:", e);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500, headers: CORS_HEADERS });
  }
}

interface PickRow {
  id: number;
  match_id: string;
  match_name: string;
  market: string;
  pick: string;
  odds: number | null;
  result: string;
  kickoff: string;
}

function calculateParlayResults(rows: PickRow[]) {
  // Group settled picks by date
  const hitsByDate: Record<string, PickRow[]> = {};
  for (const r of rows) {
    if (r.result !== "hit" || !r.kickoff) continue;
    const date = new Date(r.kickoff).toISOString().split("T")[0];
    if (!hitsByDate[date]) hitsByDate[date] = [];
    hitsByDate[date].push(r);
  }

  const parlays: { legs: number; date: string; picks: string[]; combinedOdds: number }[] = [];

  for (const [date, hits] of Object.entries(hitsByDate)) {
    // 2-leg combos (limit to first 10 to avoid explosion)
    const limited = hits.slice(0, 10);
    for (let i = 0; i < limited.length; i++) {
      for (let j = i + 1; j < limited.length; j++) {
        const odds1 = limited[i].odds ?? 1.5;
        const odds2 = limited[j].odds ?? 1.5;
        parlays.push({
          legs: 2,
          date,
          picks: [
            `${limited[i].match_name}: ${limited[i].pick}`,
            `${limited[j].match_name}: ${limited[j].pick}`,
          ],
          combinedOdds: Math.round(odds1 * odds2 * 100) / 100,
        });
      }
    }

    // 3-leg combos (limit to first 6)
    const limited3 = hits.slice(0, 6);
    for (let i = 0; i < limited3.length; i++) {
      for (let j = i + 1; j < limited3.length; j++) {
        for (let k = j + 1; k < limited3.length; k++) {
          const o1 = limited3[i].odds ?? 1.5;
          const o2 = limited3[j].odds ?? 1.5;
          const o3 = limited3[k].odds ?? 1.5;
          parlays.push({
            legs: 3,
            date,
            picks: [
              `${limited3[i].match_name}: ${limited3[i].pick}`,
              `${limited3[j].match_name}: ${limited3[j].pick}`,
              `${limited3[k].match_name}: ${limited3[k].pick}`,
            ],
            combinedOdds: Math.round(o1 * o2 * o3 * 100) / 100,
          });
        }
      }
    }
  }

  // Sort by combined odds descending, limit to top 20
  parlays.sort((a, b) => b.combinedOdds - a.combinedOdds);
  return parlays.slice(0, 20);
}
