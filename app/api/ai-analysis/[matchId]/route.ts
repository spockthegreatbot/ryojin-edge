import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface MatchInput {
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds?: number;
  homeForm?: string[];
  awayForm?: string[];
  h2hHomeWins?: number;
  h2hTotal?: number;
  goalsAvgHome?: number;
  goalsAvgAway?: number;
  xgHome?: number;
  xgAway?: number;
  bttsProb?: number;
  homeElo?: number;
  awayElo?: number;
  homeTablePos?: number;
  awayTablePos?: number;
  referee?: string | null;
  weather?: { description?: string; tempC?: number } | null;
  homeInjuries?: { name: string; status: string; tier: string; ppg: number }[];
  awayInjuries?: { name: string; status: string; tier: string; ppg: number }[];
  homeOnBackToBack?: boolean;
  awayOnBackToBack?: boolean;
  homeRecord?: { wins: number; losses: number; winPct: number; homeWinPct: number } | null;
  awayRecord?: { wins: number; losses: number; winPct: number } | null;
  totalLine?: number;
  // Edge model output
  bets?: { market: string; pick: string; edge: number; modelProb: number; marketProb: number; odds?: number; value: boolean; confidence: number; tier: string }[];
  score?: number;
}

function deVig(a: number, b: number, c?: number): number[] {
  const odds = c ? [a, b, c] : [a, b];
  const implied = odds.map(o => 1 / o);
  const sum = implied.reduce((s, v) => s + v, 0);
  return implied.map(v => v / sum);
}

function formatPct(n: number) { return `${Math.round(n * 100)}%`; }

async function fetchNewsContext(home: string, away: string, league: string): Promise<string> {
  try {
    const queries = [
      `${home} vs ${away} ${league} prediction`,
      `${home} injury lineup`,
      `${away} injury lineup`,
    ];
    const newsItems: string[] = [];

    for (const q of queries.slice(0, 2)) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-AU&gl=AU&ceid=AU:en`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
      for (const item of items.slice(0, 3)) {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? item.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
        const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] ?? "";
        const date = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
        if (title) newsItems.push(`• ${title} [${source}] ${date ? `(${new Date(date).toLocaleDateString("en-AU", { month: "short", day: "numeric" })})` : ""}`);
      }
    }

    return newsItems.slice(0, 6).join("\n") || "No recent news found.";
  } catch {
    return "News unavailable.";
  }
}

function buildPrompt(m: MatchInput, news: string): string {
  const probs = deVig(m.homeOdds, m.awayOdds, m.drawOdds);
  const homeProb = probs[0];
  const awayProb = m.drawOdds ? probs[2] : probs[1];
  const drawProb = m.drawOdds ? probs[1] : undefined;

  const topBet = m.bets?.find(b => b.value) ?? m.bets?.[0];
  const modelEdge = topBet ? `${topBet.pick} @ ${topBet.odds?.toFixed(2) ?? "—"} — model edge +${Math.round(topBet.edge * 100)}%` : "No clear edge found by model";

  const injuryBlock = (() => {
    const lines: string[] = [];
    const significant = (list: typeof m.homeInjuries, team: string) =>
      (list ?? []).filter(p => p.status === "Out" || p.status === "Doubtful")
        .map(p => `  - ${team}: ${p.name} ${p.status} (${p.tier}, ${p.ppg.toFixed(0)} PPG)`);
    lines.push(...significant(m.homeInjuries, m.homeTeam));
    lines.push(...significant(m.awayInjuries, m.awayTeam));
    return lines.length ? `Injuries:\n${lines.join("\n")}` : "Injuries: None reported";
  })();

  const b2bBlock = [
    m.homeOnBackToBack ? `${m.homeTeam} on back-to-back (played yesterday)` : "",
    m.awayOnBackToBack ? `${m.awayTeam} on back-to-back (played yesterday)` : "",
  ].filter(Boolean).join(", ") || "No back-to-back fatigue";

  const formBlock = m.sport === "soccer"
    ? `Form — ${m.homeTeam} last 5: ${m.homeForm?.join("") || "—"} | ${m.awayTeam} last 5: ${m.awayForm?.join("") || "—"}`
    : `L10 — ${m.homeTeam}: ${m.homeRecord ? `${m.homeRecord.wins}W-${m.homeRecord.losses}L (${formatPct(m.homeRecord.winPct)})` : m.homeForm?.join("") || "—"} | ${m.awayTeam}: ${m.awayRecord ? `${m.awayRecord.wins}W-${m.awayRecord.losses}L (${formatPct(m.awayRecord.winPct)})` : m.awayForm?.join("") || "—"}`;

  const statsBlock = m.sport === "soccer"
    ? [
      m.xgHome || m.goalsAvgHome ? `xG/Goals avg: ${m.homeTeam} ${(m.xgHome || m.goalsAvgHome)?.toFixed(2)} | ${m.awayTeam} ${(m.xgAway || m.goalsAvgAway)?.toFixed(2)}` : "",
      m.h2hTotal ? `H2H: ${m.homeTeam} won ${m.h2hHomeWins}/${m.h2hTotal} meetings` : "",
      m.homeTablePos && m.awayTablePos ? `Table: ${m.homeTeam} P${m.homeTablePos} | ${m.awayTeam} P${m.awayTablePos}` : "",
      m.bttsProb ? `BTTS probability: ${m.bttsProb}%` : "",
      m.homeElo && m.awayElo ? `Elo: ${m.homeTeam} ${m.homeElo} | ${m.awayTeam} ${m.awayElo}` : "",
      m.referee ? `Referee: ${m.referee}` : "",
      m.weather?.description ? `Weather: ${m.weather.description} ${m.weather.tempC}°C` : "",
    ].filter(Boolean).join("\n")
    : [
      `Home court: ${m.homeRecord ? `${formatPct(m.homeRecord.homeWinPct)} home win rate` : "—"}`,
      m.totalLine ? `O/U line: ${m.totalLine}` : "",
    ].filter(Boolean).join("\n");

  return `You are a sharp professional sports betting analyst. Your job is to find market inefficiencies — not predict winners.

MATCH: ${m.homeTeam} vs ${m.awayTeam}
COMPETITION: ${m.league}
SPORT: ${m.sport.toUpperCase()}

MARKET ODDS (de-vigged implied probabilities):
- ${m.homeTeam}: ${m.homeOdds.toFixed(2)} (market says ${formatPct(homeProb)})${m.drawOdds ? `\n- Draw: ${m.drawOdds.toFixed(2)} (market says ${formatPct(drawProb!)})` : ""}
- ${m.awayTeam}: ${m.awayOdds.toFixed(2)} (market says ${formatPct(awayProb)})

OUR MODEL OUTPUT:
${modelEdge}
Edge score: ${m.score ?? 0}/100

DATA INPUTS:
${formBlock}
${statsBlock}
${injuryBlock}
Schedule: ${b2bBlock}

RECENT NEWS (last 48-72hrs):
${news}

---
Write 3-4 sentences of sharp betting analysis. Mandatory structure:
1. Is the market correctly priced, or is there a genuine inefficiency? Cite specific numbers.
2. Which data point or news item is the MOST important signal right now?
3. If there's edge, which specific market captures it best (moneyline, spread, totals, BTTS)?
4. One sentence on timing — is there a closing-line risk?

Rules:
- Sound like Bloomberg Terminal, not a tipster site
- Be specific: use odds, percentages, and team names
- If no clear edge exists, say so plainly
- Never hype — cold, analytical, direct
- Max 120 words`;
}

// In-memory cache to avoid re-calling OpenAI within the same deploy instance
const cache = new Map<string, { analysis: string; headline: string; ts: number }>();
const CACHE_TTL = 6 * 3600 * 1000; // 6 hours

export async function POST(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI key not configured" }, { status: 503 });
  }

  const match: MatchInput = await req.json();
  const cacheKey = `${params.matchId}_${match.homeOdds}_${match.awayOdds}`;

  // Serve from cache if fresh
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached);
  }

  // Fetch news context
  const news = await fetchNewsContext(match.homeTeam, match.awayTeam, match.league);

  // Build prompt and call GPT-4o-mini
  const prompt = buildPrompt(match, news);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a sharp sports betting analyst. Cold, precise, data-driven. No hype.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI error:", err);
      return NextResponse.json({ error: "OpenAI request failed" }, { status: 502 });
    }

    const data = await res.json();
    const analysis = data.choices?.[0]?.message?.content?.trim() ?? "Analysis unavailable.";

    // Generate a sharp one-line headline separately
    const headlineRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Based on this analysis, write ONE sharp headline (max 10 words, no quotes): "${analysis}"`,
          },
        ],
        max_tokens: 30,
        temperature: 0.3,
      }),
    });

    const headlineData = await headlineRes.json();
    const headline = headlineData.choices?.[0]?.message?.content?.trim() ?? "";

    const result = { analysis, headline, news: news.split("\n").filter(Boolean).slice(0, 3), ts: Date.now() };
    cache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (e) {
    console.error("AI analysis error:", e);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
