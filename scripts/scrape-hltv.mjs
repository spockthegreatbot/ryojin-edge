#!/usr/bin/env node
// HLTV Scraper — Playwright headless with stealth
// Scrapes rankings + upcoming matches, saves to /tmp/hltv-data.json

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const OUTPUT_PATH = '/tmp/hltv-data.json';

async function createStealthBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  return { browser, ctx, page };
}

// ─── Rankings ────────────────────────────────────────────────────────────────
async function scrapeRankings(page) {
  console.log('[hltv] Scraping rankings...');
  await page.goto('https://www.hltv.org/ranking/teams', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForSelector('.ranked-team', { timeout: 15000 });

  const rankings = await page.$$eval('.ranked-team', (rows) => {
    return rows.slice(0, 30).map((row) => {
      const posEl = row.querySelector('.position');
      const nameEl = row.querySelector('.name');
      const pointsEl = row.querySelector('.points');

      const rank = posEl
        ? parseInt(posEl.textContent.replace('#', '').trim(), 10)
        : 0;
      const name = nameEl ? nameEl.textContent.trim() : 'Unknown';
      const pointsText = pointsEl ? pointsEl.textContent.trim() : '0';
      const pointsMatch = pointsText.match(/(\d+)/);
      const points = pointsMatch ? parseInt(pointsMatch[1], 10) : 0;

      return { rank, name, points };
    });
  });

  console.log(`[hltv] Got ${rankings.length} ranked teams`);
  return rankings;
}

// ─── Matches ─────────────────────────────────────────────────────────────────
async function scrapeMatches(page) {
  console.log('[hltv] Scraping upcoming matches...');
  await page.goto('https://www.hltv.org/matches', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Wait for match elements
  try {
    await page.waitForSelector('.match-bottom', { timeout: 15000 });
  } catch {
    console.warn('[hltv] No .match-bottom found after 15s');
    await page.waitForTimeout(3000);
  }

  // The page has nested .match divs. We target .match-bottom which contains
  // match-info (time, format) and match-teams (team names).
  // The parent .match or sibling .match-top has event info.
  const matches = await page.evaluate(() => {
    const results = [];
    // Get all match-bottom elements (each represents one match row)
    const bottomEls = document.querySelectorAll('.match-bottom');

    for (const bottom of bottomEls) {
      // Team names
      const teamNameEls = bottom.querySelectorAll('.match-teamname');
      const team1 = teamNameEls[0]?.textContent?.trim() || '';
      const team2 = teamNameEls[1]?.textContent?.trim() || '';

      // Skip if missing teams or TBD
      if (!team1 || !team2) continue;
      if (team1.includes('winner') || team2.includes('winner')) continue;
      if (team1 === 'TBD' || team2 === 'TBD') continue;

      // Format (bo1, bo3, bo5)
      const metaEls = bottom.querySelectorAll('.match-meta');
      let format = 'BO3';
      for (const m of metaEls) {
        const txt = m.textContent.trim().toLowerCase();
        if (txt.startsWith('bo')) {
          format = txt.toUpperCase();
        }
      }

      // Time from data-unix attribute
      const timeEl = bottom.querySelector('.match-time[data-unix]');
      let time = '';
      if (timeEl) {
        const unix = parseInt(timeEl.getAttribute('data-unix'), 10);
        if (unix) {
          const d = new Date(unix);
          time = d.toISOString().replace('T', ' ').substring(0, 16);
        }
      }

      // Check if live
      const isLive = !!bottom.querySelector('.match-meta-live');

      // Event name — from sibling .match-top or parent's data attribute
      let event = '';
      const parent = bottom.parentElement;
      if (parent) {
        const eventEl = parent.querySelector('.match-event[data-event-headline]');
        if (eventEl) {
          event = eventEl.getAttribute('data-event-headline') || '';
        }
      }

      // Stars — count from the match-top link classes or star elements
      let stars = 0;
      if (parent) {
        const topLink = parent.querySelector('.match-top');
        if (topLink && !topLink.classList.contains('without-stars')) {
          const starEls = topLink.querySelectorAll('.star');
          stars = starEls.length;
        }
      }

      results.push({ team1, team2, event, time, format, stars, isLive });
    }

    return results;
  });

  // Deduplicate — HLTV shows matches in both "by event" and "by time" views
  const seen = new Set();
  const deduped = [];
  for (const m of matches) {
    const key = `${m.team1}|${m.team2}|${m.time}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(m);
    }
  }

  // Separate live and upcoming
  const live = deduped.filter((m) => m.isLive);
  const upcoming = deduped.filter((m) => !m.isLive);

  console.log(
    `[hltv] Got ${upcoming.length} upcoming + ${live.length} live matches (${matches.length} raw, ${deduped.length} deduped)`
  );

  // Remove isLive from output, return upcoming first then live
  return [...upcoming, ...live].map(({ isLive, ...rest }) => rest);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log(`[hltv] Scraper starting at ${new Date().toISOString()}`);

  const { browser, page } = await createStealthBrowser();

  try {
    const rankings = await scrapeRankings(page);
    const matches = await scrapeMatches(page);

    const data = {
      rankings,
      matches,
      scraped_at: new Date().toISOString(),
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[hltv] Saved to ${OUTPUT_PATH} in ${elapsed}s`);
    console.log(`[hltv] Rankings: ${rankings.length}, Matches: ${matches.length}`);
  } catch (err) {
    console.error('[hltv] Scraper error:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
