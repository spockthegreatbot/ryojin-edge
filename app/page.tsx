"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { MatchData } from "@/lib/mock-data";
import type { BetSuggestion } from "@/lib/bet-analyzer";

import type { MatchWeather } from "@/lib/weather";

type Match = MatchData & {
  score: number;
  color: "red" | "yellow" | "green";
  bets?: BetSuggestion[];
  dataSourceApiSports?: boolean;
  dataSourceFootballData?: boolean;
  weather?: MatchWeather | null;
  dataSource?: "xG" | "goals_avg";
  aiHeadline?: string;
  homeOnBackToBack?: boolean;
  awayOnBackToBack?: boolean;
};

interface NewsItem { title: string; url: string; source: string; pubDate: string; }
interface OddsMovement { homeDelta: number; awayDelta: number; firstSeen: string; }

const EDGE_COLORS = { red: "#ef4444", yellow: "#eab308", green: "#22c55e" };

function formatKickoff(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return { date, time };
}

// ── Countdown hook ─────────────────────────────────────────────────────────
function useCountdown(targetTime: string | null) {
  const [timeLeft, setTimeLeft] = useState("");
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!targetTime) { setTimeLeft(""); return; }

    const tick = () => {
      const diff = new Date(targetTime).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("LIVE"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    rafRef.current = setInterval(tick, 1000);
    return () => { if (rafRef.current) clearInterval(rafRef.current); };
  }, [targetTime]);

  return timeLeft;
}

function EdgeBadge({ score, color }: { score: number; color: keyof typeof EDGE_COLORS }) {
  return (
    <div style={{
      background: EDGE_COLORS[color],
      borderRadius: "50%",
      width: 52, height: 52,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: 15, color: "#0a0a0f",
      flexShrink: 0,
      boxShadow: `0 0 14px ${EDGE_COLORS[color]}55`,
    }}>
      {score}
    </div>
  );
}

function ConfBar({ pct }: { pct: number }) {
  return (
    <div style={{ background: "#1e1e30", borderRadius: 4, height: 4, width: "100%", overflow: "hidden" }}>
      <div style={{
        background: pct > 70 ? "#22c55e" : pct > 55 ? "#7c3aed" : "#eab308",
        width: `${pct}%`, height: "100%", transition: "width 0.3s",
      }} />
    </div>
  );
}

function sportLabel(m: Match): string {
  if (m.sport === "nba") return "🏀 NBA";
  if (m.sport === "nrl") return `🏉 ${m.league || "NRL"}`;
  if (m.sport === "ufc") return `🥊 ${m.league || "UFC/MMA"}`;
  return `⚽ ${m.league || "Soccer"}`;
}

function evColor(ev: number): string {
  return ev > 0.03 ? "#22c55e" : ev > 0 ? "#eab308" : "#ef4444";
}

function MatchCard({ m }: { m: Match }) {
  const topPick = m.bets?.find((b) => b.value) ?? m.bets?.[0] ?? null;
  const [news, setNews] = useState<NewsItem[]>([]);
  const [evOpen, setEvOpen] = useState(false);
  const [evHome, setEvHome] = useState(m.homeOdds?.toFixed(2) ?? "");
  const [evAway, setEvAway] = useState(m.awayOdds?.toFixed(2) ?? "");
  const [evDraw, setEvDraw] = useState(m.drawOdds?.toFixed(2) ?? "");
  const [movement, setMovement] = useState<OddsMovement | null>(null);

  // Lazy news fetch
  useEffect(() => {
    if (!m.id) return;
    const controller = new AbortController();
    fetch(`/api/news/${m.id}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : [])
      .then((items: NewsItem[]) => setNews(items.slice(0, 2)))
      .catch(() => {});
    return () => controller.abort();
  }, [m.id]);

  // Line movement via localStorage
  useEffect(() => {
    if (!m.homeOdds || m.homeOdds <= 1) return;
    const key = `odds_${m.id}`;
    const stored = localStorage.getItem(key);
    const now = new Date().toISOString();
    if (stored) {
      try {
        const prev = JSON.parse(stored) as { h: number; a: number; ts: string };
        const homeDelta = parseFloat((m.homeOdds - prev.h).toFixed(3));
        const awayDelta = parseFloat((m.awayOdds - prev.a).toFixed(3));
        if (Math.abs(homeDelta) > 0.005 || Math.abs(awayDelta) > 0.005) {
          setMovement({ homeDelta, awayDelta, firstSeen: prev.ts });
        }
        // Update stored value
        localStorage.setItem(key, JSON.stringify({ h: m.homeOdds, a: m.awayOdds, ts: prev.ts }));
      } catch { localStorage.removeItem(key); }
    } else {
      localStorage.setItem(key, JSON.stringify({ h: m.homeOdds, a: m.awayOdds, ts: now }));
    }
  }, [m.id, m.homeOdds, m.awayOdds]);

  // EV calculation from user-input odds
  const calcEV = (inputOdds: string, modelProb: number | undefined): { ev: number; valid: boolean } => {
    const odds = parseFloat(inputOdds);
    if (!odds || odds <= 1 || !modelProb) return { ev: 0, valid: false };
    return { ev: parseFloat(((modelProb * odds) - 1).toFixed(4)), valid: true };
  };
  const homeModelProb = topPick?.pick?.includes(m.homeTeam) ? (topPick.modelProb) : (m.bets?.find(b => b.pick?.includes(m.homeTeam))?.modelProb);
  const awayModelProb = m.bets?.find(b => b.pick?.includes(m.awayTeam))?.modelProb;
  const drawModelProb = m.bets?.find(b => b.pick === "Draw")?.modelProb;
  const evHomeResult = calcEV(evHome, homeModelProb);
  const evAwayResult = calcEV(evAway, awayModelProb);
  const evDrawResult = calcEV(evDraw, drawModelProb);

  return (
    <div style={{ position: "relative" }}>
      {/* EV Calculator panel — floats above the card */}
      {evOpen && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
            background: "#1a1a2e", borderRadius: 16,
            border: "1px solid rgba(124,58,237,0.4)",
            padding: "16px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>🧮 EV Calculator</span>
            <button onClick={() => setEvOpen(false)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>Enter your book&apos;s current odds to calculate expected value</div>
          {[
            { label: m.homeTeam, value: evHome, setter: setEvHome, result: evHomeResult },
            ...(m.drawOdds ? [{ label: "Draw", value: evDraw, setter: setEvDraw, result: evDrawResult }] : []),
            { label: m.awayTeam, value: evAway, setter: setEvAway, result: evAwayResult },
          ].map(({ label, value, setter, result }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{label}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder="e.g. 2.10"
                  step="0.05"
                  style={{
                    flex: 1, background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 7, padding: "6px 10px", color: "white", fontSize: 13,
                    outline: "none",
                  }}
                />
                {result.valid && (
                  <div style={{
                    minWidth: 80, textAlign: "right",
                    fontSize: 13, fontWeight: 700,
                    color: evColor(result.ev),
                  }}>
                    EV {result.ev > 0 ? "+" : ""}{(result.ev * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          ))}
          {evHomeResult.valid && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
              Model probs: H {homeModelProb ? Math.round(homeModelProb * 100) : "—"}% / A {awayModelProb ? Math.round(awayModelProb * 100) : "—"}%{drawModelProb ? ` / D ${Math.round(drawModelProb * 100)}%` : ""}
            </div>
          )}
        </div>
      )}

    <Link href={`/match/${m.id}`} style={{ textDecoration: "none" }}>
      <div
        className="match-card"
        style={{
          background: "#12121a",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "18px 16px",
          cursor: "pointer",
          transition: "border-color 0.2s, box-shadow 0.2s, transform 0.1s",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "rgba(124,58,237,0.4)";
          el.style.boxShadow = "0 0 24px rgba(124,58,237,0.12)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "rgba(255,255,255,0.07)";
          el.style.boxShadow = "none";
        }}
      >
        {/* Sport + time */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{
              fontSize: 11, color: "#7c3aed", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1.5,
              background: "rgba(124,58,237,0.15)", padding: "3px 8px", borderRadius: 6,
            }}>
              {sportLabel(m)}
            </span>
            {(m.homeOnBackToBack || m.awayOnBackToBack) && (
              <span style={{ fontSize: 10, color: "#f97316", background: "rgba(249,115,22,0.15)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                😴 B2B
              </span>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "white", fontWeight: 600 }}>{formatKickoff(m.commenceTime).date}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>🕐 {formatKickoff(m.commenceTime).time}</div>
          </div>
        </div>

        {/* Teams + Edge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "white", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.homeTeam}</div>
            <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, margin: "2px 0" }}>vs</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#d1d5db", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.awayTeam}</div>
          </div>
          <EdgeBadge score={m.score} color={m.color} />
        </div>

        {/* Mini Odds: Home / Draw / Away — with line movement */}
        <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
          {[
            { l: "H", v: m.homeOdds, delta: movement?.homeDelta },
            ...(m.drawOdds ? [{ l: "D", v: m.drawOdds, delta: undefined }] : []),
            { l: "A", v: m.awayOdds, delta: movement?.awayDelta },
          ].map(({ l, v, delta }) => (
            <div key={l} style={{
              flex: 1, background: "#0a0a0f", borderRadius: 7,
              padding: "6px 4px", textAlign: "center",
              border: `1px solid ${delta && delta < -0.02 ? "rgba(34,197,94,0.3)" : delta && delta > 0.02 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.05)"}`,
              position: "relative",
            }}>
              <div style={{ fontSize: 9, color: "#4b5563", marginBottom: 1 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{v || "—"}</div>
              {delta && Math.abs(delta) > 0.02 && (
                <div style={{
                  fontSize: 8, fontWeight: 700, marginTop: 1,
                  color: delta < 0 ? "#22c55e" : "#ef4444",
                }}>
                  {delta < 0 ? `▼ ${Math.abs(delta).toFixed(2)}` : `▲ ${delta.toFixed(2)}`}
                </div>
              )}
            </div>
          ))}
        </div>
        {movement && (
          <div style={{ fontSize: 9, color: "#374151", marginTop: -8, marginBottom: 8, textAlign: "right" }}>
            📈 Line moved since {new Date(movement.firstSeen).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
          </div>
        )}

        {/* No odds yet badge — shown when we have no real market data */}
        {(!m.homeOdds || m.homeOdds <= 1) && (!m.bets || m.bets.length === 0) && (
          <div style={{
            background: "rgba(107,114,128,0.08)",
            borderRadius: 9,
            border: "1px solid rgba(107,114,128,0.2)",
            padding: "8px 10px",
            marginBottom: 10,
            textAlign: "center",
          }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>📊 No odds yet</span>
          </div>
        )}

        {/* Top value pick inline (if any) */}
        {topPick && (
          <div style={{
            background: topPick.value ? "rgba(34,197,94,0.07)" : "rgba(124,58,237,0.06)",
            borderRadius: 9,
            border: `1px solid ${topPick.value ? "rgba(34,197,94,0.2)" : "rgba(124,58,237,0.15)"}`,
            padding: "8px 10px",
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{topPick.market}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: topPick.value ? "#22c55e" : "#c4b5fd" }}>{topPick.pick}</div>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {topPick.odds && <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>{topPick.odds.toFixed(2)}</span>}
                <span style={{ fontSize: 11, fontWeight: 700, color: topPick.value ? "#22c55e" : "#6b7280" }}>{topPick.confidence}%</span>
                <span style={{ fontSize: 10 }}>{topPick.tier.split(" ")[0]}</span>
              </div>
            </div>
          </div>
        )}

        {/* Remaining picks or props */}
        {m.bets && m.bets.length > 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {m.bets.slice(1, 3).map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0a0f", borderRadius: 7, padding: "6px 9px", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 1 }}>{b.market}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: b.value ? "#22c55e" : "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.pick}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: b.value ? "#22c55e" : "#6b7280", background: b.value ? "rgba(34,197,94,0.1)" : "rgba(107,114,128,0.1)", padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>
                  {b.confidence}%
                </span>
              </div>
            ))}
          </div>
        ) : !m.bets && m.props.slice(0, 2).map((p) => (
          <div key={p.label} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{p.label}</span>
              <span style={{ fontSize: 11, color: "white", fontWeight: 600 }}>
                {p.value} <span style={{ color: "#7c3aed" }}>{p.confidence}%</span>
              </span>
            </div>
            <ConfBar pct={p.confidence} />
          </div>
        ))}

        {/* Footer: source badges + xG + weather + referee */}
        <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {/* xG badge */}
          {m.dataSource === "xG" && m.xgHome > 0 && m.xgAway > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: "#7c3aed", background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(124,58,237,0.25)",
              padding: "1px 6px", borderRadius: 4,
            }}>
              📊 xG: {m.xgHome} | {m.xgAway}
            </span>
          )}
          {/* Weather badge */}
          {m.weather && (
            <span style={{
              fontSize: 9, fontWeight: 600,
              color: "#6b7280", background: "rgba(107,114,128,0.1)",
              padding: "1px 6px", borderRadius: 4,
            }}>
              {m.weather.icon} {m.weather.tempC}°C
            </span>
          )}
          {(m.dataSourceApiSports || m.dataSourceFootballData) && (
            <>
              {m.dataSourceApiSports && (
                <span style={{ fontSize: 9, color: "#374151", background: "rgba(55,65,81,0.15)", padding: "1px 5px", borderRadius: 3 }}>
                  📊 API-Sports
                </span>
              )}
              {m.dataSourceFootballData && (
                <span style={{ fontSize: 9, color: "#374151", background: "rgba(55,65,81,0.15)", padding: "1px 5px", borderRadius: 3 }}>
                  📅 fd.org
                </span>
              )}
            </>
          )}
          {m.referee && (
            <span style={{ fontSize: 9, color: "#374151", marginLeft: "auto" }}>
              ⚖️ {m.referee.split(" ").pop()}
            </span>
          )}
        </div>

        {/* AI headline */}
        {m.aiHeadline && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#a78bfa", fontStyle: "italic", lineHeight: 1.4, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            {m.aiHeadline}
          </div>
        )}

        {/* Live news */}
        {news.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            {news.map((n, i) => (
              <a
                key={i}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ display: "block", marginBottom: i < news.length - 1 ? 6 : 0, textDecoration: "none" }}
              >
                <div style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.3, marginBottom: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  📰 {n.title}
                </div>
                <div style={{ fontSize: 9, color: "#4b5563" }}>{n.source}</div>
              </a>
            ))}
          </div>
        )}

        {/* EV Calculator button */}
        {m.homeOdds > 1 && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEvOpen(o => !o); }}
            style={{
              marginTop: 10, width: "100%", padding: "7px 0",
              background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)",
              borderRadius: 8, color: "#7c3aed", fontSize: 11, fontWeight: 700,
              cursor: "pointer", letterSpacing: 0.5,
            }}
          >
            🧮 Calculate EV at your book
          </button>
        )}
      </div>
    </Link>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "#12121a", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", padding: 20 }}>
      {[80, 120, 60, 40, 40, 40].map((w, i) => (
        <div key={i} style={{
          background: "#1e1e30", borderRadius: 6,
          height: i < 2 ? 18 : 12, width: `${w}%`,
          marginBottom: 12, animation: "pulse 1.5s infinite",
        }} />
      ))}
    </div>
  );
}

// ── Stats bar pulse dot ────────────────────────────────────────────────────
function LiveDot() {
  return (
    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#22c55e", marginRight: 4, boxShadow: "0 0 6px #22c55e", animation: "livePulse 1.4s ease-in-out infinite" }} />
  );
}

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tab, setTab] = useState<"all" | "soccer" | "nba" | "nrl" | "ufc">("all");
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState("");
  const [winRate, setWinRate] = useState<number | null>(null);
  const [trackedPicks, setTrackedPicks] = useState<number>(0);

  const fetchMatches = async () => {
    try {
      const r = await fetch("/api/matches");
      const d = await r.json();
      setMatches(d);
      setUpdated(new Date().toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney" }));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Fetch win-rate stats quietly (non-blocking)
  const fetchStats = async () => {
    try {
      const r = await fetch("/api/stats");
      if (!r.ok) return;
      const d = await r.json();
      const ov = d?.overall;
      if (ov?.total > 0) setTrackedPicks(ov.total);
      if (ov?.win_rate != null) setWinRate(ov.win_rate);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    fetchMatches();
    fetchStats();
    const t = setInterval(fetchMatches, 3600000); // 1 hour — odds don't move faster than this
    const ts = setInterval(fetchStats, 3600000); // 1 hour
    return () => { clearInterval(t); clearInterval(ts); };
  }, []);

  // Stats
  const allValueBets = matches.flatMap((m) => (m.bets ?? []).filter((b) => b.value));
  const strongEdges = allValueBets.filter((b) => b.tier === "🔥 Strong");
  const soccerCount = matches.filter((m) => m.sport === "soccer").length;
  const nbaCount = matches.filter((m) => m.sport === "nba").length;
  const nrlCount = matches.filter((m) => m.sport === "nrl").length;
  const ufcCount = matches.filter((m) => m.sport === "ufc").length;

  // Nearest upcoming match for countdown
  const nextMatch = matches
    .filter((m) => new Date(m.commenceTime).getTime() > Date.now())
    .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime())[0] ?? null;

  const countdown = useCountdown(nextMatch?.commenceTime ?? null);

  const filtered = matches
    .filter((m) => tab === "all" || m.sport === tab)
    .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());

  return (
    <main style={{ minHeight: "100vh", background: "#0d0d14", padding: "0 0 40px" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes livePulse { 0%,100%{opacity:1; transform:scale(1)} 50%{opacity:0.6; transform:scale(1.25)} }
        .match-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media (max-width: 1280px) { .match-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 900px)  { .match-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px)  { .match-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Hero header with gradient */}
      <div style={{
        background: "linear-gradient(180deg, rgba(124,58,237,0.12) 0%, rgba(13,13,20,0) 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        padding: "28px 16px 0",
        marginBottom: 0,
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "white", margin: "0 0 4px", letterSpacing: -0.5 }}>
                🏆 TopBet Dashboard
              </h1>
              <p style={{ color: "#6b7280", margin: 0, fontSize: 13 }}>
                Upcoming matches · Next 7 days · Live market analysis
              </p>
            </div>
            <div style={{ fontSize: 12, color: "#374151", alignSelf: "center" }}>
              {updated && `Updated ${updated} AEDT`}
            </div>
          </div>

          {/* Live stats bar */}
          {!loading && (
            <div style={{
              display: "flex", gap: 0, flexWrap: "wrap",
              background: "#12121a",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.07)",
              overflow: "hidden",
              marginBottom: 20,
            }}>
              {[
                {
                  icon: "🏆",
                  label: "Value picks today",
                  value: String(allValueBets.length),
                  color: "#22c55e",
                },
                {
                  icon: "🔥",
                  label: "Strong edges",
                  value: String(strongEdges.length),
                  color: "#f97316",
                },
                {
                  icon: "📊",
                  label: trackedPicks > 0 ? `${trackedPicks} tracked` : "Pick tracker",
                  value: winRate != null ? `${winRate}%` : "Tracking…",
                  color: winRate != null ? (winRate >= 50 ? "#22c55e" : "#ef4444") : "#4b5563",
                },
                {
                  icon: nextMatch ? "⏱" : "📅",
                  label: nextMatch ? `${nextMatch.homeTeam} vs ${nextMatch.awayTeam}` : "Next kickoff",
                  value: countdown || "—",
                  color: "#3b82f6",
                  flex: true,
                },
              ].map(({ icon, label, value, color, flex }, i, arr) => (
                <div
                  key={label}
                  style={{
                    flex: flex ? "1 1 200px" : "0 0 auto",
                    padding: "14px 18px",
                    borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}
                >
                  <div style={{ fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
                    {icon} {label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color }}>
                    {i === 3 && countdown !== "LIVE" && countdown !== "" && <LiveDot />}
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sport tabs */}
          <div style={{ display: "flex", gap: 8, paddingBottom: 0 }}>
            {([
              { key: "all", label: "All Matches", count: matches.length },
              { key: "soccer", label: "⚽ Soccer", count: soccerCount },
              { key: "nba", label: "🏀 NBA", count: nbaCount },
              { key: "nrl", label: "🏉 NRL", count: nrlCount },
              { key: "ufc", label: "🥊 UFC", count: ufcCount },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: "9px 18px",
                  borderRadius: "10px 10px 0 0",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  background: tab === key ? "#7c3aed" : "rgba(255,255,255,0.04)",
                  color: tab === key ? "white" : "#6b7280",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  position: "relative",
                  bottom: -1,
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: tab === key ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
                    color: tab === key ? "white" : "#4b5563",
                    padding: "1px 6px",
                    borderRadius: 20,
                    minWidth: 18,
                    textAlign: "center",
                  }}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px 0" }}>
        <div className="match-grid">
          {loading
            ? Array(8).fill(null).map((_, i) => <SkeletonCard key={i} />)
            : filtered.map((m) => <MatchCard key={m.id} m={m} />)}
        </div>

        {!loading && filtered.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "80px 20px",
            background: "#12121a",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{
              fontSize: 40, marginBottom: 16,
              animation: "livePulse 2s ease-in-out infinite",
              display: "inline-block",
            }}>
              📡
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#9ca3af", marginBottom: 8 }}>
              Checking markets...
            </div>
            <div style={{ fontSize: 13, color: "#4b5563" }}>
              No {tab !== "all" ? tab.toUpperCase() + " " : ""}matches scheduled for the next 7 days.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
