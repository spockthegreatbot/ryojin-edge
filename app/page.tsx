"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MatchData } from "@/lib/mock-data";
import type { BetSuggestion } from "@/lib/bet-analyzer";

type Match = MatchData & {
  score: number;
  color: "red" | "yellow" | "green";
  bets?: BetSuggestion[];
  dataSourceApiSports?: boolean;
  dataSourceFootballData?: boolean;
};

const EDGE_COLORS = { red: "#ef4444", yellow: "#eab308", green: "#22c55e" };

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function EdgeBadge({ score, color }: { score: number; color: keyof typeof EDGE_COLORS }) {
  return (
    <div
      style={{
        background: EDGE_COLORS[color],
        borderRadius: "50%",
        width: 52,
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 15,
        color: "#0a0a0f",
        flexShrink: 0,
        boxShadow: `0 0 12px ${EDGE_COLORS[color]}44`,
      }}
    >
      {score}
    </div>
  );
}

function ConfBar({ pct }: { pct: number }) {
  return (
    <div style={{ background: "#1e1e30", borderRadius: 4, height: 4, width: "100%", overflow: "hidden" }}>
      <div
        style={{
          background: pct > 70 ? "#22c55e" : pct > 55 ? "#7c3aed" : "#eab308",
          width: `${pct}%`,
          height: "100%",
          transition: "width 0.3s",
        }}
      />
    </div>
  );
}

function MatchCard({ m }: { m: Match }) {
  return (
    <Link href={`/match/${m.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "#12121a",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.07)",
          padding: 14,
          cursor: "pointer",
          transition: "border-color 0.2s, transform 0.1s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(124,58,237,0.4)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
        }}
      >
        {/* Sport + time */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span
              style={{
                fontSize: 11,
                color: "#7c3aed",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                background: "rgba(124,58,237,0.15)",
                padding: "3px 8px",
                borderRadius: 6,
              }}
            >
              {m.sport === "soccer" ? `⚽ ${(m as Match & { league?: string }).league || "EPL"}` : "🏀 NBA"}
            </span>
            {(m as Match & { isLive?: boolean }).isLive ? (
              <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, background: "rgba(34,197,94,0.12)", padding: "2px 6px", borderRadius: 4, letterSpacing: 0.8 }}>
                ● LIVE
              </span>
            ) : (
              <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, background: "rgba(107,114,128,0.12)", padding: "2px 6px", borderRadius: 4, letterSpacing: 0.8 }}>
                DEMO
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>🕐 {formatKickoff(m.commenceTime)} AEDT</span>
        </div>

        {/* Teams + Edge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "white", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.homeTeam}</div>
            <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500 }}>vs</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#d1d5db", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.awayTeam}</div>
          </div>
          <EdgeBadge score={m.score} color={m.color} />
        </div>

        {/* Odds */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[
            ["H", m.homeOdds],
            ...(m.drawOdds ? [["D", m.drawOdds]] : []),
            ["A", m.awayOdds],
          ].map(([l, v]) => (
            <div
              key={String(l)}
              style={{
                flex: 1,
                background: "#0a0a0f",
                borderRadius: 8,
                padding: "7px 4px",
                textAlign: "center",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "white" }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Bet Suggestions */}
        {m.bets && m.bets.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
              Top Picks
            </div>
            {m.bets.slice(0, 3).map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0a0f", borderRadius: 8, padding: "8px 10px", border: `1px solid ${b.value ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.04)"}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 1 }}>{b.market}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: b.value ? "#22c55e" : "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.pick}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 8 }}>
                  {b.odds && <span style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700 }}>{b.odds.toFixed(2)}</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, color: b.value ? "#22c55e" : "#6b7280", background: b.value ? "rgba(34,197,94,0.1)" : "rgba(107,114,128,0.1)", padding: "2px 6px", borderRadius: 4 }}>
                    {b.confidence}%
                  </span>
                  <span style={{ fontSize: 10 }}>{b.tier.split(" ")[0]}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {m.props.slice(0, 3).map((p) => (
              <div key={p.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{p.label}</span>
                  <span style={{ fontSize: 12, color: "white", fontWeight: 600 }}>
                    {p.value}{" "}
                    <span style={{ color: "#7c3aed" }}>{p.confidence}%</span>
                  </span>
                </div>
                <ConfBar pct={p.confidence} />
              </div>
            ))}
          </div>
        )}

        {/* Data source badges */}
        {(m.dataSourceApiSports || m.dataSourceFootballData) && (
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {m.dataSourceApiSports && (
              <span style={{ fontSize: 10, color: "#4b5563", background: "rgba(75,85,99,0.1)", padding: "2px 6px", borderRadius: 4, letterSpacing: 0.3 }}>
                📊 API-Sports
              </span>
            )}
            {m.dataSourceFootballData && (
              <span style={{ fontSize: 10, color: "#4b5563", background: "rgba(75,85,99,0.1)", padding: "2px 6px", borderRadius: 4, letterSpacing: 0.3 }}>
                📅 football-data
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "#12121a", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", padding: 20 }}>
      {[80, 120, 60, 40, 40, 40].map((w, i) => (
        <div
          key={i}
          style={{
            background: "#1e1e30",
            borderRadius: 6,
            height: i < 2 ? 18 : 12,
            width: `${w}%`,
            marginBottom: 12,
            animation: "pulse 1.5s infinite",
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tab, setTab] = useState<"all" | "soccer" | "nba">("all");
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState("");

  const fetchMatches = async () => {
    try {
      const r = await fetch("/api/matches");
      const d = await r.json();
      setMatches(d);
      setUpdated(
        new Date().toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney" })
      );
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMatches();
    const t = setInterval(fetchMatches, 300000);
    return () => clearInterval(t);
  }, []);

  const filtered = matches
    .filter((m) => tab === "all" || m.sport === tab)
    .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "24px 16px" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .match-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        @media (max-width: 1200px) { .match-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 860px)  { .match-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 540px)  { .match-grid { grid-template-columns: 1fr; } }
      `}</style>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "white", margin: "0 0 4px" }}>
            Upcoming Matches — Next 7 Days
          </h1>
          <p style={{ color: "#6b7280", margin: 0, fontSize: 14 }}>
            Prop predictions updated every 5 mins
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["all", "soccer", "nba"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 20px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                background: tab === t ? "#7c3aed" : "#12121a",
                color: tab === t ? "white" : "#6b7280",
                transition: "all 0.15s",
              }}
            >
              {t === "all" ? "All" : t === "soccer" ? "⚽ Soccer" : "🏀 NBA"}
            </button>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#374151", alignSelf: "center" }}>
            {updated && `Updated ${updated} AEDT`}
          </div>
        </div>

        {/* Grid */}
        <div className="match-grid">
          {loading
            ? Array(8).fill(null).map((_, i) => <SkeletonCard key={i} />)
            : filtered.map((m) => <MatchCard key={m.id} m={m} />)}
        </div>

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#4b5563", padding: "60px 0" }}>
            No matches found for this sport in the next 7 days.
          </div>
        )}
      </div>
    </main>
  );
}
