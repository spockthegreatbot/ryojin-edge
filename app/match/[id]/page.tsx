import { MOCK_MATCHES } from "@/lib/mock-data";
import { calcEdgeScore } from "@/lib/edge-calculator";
import Link from "next/link";

const EDGE_COLORS = { red: "#ef4444", yellow: "#eab308", green: "#22c55e" };
const FORM_COLORS: Record<string, string> = { W: "#22c55e", D: "#eab308", L: "#ef4444" };

export default function MatchPage({ params }: { params: { id: string } }) {
  const m = MOCK_MATCHES.find((x) => x.id === params.id);
  if (!m)
    return (
      <main style={{ background: "#0a0a0f", minHeight: "100vh", padding: 40 }}>
        <div style={{ color: "#6b7280" }}>Match not found.</div>
      </main>
    );

  const { score, color } = calcEdgeScore({
    homeForm: m.homeForm,
    awayForm: m.awayForm,
    h2hHomeWins: m.h2hHomeWins,
    h2hTotal: m.h2hTotal,
  });

  const isSoccer = m.sport === "soccer";

  const statRows = isSoccer
    ? [
        ["Avg Goals / Game", m.goalsAvgHome, m.goalsAvgAway],
        ["Expected Goals (xG)", m.xgHome, m.xgAway],
        ["Avg Corners / Game", m.cornersAvgHome, m.cornersAvgAway],
        ["Avg Cards / Game", m.cardsAvgHome, m.cardsAvgAway],
      ]
    : [["Avg Points / Game", m.goalsAvgHome, m.goalsAvgAway]];

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "24px 16px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Link
          href="/"
          style={{ color: "#7c3aed", textDecoration: "none", fontSize: 14, display: "inline-block", marginBottom: 20 }}
        >
          ← Back to Dashboard
        </Link>

        {/* Match Header */}
        <div
          style={{
            background: "#12121a",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div
                style={{
                  fontSize: 11, color: "#7c3aed", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 1.5,
                  background: "rgba(124,58,237,0.15)", padding: "3px 8px",
                  borderRadius: 6, display: "inline-block", marginBottom: 12,
                }}
              >
                {isSoccer ? "⚽ EPL" : "🏀 NBA"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "white" }}>{m.homeTeam}</div>
              <div style={{ color: "#4b5563", margin: "4px 0", fontSize: 13 }}>vs</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#d1d5db" }}>{m.awayTeam}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  background: EDGE_COLORS[color],
                  borderRadius: "50%",
                  width: 68,
                  height: 68,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 24,
                  color: "#0a0a0f",
                  margin: "0 auto 8px",
                  boxShadow: `0 0 16px ${EDGE_COLORS[color]}44`,
                }}
              >
                {score}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 }}>
                Edge Score
              </div>
            </div>
          </div>
        </div>

        {/* Prop Predictions */}
        <h2 style={{ color: "white", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Prop Predictions</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {m.props.map((p) => (
            <div
              key={p.label}
              style={{
                background: "#12121a",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.07)",
                padding: 16,
              }}
            >
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {p.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "white", marginBottom: 10 }}>{p.value}</div>
              <div style={{ background: "#0a0a0f", borderRadius: 4, height: 5, overflow: "hidden" }}>
                <div
                  style={{
                    background: p.confidence > 70 ? "#22c55e" : p.confidence > 55 ? "#7c3aed" : "#eab308",
                    width: `${p.confidence}%`,
                    height: "100%",
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 5, textAlign: "right", fontWeight: 600 }}>
                {p.confidence}% confidence
              </div>
            </div>
          ))}

          {isSoccer && (
            <>
              <div style={{ background: "#12121a", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: 16 }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Corners Total</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "white", marginBottom: 6 }}>
                  {(m.cornersAvgHome + m.cornersAvgAway).toFixed(1)}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {m.homeTeam}: {m.cornersAvgHome} · {m.awayTeam}: {m.cornersAvgAway}
                </div>
              </div>
              <div style={{ background: "#12121a", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: 16 }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>BTTS Probability</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "white", marginBottom: 10 }}>{m.bttsProb}%</div>
                <div style={{ background: "#0a0a0f", borderRadius: 4, height: 5, overflow: "hidden" }}>
                  <div style={{ background: "#7c3aed", width: `${m.bttsProb}%`, height: "100%" }} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Team Form */}
        <h2 style={{ color: "white", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Team Form (Last 5)</h2>
        <div
          style={{
            background: "#12121a",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
            padding: 20,
            marginBottom: 24,
          }}
        >
          {[
            [m.homeTeam, m.homeForm],
            [m.awayTeam, m.awayForm],
          ].map(([name, form]) => (
            <div
              key={String(name)}
              style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}
            >
              <div style={{ width: 130, fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>{String(name)}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(form as string[]).map((r, i) => (
                  <div
                    key={i}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: FORM_COLORS[r] || "#374151",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#0a0a0f",
                    }}
                  >
                    {r}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* H2H */}
        <h2 style={{ color: "white", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Head to Head</h2>
        <div
          style={{
            background: "#12121a",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#22c55e" }}>{m.h2hHomeWins}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{m.homeTeam} Wins</div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#eab308" }}>
                {Math.max(0, m.h2hTotal - m.h2hHomeWins - (m.h2hTotal - m.h2hHomeWins - 1))}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Draws</div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#ef4444" }}>
                {m.h2hTotal - m.h2hHomeWins}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{m.awayTeam} Wins</div>
            </div>
          </div>
        </div>

        {/* Stats Table */}
        <h2 style={{ color: "white", fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Season Stats</h2>
        <div
          style={{
            background: "#12121a",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
            overflow: "hidden",
            marginBottom: 32,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", color: "#6b7280", fontWeight: 500 }}>Stat</th>
                <th style={{ padding: "12px 16px", textAlign: "center", color: "#9ca3af", fontWeight: 600 }}>
                  {m.homeTeam}
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", color: "#9ca3af", fontWeight: 600 }}>
                  {m.awayTeam}
                </th>
              </tr>
            </thead>
            <tbody>
              {statRows.map(([label, h, a]) => (
                <tr key={String(label)} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "10px 16px", color: "#6b7280" }}>{String(label)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "center", color: "white", fontWeight: 600 }}>
                    {Number(h).toFixed(1)}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "center", color: "white", fontWeight: 600 }}>
                    {Number(a).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
