"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MatchData } from "@/lib/mock-data";
import { BetSuggestion, FactorBreakdown } from "@/lib/bet-analyzer";
import { Parlay } from "@/lib/parlays";

// ── Types ────────────────────────────────────────────────────────────────────

interface MatchWithBets extends MatchData {
  bets?: BetSuggestion[];
}

interface ValueBet extends BetSuggestion {
  matchId: string;
  matchName: string;
  homeTeam: string;
  awayTeam: string;
  homeForm: string[];
  awayForm: string[];
  commenceTime: string;
  sport: "soccer" | "nba" | "nrl" | "ufc";
  league: string;
  closing_odds?: number | null;
  clv?: number | null;
}

type SortMode = "date" | "edge" | "confidence";

// ── Confidence Tier Logic ────────────────────────────────────────────────────

type ConfidenceTier = "lock" | "strong" | "speculative";

function getConfidenceTier(confidence: number, edge: number): ConfidenceTier {
  if (confidence >= 85 && edge >= 0.15) return "lock";
  if (confidence >= 70 && edge >= 0.10) return "strong";
  return "speculative";
}

const TIER_CONFIG = {
  lock: {
    label: "🔒 LOCK",
    color: "#E8C96E",
    bg: "rgba(232,201,110,0.12)",
    border: "rgba(232,201,110,0.3)",
    description: "These are the strongest plays",
  },
  strong: {
    label: "🎯 STRONG",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    border: "rgba(34,197,94,0.25)",
    description: "Good value, solid edge",
  },
  speculative: {
    label: "⚡ SPEC",
    color: "#9ca3af",
    bg: "rgba(156,163,175,0.08)",
    border: "rgba(156,163,175,0.15)",
    description: "Higher risk, potential upside",
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function getFormStreak(form: string[]): { type: "W" | "L" | "D"; count: number } | null {
  if (!form || form.length === 0) return null;
  const reversed = [...form].reverse();
  const streakType = reversed[0] as "W" | "L" | "D";
  let count = 0;
  for (const f of reversed) {
    if (f === streakType) count++;
    else break;
  }
  if (count < 2) return null;
  return { type: streakType, count };
}

function StreakBadge({ form }: { form: string[] }) {
  const streak = getFormStreak(form);
  if (!streak) return null;
  const color = streak.type === "W" ? "#22c55e" : streak.type === "L" ? "#ef4444" : "#eab308";
  const bg = streak.type === "W" ? "#0f1a14" : streak.type === "L" ? "#1a0f0f" : "#1a1810";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      color, background: bg,
      padding: "2px 5px", borderRadius: 3,
      fontFamily: "var(--font-dm-mono), monospace",
    }}>
      {streak.type}{streak.count}
    </span>
  );
}

function CLVIndicator({ clv, closingOdds }: { clv?: number | null; closingOdds?: number | null }) {
  if (clv === undefined || clv === null) return null;
  const favorable = clv > 0;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      color: favorable ? "#22c55e" : "#ef4444",
      display: "inline-flex", alignItems: "center", gap: 3,
    }}>
      {favorable ? "↗" : "↘"} {favorable ? "Line moving our way" : "Line moving against"}
      {closingOdds && <span style={{ color: "#4b5563", fontSize: 9 }}> (close: {closingOdds.toFixed(2)})</span>}
    </span>
  );
}

// ── Tier Badge ───────────────────────────────────────────────────────────────

function TierBadge({ bet }: { bet: ValueBet }) {
  const tier = getConfidenceTier(bet.confidence, bet.edge);
  const cfg = TIER_CONFIG[tier];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
      padding: "3px 8px", borderRadius: 4,
      border: `1px solid ${cfg.border}`,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
    }}>
      {cfg.label}
    </span>
  );
}

function FactorTags({ factors }: { factors: FactorBreakdown[] }) {
  const dirColor = (d: "+" | "-" | "=") =>
    d === "+" ? "#22c55e" : d === "-" ? "#ef4444" : "#6b7280";
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
      {factors.map((f, i) => (
        <span key={i} style={{
          fontSize: 9,
          color: dirColor(f.direction),
          background: f.direction === "+" ? "#0f1a14" : f.direction === "-" ? "#1a1010" : "#15151e",
          borderRadius: 3,
          padding: "2px 5px",
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}>
          {f.direction === "+" ? "📈" : f.direction === "-" ? "📉" : "➖"} {f.label}
        </span>
      ))}
    </div>
  );
}

// ── Best Bets Hero Section (Top 3) ──────────────────────────────────────────

function BestBetsHero({ bets }: { bets: ValueBet[] }) {
  if (bets.length === 0) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        marginBottom: 14,
      }}>
        <h2 style={{
          fontSize: 16, fontWeight: 700, color: "#E8C96E",
          margin: 0, letterSpacing: -0.3,
        }}>
          🏆 Best Bets Today
        </h2>
        <span style={{ fontSize: 11, color: "#4b5563" }}>
          Top picks by confidence × edge
        </span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 12,
      }}>
        {bets.map((bet, i) => (
          <Link key={`best-${i}`} href={`/match/${bet.matchId}`} style={{ textDecoration: "none" }}>
            <div style={{
              background: "linear-gradient(135deg, #1a1814 0%, #141419 100%)",
              borderRadius: 6,
              border: `1px solid ${TIER_CONFIG[getConfidenceTier(bet.confidence, bet.edge)].border}`,
              borderLeft: `3px solid ${TIER_CONFIG[getConfidenceTier(bet.confidence, bet.edge)].color}`,
              padding: "16px 18px",
              cursor: "pointer",
              transition: "border-color 0.2s, transform 0.15s",
              position: "relative",
            }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(232,201,110,0.5)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = TIER_CONFIG[getConfidenceTier(bet.confidence, bet.edge)].border;
                (e.currentTarget as HTMLDivElement).style.transform = "none";
              }}
            >
              {/* Rank badge */}
              <div style={{
                position: "absolute", top: -8, right: 12,
                background: "#E8C96E", color: "#0a0a0f",
                fontSize: 10, fontWeight: 800,
                padding: "2px 8px", borderRadius: 10,
              }}>
                #{i + 1}
              </div>

              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8 }}>
                <div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                    <TierBadge bet={bet} />
                    <span style={{ fontSize: 10, color: "#6b7280" }}>
                      {bet.sport === "soccer" ? "⚽" : "🏀"} {bet.league}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#e8e0d0", fontWeight: 600 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {bet.homeTeam} <StreakBadge form={bet.homeForm} />
                    </span>
                    <span style={{ color: "#4b5563", margin: "0 6px" }}>vs</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {bet.awayTeam} <StreakBadge form={bet.awayForm} />
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{
                    fontSize: 24, fontWeight: 300, color: "#22c55e",
                    fontFamily: "var(--font-dm-mono), monospace",
                  }}>
                    +{(bet.edge * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 9, color: "#44444f", textTransform: "uppercase" }}>Edge</div>
                </div>
              </div>

              {/* Market + Pick */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: "#44444f", textTransform: "uppercase", letterSpacing: "0.1em" }}>{bet.market}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#22c55e" }}>{bet.pick}</span>
                {bet.odds && <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>@ {bet.odds.toFixed(2)}</span>}
              </div>

              {/* Reasoning */}
              <p style={{
                fontSize: 12, color: "#9ca3af", lineHeight: 1.5, margin: "0 0 8px",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {bet.reasoning}
              </p>

              {/* CLV + Kelly */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#E8C96E", fontWeight: 600 }}>📊 Kelly: {bet.kellySuggestion}</span>
                <CLVIndicator clv={bet.clv} closingOdds={bet.closing_odds} />
              </div>

              {/* Stats bar */}
              <div style={{ display: "flex", gap: 14, marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 400, color: "#e8e0d0", fontFamily: "var(--font-dm-mono), monospace" }}>{bet.confidence}%</span>
                  <span style={{ fontSize: 9, color: "#44444f", marginLeft: 4 }}>Conf</span>
                </div>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 400, color: "#9ca3af" }}>{Math.round(bet.modelProb * 100)}%</span>
                  <span style={{ fontSize: 9, color: "#44444f", marginLeft: 4 }}>Model</span>
                </div>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 400, color: "#4b5563" }}>{Math.round(bet.marketProb * 100)}%</span>
                  <span style={{ fontSize: 9, color: "#44444f", marginLeft: 4 }}>Market</span>
                </div>
              </div>

              {/* Kickoff */}
              <div style={{ fontSize: 10, color: "#4b5563", marginTop: 6 }}>
                🕐 {formatKickoff(bet.commenceTime)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Parlay Suggestion Section ───────────────────────────────────────────────

function ParlaySuggestions({ parlays }: { parlays: Parlay[] }) {
  if (!parlays || parlays.length === 0) return null;

  // Show max 2 parlays — 2-leg ones from different leagues
  const twoLeg = parlays.filter(p => p.legs.length === 2).slice(0, 2);
  const display = twoLeg.length > 0 ? twoLeg : parlays.slice(0, 2);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "#9ca3af", margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>
          🎲 Multi-Bet Suggestions
        </h2>
        <span style={{ fontSize: 11, color: "#4b5563" }}>
          Uncorrelated parlays from different leagues
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {display.map((parlay, i) => (
          <div key={`parlay-${i}`} style={{
            background: "#141419",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "14px 16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#a855f7",
                background: "rgba(168,85,247,0.12)", padding: "2px 8px",
                borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
                {parlay.legs.length}-Leg Parlay
              </span>
              <span style={{
                fontSize: 18, fontWeight: 700, color: "#E8C96E",
                fontFamily: "var(--font-dm-mono), monospace",
              }}>
                {parlay.combinedOdds.toFixed(2)}x
              </span>
            </div>

            {/* Legs */}
            {parlay.legs.map((leg, j) => (
              <div key={`leg-${j}`} style={{
                padding: "8px 0",
                borderBottom: j < parlay.legs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <div style={{ fontSize: 12, color: "#e8e0d0", fontWeight: 600, marginBottom: 2 }}>
                  {leg.match}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#22c55e" }}>
                    {leg.pick} @ {leg.odds.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>
                    {leg.edgePct} edge · {leg.league}
                  </span>
                </div>
              </div>
            ))}

            {/* Summary */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>
                Combined prob: {parlay.combinedProb}%
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: parlay.combinedEdge > 0 ? "#22c55e" : "#ef4444",
              }}>
                Edge: {parlay.combinedEdgePct}
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
              {parlay.reason}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Regular Value Bet Card ──────────────────────────────────────────────────

function ValueBetCard({ bet }: { bet: ValueBet }) {
  const tier = getConfidenceTier(bet.confidence, bet.edge);
  const cfg = TIER_CONFIG[tier];

  return (
    <Link href={`/match/${bet.matchId}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "#141419",
        borderRadius: 6,
        border: `1px solid ${cfg.border}`,
        borderLeft: tier === "lock" ? `3px solid ${cfg.color}` : `1px solid ${cfg.border}`,
        padding: "14px 16px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "border-color 0.2s, transform 0.15s",
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.15)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = cfg.border;
          (e.currentTarget as HTMLDivElement).style.transform = "none";
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
          <div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
              <TierBadge bet={bet} />
              <span style={{ fontSize: 10, color: "#6b7280" }}>
                {bet.sport === "soccer" ? "⚽" : bet.sport === "nba" ? "🏀" : "🏈"} {bet.league}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {bet.homeTeam} <StreakBadge form={bet.homeForm} />
              </span>
              <span style={{ color: "#4b5563", margin: "0 4px" }}>vs</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {bet.awayTeam} <StreakBadge form={bet.awayForm} />
              </span>
            </div>
            <div style={{ fontSize: 10, color: "#4b5563", marginTop: 3 }}>
              🕐 {formatKickoff(bet.commenceTime)}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontSize: 18, fontWeight: 300,
              color: cfg.color,
              fontFamily: "var(--font-dm-mono), monospace",
            }}>
              +{(bet.edge * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 9, color: "#44444f", textTransform: "uppercase" }}>Edge</div>
          </div>
        </div>

        {/* Market + pick */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "#44444f", textTransform: "uppercase", letterSpacing: "0.1em" }}>{bet.market}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#22c55e" }}>{bet.pick}</span>
          {bet.odds && <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>@ {bet.odds.toFixed(2)}</span>}
        </div>

        {/* Reasoning */}
        <p style={{
          fontSize: 12, color: "#9ca3af", lineHeight: 1.5, margin: "0 0 8px", flex: 1,
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {bet.reasoning}
        </p>

        {/* Factor tags */}
        {bet.factors && bet.factors.length > 0 && <FactorTags factors={bet.factors} />}

        {/* Kelly + CLV */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 8, flexWrap: "wrap", gap: 4,
        }}>
          <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>📊 {bet.kellySuggestion}</span>
          <CLVIndicator clv={bet.clv} closingOdds={bet.closing_odds} />
        </div>

        {/* Referee note */}
        {bet.refereeNote && (
          <div style={{ marginTop: 4, fontSize: 10, color: "#4b5563" }}>{bet.refereeNote}</div>
        )}

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 400, color: cfg.color, fontFamily: "var(--font-dm-mono), monospace" }}>{bet.confidence}%</span>
            <span style={{ fontSize: 9, color: "#44444f", marginLeft: 3 }}>Conf</span>
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 400, color: "#9ca3af", fontFamily: "var(--font-dm-mono), monospace" }}>{Math.round(bet.modelProb * 100)}%</span>
            <span style={{ fontSize: 9, color: "#44444f", marginLeft: 3 }}>Model</span>
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 400, color: "#4b5563", fontFamily: "var(--font-dm-mono), monospace" }}>{Math.round(bet.marketProb * 100)}%</span>
            <span style={{ fontSize: 9, color: "#44444f", marginLeft: 3 }}>Market</span>
          </div>
          {bet.odds && (
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{bet.odds.toFixed(2)}</span>
              <span style={{ fontSize: 9, color: "#6b7280", marginLeft: 3 }}>Odds</span>
            </div>
          )}
        </div>

        {/* Confidence bar */}
        <div style={{ marginTop: 6 }}>
          <div style={{ background: "#0a0a0f", borderRadius: 3, height: 4, overflow: "hidden" }}>
            <div style={{
              background: cfg.color,
              width: `${bet.confidence}%`, height: "100%",
              transition: "width 0.4s",
              opacity: 0.7,
            }} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Tier Section ────────────────────────────────────────────────────────────

function TierSection({ tier, bets }: { tier: ConfidenceTier; bets: ValueBet[] }) {
  if (bets.length === 0) return null;
  const cfg = TIER_CONFIG[tier];
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{
          fontSize: 14, fontWeight: 700, color: cfg.color,
          margin: 0, textTransform: "uppercase", letterSpacing: 1.2,
        }}>
          {cfg.label}
        </h2>
        <span style={{ fontSize: 11, color: "#4b5563", fontFamily: "var(--font-dm-mono), monospace" }}>
          {bets.length} pick{bets.length !== 1 ? "s" : ""}
        </span>
        <span style={{ fontSize: 11, color: "#44444f" }}>— {cfg.description}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {bets.map((bet, i) => (
          <ValueBetCard key={`${tier}-${i}`} bet={bet} />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function PicksPage() {
  const [valueBets, setValueBets] = useState<ValueBet[]>([]);
  const [parlays, setParlays] = useState<Parlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("edge");

  const fetchPicks = useCallback(async () => {
    try {
      // Fetch picks from API (includes parlays)
      const picksRes = await fetch("/api/picks");
      if (picksRes.ok) {
        const data = await picksRes.json();
        const picks = data.picks ?? [];
        setParlays(data.parlays ?? []);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allValue: ValueBet[] = picks.map((p: any) => ({
          market: p.market,
          pick: p.pick,
          confidence: p.confidence,
          edge: p.edge,
          modelProb: p.modelProb,
          marketProb: p.marketProb,
          odds: p.odds,
          value: true,
          reasoning: p.reasoning,
          tier: p.tier,
          kellySuggestion: p.kellySuggestion ?? p.kelly,
          factors: p.factors,
          refereeNote: p.refereeNote,
          matchId: p.matchId,
          matchName: `${p.homeTeam} vs ${p.awayTeam}`,
          homeTeam: p.homeTeam,
          awayTeam: p.awayTeam,
          homeForm: p.homeForm ?? [],
          awayForm: p.awayForm ?? [],
          commenceTime: p.kickoff,
          sport: p.sport,
          league: p.league,
          closing_odds: p.closing_odds,
          clv: p.clv,
        }));

        setValueBets(allValue);
        setLastUpdated(new Date());
        setLoading(false);
        return;
      }

      // Fallback: fetch from matches API
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
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              homeForm: match.homeForm ?? [],
              awayForm: match.awayForm ?? [],
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

  // Sort picks
  const sorted = [...valueBets].sort((a, b) => {
    if (sortMode === "date") {
      const timeDiff = new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.edge - a.edge;
    }
    if (sortMode === "confidence") {
      return b.confidence - a.confidence || b.edge - a.edge;
    }
    return b.edge - a.edge;
  });

  // Best Bets: top 3 by confidence × edge score
  const bestBets = [...valueBets]
    .sort((a, b) => (b.confidence * b.edge) - (a.confidence * a.edge))
    .slice(0, 3);

  // Group into tiers
  const locks = sorted.filter((b) => getConfidenceTier(b.confidence, b.edge) === "lock");
  const strong = sorted.filter((b) => getConfidenceTier(b.confidence, b.edge) === "strong");
  const speculative = sorted.filter((b) => getConfidenceTier(b.confidence, b.edge) === "speculative");

  return (
    <main style={{ minHeight: "100vh", background: "#080808" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "white", marginBottom: 5, letterSpacing: -0.3 }}>
            🎯 Value Picks
          </h1>
          <div style={{
            fontSize: 12, color: "#6b7280",
            display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
          }}>
            <span>Curated bets ranked by model confidence and edge</span>
            {lastUpdated && (
              <span style={{ color: "#374151" }}>
                Updated {lastUpdated.toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour12: true })}
              </span>
            )}
            <button
              onClick={fetchPicks}
              style={{
                background: "#141419", border: "1px solid rgba(255,255,255,0.06)",
                color: "#888899", borderRadius: 4, padding: "3px 10px",
                fontSize: 11, cursor: "pointer",
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Tier legend */}
        <div style={{
          display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap",
          padding: "10px 14px", background: "#141419", borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          {(["lock", "strong", "speculative"] as const).map((t) => {
            const cfg = TIER_CONFIG[t];
            const count = t === "lock" ? locks.length : t === "strong" ? strong.length : speculative.length;
            return (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: cfg.color,
                  background: cfg.bg, padding: "2px 7px", borderRadius: 3,
                  border: `1px solid ${cfg.border}`,
                }}>
                  {cfg.label}
                </span>
                <span style={{ fontSize: 11, color: "#4b5563" }}>{count}</span>
              </div>
            );
          })}
          <span style={{ fontSize: 11, color: "#374151", marginLeft: "auto" }}>
            {valueBets.length} total picks
          </span>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                background: "#141419", borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px",
                height: 120, animation: "pulse 1.5s infinite",
              }} />
            ))}
          </div>
        ) : valueBets.length === 0 ? (
          <div style={{
            background: "#141419", borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "50px 24px", textAlign: "center",
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
            {/* Best Bets Today hero */}
            <BestBetsHero bets={bestBets} />

            {/* Parlay Suggestions */}
            <ParlaySuggestions parlays={parlays} />

            {/* Sort controls */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 18, flexWrap: "wrap", gap: 10,
            }}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                All picks by tier
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                {(["edge", "confidence", "date"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    style={{
                      padding: "4px 0", border: "none", cursor: "pointer",
                      fontWeight: sortMode === mode ? 600 : 400,
                      fontSize: 11, background: "transparent",
                      color: sortMode === mode ? "#e8e0d0" : "#44444f",
                      transition: "color 0.15s",
                    }}
                  >
                    {mode === "edge" ? "📈 By Edge" : mode === "confidence" ? "🎯 By Confidence" : "📅 By Date"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tiered sections */}
            <TierSection tier="lock" bets={locks} />
            <TierSection tier="strong" bets={strong} />
            <TierSection tier="speculative" bets={speculative} />
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
