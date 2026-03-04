"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MOCK_MATCHES, MatchData } from "@/lib/mock-data";
import { calcEdgeScore, buildPropReasoning, PropReasoning, EdgeResult } from "@/lib/edge-calculator";
import { NewsItem } from "@/app/api/news/[matchId]/route";

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

      {/* Reasoning toggle */}
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
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          background: "#12121a",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "14px 16px",
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(124,58,237,0.35)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
        }}
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
              {item.pubDate && (
                <span style={{ fontSize: 11, color: "#374151" }}>{timeAgo(item.pubDate)}</span>
              )}
            </div>
          </div>
          <span style={{ color: "#374151", fontSize: 14, flexShrink: 0, marginTop: 2 }}>↗</span>
        </div>
      </div>
    </a>
  );
}

export default function MatchPage({ params }: { params: { id: string } }) {
  const m: MatchData | undefined = MOCK_MATCHES.find((x) => x.id === params.id);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/news/${params.id}`)
      .then((r) => r.json())
      .then((d) => { setNews(d); setNewsLoading(false); })
      .catch(() => setNewsLoading(false));
  }, [params.id]);

  if (!m) {
    return (
      <main style={{ background: "#0a0a0f", minHeight: "100vh", padding: 40 }}>
        <div style={{ color: "#6b7280" }}>Match not found.</div>
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

  const statRows = isSoccer
    ? [
        ["Avg Goals / Game", m.goalsAvgHome, m.goalsAvgAway],
        ["Expected Goals (xG)", m.xgHome, m.xgAway],
        ["Avg Corners / Game", m.cornersAvgHome, m.cornersAvgAway],
        ["Avg Cards / Game", m.cardsAvgHome, m.cardsAvgAway],
        ["1st Half Goals Avg", m.firstHalfGoalsAvg, "—"],
        ["Clean Sheet %", `${m.cleanSheetHome}%`, `${m.cleanSheetAway}%`],
        ["VAR Likelihood", `${m.varLikelihood}%`, "—"],
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
                {isSoccer ? "⚽" : "🏀"} {m.league}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "white" }}>{m.homeTeam}</div>
              <div style={{ color: "#4b5563", margin: "4px 0", fontSize: 13 }}>vs</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#d1d5db" }}>{m.awayTeam}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>🕐 {formatKickoff(m.commenceTime)} AEDT</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{
                background: EDGE_COLORS[edge.color],
                borderRadius: "50%", width: 72, height: 72,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 26, color: "#0a0a0f",
                margin: "0 auto 8px",
                boxShadow: `0 0 20px ${EDGE_COLORS[edge.color]}44`,
              }}>
                {edge.score}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 }}>Edge Score</div>
            </div>
          </div>

          {/* Odds */}
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
        </Card>

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

        {/* Prop Predictions with Reasoning */}
        <Section title="📊 Prop Predictions">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {propReasonings.map((p) => (
              <PropCard key={p.prop} p={p} />
            ))}
          </div>
        </Section>

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
                <div key={label} style={{
                  background: "#12121a", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Team Form */}
        <Section title="📈 Team Form (Last 5)">
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
        </Section>

        {/* H2H */}
        <Section title="🆚 Head to Head">
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
        </Section>

        {/* Season Stats Table */}
        <Section title="📋 Season Stats">
          <div style={{
            background: "#12121a", borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
          }}>
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
                      {typeof h === "number" ? h.toFixed(1) : h}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "white", fontWeight: 600 }}>
                      {typeof a === "number" ? a.toFixed(1) : a}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* News Section */}
        <Section title="📰 Latest News">
          {newsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{
                  background: "#12121a", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px",
                }}>
                  <div style={{ background: "#1e1e30", borderRadius: 4, height: 14, width: "80%", marginBottom: 8, animation: "pulse 1.5s infinite" }} />
                  <div style={{ background: "#1e1e30", borderRadius: 4, height: 10, width: "50%", animation: "pulse 1.5s infinite" }} />
                </div>
              ))}
            </div>
          ) : news.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {news.map((item, i) => (
                <NewsCard key={i} item={item} />
              ))}
            </div>
          ) : (
            <Card>
              <div style={{ color: "#4b5563", textAlign: "center", padding: "20px 0", fontSize: 14 }}>
                No recent news found for this fixture.
              </div>
            </Card>
          )}
        </Section>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </main>
  );
}
