"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface PickResult {
  id: number;
  match_id: string;
  match_name: string;
  league: string;
  sport: string;
  kickoff: string;
  market: string;
  pick: string;
  model_prob: number | null;
  market_prob: number | null;
  edge: number | null;
  tier: string | null;
  odds: number | null;
  result: "hit" | "miss" | "void" | "pending";
  actual_score: string | null;
  actual_value: string | null;
  settled_at: string | null;
  created_at: string;
}

interface MarketStat {
  market: string;
  total: number;
  hits: number;
  hitRate: number;
}

interface TierStat {
  tier: string;
  total: number;
  hits: number;
  hitRate: number;
}

interface SportStat {
  sport: string;
  total: number;
  hits: number;
  hitRate: number;
}

interface ParlayResult {
  legs: number;
  date: string;
  picks: string[];
  combinedOdds: number;
}

interface ResultsData {
  results: PickResult[];
  summary: {
    total: number;
    hits: number;
    misses: number;
    pending: number;
    voided: number;
    hitRate: number | null;
  };
  byMarket: MarketStat[];
  byTier: TierStat[];
  bySport: SportStat[];
  parlayResults: ParlayResult[];
}

type FilterTab = "all" | "hit" | "miss" | "pending";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function ResultBadge({ result }: { result: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    hit: { label: "✅ HIT", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    miss: { label: "❌ MISS", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    void: { label: "⊘ VOID", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
    pending: { label: "⏳ PENDING", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  };
  const s = config[result] ?? config.pending;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        padding: "3px 8px",
        borderRadius: 2,
        fontFamily: "var(--font-dm-mono), monospace",
        letterSpacing: "0.05em",
      }}
    >
      {s.label}
    </span>
  );
}

function MarketBadge({ market }: { market: string }) {
  const m = market.toLowerCase();
  let icon = "📊";
  if (m.includes("result") || m.includes("winner") || m.includes("double chance") || m.includes("moneyline")) icon = "🏁";
  else if (m.includes("goal") || m.includes("btts") || m.includes("both teams") || m.includes("over") || m.includes("under")) icon = "⚽";
  else if (m.includes("corner")) icon = "📐";
  else if (m.includes("card")) icon = "🟨";
  else if (m.includes("clean sheet")) icon = "🛡️";
  else if (m.includes("first half")) icon = "⏱️";

  return (
    <span
      style={{
        fontSize: 10,
        color: "#9ca3af",
        background: "rgba(255,255,255,0.04)",
        padding: "2px 6px",
        borderRadius: 2,
        fontFamily: "var(--font-dm-mono), monospace",
      }}
    >
      {icon} {market}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 2,
        padding: "16px 20px",
        flex: "1 1 140px",
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "var(--font-dm-mono), monospace" }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: "#e8e0d0", marginTop: 4, fontFamily: "var(--font-dm-mono), monospace" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [marketFilter, setMarketFilter] = useState<string>("all");
  const [days, setDays] = useState(30);
  const [showParlays, setShowParlays] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days), limit: "200" });
      if (sportFilter !== "all") params.set("sport", sportFilter);
      if (marketFilter !== "all") params.set("market", marketFilter);

      const res = await fetch(`/api/picks/results?${params}`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [days, sportFilter, marketFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredResults = data?.results.filter((r) => {
    if (filterTab === "all") return true;
    return r.result === filterTab;
  }) ?? [];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: "#e8e0d0",
            fontFamily: "var(--font-dm-mono), monospace",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          PICK RESULTS
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "8px 0 0" }}>
          Track which picks hit or missed. Auto-settled after matches complete.
        </p>
      </div>

      {/* Summary Cards */}
      {data && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <StatCard label="Total Picks" value={data.summary.total} />
          <StatCard
            label="Hit Rate"
            value={data.summary.hitRate !== null ? `${data.summary.hitRate}%` : "—"}
            sub={`${data.summary.hits}W / ${data.summary.misses}L`}
          />
          <StatCard label="Pending" value={data.summary.pending} />
          <StatCard label="Voided" value={data.summary.voided} />
        </div>
      )}

      {/* Breakdown Tables */}
      {data && (data.byMarket.length > 0 || data.byTier.length > 0) && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          {/* By Market */}
          {data.byMarket.length > 0 && (
            <div style={{ flex: "1 1 280px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 2, padding: 16 }}>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontFamily: "var(--font-dm-mono), monospace" }}>
                By Market
              </div>
              {data.byMarket.map((m) => (
                <div key={m.market} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{m.market}</span>
                  <span style={{ fontSize: 12, color: m.hitRate >= 55 ? "#22c55e" : m.hitRate >= 45 ? "#f59e0b" : "#ef4444", fontFamily: "var(--font-dm-mono), monospace" }}>
                    {m.hitRate}% ({m.hits}/{m.total})
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* By Tier */}
          {data.byTier.length > 0 && (
            <div style={{ flex: "1 1 280px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 2, padding: 16 }}>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontFamily: "var(--font-dm-mono), monospace" }}>
                By Tier
              </div>
              {data.byTier.map((t) => (
                <div key={t.tier} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{t.tier}</span>
                  <span style={{ fontSize: 12, color: t.hitRate >= 55 ? "#22c55e" : t.hitRate >= 45 ? "#f59e0b" : "#ef4444", fontFamily: "var(--font-dm-mono), monospace" }}>
                    {t.hitRate}% ({t.hits}/{t.total})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        {/* Result tabs */}
        {(["all", "hit", "miss", "pending"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            style={{
              background: filterTab === tab ? "rgba(255,255,255,0.08)" : "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 2,
              padding: "5px 12px",
              fontSize: 11,
              color: filterTab === tab ? "#e8e0d0" : "#6b7280",
              cursor: "pointer",
              fontFamily: "var(--font-dm-mono), monospace",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {tab === "all" ? "All" : tab === "hit" ? "✅ Hits" : tab === "miss" ? "❌ Misses" : "⏳ Pending"}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Sport filter */}
        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 2,
            padding: "5px 8px",
            fontSize: 11,
            color: "#9ca3af",
            fontFamily: "var(--font-dm-mono), monospace",
          }}
        >
          <option value="all">All Sports</option>
          <option value="soccer">⚽ Soccer</option>
          <option value="nba">🏀 NBA</option>
          <option value="cs2">🎮 CS2</option>
        </select>

        {/* Market filter */}
        <select
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 2,
            padding: "5px 8px",
            fontSize: 11,
            color: "#9ca3af",
            fontFamily: "var(--font-dm-mono), monospace",
          }}
        >
          <option value="all">All Markets</option>
          <option value="result">🏁 Result</option>
          <option value="goal">⚽ Goals</option>
          <option value="corner">📐 Corners</option>
          <option value="card">🟨 Cards</option>
          <option value="clean">🛡️ Clean Sheet</option>
        </select>

        {/* Days filter */}
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 2,
            padding: "5px 8px",
            fontSize: 11,
            color: "#9ca3af",
            fontFamily: "var(--font-dm-mono), monospace",
          }}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>

        {/* Parlay toggle */}
        <button
          onClick={() => setShowParlays(!showParlays)}
          style={{
            background: showParlays ? "rgba(232,201,110,0.12)" : "transparent",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 2,
            padding: "5px 12px",
            fontSize: 11,
            color: showParlays ? "#E8C96E" : "#6b7280",
            cursor: "pointer",
            fontFamily: "var(--font-dm-mono), monospace",
          }}
        >
          🎯 Parlays
        </button>
      </div>

      {/* Parlay Tracker */}
      {showParlays && data && data.parlayResults.length > 0 && (
        <div style={{ marginBottom: 24, background: "rgba(232,201,110,0.04)", border: "1px solid rgba(232,201,110,0.15)", borderRadius: 2, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#E8C96E", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontFamily: "var(--font-dm-mono), monospace" }}>
            Winning Parlay Combos (would have hit)
          </div>
          {data.parlayResults.slice(0, 10).map((p, i) => (
            <div
              key={i}
              style={{
                padding: "8px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div>
                <span style={{ fontSize: 10, color: "#E8C96E", fontFamily: "var(--font-dm-mono), monospace" }}>
                  {p.legs}-LEG • {p.date}
                </span>
                {p.picks.map((pk, j) => (
                  <div key={j} style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                    {pk}
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#22c55e", fontFamily: "var(--font-dm-mono), monospace", whiteSpace: "nowrap" }}>
                @{p.combinedOdds}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Loading / Error */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280", fontSize: 13 }}>
          Loading results...
        </div>
      )}

      {error && (
        <div style={{ textAlign: "center", padding: 40, color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Results List */}
      {!loading && !error && filteredResults.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280", fontSize: 13 }}>
          No results found. Picks will appear here once matches are settled.
        </div>
      )}

      {!loading && filteredResults.map((r) => (
        <div
          key={r.id}
          style={{
            background: r.result === "hit"
              ? "rgba(34,197,94,0.04)"
              : r.result === "miss"
              ? "rgba(239,68,68,0.04)"
              : "rgba(255,255,255,0.02)",
            border: `1px solid ${
              r.result === "hit"
                ? "rgba(34,197,94,0.15)"
                : r.result === "miss"
                ? "rgba(239,68,68,0.12)"
                : "rgba(255,255,255,0.06)"
            }`,
            borderRadius: 2,
            padding: "12px 16px",
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {/* Left: Match + Market + Pick */}
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#e8e0d0", fontWeight: 500 }}>
                {r.match_name}
              </span>
              <MarketBadge market={r.market} />
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
              <span style={{ color: "#e8e0d0", fontWeight: 500 }}>{r.pick}</span>
              {r.odds && (
                <span style={{ color: "#6b7280", marginLeft: 8, fontFamily: "var(--font-dm-mono), monospace" }}>
                  @{r.odds.toFixed(2)}
                </span>
              )}
              {r.edge && (
                <span style={{ color: "#6b7280", marginLeft: 8, fontFamily: "var(--font-dm-mono), monospace" }}>
                  +{Math.round(r.edge * 100)}% edge
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4, fontFamily: "var(--font-dm-mono), monospace" }}>
              {r.kickoff ? formatDate(r.kickoff) : "—"} • {r.league} • {r.sport}
            </div>
          </div>

          {/* Right: Result + Actual Score */}
          <div style={{ textAlign: "right", minWidth: 120 }}>
            <ResultBadge result={r.result} />
            {r.actual_score && (
              <div style={{ fontSize: 12, color: "#e8e0d0", marginTop: 4, fontFamily: "var(--font-dm-mono), monospace" }}>
                {r.actual_score}
              </div>
            )}
            {r.actual_value && (
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                {r.actual_value}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
