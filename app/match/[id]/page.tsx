"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MOCK_MATCHES, MatchData } from "@/lib/mock-data";
import { calcEdgeScore, buildPropReasoning, PropReasoning, EdgeResult } from "@/lib/edge-calculator";
import { NewsItem } from "@/app/api/news/[matchId]/route";
import { analyzeMatch, BetSuggestion, FactorBreakdown } from "@/lib/bet-analyzer";
import { cardStyleLabel } from "@/lib/referees";
import type { MatchWeather } from "@/lib/weather";

const EDGE_COLORS = { red: "#ef4444", yellow: "#eab308", green: "#22c55e" };
const FORM_COLORS: Record<string, string> = { W: "#22c55e", D: "#eab308", L: "#ef4444" };
const IMPACT_COLORS = { positive: "#22c55e", neutral: "#6b7280", negative: "#ef4444" };
const IMPACT_ICONS = { positive: "↑", neutral: "→", negative: "↓" };

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

function timeAgo(pubDate: string) {
  try {
    const diff = Date.now() - new Date(pubDate).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return "";
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#12121a",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.07)",
      padding: 18,
      ...style,
    }}>
      {children}
    </div>
  );
}

function FactorTags({ factors }: { factors: FactorBreakdown[] }) {
  const dirColor = (d: "+" | "-" | "=") =>
    d === "+" ? "#22c55e" : d === "-" ? "#ef4444" : "#6b7280";
  const dirIcon = (d: "+" | "-" | "=") =>
    d === "+" ? "📈" : d === "-" ? "📉" : "➖";

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
      {factors.map((f, i) => (
        <span
          key={i}
          style={{
            fontSize: 10,
            color: dirColor(f.direction),
            background: `${dirColor(f.direction)}18`,
            border: `1px solid ${dirColor(f.direction)}33`,
            borderRadius: 5,
            padding: "2px 7px",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {dirIcon(f.direction)} {f.label} {f.direction}{Math.abs(Math.round(f.impact * 100))}%
        </span>
      ))}
    </div>
  );
}

function PropCard({ p }: { p: PropReasoning }) {
  const [open, setOpen] = useState(false);
  const conf = p.confidence;
  const barColor = conf > 70 ? "#22c55e" : conf > 55 ? "#7c3aed" : "#eab308";

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{p.prop}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "white" }}>{p.value}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: barColor }}>{conf}%</div>
          <div style={{ fontSize: 10, color: "#6b7280" }}>confidence</div>
        </div>
      </div>
      <div style={{ background: "#0a0a0f", borderRadius: 4, height: 5, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ background: barColor, width: `${conf}%`, height: "100%", transition: "width 0.4s" }} />
      </div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "1px solid rgba(124,58,237,0.3)",
          color: "#7c3aed",
          borderRadius: 6,
          padding: "5px 10px",
          fontSize: 12,
          cursor: "pointer",
          fontWeight: 500,
          width: "100%",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>🧠 Why this prediction?</span>
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10 }}>
          {p.why.map((reason, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ color: "#7c3aed", fontSize: 13, flexShrink: 0, marginTop: 1 }}>•</span>
              <span style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.5 }}>{reason}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "#12121a",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "14px 16px",
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(124,58,237,0.35)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "white", lineHeight: 1.4, marginBottom: 6 }}>
              {item.title}
            </div>
            {item.snippet && (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 6 }}>
                {item.snippet}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 500 }}>{item.source}</span>
              {item.pubDate && <span style={{ fontSize: 11, color: "#374151" }}>{timeAgo(item.pubDate)}</span>}
            </div>
          </div>
          <span style={{ color: "#374151", fontSize: 14, flexShrink: 0, marginTop: 2 }}>↗</span>
        </div>
      </div>
    </a>
  );
}

function displayStat(value: number | string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && value === 0) return "—";
  if (typeof value === "string" && (value === "0" || value === "0.0" || value === "0%")) return "—";
  return typeof value === "number" ? value.toString() : value;
}

// Collapsible "How we calculated this" section
function AlgorithmExplainer({ bets, isSoccer }: { bets: BetSuggestion[]; isSoccer: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "1px solid rgba(124,58,237,0.25)",
          color: "#7c3aed",
          borderRadius: 8,
          padding: "7px 14px",
          fontSize: 12,
          cursor: "pointer",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>🔬 How we calculated this</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{
          marginTop: 12,
          background: "#0d0d18",
          borderRadius: 10,
          border: "1px solid rgba(124,58,237,0.15)",
          padding: 16,
          fontSize: 13,
          color: "#9ca3af",
          lineHeight: 1.7,
        }}>
          <p style={{ margin: "0 0 10px", fontWeight: 600, color: "#c4b5fd" }}>📐 Model Components</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            <li><strong style={{ color: "#e5e7eb" }}>Elo Ratings:</strong> Teams ranked by league table position → Elo score (1250–1750). Win probability calculated using logistic formula with 50-point home advantage.</li>
            {isSoccer && (
              <>
                <li><strong style={{ color: "#e5e7eb" }}>Dixon-Coles Poisson:</strong> Goals modelled as Poisson distributions. Low-scoring scorelines (0-0, 1-0, 0-1, 1-1) corrected with ρ=−0.13 to reflect real-world under-representation of these results in standard Poisson.</li>
                <li><strong style={{ color: "#e5e7eb" }}>Referee Intelligence:</strong> Referee card style (strict/lenient) adjusts cards market confidence. Penalty rate flags are applied to match result reasoning.</li>
              </>
            )}
            <li><strong style={{ color: "#e5e7eb" }}>Recent Form:</strong> Last 5 results weighted (W=1, D=0.4, L=0). Form differential adjusts match result probabilities.</li>
            <li><strong style={{ color: "#e5e7eb" }}>H2H Record:</strong> Last 10 head-to-head results contribute 10–15% weight to win probability.</li>
            <li><strong style={{ color: "#e5e7eb" }}>De-vigged Market:</strong> Bookmaker margin removed from odds to get true implied probability. Our model vs true market = edge.</li>
            <li><strong style={{ color: "#e5e7eb" }}>Kelly Criterion:</strong> ¼ Kelly fraction used for staking suggestions. (Full Kelly × 0.25 for safety.)</li>
          </ul>
          {bets.some((b) => b.factors && b.factors.length > 0) && (
            <p style={{ margin: "12px 0 0", fontSize: 12, color: "#4b5563" }}>
              Factor breakdown tags show each component&apos;s contribution to edge: 📈 positive / 📉 negative / ➖ neutral
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MatchPage({ params }: { params: { id: string } }) {
  const [m, setM] = useState<MatchData | undefined>(MOCK_MATCHES.find((x) => x.id === params.id));
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [aiHeadlineLive, setAiHeadlineLive] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  useEffect(() => {
    if (!m) {
      fetch("/api/matches")
        .then((r) => r.json())
        .then((matches: MatchData[]) => {
          const found = matches.find((x) => x.id === params.id);
          if (found) setM(found);
        })
        .catch(() => {});
    }
  }, [params.id, m]);

  // FIX 1: Pass team names as query params so news API can search without mock-data lookup
  useEffect(() => {
    if (!m) return;
    const qs = m.homeTeam && m.awayTeam
      ? `?home=${encodeURIComponent(m.homeTeam)}&away=${encodeURIComponent(m.awayTeam)}&league=${encodeURIComponent(m.league)}`
      : "";
    fetch(`/api/news/${params.id}${qs}`)
      .then((r) => r.json())
      .then((d) => { setNews(d); setNewsLoading(false); })
      .catch(() => setNewsLoading(false));
  }, [params.id, m]);

  // Real AI analysis — called once match data loads
  useEffect(() => {
    if (!m || !m.homeOdds || m.homeOdds <= 1) return;
    setAiLoading(true);
    fetch(`/api/ai-analysis/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(m),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.analysis) {
          setAiAnalysis(d.analysis);
          setAiHeadlineLive(d.headline ?? "");
        } else {
          setAiError(true);
        }
      })
      .catch(() => setAiError(true))
      .finally(() => setAiLoading(false));
  }, [params.id, m?.homeOdds]);

  if (!m) {
    return (
      <main style={{ background: "#0a0a0f", minHeight: "100vh", padding: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#6b7280" }}>
          <div style={{ width: 20, height: 20, border: "2px solid #7c3aed", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Loading match...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  const edge: EdgeResult = calcEdgeScore({
    homeForm: m.homeForm,
    awayForm: m.awayForm,
    h2hHomeWins: m.h2hHomeWins,
    h2hTotal: m.h2hTotal,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
  });

  const propReasonings: PropReasoning[] = buildPropReasoning(m);
  const isSoccer = m.sport === "soccer";
  const isNRL = m.sport === "nrl";
  const isUFC = m.sport === "ufc";
  const bets = analyzeMatch({ ...m });
  const valueBets = bets.filter((b) => b.value);
  const otherBets = bets.filter((b) => !b.value).slice(0, 3);
  const allBets = [...valueBets, ...otherBets];

  const statRows = isSoccer
    ? [
        ["Avg Goals / Game", m.goalsAvgHome, m.goalsAvgAway],
        ["Expected Goals (xG)", m.xgHome, m.xgAway],
        ["Avg Corners / Game", m.cornersAvgHome, m.cornersAvgAway],
        ["Avg Cards / Game", m.cardsAvgHome, m.cardsAvgAway],
        ["1st Half Goals Avg", m.firstHalfGoalsAvg, "—"],
        ["Clean Sheet %", m.cleanSheetHome ? `${m.cleanSheetHome}%` : 0, m.cleanSheetAway ? `${m.cleanSheetAway}%` : 0],
        ["VAR Likelihood", m.varLikelihood ? `${m.varLikelihood}%` : 0, "—"],
      ]
    : isNRL
    ? [
        ["League", "NRL", "NRL"],
        ["Format", "80 min + Golden Point", "No draws"],
        ["Avg Total Points", "~43 pts/game", "(season avg)"],
        ["Scoring", "Try (4pt) + Conv (2pt)", "Penalty (2pt), Field Goal (1pt)"],
      ]
    : isUFC
    ? [
        ["Format", "3 rounds (5 for main)", "Title fights"],
        ["Win methods", "KO/TKO, Sub, Dec", ""],
        ["No draw", "Majority draw possible", "rare"],
      ]
    : [["Avg Points / Game", m.goalsAvgHome, m.goalsAvgAway]];

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "24px 16px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Link href="/" style={{ color: "#7c3aed", textDecoration: "none", fontSize: 14, display: "inline-block", marginBottom: 20 }}>
          ← Back to Dashboard
        </Link>

        {/* Match Header */}
        <Card style={{ marginBottom: 28, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{
                fontSize: 11, color: "#7c3aed", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 1.5,
                background: "rgba(124,58,237,0.15)", padding: "3px 8px",
                borderRadius: 6, display: "inline-block", marginBottom: 12,
              }}>
                {isSoccer ? "⚽" : isNRL ? "🏉" : isUFC ? "🥊" : "🏀"} {m.league}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "white" }}>{m.homeTeam}</div>
              <div style={{ color: "#4b5563", margin: "4px 0", fontSize: 13 }}>vs</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#d1d5db" }}>{m.awayTeam}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>🕐 {formatKickoff(m.commenceTime)} AEDT</div>
              {/* Referee tag */}
              {m.referee && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>⚖️ Referee:</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af" }}>{m.referee}</span>
                  {m.refereeStats && (
                    <span style={{
                      fontSize: 10,
                      color: cardStyleLabel(m.refereeStats.cardStyle).color,
                      background: `${cardStyleLabel(m.refereeStats.cardStyle).color}18`,
                      border: `1px solid ${cardStyleLabel(m.refereeStats.cardStyle).color}33`,
                      borderRadius: 4,
                      padding: "1px 6px",
                      fontWeight: 700,
                    }}>
                      {cardStyleLabel(m.refereeStats.cardStyle).label}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{
                background: EDGE_COLORS[edge.color],
                borderRadius: "50%", width: 72, height: 72,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 26, color: "#0a0a0f",
                margin: "0 auto 8px",
                boxShadow: `0 0 24px ${EDGE_COLORS[edge.color]}55`,
              }}>
                {edge.score}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 }}>Edge Score</div>
              {/* Elo display */}
              {m.homeElo && m.awayElo && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#4b5563" }}>
                  Elo {m.homeElo.toFixed(0)} / {m.awayElo.toFixed(0)}
                </div>
              )}
            </div>
          </div>

          {/* Odds bar */}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            {[
              [m.homeTeam, m.homeOdds],
              ...(m.drawOdds ? [["Draw", m.drawOdds]] : []),
              [m.awayTeam, m.awayOdds],
            ].map(([l, v]) => (
              <div key={String(l)} style={{
                flex: 1, background: "#0a0a0f", borderRadius: 10,
                padding: "10px 8px", textAlign: "center",
                border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 3 }}>{String(l)}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "white" }}>{v}</div>
              </div>
            ))}
          </div>

          {/* xG + Weather row */}
          {(((m as MatchData & { dataSource?: string }).dataSource === "xG" && m.xgHome > 0 && m.xgAway > 0) || (m as MatchData & { weather?: MatchWeather | null }).weather) && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              {(m as MatchData & { dataSource?: string }).dataSource === "xG" && m.xgHome > 0 && (
                <div style={{
                  background: "rgba(124,58,237,0.1)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  color: "#c4b5fd",
                  fontWeight: 600,
                }}>
                  📊 xG: <span style={{ color: "#7c3aed" }}>{m.xgHome}</span> | <span style={{ color: "#7c3aed" }}>{m.xgAway}</span>
                  <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 8 }}>via Understat (last 10 matches)</span>
                </div>
              )}
              {(() => {
                const weather = (m as MatchData & { weather?: MatchWeather | null }).weather;
                if (!weather) return null;
                return (
                  <div style={{
                    background: "rgba(59,130,246,0.08)",
                    border: "1px solid rgba(59,130,246,0.2)",
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 13,
                    color: "#93c5fd",
                    fontWeight: 600,
                  }}>
                    {weather.icon} {weather.description} — {weather.rainMm.toFixed(1)}mm expected | {weather.tempC}°C | {weather.windKph}km/h wind
                    {weather.goalsImpact !== 0 && (
                      <span style={{ color: weather.goalsImpact < 0 ? "#ef4444" : "#22c55e", marginLeft: 8, fontSize: 11 }}>
                        {(weather.goalsImpact * 100).toFixed(0)}% goals impact
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </Card>

        {/* Bet Suggestions */}
        <Section title="🎯 Betting Analysis">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allBets.map((b, i) => (
              <Card key={i} style={{ padding: "16px 18px", border: b.value ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8 }}>{b.market}</span>
                      {b.value && <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, background: "rgba(34,197,94,0.1)", padding: "1px 6px", borderRadius: 4 }}>VALUE BET</span>}
                      <span style={{ fontSize: 11 }}>{b.tier}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: b.value ? "#22c55e" : "white", marginBottom: 4 }}>{b.pick}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{b.reasoning}</div>
                    {/* Factor breakdown tags */}
                    {b.factors && b.factors.length > 0 && <FactorTags factors={b.factors} />}
                    {/* Kelly suggestion */}
                    <div style={{ marginTop: 8, fontSize: 11, color: b.value ? "#22c55e" : "#4b5563" }}>
                      📊 Kelly: {b.kellySuggestion}
                    </div>
                    {/* Best book recommendation */}
                    {b.bestBook && b.bestOdds && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#eab308" }}>
                        🏦 Best price: <strong>{b.bestBook}</strong> @ {b.bestOdds.toFixed(2)}
                        {b.bestEdge !== undefined && (
                          <span style={{ color: b.bestEdge > 0 ? "#22c55e" : "#ef4444", marginLeft: 6 }}>
                            ({b.bestEdge > 0 ? "+" : ""}{(b.bestEdge * 100).toFixed(1)}% edge at best odds)
                          </span>
                        )}
                      </div>
                    )}
                    {/* Referee note */}
                    {b.refereeNote && (
                      <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>{b.refereeNote}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, minWidth: 80 }}>
                    {b.odds && <div style={{ fontSize: 18, fontWeight: 700, color: "#7c3aed" }}>{b.odds.toFixed(2)}</div>}
                    <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{b.confidence}%</div>
                    <div style={{ fontSize: 11, color: b.edge >= 0.05 ? "#22c55e" : b.edge >= 0 ? "#eab308" : "#ef4444" }}>
                      {b.edge >= 0 ? "+" : ""}{(b.edge * 100).toFixed(1)}¢ edge
                    </div>
                  </div>
                </div>
                {/* Probability comparison bar */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4b5563", marginBottom: 4 }}>
                    <span>Model: {Math.round(b.modelProb * 100)}%</span>
                    <span>Market: {Math.round(b.marketProb * 100)}%</span>
                  </div>
                  <div style={{ background: "#0a0a0f", borderRadius: 4, height: 6, position: "relative", overflow: "hidden" }}>
                    <div style={{ background: "#7c3aed44", width: `${b.marketProb * 100}%`, height: "100%", position: "absolute" }} />
                    <div style={{ background: b.value ? "#22c55e" : "#7c3aed", width: `${b.modelProb * 100}%`, height: "100%", borderRadius: 4, opacity: 0.8 }} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <AlgorithmExplainer bets={allBets} isSoccer={isSoccer} />
        </Section>

        {/* ── Bookmaker Odds Comparison ── */}
        {isSoccer && (() => {
          const allBookOdds = (m as MatchData & { allBookOdds?: { book: string; home: number; away: number; draw?: number }[] }).allBookOdds;
          if (!allBookOdds || allBookOdds.length === 0) return null;
          const sorted = [...allBookOdds].sort((a, b) => b.home - a.home);
          return (
            <Section title="🏦 Bookmaker Odds Comparison">
              <Card style={{ padding: "16px 0", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <th style={{ textAlign: "left", padding: "8px 16px", color: "#6b7280", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Bookmaker</th>
                      <th style={{ textAlign: "center", padding: "8px 10px", color: "#6b7280", fontWeight: 600, fontSize: 11 }}>{m.homeTeam.split(" ").pop()}</th>
                      <th style={{ textAlign: "center", padding: "8px 10px", color: "#6b7280", fontWeight: 600, fontSize: 11 }}>Draw</th>
                      <th style={{ textAlign: "center", padding: "8px 10px", color: "#6b7280", fontWeight: 600, fontSize: 11 }}>{m.awayTeam.split(" ").pop()}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.slice(0, 10).map((bk, i) => {
                      const bestHome = Math.max(...allBookOdds.map(b => b.home));
                      const bestAway = Math.max(...allBookOdds.map(b => b.away));
                      const bestDraw = Math.max(...allBookOdds.filter(b => b.draw).map(b => b.draw ?? 0));
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "8px 16px", color: "#9ca3af", fontWeight: 600 }}>{bk.book}</td>
                          <td style={{ textAlign: "center", padding: "8px 10px", color: bk.home === bestHome ? "#22c55e" : "white", fontWeight: bk.home === bestHome ? 700 : 400 }}>
                            {bk.home.toFixed(2)}{bk.home === bestHome && <span style={{ fontSize: 9, marginLeft: 3 }}>★</span>}
                          </td>
                          <td style={{ textAlign: "center", padding: "8px 10px", color: bk.draw === bestDraw ? "#22c55e" : "#6b7280", fontWeight: bk.draw === bestDraw ? 700 : 400 }}>
                            {bk.draw ? bk.draw.toFixed(2) : "—"}{bk.draw === bestDraw && bk.draw > 0 && <span style={{ fontSize: 9, marginLeft: 3 }}>★</span>}
                          </td>
                          <td style={{ textAlign: "center", padding: "8px 10px", color: bk.away === bestAway ? "#22c55e" : "white", fontWeight: bk.away === bestAway ? 700 : 400 }}>
                            {bk.away.toFixed(2)}{bk.away === bestAway && <span style={{ fontSize: 9, marginLeft: 3 }}>★</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ padding: "8px 16px 0", fontSize: 10, color: "#374151" }}>★ Best available odds highlighted in green</div>
              </Card>
            </Section>
          );
        })()}

        {/* ── Referee Intelligence Section ── */}
        {m.refereeStats && m.referee && (
          <Section title="⚖️ Referee Intelligence">
            <Card style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                {/* Avatar placeholder */}
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "linear-gradient(135deg, #7c3aed44, #7c3aed22)",
                  border: "2px solid rgba(124,58,237,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, flexShrink: 0,
                }}>
                  ⚖️
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "white", marginBottom: 4 }}>{m.referee}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: cardStyleLabel(m.refereeStats.cardStyle).color,
                      background: `${cardStyleLabel(m.refereeStats.cardStyle).color}18`,
                      border: `1px solid ${cardStyleLabel(m.refereeStats.cardStyle).color}33`,
                      padding: "2px 8px", borderRadius: 6,
                    }}>
                      {cardStyleLabel(m.refereeStats.cardStyle).label} on cards
                    </span>
                    <span style={{ fontSize: 11, color: "#4b5563" }}>{m.refereeStats.league === "PL" ? "Premier League" : m.refereeStats.league === "CL" ? "Champions League" : "EPL / UCL"}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6, fontStyle: "italic" }}>
                    &quot;{m.refereeStats.notes}&quot;
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginTop: 18 }}>
                {[
                  { label: "Yellow Cards", value: m.refereeStats.yellowCardsPerGame.toFixed(1), unit: "/game", color: "#eab308", warn: m.refereeStats.yellowCardsPerGame > 3.8 },
                  { label: "Red Cards", value: m.refereeStats.redCardsPerGame.toFixed(2), unit: "/game", color: "#ef4444", warn: m.refereeStats.redCardsPerGame > 0.10 },
                  { label: "Penalties", value: m.refereeStats.penaltiesPerGame.toFixed(2), unit: "/game", color: "#7c3aed", warn: m.refereeStats.penaltiesPerGame > 0.32 },
                  { label: "Fouls", value: m.refereeStats.foulsPerGame.toFixed(1), unit: "/game", color: "#6b7280", warn: false },
                  { label: "VAR Calls", value: m.refereeStats.varInterventionsPerGame.toFixed(2), unit: "/game", color: "#3b82f6", warn: m.refereeStats.varInterventionsPerGame > 0.40 },
                ].map(({ label, value, unit, color, warn }) => (
                  <div key={label} style={{
                    background: "#0d0d18",
                    borderRadius: 10,
                    border: `1px solid ${warn ? color + "44" : "rgba(255,255,255,0.05)"}`,
                    padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: warn ? color : "white" }}>
                      {value}
                      <span style={{ fontSize: 11, color: "#4b5563", fontWeight: 400 }}>{unit}</span>
                    </div>
                    {warn && <div style={{ fontSize: 9, color, marginTop: 3, fontWeight: 600 }}>▲ Above avg</div>}
                  </div>
                ))}
              </div>

              {/* Home bias meter */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Home Bias Indicator
                </div>
                <div style={{ position: "relative", height: 20 }}>
                  {/* Track */}
                  <div style={{ height: 6, background: "#1e1e30", borderRadius: 3, position: "absolute", top: 7, left: 0, right: 0 }} />
                  {/* Center marker */}
                  <div style={{ width: 2, height: 14, background: "#374151", position: "absolute", top: 3, left: "50%", transform: "translateX(-50%)" }} />
                  {/* Indicator dot */}
                  <div style={{
                    width: 14, height: 14,
                    background: Math.abs(m.refereeStats.homeBias) < 0.3 ? "#22c55e" : "#eab308",
                    borderRadius: "50%",
                    position: "absolute",
                    top: 3,
                    left: `${50 + (m.refereeStats.homeBias / 2) * 50}%`,
                    transform: "translateX(-50%)",
                    boxShadow: `0 0 8px ${Math.abs(m.refereeStats.homeBias) < 0.3 ? "#22c55e" : "#eab308"}66`,
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#374151", marginTop: 4 }}>
                  <span>← Away bias</span>
                  <span>Neutral</span>
                  <span>Home bias →</span>
                </div>
              </div>

              {/* Impact on picks */}
              <div style={{
                marginTop: 14,
                padding: "10px 14px",
                background: "rgba(124,58,237,0.08)",
                borderRadius: 8,
                border: "1px solid rgba(124,58,237,0.2)",
                fontSize: 12, color: "#c4b5fd",
              }}>
                💡 <strong>Impact on picks:</strong>{" "}
                {m.refereeStats.cardStyle === "strict"
                  ? `${m.referee} is strict — cards market confidence boosted by 7%. High card rate (${m.refereeStats.yellowCardsPerGame.toFixed(1)}/game) supports Over ${3.5} cards.`
                  : m.refereeStats.cardStyle === "lenient"
                  ? `${m.referee} is lenient — cards market confidence reduced by 5%. Low card rate (${m.refereeStats.yellowCardsPerGame.toFixed(1)}/game).`
                  : `${m.referee} is average on cards (${m.refereeStats.yellowCardsPerGame.toFixed(1)}/game). No major adjustment applied.`}
                {m.refereeStats.penaltiesPerGame > 0.32 && ` Elevated penalty risk (${m.refereeStats.penaltiesPerGame.toFixed(2)}/game).`}
                {m.refereeStats.varInterventionsPerGame > 0.40 && " High VAR usage — expect stoppages."}
              </div>
            </Card>
          </Section>
        )}

        {/* 🤖 Real AI Analysis — GPT-4o-mini + live news */}
        <Section title="🤖 AI Match Analysis">
          <Card>
            {aiLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#6b7280", padding: "8px 0" }}>
                <div style={{ width: 16, height: 16, border: "2px solid #7c3aed", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 13 }}>Analysing market data + live news…</span>
              </div>
            )}
            {!aiLoading && aiError && (
              <div style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic" }}>
                {m.aiReasoning ?? "Analysis unavailable for this fixture."}
              </div>
            )}
            {!aiLoading && aiAnalysis && (
              <>
                {aiHeadlineLive && (
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: "#a78bfa",
                    marginBottom: 14, paddingBottom: 12,
                    borderBottom: "1px solid rgba(167,139,250,0.15)",
                    letterSpacing: 0.2,
                  }}>
                    {aiHeadlineLive}
                  </div>
                )}
                <div style={{ fontSize: 14, color: "#d1d5db", lineHeight: 1.8 }}>
                  {aiAnalysis}
                </div>
                <div style={{ marginTop: 12, fontSize: 10, color: "#374151" }}>
                  Powered by GPT-4o-mini · refreshes every 6h · based on live odds + news
                </div>
              </>
            )}
          </Card>
        </Section>

        {/* Edge Reasoning */}
        <Section title="🧠 Edge Analysis">
          <Card>
            {edge.reasoning.map((r, i) => (
              <div key={i} style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "12px 0",
                borderBottom: i < edge.reasoning.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `${IMPACT_COLORS[r.impact]}22`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  color: IMPACT_COLORS[r.impact],
                  fontWeight: 700, fontSize: 14,
                }}>
                  {IMPACT_ICONS[r.impact]}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "white", marginBottom: 3 }}>{r.label}</div>
                  <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.5 }}>{r.detail}</div>
                </div>
              </div>
            ))}
          </Card>
        </Section>

        {/* Prop Predictions — soccer only */}
        {isSoccer && <Section title="📊 Prop Predictions">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {propReasonings.map((p) => (
              <PropCard key={p.prop} p={p} />
            ))}
          </div>
        </Section>}

        {/* Extra Soccer Stats */}
        {isSoccer && (
          <Section title="📐 Key Stats">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "BTTS Prob", value: `${m.bttsProb}%`, color: m.bttsProb >= 60 ? "#22c55e" : "#eab308" },
                { label: "VAR Likely", value: `${m.varLikelihood}%`, color: m.varLikelihood >= 60 ? "#ef4444" : "#6b7280" },
                { label: "1st Half Goals", value: m.firstHalfGoalsAvg.toFixed(1), color: "white" },
                { label: "Home Clean Sheet", value: `${m.cleanSheetHome}%`, color: "#9ca3af" },
                { label: "Away Clean Sheet", value: `${m.cleanSheetAway}%`, color: "#9ca3af" },
                { label: "xG Total", value: `${(m.xgHome + m.xgAway).toFixed(1)}`, color: "white" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "#12121a", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Team Form — hide for NRL/UFC (no form data) */}
        {!isNRL && !isUFC && <Section title="📈 Team Form (Last 5)">
          <Card>
            {[
              [m.homeTeam, m.homeForm],
              [m.awayTeam, m.awayForm],
            ].map(([name, form]) => (
              <div key={String(name)} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ width: 130, fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>{String(name)}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(form as string[]).map((r, i) => (
                    <div key={i} style={{
                      width: 34, height: 34, borderRadius: 8,
                      background: FORM_COLORS[r] || "#374151",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 13, color: "#0a0a0f",
                    }}>
                      {r}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "#4b5563" }}>
                  {(form as string[]).filter((x) => x === "W").length}W {(form as string[]).filter((x) => x === "D").length}D {(form as string[]).filter((x) => x === "L").length}L
                </div>
              </div>
            ))}
          </Card>
        </Section>}

        {/* H2H — hide for NRL/UFC */}
        {!isNRL && !isUFC && <Section title="🆚 Head to Head">
          <Card>
            <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, color: "#22c55e" }}>{m.h2hHomeWins}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{m.homeTeam}<br />Wins</div>
              </div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, color: "#eab308" }}>{m.h2hDraws}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Draws</div>
              </div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, color: "#ef4444" }}>
                  {m.h2hTotal - m.h2hHomeWins - m.h2hDraws}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{m.awayTeam}<br />Wins</div>
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#374151" }}>
              Last {m.h2hTotal} meetings
            </div>
          </Card>
        </Section>}

        {/* Season Stats */}
        <Section title={isNRL ? "🏉 NRL Match Info" : isUFC ? "🥊 Fight Info" : "📋 Season Stats"}>
          <div style={{ background: "#12121a", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: "#6b7280", fontWeight: 500 }}>Stat</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", color: "#9ca3af", fontWeight: 600 }}>{m.homeTeam}</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", color: "#9ca3af", fontWeight: 600 }}>{m.awayTeam}</th>
                </tr>
              </thead>
              <tbody>
                {statRows.map(([label, h, a]) => (
                  <tr key={String(label)} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "10px 16px", color: "#6b7280" }}>{String(label)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "white", fontWeight: 600 }}>
                      {displayStat(typeof h === "number" ? parseFloat(h.toFixed(1)) : String(h))}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "white", fontWeight: 600 }}>
                      {displayStat(typeof a === "number" ? parseFloat(a.toFixed(1)) : String(a))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* News */}
        <Section title="📰 Latest News">
          {newsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ background: "#12121a", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px" }}>
                  <div style={{ background: "#1e1e30", borderRadius: 4, height: 14, width: "80%", marginBottom: 8, animation: "pulse 1.5s infinite" }} />
                  <div style={{ background: "#1e1e30", borderRadius: 4, height: 10, width: "50%", animation: "pulse 1.5s infinite" }} />
                </div>
              ))}
            </div>
          ) : news.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {news.map((item, i) => <NewsCard key={i} item={item} />)}
            </div>
          ) : (
            <Card>
              <div style={{ color: "#4b5563", textAlign: "center", padding: "20px 0", fontSize: 14 }}>
                No recent news found for this fixture.
              </div>
            </Card>
          )}
        </Section>

        {/* Data source note */}
        <div style={{
          marginTop: 16, padding: "10px 14px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)",
          fontSize: 11, color: "#374151", lineHeight: 1.6,
        }}>
          📡 <strong style={{ color: "#4b5563" }}>Data sources:</strong>{" "}
          Odds — The Odds API · Soccer stats — football-data.org · NBA stats — BallDontLie ·
          Referee data — 2024-25 season averages · Stats showing &quot;—&quot; are not yet available.
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}
