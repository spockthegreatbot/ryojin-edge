import { NextResponse } from "next/server";

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
    const title =
      item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
      item.match(/<title>(.*?)<\/title>/)?.[1] ??
      "";
    const link =
      item.match(/<link>(.*?)<\/link>/)?.[1] ??
      item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] ??
      "";
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
    const description =
      item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ??
      item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ??
      "";

    const sourceMatch =
      item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] ??
      item.match(/- ([\w\s]+)$/m)?.[1] ??
      "News";

    const snippet = description.replace(/<[^>]+>/g, "").slice(0, 160).trim();

    if (title && link) {
      items.push({
        title: title
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'"),
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
  req: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const { searchParams } = new URL(req.url);
  const home = searchParams.get("home") ?? "";
  const away = searchParams.get("away") ?? "";
  const league = searchParams.get("league") ?? "";

  // Build search queries from the team names passed as query params
  const queries: string[] = [];
  if (home && away) {
    queries.push(`${home} vs ${away}`);
    queries.push(`${home} ${away}`);
  }
  if (home && league) {
    queries.push(`${home} ${league}`);
  }
  // Fallback: use matchId as-is if no team params provided
  if (queries.length === 0) {
    queries.push(matchId.replace(/-/g, " "));
  }

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
      // Silent fail — news is best-effort
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
