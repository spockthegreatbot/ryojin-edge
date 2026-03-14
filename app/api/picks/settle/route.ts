import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Auto-settle pick results.
 * For each pending pick where kickoff < now - 3 hours:
 *   - Fetch actual match result from API-Sports
 *   - Compare to pick → mark as 'hit' or 'miss'
 *   - Store actual_score and actual_value
 * Run via VPS cron every 2 hours: curl https://topbets-dev.vercel.app/api/picks/settle
 */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 503 });
  }

  const API_KEY = process.env.API_SPORTS_KEY;
  if (!API_KEY) {
    return NextResponse.json({ error: "API_SPORTS_KEY not set" }, { status: 503 });
  }

  const sql = getDb();

  // Get unresolved picks with kickoff > 3h ago
  const pending = await sql`
    SELECT * FROM pick_results
    WHERE result = 'pending'
    AND kickoff < NOW() - INTERVAL '3 hours'
    AND kickoff > NOW() - INTERVAL '7 days'
    LIMIT 30
  `;

  let settled = 0;
  let errors = 0;

  for (const pick of pending) {
    try {
      // Extract fixture ID from match_id (format: "apisports-12345")
      const fixtureId = pick.match_id.startsWith("apisports-")
        ? pick.match_id.replace("apisports-", "")
        : null;

      if (!fixtureId) continue; // Can't resolve non-API-Sports IDs

      const res = await fetch(
        `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`,
        { headers: { "x-apisports-key": API_KEY } }
      );
      const data = await res.json();
      const fixture = data.response?.[0];

      if (!fixture) continue;

      const status = fixture.fixture?.status?.short;
      if (!["FT", "AET", "PEN"].includes(status)) continue; // Not finished

      const homeGoals: number = fixture.goals?.home ?? 0;
      const awayGoals: number = fixture.goals?.away ?? 0;
      const totalGoals = homeGoals + awayGoals;
      const actualScore = `${homeGoals}-${awayGoals}`;
      const htHome = fixture.score?.halftime?.home ?? null;
      const htAway = fixture.score?.halftime?.away ?? null;

      const market = pick.market.toLowerCase();
      const pickVal = pick.pick.toLowerCase();
      let result: "hit" | "miss" | "void" = "miss";
      let actualValue = "";

      // ── Match Result ──
      if (market.includes("match result") || market.includes("1x2") || market.includes("winner")) {
        if (homeGoals > awayGoals) actualValue = "Home Win";
        else if (awayGoals > homeGoals) actualValue = "Away Win";
        else actualValue = "Draw";

        if (pickVal.includes("home") || pickVal.includes(pick.match_name.split(" vs ")[0]?.toLowerCase() ?? "")) {
          result = homeGoals > awayGoals ? "hit" : "miss";
        } else if (pickVal.includes("away") || pickVal.includes(pick.match_name.split(" vs ")[1]?.toLowerCase() ?? "")) {
          result = awayGoals > homeGoals ? "hit" : "miss";
        } else if (pickVal.includes("draw")) {
          result = homeGoals === awayGoals ? "hit" : "miss";
        }
      }
      // ── Double Chance ──
      else if (market.includes("double chance")) {
        const homeWin = homeGoals > awayGoals;
        const awayWin = awayGoals > homeGoals;
        const draw = homeGoals === awayGoals;
        actualValue = homeWin ? "Home Win" : awayWin ? "Away Win" : "Draw";

        if (pickVal.includes("home or draw")) result = homeWin || draw ? "hit" : "miss";
        else if (pickVal.includes("away or draw")) result = awayWin || draw ? "hit" : "miss";
        else if (pickVal.includes("either team wins")) result = homeWin || awayWin ? "hit" : "miss";
      }
      // ── First Half Goals ──
      else if (market.includes("first half")) {
        if (htHome !== null && htAway !== null) {
          const htTotal = htHome + htAway;
          actualValue = `HT: ${htHome}-${htAway}`;
          const lineMatch = pickVal.match(/(\d+\.?\d*)/);
          const line = lineMatch ? parseFloat(lineMatch[1]) : 1.5;
          if (pickVal.includes("over")) result = htTotal > line ? "hit" : "miss";
          else result = htTotal < line ? "hit" : "miss";
        } else {
          result = "void";
          actualValue = "HT score unavailable";
        }
      }
      // ── Total Goals (Over/Under) ──
      else if (market.includes("total goals")) {
        actualValue = `${totalGoals} goals`;
        const lineMatch = pickVal.match(/(\d+\.?\d*)/);
        const line = lineMatch ? parseFloat(lineMatch[1]) : 2.5;
        if (pickVal.includes("over")) result = totalGoals > line ? "hit" : "miss";
        else result = totalGoals < line ? "hit" : "miss";
      }
      // ── BTTS ──
      else if (market.includes("btts") || market.includes("both teams")) {
        const btts = homeGoals > 0 && awayGoals > 0;
        actualValue = btts ? "Yes" : "No";
        result = pickVal.includes("yes") ? (btts ? "hit" : "miss") : (!btts ? "hit" : "miss");
      }
      // ── Clean Sheet ──
      else if (market.includes("clean sheet")) {
        const homeName = pick.match_name.split(" vs ")[0]?.toLowerCase() ?? "";
        if (pickVal.includes(homeName)) {
          actualValue = awayGoals === 0 ? "Yes" : "No";
          result = awayGoals === 0 ? "hit" : "miss";
        } else {
          actualValue = homeGoals === 0 ? "Yes" : "No";
          result = homeGoals === 0 ? "hit" : "miss";
        }
      }
      // ── Corners (need fixture statistics) ──
      else if (market.includes("corner")) {
        try {
          const statsRes = await fetch(
            `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`,
            { headers: { "x-apisports-key": API_KEY } }
          );
          const statsData = await statsRes.json();
          const statsArr = statsData.response ?? [];
          let totalCorners = 0;
          for (const teamStats of statsArr) {
            for (const stat of (teamStats.statistics ?? [])) {
              if (stat.type === "Corner Kicks") {
                totalCorners += parseInt(stat.value ?? "0", 10);
              }
            }
          }
          actualValue = `${totalCorners} corners`;
          const lineMatch = pickVal.match(/(\d+\.?\d*)/);
          const line = lineMatch ? parseFloat(lineMatch[1]) : 9.5;
          if (pickVal.includes("over")) result = totalCorners > line ? "hit" : "miss";
          else result = totalCorners < line ? "hit" : "miss";
        } catch {
          result = "void";
          actualValue = "Corner data unavailable";
        }
      }
      // ── Cards ──
      else if (market.includes("card")) {
        try {
          const statsRes = await fetch(
            `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`,
            { headers: { "x-apisports-key": API_KEY } }
          );
          const statsData = await statsRes.json();
          const statsArr = statsData.response ?? [];
          let totalCards = 0;
          for (const teamStats of statsArr) {
            for (const stat of (teamStats.statistics ?? [])) {
              if (stat.type === "Yellow Cards" || stat.type === "Red Cards") {
                totalCards += parseInt(stat.value ?? "0", 10);
              }
            }
          }
          actualValue = `${totalCards} cards`;
          const lineMatch = pickVal.match(/(\d+\.?\d*)/);
          const line = lineMatch ? parseFloat(lineMatch[1]) : 3.5;
          if (pickVal.includes("over")) result = totalCards > line ? "hit" : "miss";
          else result = totalCards < line ? "hit" : "miss";
        } catch {
          result = "void";
          actualValue = "Card data unavailable";
        }
      }

      // Update the pick_results row
      await sql`
        UPDATE pick_results
        SET result = ${result},
            actual_score = ${actualScore},
            actual_value = ${actualValue},
            settled_at = NOW()
        WHERE id = ${pick.id}
      `;
      settled++;
    } catch (e) {
      console.error("[settle] Error for pick", pick.id, e);
      errors++;
    }
  }

  return NextResponse.json({
    settled,
    checked: pending.length,
    errors,
    timestamp: new Date().toISOString(),
  });
}
