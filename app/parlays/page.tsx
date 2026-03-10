"use client";

import { useEffect, useState, useCallback } from "react";
import { Parlay, ParlayLeg } from "@/lib/parlays";

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    month: "short",
    day: "numeric",
  });
}

function tierColor(tier: string): string {
  if (tier === "🎯 High Confidence") return "#60a5fa";
  if (tier === "💰 Value Accumulator") return "#22c55e";
  if (tier === "🚀 Power Parlay") return "#a855f7";
  if (tier === "🌍 League Spread") return "#f59e0b";
  return "#60a5fa";
}

function tierBg(tier: string): string {
  if (tier === "🎯 High Confidence") return "rgba(96,165,250,0.12)";
  if (tier === "💰 Value Accumulator") return "rgba(34,197,94,0.12)";
  if (tier === "🚀 Power Parlay") return "rgba(168,85,247,0.12)";
  if (tier === "🌍 League Spread") return "rgba(245,158,11,0.12)";
  return "rgba(96,165,250,0.12)";
}

function tierBorder(tier: string): string {
  if (tier === "🎯 High Confidence") return "rgba(96,165,250,0.3)";
  if (tier === "💰 Value Accumulator") return "rgba(34,197,94,0.3)";
  if (tier === "🚀 Power Parlay") return "rgba(168,85,247,0.3)";
  if (tier === "🌍 League Spread") return "rgba(245,158,11,0.3)";
  return "rgba(96,165,250,0.3)";
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: tierColor(tier),
        background: tierBg(tier),
        padding: "3px 10px",
        borderRadius: 6,
        border: `1px solid ${tierBorder(tier)}`,
        whiteSpace: "nowrap" as const,
      }}
    >
      {tier}
    </span>
  );
}

function StrategyChip({ strategy }: { strategy: Parlay['strategy'] }) {
  const labels: Record<Parlay['strategy'], string> = {
    'high-confidence': 'HIGH CONFIDENCE',
    'value-accumulator': 'VALUE ACCUMULATOR',
    'power-parlay': 'POWER PARLAY',
    'league-spread': 'LEAGUE SPREAD',
  };
  const colors: Record<Parlay['strategy'], string> = {
    'high-confidence': '#60a5fa',
    'value-accumulator': '#22c55e',
    'power-parlay': '#a855f7',
    'league-spread': '#f59e0b',
  };
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        color: colors[strategy],
        letterSpacing: 1.2,
        textTransform: "uppercase" as const,
        opacity: 0.7,
      }}
    >
      {labels[strategy]}
    </span>
  );
}

function LegRow({ leg, index }: { leg: ParlayLeg; index: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#e8e0d0",
          background: "rgba(232,224,208,0.08)",
          width: 20,
          height: 20,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {index + 1}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
          {leg.pick}{" "}
          <span style={{ color: "#22c55e", fontWeight: 600 }}>
            ({leg.odds.toFixed(2)})
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
          {leg.match} · {leg.league} · {formatKickoff(leg.kickoff)}
        </div>
        <div style={{ fontSize: 10, color: "#4b5563", marginTop: 1 }}>
          {leg.market} · Model: {Math.round(leg.modelProb * 100)}% · Edge:{" "}
          <span style={{ color: "#22c55e" }}>{leg.edgePct}</span>
        </div>
      </div>
    </div>
  );
}

function ParlayCard({ parlay }: { parlay: Parlay }) {
  const color = tierColor(parlay.tier);
  const borderColor = parlay.tier === "🎯 High Confidence"
    ? "rgba(96,165,250,0.25)"
    : parlay.tier === "💰 Value Accumulator"
    ? "rgba(34,197,94,0.25)"
    : parlay.tier === "🚀 Power Parlay"
    ? "rgba(168,85,247,0.3)"
    : "rgba(245,158,11,0.25)";

  return (
    <div
      style={{
        background: "#141419",
        borderRadius: 2,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${color}`,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Strategy chip */}
      <div style={{ marginBottom: 6 }}>
        <StrategyChip strategy={parlay.strategy} />
      </div>

      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 6,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, color: "#4b5563", fontWeight: 600 }}>
          {parlay.legs.length}-Leg Parlay
        </div>
        <TierBadge tier={parlay.tier} />
      </div>

      {/* Reason text */}
      {parlay.reason && (
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            fontStyle: "italic",
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          {parlay.reason}
        </div>
      )}

      {/* Legs */}
      <div style={{ marginBottom: 14 }}>
        {parlay.legs.map((leg, i) => (
          <LegRow key={i} leg={leg} index={i} />
        ))}
      </div>

      {/* Combined section */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          borderRadius: 10,
          padding: "12px 14px",
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 2 }}>
            Combined Odds
          </div>
          <div style={{ fontSize: 28, fontWeight: 300, color: "#f0f0f0", fontFamily: "var(--font-dm-mono), monospace" }}>
            @ {parlay.combinedOdds.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 2 }}>
            Combined Edge
          </div>
          <div style={{ fontSize: 22, fontWeight: 300, color: "#22c55e", fontFamily: "var(--font-dm-mono), monospace" }}>
            {parlay.combinedEdgePct}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 2 }}>
            Model Prob
          </div>
          <div style={{ fontSize: 18, fontWeight: 300, color: "#e8e0d0", fontFamily: "var(--font-dm-mono), monospace" }}>
            {parlay.combinedProb}%
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 2 }}>
            Kelly Size
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#9ca3af" }}>
            📊 {parlay.kellySuggestion}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: 10, fontSize: 10, color: "#374151", fontStyle: "italic" }}>
        Parlay assumes leg independence. Correlated legs (same match) excluded.
      </div>
    </div>
  );
}

interface ParlayPayload {
  generated: string;
  parlays: Parlay[];
  summary: {
    total: number;
    byStrategy: {
      highConfidence: number;
      valueAccumulator: number;
      powerParlay: number;
      leagueSpread: number;
    };
  };
}

const STRATEGY_SECTIONS: Array<{
  key: Parlay['strategy'];
  label: string;
  color: string;
}> = [
  { key: 'high-confidence',  label: '🎯 High Confidence',   color: '#60a5fa' },
  { key: 'value-accumulator', label: '💰 Value Accumulators', color: '#22c55e' },
  { key: 'power-parlay',     label: '🚀 Power Parlays',      color: '#a855f7' },
  { key: 'league-spread',    label: '🌍 League Spread',      color: '#f59e0b' },
];

export default function ParlaysPage() {
  const [data, setData] = useState<ParlayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchParlays = useCallback(async () => {
    try {
      const res = await fetch("/api/parlays");
      if (!res.ok) return;
      const json: ParlayPayload = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParlays();
    const interval = setInterval(fetchParlays, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchParlays]);

  const byStrategy = (strategy: Parlay['strategy']) =>
    (data?.parlays ?? []).filter(p => p.strategy === strategy).slice(0, 2);

  return (
    <main style={{ minHeight: "100vh", background: "#080808" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "white",
              marginBottom: 8,
              letterSpacing: -0.5,
            }}
          >
            🎰 Top Parlays
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", maxWidth: 600, lineHeight: 1.6 }}>
            Model-generated multi-bet combinations. Each leg independently
            verified. Parlays shown only when all legs have real Pinnacle odds.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            {lastUpdated && (
              <span style={{ fontSize: 12, color: "#374151" }}>
                Updated{" "}
                {lastUpdated.toLocaleTimeString("en-AU", {
                  timeZone: "Australia/Sydney",
                  hour12: true,
                })}
              </span>
            )}
            <button
              onClick={fetchParlays}
              style={{
                background: "rgba(232,224,208,0.08)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#888899",
                borderRadius: 6,
                padding: "3px 10px",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Summary pills */}
        {data && (
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 28,
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "🎯 High Confidence", value: data.summary.byStrategy.highConfidence,   color: "#60a5fa" },
              { label: "💰 Value Accumulators", value: data.summary.byStrategy.valueAccumulator, color: "#22c55e" },
              { label: "🚀 Power Parlays",    value: data.summary.byStrategy.powerParlay,     color: "#a855f7" },
              { label: "🌍 League Spread",    value: data.summary.byStrategy.leagueSpread,    color: "#f59e0b" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: "#141419",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 2,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color,
                }}
              >
                {label} <span style={{ color: "white" }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: "#141419",
                  borderRadius: 2,
                  border: "1px solid rgba(255,255,255,0.07)",
                  height: 180,
                  animation: "pulse 1.5s infinite",
                }}
              />
            ))}
          </div>
        ) : (data?.parlays?.length ?? 0) === 0 ? (
          <div
            style={{
              background: "#141419",
              borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.07)",
              padding: "60px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 14 }}>🎰</div>
            <div
              style={{
                fontSize: 18,
                color: "#9ca3af",
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              No parlays available right now
            </div>
            <div style={{ fontSize: 13, color: "#4b5563" }}>
              Parlays require at least 2 value picks from different matches with
              real odds. Check back closer to kickoff.
            </div>
          </div>
        ) : (
          <>
            {STRATEGY_SECTIONS.map(({ key, label, color }) => {
              const section = byStrategy(key);
              if (section.length === 0) return null;
              return (
                <section key={key} style={{ marginBottom: 40 }}>
                  <h2
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color,
                      textTransform: "uppercase",
                      letterSpacing: 1.2,
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {label}
                    <span
                      style={{
                        fontSize: 11,
                        background: "rgba(255,255,255,0.08)",
                        padding: "2px 8px",
                        borderRadius: 20,
                        color: "#6b7280",
                        fontWeight: 500,
                      }}
                    >
                      {section.length}
                    </span>
                  </h2>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {section.map((p, i) => (
                      <ParlayCard key={i} parlay={p} />
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Info footer */}
            <div
              style={{
                background: "#141419",
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.05)",
                padding: "12px 16px",
                fontSize: 12,
                color: "#4b5563",
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: "#6b7280" }}>ℹ️ How parlays are built:</strong> Four distinct
              strategies — High Confidence targets win probability, Value Accumulator maximises edge
              across leagues, Power Parlay optimises risk/reward ratio, League Spread ensures
              cross-competition diversity. Kelly sizing is quartered for parlay risk. Same-match legs
              are never combined.
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </main>
  );
}
