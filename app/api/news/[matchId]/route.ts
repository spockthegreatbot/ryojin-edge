import { NextResponse } from "next/server";
import { MOCK_MATCHES } from "@/lib/mock-data";

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  pubDate: string;
  snippet: string;
}

function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

  for (const item of itemMatches.slice(0, 6)) {
    const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      ?? item.match(/<title>(.*?)<\/title>/)?.[1]
      ?? "";
    const link = item.match(/<link>(.*?)<\/link>/)?.[1]
      ?? item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]
      ?? "";
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
    const description = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
      ?? item.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      ?? "";

    // Extract source from Google News URL or description
    const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1]
      ?? item.match(/- ([\w\s]+)$/m)?.[1]
      ?? "News";

    // Strip HTML from description
    const snippet = description.replace(/<[^>]+>/g, "").slice(0, 160).trim();

    if (title && link) {
      items.push({
        title: title.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
        url: link,
        source: sourceMatch.trim(),
        pubDate,
        snippet,
      });
    }
  }

  return items;
}

export async function GET(
  _req: Request,
  { params }: { params: { matchId: string } }
) {
  const match = MOCK_MATCHES.find((m) => m.id === params.matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const queries = [
    `${match.homeTeam} ${match.awayTeam}`,
    `${match.homeTeam} ${match.league}`,
  ];

  const allItems: NewsItem[] = [];

  for (const query of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-AU&gl=AU&ceid=AU:en`;
      const res = await fetch(url, {
        next: { revalidate: 1800 }, // 30 min cache
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RyojinEdge/1.0)",
        },
      });

      if (res.ok) {
        const xml = await res.text();
        const items = parseRSS(xml);
        allItems.push(...items);
      }
    } catch {
      // Silent fail
    }
    if (allItems.length >= 5) break;
  }

  // Dedupe by title
  const seen = new Set<string>();
  const unique = allItems.filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  });

  return NextResponse.json(unique.slice(0, 6));
}
