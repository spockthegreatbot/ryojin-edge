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

function TierBadge({ tier }: { tier: string }) {
  const isPower = tier === "🔥🔥 Power Parlay";
  const isStrong = tier === "🔥 Strong Parlay";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: isPower ? "#a855f7" : isStrong ? "#22c55e" : "#60a5fa",
        background: isPower
          ? "rgba(168,85,247,0.12)"
          : isStrong
          ? "rgba(34,197,94,0.12)"
          : "rgba(96,165,250,0.12)",
        padding: "3px 10px",
        borderRadius: 6,
        border: `1px solid ${isPower ? "rgba(168,85,247,0.3)" : isStrong ? "rgba(34,197,94,0.3)" : "rgba(96,165,250,0.3)"}`,
        whiteSpace: "nowrap" as const,
      }}
    >
      {tier}
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
  const isPower = parlay.tier === "🔥🔥 Power Parlay";
  const isStrong = parlay.tier === "🔥 Strong Parlay";
  const borderColor = isPower
    ? "rgba(168,85,247,0.4)"
    : isStrong
    ? "rgba(34,197,94,0.3)"
    : "rgba(96,165,250,0.2)";
  const leftBorder = isPower ? "#e8e0d0" : isStrong ? "#22c55e" : "#60a5fa";

  return (
    <div
      style={{
        background: "#141419",
        borderRadius: 2,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${leftBorder}`,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, color: "#4b5563", fontWeight: 600 }}>
          {parlay.legs.length}-Leg Parlay
        </div>
        <TierBadge tier={parlay.tier} />
      </div>

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
  twoLeg: Parlay[];
  threeLeg: Parlay[];
  summary: { total: number; power: number; strong: number; value: number };
}

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

  const twoLeg = data?.twoLeg ?? [];
  const threeLeg = data?.threeLeg ?? [];

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
              {
                label: "🔥🔥 Power",
                value: data.summary.power,
                color: "#a855f7",
              },
              {
                label: "🔥 Strong",
                value: data.summary.strong,
                color: "#22c55e",
              },
              {
                label: "✅ Value",
                value: data.summary.value,
                color: "#60a5fa",
              },
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
            {/* 2-Leg Parlays */}
            {twoLeg.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <h2
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  2-Leg Parlays
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
                    {twoLeg.length}
                  </span>
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(380px, 1fr))",
                    gap: 16,
                  }}
                >
                  {twoLeg.map((p, i) => (
                    <ParlayCard key={i} parlay={p} />
                  ))}
                </div>
              </section>
            )}

            {/* 3-Leg Parlays */}
            {threeLeg.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <h2
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  3-Leg Parlays
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
                    {threeLeg.length}
                  </span>
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(420px, 1fr))",
                    gap: 16,
                  }}
                >
                  {threeLeg.map((p, i) => (
                    <ParlayCard key={i} parlay={p} />
                  ))}
                </div>
              </section>
            )}

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
              <strong style={{ color: "#6b7280" }}>ℹ️ How parlays are built:</strong> We combine
              the strongest individual value picks from separate matches. Edge
              compounds when legs are uncorrelated. Kelly sizing is quartered for
              parlay risk. Same-match legs are never combined.
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
