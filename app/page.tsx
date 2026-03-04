"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MatchData } from "@/lib/mock-data";

type Match = MatchData & { score: number; color: "red" | "yellow" | "green" };

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
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.07)",
          padding: 20,
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "white", marginBottom: 2 }}>{m.homeTeam}</div>
            <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 500 }}>vs</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#d1d5db", marginTop: 2 }}>{m.awayTeam}</div>
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

        {/* Props */}
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

  const filtered = matches.filter((m) => tab === "all" || m.sport === tab);

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "24px 16px" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "white", margin: "0 0 4px" }}>
            Today&apos;s Matches
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: 16,
          }}
        >
          {loading
            ? Array(4).fill(null).map((_, i) => <SkeletonCard key={i} />)
            : filtered.map((m) => <MatchCard key={m.id} m={m} />)}
        </div>

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#4b5563", padding: "60px 0" }}>
            No matches scheduled for this sport today.
          </div>
        )}
      </div>
    </main>
  );
}
