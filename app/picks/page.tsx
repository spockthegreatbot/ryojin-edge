"use client";

import { useEffect, useState, useCallback } from "react";
import { MatchData } from "@/lib/mock-data";
import { BetSuggestion } from "@/lib/bet-analyzer";


interface MatchWithBets extends MatchData {
  bets?: BetSuggestion[];
}

interface ValueBet extends BetSuggestion {
  matchName: string;
  commenceTime: string;
  sport: "soccer" | "nba";
  league: string;
}

function formatKickoff(iso: string) {
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

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    "🔥 Strong": { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
    "✅ Lean":   { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    "⚠️ Marginal": { color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  };
  const style = map[tier] ?? { color: "#9ca3af", bg: "rgba(156,163,175,0.1)" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      color: style.color, background: style.bg,
      padding: "2px 8px", borderRadius: 6,
      border: `1px solid ${style.color}44`,
    }}>
      {tier}
    </span>
  );
}

function ValueBetCard({ bet }: { bet: ValueBet }) {
  return (
    <div style={{
      background: "#12121a",
      borderRadius: 14,
      border: "1px solid rgba(34,197,94,0.2)",
      padding: "16px 18px",
    }}>
      {/* Match name + kickoff */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{bet.matchName}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            🕐 {formatKickoff(bet.commenceTime)} AEDT
          </div>
        </div>
        <TierBadge tier={bet.tier} />
      </div>

      {/* Market + pick */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 10, color: "#7c3aed", textTransform: "uppercase",
          letterSpacing: 0.8, background: "rgba(124,58,237,0.12)",
          padding: "2px 8px", borderRadius: 5, fontWeight: 600,
        }}>
          {bet.market}
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>{bet.pick}</span>
      </div>

      {/* Reasoning */}
      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5, marginBottom: 12 }}>
        {bet.reasoning}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e" }}>
            +{(bet.edge * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: "#6b7280" }}>Edge</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#7c3aed" }}>
            {bet.confidence}%
          </div>
          <div style={{ fontSize: 10, color: "#6b7280" }}>Confidence</div>
        </div>
        {bet.odds && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "white" }}>
              {bet.odds.toFixed(2)}
            </div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Odds</div>
          </div>
        )}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#9ca3af" }}>
            {Math.round(bet.modelProb * 100)}%
          </div>
          <div style={{ fontSize: 10, color: "#6b7280" }}>Model</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#4b5563" }}>
            {Math.round(bet.marketProb * 100)}%
          </div>
          <div style={{ fontSize: 10, color: "#6b7280" }}>Market</div>
        </div>
      </div>
    </div>
  );
}

export default function PicksPage() {
  const [valueBets, setValueBets] = useState<ValueBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPicks = useCallback(async () => {
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) return;
      const matches: MatchWithBets[] = await res.json();

      const allValue: ValueBet[] = [];
      matches.forEach((match) => {
        const bets = match.bets ?? [];
        bets
          .filter((b) => b.value === true)
          .forEach((b) => {
            allValue.push({
              ...b,
              matchName: `${match.homeTeam} vs ${match.awayTeam}`,
              commenceTime: match.commenceTime,
              sport: match.sport,
              league: match.league,
            });
          });
      });

      // Sort by edge descending
      allValue.sort((a, b) => b.edge - a.edge);
      setValueBets(allValue);
      setLastUpdated(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPicks();
    const interval = setInterval(fetchPicks, 5 * 60 * 1000); // 5 min refresh
    return () => clearInterval(interval);
  }, [fetchPicks]);

  const soccerBets = valueBets.filter((b) => b.sport === "soccer");
  const nbaBets = valueBets.filter((b) => b.sport === "nba");

  return (
    <main style={{ minHeight: "100vh", background: "#0d0d14" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "white", marginBottom: 6 }}>
            🎯 Value Picks
          </h1>
          <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span>Value bets with edge ≥ 5% vs market implied probability</span>
            {lastUpdated && (
              <span style={{ color: "#374151" }}>
                Updated {lastUpdated.toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour12: true })}
              </span>
            )}
            <button
              onClick={fetchPicks}
              style={{
                background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
                color: "#7c3aed", borderRadius: 6, padding: "3px 10px",
                fontSize: 12, cursor: "pointer", fontWeight: 500,
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                background: "#12121a", borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.07)", padding: "16px 18px",
                height: 120,
                animation: "pulse 1.5s infinite",
              }} />
            ))}
          </div>
        ) : valueBets.length === 0 ? (
          <div style={{
            background: "#12121a", borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "48px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 16, color: "#9ca3af", fontWeight: 600 }}>
              No value bets right now — check back closer to kickoff.
            </div>
            <div style={{ fontSize: 13, color: "#4b5563", marginTop: 8 }}>
              Value bets appear when model probability exceeds market implied probability by 5%+
            </div>
          </div>
        ) : (
          <>
            {/* Soccer Section */}
            {soccerBets.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{
                  fontSize: 15, fontWeight: 700, color: "#9ca3af",
                  textTransform: "uppercase", letterSpacing: 1.2,
                  marginBottom: 14, display: "flex", alignItems: "center", gap: 8,
                }}>
                  ⚽ Soccer
                  <span style={{
                    fontSize: 11, background: "rgba(255,255,255,0.08)",
                    padding: "2px 8px", borderRadius: 20, color: "#6b7280", fontWeight: 500,
                  }}>
                    {soccerBets.length} pick{soccerBets.length !== 1 ? "s" : ""}
                  </span>
                </h2>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 14,
                }}>
                  {soccerBets.map((bet, i) => (
                    <ValueBetCard key={`soccer-${i}`} bet={bet} />
                  ))}
                </div>
              </div>
            )}

            {/* NBA Section */}
            {nbaBets.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{
                  fontSize: 15, fontWeight: 700, color: "#9ca3af",
                  textTransform: "uppercase", letterSpacing: 1.2,
                  marginBottom: 14, display: "flex", alignItems: "center", gap: 8,
                }}>
                  🏀 NBA
                  <span style={{
                    fontSize: 11, background: "rgba(255,255,255,0.08)",
                    padding: "2px 8px", borderRadius: 20, color: "#6b7280", fontWeight: 500,
                  }}>
                    {nbaBets.length} pick{nbaBets.length !== 1 ? "s" : ""}
                  </span>
                </h2>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 14,
                }}>
                  {nbaBets.map((bet, i) => (
                    <ValueBetCard key={`nba-${i}`} bet={bet} />
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div style={{
              background: "#12121a", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.05)",
              padding: "12px 16px",
              display: "flex", gap: 24, flexWrap: "wrap",
              fontSize: 13, color: "#6b7280",
            }}>
              <span>📊 {valueBets.length} total value bets</span>
              <span>🔥 {valueBets.filter(b => b.tier === "🔥 Strong").length} strong</span>
              <span>✅ {valueBets.filter(b => b.tier === "✅ Lean").length} lean</span>
              <span>⚠️ {valueBets.filter(b => b.tier === "⚠️ Marginal").length} marginal</span>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </main>
  );
}
