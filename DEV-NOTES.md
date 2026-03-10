# DEV-NOTES.md — Codebase Audit

**Branch:** `dev/sleep-session`  
**Auditor:** Rook  
**Date:** 2026-03-10  

---

## Bugs Found

### 🔴 BUG-1: CLV Formula Contradiction (CRITICAL — data integrity)

Two different CLV formulas in the codebase produce **opposite signs and different scales**:

- **`lib/db.ts` → `updateClosingOdds()`:**  
  `CLV = (closingOdds / pickOdds) - 1` → decimal, **positive when closing > opening** (line moved AGAINST us)

- **`app/api/picks/close/route.ts` → POST handler:**  
  `CLV = (openingOdds / closingOdds - 1) * 100` → percentage, **positive when opening > closing** (we got BETTER odds)

**Impact:** Any pick updated via the POST `/api/picks/close` endpoint gets CLV with the opposite sign and 100x scale vs picks updated via the resolve route. Historical CLV data in the DB is unreliable.

**Fix:** Standardise on ONE formula. Correct CLV for betting = `(closingOdds / openingOdds) - 1` → positive means closing line shortened (we had value). Apply consistently in both locations. Pick one scale (decimal or percentage) and stick to it.

---

### 🟡 BUG-2: De-vig Destructuring When No Draw Odds

**File:** `lib/bet-analyzer.ts` → `analyzeSoccer()`, lines ~145-148

```ts
const [marketHome, marketDraw, marketAway] = match.drawOdds
  ? deVig(oddsArr)
  : [...deVig([match.homeOdds, match.awayOdds]), 0];
```

When `drawOdds` is falsy, this produces `[marketHome, marketAway, 0]` — the variable named `marketDraw` actually holds the **away** probability, and `marketAway` is `0`.

Later code checks `marketDraw > 0` before adding a Draw suggestion (safe), but `marketAway` being `0` means the Away Win model probability calculation uses `marketAway = 0` in its 35% weight component. Away Win picks will be systematically undervalued when draw odds are missing.

**Fix:** Destructure correctly:
```ts
const [marketHome, marketAway_] = deVig([match.homeOdds, match.awayOdds]);
// marketDraw = 0, marketAway = marketAway_
```

---

### 🟡 BUG-3: Closing Odds Window Never Triggers in Resolve Route

**File:** `app/api/picks/resolve/route.ts`, lines ~25-40

The resolve route fetches picks where `kickoff < NOW() - INTERVAL '2 hours'`. Then it checks:
```ts
const diffMs = kickoffTime - now;
if (diffMs <= 3600000 && diffMs >= -7200000) { ... }
```

Since `kickoff` is always >2h in the past, `diffMs` is always < -7,200,000ms. The condition `diffMs >= -7200000` is borderline and will miss most picks. The closing odds capture window effectively **never fires** for picks resolved more than 2h after kickoff.

**Fix:** Decouple closing odds capture from the resolve route. Run a separate pre-kickoff job (e.g., 5 min before kickoff) to snapshot closing odds, OR remove the time window check and just always try to fetch closing odds during resolution.

---

### 🟡 BUG-4: Elo Draw Approximation Can Go Negative

**File:** `lib/bet-analyzer.ts` → Draw market section

```ts
const eloDrawApprox = Math.max(0.15, 1 - eloWinHome * 1.2 - eloWinAway * 1.0);
```

When `eloWinHome` is high (e.g., 0.75): `1 - 0.9 - 0.25 = -0.15`, clamped to 0.15. The formula is crude — the multipliers (1.2 and 1.0) are asymmetric and don't form a coherent probability model. For extreme Elo gaps, the draw probability is always pinned at the floor.

**Impact:** Low. The draw market is weighted at 20% from Elo anyway. But it means the model never differentiates draws based on Elo for lopsided matches.

---

### 🟢 BUG-5: parlays.ts Summary Has Redundant Strategy Count

**File:** `app/api/parlays/route.ts`, lines ~45-50

```ts
byStrategy: {
  highConfidence: parlays.filter(p => p.strategy === 'best-bets').length,
  ...
  powerParlay: parlays.filter(p => p.strategy === 'best-bets').length, // ← duplicate of highConfidence
  ...
}
```

`powerParlay` counts the same strategy as `highConfidence`. Looks like a copy-paste artifact from when a "power-parlay" strategy existed.

---

## Missing Error Handling

### ERR-1: No Auth on `/api/picks/close` POST Endpoint

Anyone can POST to `/api/picks/close` and overwrite CLV data for any pick. No API key, no auth header check.

**Fix:** Add `API_SECRET` header check or similar guard.

### ERR-2: No Fetch Timeouts Anywhere

`lib/elo.ts`, `lib/understat.ts`, `lib/odds-apisports.ts` — all use bare `fetch()` with no `AbortController` timeout. A slow/hanging upstream API (ClubElo, Understat, API-Sports) will block the request indefinitely.

**Fix:** Wrap all external fetches in a timeout helper:
```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 8000);
const res = await fetch(url, { signal: controller.signal });
clearTimeout(timeout);
```

### ERR-3: `understat.ts` JSON.parse on Regex-Extracted String

`getTeamXG()` does `JSON.parse(raw)` on a string extracted via regex from HTML. If Understat changes their HTML structure, this throws an unhandled exception that bubbles up.

**Fix:** Wrap in try/catch specific to the JSON parse step with a descriptive error.

### ERR-4: Picks Route Self-Fetch Can Circular-Fail

`app/api/picks/route.ts` fetches `${origin}/api/matches` — if `/api/matches` is also down or slow, the picks endpoint returns 502 with no diagnostic info. There's also a risk of circular dependency if matches itself calls picks.

### ERR-5: No Rate Limiting on Resolve Loop

`app/api/picks/resolve/route.ts` fires up to 20 API-Sports calls in a tight loop (one per pending pick). API-Sports free tier allows ~100 requests/day. A single resolve call could burn 20% of quota.

**Fix:** Add a small delay between calls or batch fixture IDs into a single multi-fixture API call if the API supports it.

### ERR-6: `alerts.ts` Hardcoded Chat ID

Telegram chat ID is hardcoded as `'5370205957'`. Should be an env var for portability.

---

## Performance Concerns

### PERF-1: Sequential DB Inserts in Picks Route

`app/api/picks/route.ts` inserts picks one at a time in a `for` loop:
```ts
for (const pick of picks) {
  await sql`INSERT INTO picks ...`;
}
```

With 20+ picks per run, this is 20+ sequential round trips to Neon. Neon's serverless driver supports batching.

**Fix:** Use a single bulk INSERT with `UNNEST` or batch the inserts.

### PERF-2: O(n³) Loop in Parlay Builder

`lib/parlays.ts` → Value Accumulator 3-leg strategy: triple nested loop over up to 30 candidates = 27,000 iterations max. Currently fine, but would degrade if candidate pool grows.

### PERF-3: Understat Has No In-Memory Cache

`lib/understat.ts` relies on Next.js `revalidate: 21600` (6h) for caching, but this only works in Next.js fetch context. Direct calls (e.g., from API routes without Next.js cache) will scrape Understat on every invocation.

Compare with `lib/elo.ts` which has its own `Map`-based in-memory cache with TTL — Understat should have the same.

### PERF-4: Pagination Loop in Odds Fetcher

`lib/odds-apisports.ts` → `getLeagueOdds()` fetches up to 5 pages sequentially. Could `Promise.all` pages 2-5 after getting `totalPages` from page 1.

---

## Incomplete Features (TODOs)

### TODO-1: Closing Odds / CLV Pipeline (Task 5) — 60% Complete

**What exists:**
- ✅ DB columns: `opening_odds`, `closing_odds`, `clv` — migration exists and runs in `initSchema()`
- ✅ `updateClosingOdds()` function in `lib/db.ts`
- ✅ Manual endpoint: `POST /api/picks/close`
- ✅ Auto-capture attempt in `/api/picks/resolve`
- ✅ Performance page reads CLV data

**What's broken/missing:**
- ❌ CLV formula inconsistency (BUG-1 above) — **must fix first**
- ❌ Auto-capture timing window never triggers (BUG-3 above)
- ❌ No pre-kickoff cron job to snapshot closing odds before match starts
- ❌ Only Match Result markets get closing odds — BTTS, Over/Under, Corners are ignored
- ❌ No closing odds for NBA picks at all
- ❌ No historical CLV trending / reporting beyond the basic performance page

### TODO-2: No Automated Cron for Resolve + CLV

The resolve endpoint exists but nothing calls it automatically. Needs a cron job (Vercel Cron or external) to run `/api/picks/resolve` every ~30 min and a separate `/api/picks/close-snapshot` ~5 min before each kickoff.

### TODO-3: NRL and UFC Sport Analyzers Missing

`MatchData` supports `sport: "nrl" | "ufc"` but `analyzeMatch()` only handles `"nba"` and falls through to `analyzeSoccer()` for everything else. NRL/UFC picks would get soccer-style analysis (Poisson, Dixon-Coles) which is nonsensical.

### TODO-4: Understat Slug Map Is EPL-Only

`lib/understat.ts` only maps Premier League teams. UCL, La Liga, Bundesliga, Serie A, Ligue 1 teams all return `null` from `getTeamXG()`. Understat actually covers the top 5 European leagues — the slug map just needs expanding.

### TODO-5: ClubElo Slug Map Missing Many Teams

`lib/elo.ts` maps ~50 teams but misses many (e.g., Napoli, Lazio, Roma, Real Sociedad, Athletic Bilbao, Sporting CP, Marseille, Lyon, Stuttgart, Frankfurt). Any unmatched team falls back to the default 1500 Elo.

---

## Recommended Priority Order

| # | Item | Severity | Effort | Impact |
|---|------|----------|--------|--------|
| 1 | **BUG-1: CLV formula contradiction** | 🔴 Critical | Small | Data integrity — fix before any more CLV data is written |
| 2 | **BUG-3: Closing odds window never fires** | 🟡 High | Medium | Task 5 is dead without this — need pre-kickoff cron |
| 3 | **ERR-1: No auth on /api/picks/close** | 🟡 High | Small | Security — anyone can corrupt pick data |
| 4 | **BUG-2: De-vig destructuring** | 🟡 Medium | Small | Away win picks undervalued when no draw odds |
| 5 | **ERR-2: Fetch timeouts** | 🟡 Medium | Small | Prevents hanging requests under bad network |
| 6 | **PERF-1: Sequential DB inserts** | 🟡 Medium | Medium | Latency reduction for picks endpoint |
| 7 | **TODO-4/5: Expand team slug maps** | 🟢 Low | Medium | Better xG/Elo coverage across leagues |
| 8 | **TODO-2: Cron automation** | 🟡 High | Medium | No automation = manual-only resolution |
| 9 | **BUG-5: Duplicate parlay strategy count** | 🟢 Low | Tiny | Cosmetic |
| 10 | **TODO-3: NRL/UFC analyzers** | 🟢 Low | Large | Feature gap — low priority unless those sports are active |

---

*Next session: Start with BUG-1 (CLV formula fix) + BUG-3 (closing odds cron). Those two unblock the entire Task 5 pipeline.*
