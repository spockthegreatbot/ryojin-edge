"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CS2Pick {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  match: string;
  league: string;
  sport: "cs2";
  kickoff: string;
  market: string;
  pick: string;
  edge: number;
  edgePct: string;
  confidence: number;
  modelProb: number;
  marketProb: number;
  odds: number | null;
  tier: string;
  reasoning: string;
  kellySuggestion: string;
  format: "BO1" | "BO3" | "BO5";
  isLan: boolean;
  team1Rank: number;
  team2Rank: number;
  team1Elo: number;
  team2Elo: number;
  team1Form: string[];
  team2Form: string[];
  team1WinProb: number;
  team2WinProb: number;
  homeForm: string[];
  awayForm: string[];
}

type CS2Tier = "lock" | "strong" | "spec";

function getTier(tier: string): CS2Tier {
  if (tier.includes("LOCK")) return "lock";
  if (tier.includes("STRONG")) return "strong";
  return "spec";
}

const TIER_CONFIG = {
  lock: {
    label: "🔒 LOCK",
    color: "#E8C96E",
    bg: "rgba(232,201,110,0.12)",
    border: "rgba(232,201,110,0.3)",
  },
  strong: {
    label: "🎯 STRONG",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    border: "rgba(34,197,94,0.25)",
  },
  spec: {
    label: "⚡ SPEC",
    color: "#9ca3af",
    bg: "rgba(156,163,175,0.08)",
    border: "rgba(156,163,175,0.15)",
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

function FormDots({ form }: { form: string[] }) {
  if (!form || form.length === 0) return <span style={{ fontSize: 10, color: "#374151" }}>—</span>;
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {form.map((f, i) => (
        <span key={i} style={{
          width: 16, height: 16, borderRadius: 3,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 700,
          background: f === "W" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          color: f === "W" ? "#22c55e" : "#ef4444",
          fontFamily: "var(--font-dm-mono), monospace",
        }}>
          {f}
        </span>
      ))}
    </div>
  );
}

function WinProbBar({ prob, color }: { prob: number; color: string }) {
  return (
    <div style={{
      background: "#1a1a24",
      borderRadius: 3,
      height: 6,
      overflow: "hidden",
      flex: 1,
    }}>
      <div style={{
        background: color,
        width: `${prob * 100}%`,
        height: "100%",
        borderRadius: 3,
        transition: "width 0.5s ease",
      }} />
    </div>
  );
}

function FormatBadge({ format }: { format: "BO1" | "BO3" | "BO5" }) {
  const colors: Record<string, { bg: string; color: string }> = {
    BO1: { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
    BO3: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
    BO5: { bg: "rgba(168,85,247,0.12)", color: "#a855f7" },
  };
  const c = colors[format];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700,
      background: c.bg, color: c.color,
      padding: "2px 6px", borderRadius: 3,
      letterSpacing: "0.05em",
      fontFamily: "var(--font-dm-mono), monospace",
    }}>
      {format}
    </span>
  );
}

function LanBadge() {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700,
      background: "rgba(234,179,8,0.12)", color: "#eab308",
      padding: "2px 6px", borderRadius: 3,
      letterSpacing: "0.05em",
    }}>
      🏟️ LAN
    </span>
  );
}

// ── CS2 Match Card ──────────────────────────────────────────────────────────

function CS2MatchCard({ pick }: { pick: CS2Pick }) {
  const tier = getTier(pick.tier);
  const cfg = TIER_CONFIG[tier];
  const isPick1 = pick.pick === pick.homeTeam;

  return (
    <div style={{
      background: "#141419",
      borderRadius: 6,
      border: `1px solid ${cfg.border}`,
      borderLeft: tier === "lock" ? `3px solid ${cfg.color}` : `1px solid ${cfg.border}`,
      padding: "16px 18px",
      transition: "border-color 0.2s, transform 0.15s",
      cursor: "default",
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
      {/* Header: tier + tournament + format + LAN */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
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
        <span style={{
          fontSize: 10, fontWeight: 600,
          background: "rgba(99,102,241,0.10)", color: "#818cf8",
          padding: "2px 8px", borderRadius: 3,
        }}>
          {pick.league}
        </span>
        <FormatBadge format={pick.format} />
        {pick.isLan && <LanBadge />}
      </div>

      {/* Teams */}
      <div style={{ marginBottom: 12 }}>
        {/* Team 1 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 10px", borderRadius: 4,
          background: isPick1 ? "rgba(34,197,94,0.06)" : "transparent",
          border: isPick1 ? "1px solid rgba(34,197,94,0.15)" : "1px solid transparent",
          marginBottom: 4,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isPick1 && <span style={{ fontSize: 12 }}>✅</span>}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isPick1 ? "#22c55e" : "#e8e0d0" }}>
                {pick.homeTeam}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                <span style={{
                  fontSize: 9, color: "#6b7280",
                  fontFamily: "var(--font-dm-mono), monospace",
                }}>
                  #{pick.team1Rank}
                </span>
                <span style={{ fontSize: 9, color: "#374151" }}>·</span>
                <span style={{
                  fontSize: 9, color: "#4b5563",
                  fontFamily: "var(--font-dm-mono), monospace",
                }}>
                  ELO {pick.team1Elo}
                </span>
                <FormDots form={pick.team1Form} />
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 18, fontWeight: 300, color: isPick1 ? "#22c55e" : "#4b5563",
            fontFamily: "var(--font-dm-mono), monospace",
          }}>
            {Math.round(pick.team1WinProb * 100)}%
          </div>
        </div>

        {/* Team 2 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 10px", borderRadius: 4,
          background: !isPick1 ? "rgba(34,197,94,0.06)" : "transparent",
          border: !isPick1 ? "1px solid rgba(34,197,94,0.15)" : "1px solid transparent",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isPick1 && <span style={{ fontSize: 12 }}>✅</span>}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: !isPick1 ? "#22c55e" : "#e8e0d0" }}>
                {pick.awayTeam}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                <span style={{
                  fontSize: 9, color: "#6b7280",
                  fontFamily: "var(--font-dm-mono), monospace",
                }}>
                  #{pick.team2Rank}
                </span>
                <span style={{ fontSize: 9, color: "#374151" }}>·</span>
                <span style={{
                  fontSize: 9, color: "#4b5563",
                  fontFamily: "var(--font-dm-mono), monospace",
                }}>
                  ELO {pick.team2Elo}
                </span>
                <FormDots form={pick.team2Form} />
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 18, fontWeight: 300, color: !isPick1 ? "#22c55e" : "#4b5563",
            fontFamily: "var(--font-dm-mono), monospace",
          }}>
            {Math.round(pick.team2WinProb * 100)}%
          </div>
        </div>

        {/* Win probability bar */}
        <div style={{ display: "flex", gap: 2, marginTop: 6, alignItems: "center" }}>
          <WinProbBar prob={pick.team1WinProb} color={isPick1 ? "#22c55e" : "#4b5563"} />
          <WinProbBar prob={pick.team2WinProb} color={!isPick1 ? "#22c55e" : "#4b5563"} />
        </div>
      </div>

      {/* Pick + Edge */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 8,
      }}>
        <div>
          <span style={{ fontSize: 10, color: "#44444f", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {pick.market}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#22c55e", marginLeft: 8 }}>
            {pick.pick}
          </span>
          {pick.odds && (
            <span style={{ fontSize: 13, fontWeight: 700, color: "white", marginLeft: 8 }}>
              @ {pick.odds.toFixed(2)}
            </span>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 20, fontWeight: 300, color: cfg.color,
            fontFamily: "var(--font-dm-mono), monospace",
          }}>
            +{Math.round(pick.edge * 100)}%
          </div>
          <div style={{ fontSize: 9, color: "#44444f", textTransform: "uppercase" }}>Edge</div>
        </div>
      </div>

      {/* Reasoning */}
      <p style={{
        fontSize: 12, color: "#9ca3af", lineHeight: 1.5, margin: "0 0 8px",
        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {pick.reasoning}
      </p>

      {/* Market odds notice */}
      {!pick.odds && (
        <div style={{
          fontSize: 10, color: "#6b7280", background: "rgba(107,114,128,0.08)",
          padding: "4px 8px", borderRadius: 3, marginBottom: 8,
        }}>
          ⚠️ No market odds available — model probability only
        </div>
      )}

      {/* Stats + kickoff */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)",
        flexWrap: "wrap", gap: 6,
      }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 400, color: cfg.color, fontFamily: "var(--font-dm-mono), monospace" }}>
              {pick.confidence}%
            </span>
            <span style={{ fontSize: 9, color: "#44444f", marginLeft: 3 }}>Conf</span>
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 400, color: "#9ca3af", fontFamily: "var(--font-dm-mono), monospace" }}>
              {Math.round(pick.modelProb * 100)}%
            </span>
            <span style={{ fontSize: 9, color: "#44444f", marginLeft: 3 }}>Model</span>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#4b5563" }}>
          🕐 {formatKickoff(pick.kickoff)}
        </div>
      </div>
    </div>
  );
}

// ── Main CS2 Picks Section ──────────────────────────────────────────────────

export default function CS2Picks() {
  const [picks, setPicks] = useState<CS2Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchCS2 = useCallback(async () => {
    try {
      const res = await fetch("/api/cs2-picks");
      if (!res.ok) return;
      const data = await res.json();
      setPicks(data.picks ?? []);
      setLastUpdated(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCS2();
    const interval = setInterval(fetchCS2, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCS2]);

  const locks = picks.filter(p => getTier(p.tier) === "lock");
  const strong = picks.filter(p => getTier(p.tier) === "strong");
  const spec = picks.filter(p => getTier(p.tier) === "spec");

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "white", margin: 0, letterSpacing: -0.3 }}>
            🎮 CS2 Predictions
          </h1>
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: "rgba(99,102,241,0.12)", color: "#818cf8",
            padding: "3px 10px", borderRadius: 10,
          }}>
            BETA
          </span>
        </div>
        <div style={{
          fontSize: 12, color: "#6b7280",
          display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        }}>
          <span>Elo-based model using HLTV rankings + form</span>
          {lastUpdated && (
            <span style={{ color: "#374151" }}>
              Updated {lastUpdated.toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour12: true })}
            </span>
          )}
          <button
            onClick={fetchCS2}
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
        {(["lock", "strong", "spec"] as const).map((t) => {
          const cfg = TIER_CONFIG[t];
          const count = t === "lock" ? locks.length : t === "strong" ? strong.length : spec.length;
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
          {picks.length} matches
        </span>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              background: "#141419", borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px",
              height: 200, animation: "pulse 1.5s infinite",
            }} />
          ))}
        </div>
      ) : picks.length === 0 ? (
        <div style={{
          background: "#141419", borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "50px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🎮</div>
          <div style={{ fontSize: 18, color: "#9ca3af", fontWeight: 700, marginBottom: 8 }}>
            No CS2 matches scheduled
          </div>
          <div style={{ fontSize: 13, color: "#4b5563" }}>
            Check back when tournaments are running
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* LOCK tier */}
          {locks.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "#E8C96E", margin: 0, textTransform: "uppercase", letterSpacing: 1.2 }}>
                  🔒 LOCK
                </h2>
                <span style={{ fontSize: 11, color: "#4b5563" }}>{locks.length} pick{locks.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
                {locks.map(p => <CS2MatchCard key={p.matchId} pick={p} />)}
              </div>
            </div>
          )}

          {/* STRONG tier */}
          {strong.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", margin: 0, textTransform: "uppercase", letterSpacing: 1.2 }}>
                  🎯 STRONG
                </h2>
                <span style={{ fontSize: 11, color: "#4b5563" }}>{strong.length} pick{strong.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
                {strong.map(p => <CS2MatchCard key={p.matchId} pick={p} />)}
              </div>
            </div>
          )}

          {/* SPEC tier */}
          {spec.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "#9ca3af", margin: 0, textTransform: "uppercase", letterSpacing: 1.2 }}>
                  ⚡ SPEC
                </h2>
                <span style={{ fontSize: 11, color: "#4b5563" }}>{spec.length} pick{spec.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
                {spec.map(p => <CS2MatchCard key={p.matchId} pick={p} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
