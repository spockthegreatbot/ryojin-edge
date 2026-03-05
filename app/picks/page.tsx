"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MatchData } from "@/lib/mock-data";
import { BetSuggestion, FactorBreakdown } from "@/lib/bet-analyzer";


interface MatchWithBets extends MatchData {
  bets?: BetSuggestion[];
}

interface ValueBet extends BetSuggestion {
  matchId: string;
  matchName: string;
  commenceTime: string;
  sport: "soccer" | "nba";
  league: string;
}

type SortMode = "date" | "edge";

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
    "🔥 Strong":    { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
    "✅ Lean":      { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    "⚠️ Marginal":  { color: "#eab308", bg: "rgba(234,179,8,0.12)" },
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

function FactorTags({ factors }: { factors: FactorBreakdown[] }) {
  const dirColor = (d: "+" | "-" | "=") =>
    d === "+" ? "#22c55e" : d === "-" ? "#ef4444" : "#6b7280";
  const dirIcon = (d: "+" | "-" | "=") =>
    d === "+" ? "📈" : d === "-" ? "📉" : "➖";

  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
      {factors.map((f, i) => (
        <span key={i} style={{
          fontSize: 10,
          color: dirColor(f.direction),
          background: `${dirColor(f.direction)}18`,
          border: `1px solid ${dirColor(f.direction)}33`,
          borderRadius: 5,
          padding: "2px 6px",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}>
          {dirIcon(f.direction)} {f.label} {f.direction}{Math.abs(Math.round(f.impact * 100))}%
        </span>
      ))}
    </div>
  );
}

// ── Hero card for the best single pick ─────────────────────────────────────
function HeroPick({ bet }: { bet: ValueBet }) {
  return (
    <Link href={`/match/${bet.matchId}`} style={{ textDecoration: "none", display: "block", marginBottom: 28 }}>
      <div style={{
        background: "linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(124,58,237,0.10) 100%)",
        borderRadius: 18,
        border: "1px solid rgba(34,197,94,0.35)",
        padding: "24px 26px",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: "0 0 40px rgba(34,197,94,0.08)",
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(34,197,94,0.55)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 50px rgba(34,197,94,0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(34,197,94,0.35)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 40px rgba(34,197,94,0.08)";
        }}
      >
        {/* Background glow */}
        <div style={{
          position: "absolute", top: -40, right: -40, width: 200, height: 200,
          background: "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: 1 }}>
            {/* Labels row */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <span style={{
                fontSize: 11, fontWeight: 800,
                color: "#22c55e", background: "rgba(34,197,94,0.15)",
                padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.3)",
                textTransform: "uppercase", letterSpacing: 1,
              }}>
                🏆 Best Pick
              </span>
              <TierBadge tier={bet.tier} />
              <span style={{ fontSize: 11, color: "#6b7280" }}>{bet.sport === "soccer" ? "⚽" : "🏀"} {bet.league}</span>
            </div>

            {/* Match name */}
            <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 6 }}>{bet.matchName}</div>

            {/* Market + pick */}
            <div style={{ fontSize: 11, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{bet.market}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e", marginBottom: 8 }}>{bet.pick}</div>

            {/* Reasoning */}
            <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6, marginBottom: 8 }}>{bet.reasoning}</div>

            {/* Factor tags */}
            {bet.factors && bet.factors.length > 0 && <FactorTags factors={bet.factors} />}

            {/* Kelly */}
            <div style={{ marginTop: 10, fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
              📊 Kelly: {bet.kellySuggestion}
            </div>

            {/* Referee note */}
            {bet.refereeNote && (
              <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>{bet.refereeNote}</div>
            )}
          </div>

          {/* Stats column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end", minWidth: 120 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#22c55e" }}>+{(bet.edge * 100).toFixed(1)}%</div>
              <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8 }}>Edge</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#7c3aed" }}>{bet.confidence}%</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Confidence</div>
            </div>
            {bet.odds && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "white" }}>{bet.odds.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Odds</div>
              </div>
            )}
            <div style={{ textAlign: "right", fontSize: 11, color: "#4b5563" }}>
              🕐 {formatKickoff(bet.commenceTime)}
            </div>
          </div>
        </div>

        {/* Probability bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4b5563", marginBottom: 4 }}>
            <span>Model: {Math.round(bet.modelProb * 100)}%</span>
            <span>Market: {Math.round(bet.marketProb * 100)}%</span>
          </div>
          <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, height: 8, position: "relative", overflow: "hidden" }}>
            <div style={{ background: "rgba(34,197,94,0.25)", width: `${bet.marketProb * 100}%`, height: "100%", position: "absolute" }} />
            <div style={{ background: "#22c55e", width: `${bet.modelProb * 100}%`, height: "100%", borderRadius: 6, opacity: 0.9 }} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Regular value bet card ──────────────────────────────────────────────────
function ValueBetCard({ bet }: { bet: ValueBet }) {
  return (
    <Link href={`/match/${bet.matchId}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "#12121a",
        borderRadius: 14,
        border: "1px solid rgba(34,197,94,0.18)",
        padding: "16px 18px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(34,197,94,0.35)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 18px rgba(34,197,94,0.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(34,197,94,0.18)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        {/* Match + kickoff */}
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
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
        <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5, marginBottom: 8, flex: 1 }}>
          {bet.reasoning}
        </div>

        {/* Factor tags */}
        {bet.factors && bet.factors.length > 0 && <FactorTags factors={bet.factors} />}

        {/* Kelly */}
        <div style={{ marginTop: 8, fontSize: 11, color: "#22c55e", fontWeight: 600 }}>
          📊 Kelly: {bet.kellySuggestion}
        </div>

        {/* Referee note */}
        {bet.refereeNote && (
          <div style={{ marginTop: 3, fontSize: 10, color: "#4b5563" }}>{bet.refereeNote}</div>
        )}

        {/* Stats row */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>+{(bet.edge * 100).toFixed(1)}%</div>
            <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Edge</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#7c3aed" }}>{bet.confidence}%</div>
            <div style={{ fontSize: 9, color: "#6b7280" }}>Conf</div>
          </div>
          {bet.odds && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>{bet.odds.toFixed(2)}</div>
              <div style={{ fontSize: 9, color: "#6b7280" }}>Odds</div>
            </div>
          )}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#9ca3af" }}>{Math.round(bet.modelProb * 100)}%</div>
            <div style={{ fontSize: 9, color: "#6b7280" }}>Model</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#4b5563" }}>{Math.round(bet.marketProb * 100)}%</div>
            <div style={{ fontSize: 9, color: "#6b7280" }}>Market</div>
          </div>
        </div>

        {/* Confidence bar */}
        <div style={{ marginTop: 8 }}>
          <div style={{ background: "#0a0a0f", borderRadius: 4, height: 5, overflow: "hidden" }}>
            <div style={{
              background: bet.confidence > 70 ? "#22c55e" : "#7c3aed",
              width: `${bet.confidence}%`, height: "100%",
              transition: "width 0.4s",
            }} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function PicksPage() {
  const [valueBets, setValueBets] = useState<ValueBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("date");

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
              matchId: match.id,
              matchName: `${match.homeTeam} vs ${match.awayTeam}`,
              commenceTime: match.commenceTime,
              sport: match.sport,
              league: match.league,
            });
          });
      });

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
    const interval = setInterval(fetchPicks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPicks]);

  // Sort
  const sorted = [...valueBets].sort((a, b) => {
    if (sortMode === "date") {
      const timeDiff = new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.edge - a.edge;
    }
    return b.edge - a.edge;
  });

  // Best pick (highest edge)
  const bestPick = sorted.slice().sort((a, b) => b.edge - a.edge)[0] ?? null;
  const restPicks = sorted.filter((b) => b !== bestPick || sorted.indexOf(b) > 0);

  const soccerBets = restPicks.filter((b) => b.sport === "soccer");
  const nbaBets = restPicks.filter((b) => b.sport === "nba");

  return (
    <main style={{ minHeight: "100vh", background: "#0d0d14" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "white", marginBottom: 6, letterSpacing: -0.5 }}>
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
                height: 130, animation: "pulse 1.5s infinite",
              }} />
            ))}
          </div>
        ) : valueBets.length === 0 ? (
          <div style={{
            background: "#12121a", borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "60px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 14, animation: "livePulse 2s ease-in-out infinite", display: "inline-block" }}>⏳</div>
            <div style={{ fontSize: 18, color: "#9ca3af", fontWeight: 700, marginBottom: 8 }}>
              No value bets right now — check back closer to kickoff.
            </div>
            <div style={{ fontSize: 13, color: "#4b5563", marginTop: 6 }}>
              Value bets appear when model probability exceeds market implied probability by 5%+
            </div>
          </div>
        ) : (
          <>
            {/* Hero: best pick */}
            {bestPick && <HeroPick bet={bestPick} />}

            {/* Sort controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                {restPicks.length} more value bet{restPicks.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", gap: 6, background: "#12121a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)", padding: 4 }}>
                {(["date", "edge"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 12,
                      background: sortMode === mode ? "#7c3aed" : "transparent",
                      color: sortMode === mode ? "white" : "#6b7280",
                      transition: "all 0.15s",
                    }}
                  >
                    {mode === "date" ? "📅 By Date" : "📈 By Edge"}
                  </button>
                ))}
              </div>
            </div>

            {/* Soccer section */}
            {soccerBets.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{
                  fontSize: 14, fontWeight: 700, color: "#9ca3af",
                  textTransform: "uppercase", letterSpacing: 1.2,
                  marginBottom: 14, display: "flex", alignItems: "center", gap: 8,
                }}>
                  ⚽ Soccer
                  <span style={{ fontSize: 11, background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 20, color: "#6b7280", fontWeight: 500 }}>
                    {soccerBets.length} pick{soccerBets.length !== 1 ? "s" : ""}
                  </span>
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 14 }}>
                  {soccerBets.map((bet, i) => (
                    <ValueBetCard key={`soccer-${i}`} bet={bet} />
                  ))}
                </div>
              </div>
            )}

            {/* NBA section */}
            {nbaBets.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{
                  fontSize: 14, fontWeight: 700, color: "#9ca3af",
                  textTransform: "uppercase", letterSpacing: 1.2,
                  marginBottom: 14, display: "flex", alignItems: "center", gap: 8,
                }}>
                  🏀 NBA
                  <span style={{ fontSize: 11, background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 20, color: "#6b7280", fontWeight: 500 }}>
                    {nbaBets.length} pick{nbaBets.length !== 1 ? "s" : ""}
                  </span>
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 14 }}>
                  {nbaBets.map((bet, i) => (
                    <ValueBetCard key={`nba-${i}`} bet={bet} />
                  ))}
                </div>
              </div>
            )}

            {/* Summary footer */}
            <div style={{
              background: "#12121a", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.05)",
              padding: "12px 16px",
              display: "flex", gap: 24, flexWrap: "wrap",
              fontSize: 13, color: "#6b7280",
            }}>
              <span>📊 {valueBets.length} total value bets</span>
              <span>🔥 {valueBets.filter((b) => b.tier === "🔥 Strong").length} strong</span>
              <span>✅ {valueBets.filter((b) => b.tier === "✅ Lean").length} lean</span>
              <span>⚠️ {valueBets.filter((b) => b.tier === "⚠️ Marginal").length} marginal</span>
              {valueBets.some((b) => b.refereeNote) && (
                <span>⚖️ {new Set(valueBets.filter((b) => b.refereeNote).map((b) => b.refereeNote)).size} referee insights</span>
              )}
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.15)} }
      `}</style>
    </main>
  );
}
