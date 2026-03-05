"use client";

import Link from "next/link";

// ── Shared styles ────────────────────────────────────────────────────────────
const card = {
  background: "#12121a",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.07)",
  padding: "28px 30px",
  marginBottom: 24,
} as const;

const sectionNumber = (n: string) => (
  <div style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: "50%",
    background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)",
    color: "#7c3aed", fontWeight: 800, fontSize: 14, marginRight: 12, flexShrink: 0,
  }}>
    {n}
  </div>
);

const SectionTitle = ({ n, title }: { n: string; title: string }) => (
  <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
    {sectionNumber(n)}
    <h2 style={{ fontSize: 20, fontWeight: 800, color: "#7c3aed", margin: 0 }}>{title}</h2>
  </div>
);

const prose = { fontSize: 15, color: "#9ca3af", lineHeight: 1.8 } as const;

const Formula = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    background: "#0a0a14",
    border: "1px solid rgba(124,58,237,0.25)",
    borderRadius: 10,
    padding: "16px 20px",
    fontFamily: "monospace",
    fontSize: 16,
    color: "#a78bfa",
    margin: "16px 0",
    textAlign: "center",
    letterSpacing: 0.5,
  }}>
    {children}
  </div>
);

// ── Edge Score Bar ────────────────────────────────────────────────────────────
function EdgeBar() {
  const zones = [
    { from: 0, to: 40, color: "#374151", label: "No Value", labelColor: "#6b7280" },
    { from: 40, to: 60, color: "#eab308", label: "Marginal", labelColor: "#eab308" },
    { from: 60, to: 75, color: "#22c55e", label: "✅ Lean", labelColor: "#22c55e" },
    { from: 75, to: 100, color: "#4ade80", label: "🔥 Strong", labelColor: "#4ade80" },
  ];
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", height: 28, marginBottom: 8 }}>
        {zones.map((z) => (
          <div key={z.label} style={{
            width: `${z.to - z.from}%`, background: z.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.6)",
          }}>
            {z.label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#4b5563" }}>
        <span>0</span><span>40</span><span>60</span><span>75</span><span>100</span>
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { range: "0–40", desc: "No value. Market priced correctly or against us.", color: "#6b7280" },
          { range: "40–60", desc: "Marginal. Small model advantage, high variance.", color: "#eab308" },
          { range: "60–75", desc: "✅ Lean Value. Model has clear advantage. Bet selectively.", color: "#22c55e" },
          { range: "75–100", desc: "🔥 Strong Edge. Significant model vs market divergence. High confidence.", color: "#4ade80" },
        ].map((row) => (
          <div key={row.range} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "monospace", fontSize: 13, color: row.color, minWidth: 60, fontWeight: 700 }}>{row.range}</span>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>{row.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scoreline Grid ────────────────────────────────────────────────────────────
function ScorelineGrid() {
  const grid = [
    ["—", "Away 0", "Away 1", "Away 2"],
    ["Home 0", "8.3%", "5.1%", "1.9%"],
    ["Home 1", "12.4%", "9.7%", "3.8%"],
    ["Home 2", "8.1%", "6.3%", "2.4%"],
  ];
  return (
    <div style={{ overflowX: "auto", marginTop: 16 }}>
      <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
        <tbody>
          {grid.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: "8px 14px",
                  textAlign: "center",
                  fontWeight: ri === 0 || ci === 0 ? 700 : 500,
                  color: ri === 0 || ci === 0 ? "#7c3aed" : "#22c55e",
                  background: ri === 0 || ci === 0 ? "rgba(124,58,237,0.08)" : (ri + ci) % 2 === 0 ? "#0e0e18" : "#0a0a12",
                  borderRadius: ri === 0 && ci === 0 ? "8px 0 0 0" : 0,
                  border: "1px solid rgba(255,255,255,0.05)",
                  fontFamily: ri > 0 && ci > 0 ? "monospace" : "inherit",
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: "#4b5563", marginTop: 8 }}>
        Example scoreline probability matrix (Dixon-Coles corrected)
      </div>
    </div>
  );
}

// ── Elo Visual ────────────────────────────────────────────────────────────────
function EloVisual() {
  return (
    <div style={{
      background: "#0a0a14", borderRadius: 12,
      border: "1px solid rgba(124,58,237,0.15)",
      padding: "18px 22px", marginTop: 16,
      display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>HOME ELO</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e" }}>1680</div>
      </div>
      <div style={{ fontSize: 24, color: "#374151" }}>vs</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>AWAY ELO</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#ef4444" }}>1520</div>
      </div>
      <div style={{ fontSize: 24, color: "#374151" }}>→</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>HOME WIN PROB</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed" }}>67%</div>
      </div>
    </div>
  );
}

// ── De-Vig Visual ─────────────────────────────────────────────────────────────
function DeVigVisual() {
  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Before/after strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{
          background: "#0a0a14", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
          padding: "12px 18px", textAlign: "center",
        }}>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>RAW ODDS</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#9ca3af", fontFamily: "monospace" }}>2.10</div>
        </div>
        <div style={{ fontSize: 22, color: "#374151" }}>→</div>
        <div style={{
          background: "rgba(124,58,237,0.08)", borderRadius: 10,
          border: "1px solid rgba(124,58,237,0.25)", padding: "12px 18px", textAlign: "center",
        }}>
          <div style={{ fontSize: 11, color: "#7c3aed", marginBottom: 4 }}>DE-VIGGED</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#7c3aed", fontFamily: "monospace" }}>49.2%</div>
          <div style={{ fontSize: 10, color: "#4b5563" }}>implied prob</div>
        </div>
        <div style={{ fontSize: 22, color: "#374151" }}>vs</div>
        <div style={{
          background: "rgba(34,197,94,0.08)", borderRadius: 10,
          border: "1px solid rgba(34,197,94,0.25)", padding: "12px 18px", textAlign: "center",
        }}>
          <div style={{ fontSize: 11, color: "#22c55e", marginBottom: 4 }}>MODEL PROB</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#22c55e", fontFamily: "monospace" }}>58%</div>
        </div>
        <div style={{ fontSize: 22, color: "#374151" }}>→</div>
        <div style={{
          background: "rgba(34,197,94,0.15)", borderRadius: 10,
          border: "1px solid rgba(34,197,94,0.4)", padding: "12px 18px", textAlign: "center",
        }}>
          <div style={{ fontSize: 11, color: "#22c55e", marginBottom: 4 }}>EDGE</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#22c55e", fontFamily: "monospace" }}>+11% ✅</div>
        </div>
      </div>
    </div>
  );
}

// ── Data Sources Table ─────────────────────────────────────────────────────────
function DataTable() {
  const rows = [
    { data: "Match fixtures", source: "API-Sports (Pro)", updates: "Live" },
    { data: "Team form & stats", source: "API-Sports (Pro)", updates: "24h" },
    { data: "Bookmaker odds", source: "The Odds API (Pinnacle)", updates: "6h" },
    { data: "NBA schedule & stats", source: "API-Sports Basketball", updates: "Live" },
    { data: "Referee database", source: "Curated + season stats", updates: "Weekly" },
  ];
  return (
    <div style={{ overflowX: "auto", marginTop: 16 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr>
            {["Data", "Source", "Updates"].map((h) => (
              <th key={h} style={{
                padding: "8px 14px", textAlign: "left",
                color: "#7c3aed", fontWeight: 700, fontSize: 11,
                textTransform: "uppercase", letterSpacing: 0.8,
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ padding: "8px 14px", color: "white", fontWeight: 600, border: "1px solid rgba(255,255,255,0.05)", background: i % 2 === 0 ? "#0e0e18" : "#0a0a12" }}>{r.data}</td>
              <td style={{ padding: "8px 14px", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.05)", background: i % 2 === 0 ? "#0e0e18" : "#0a0a12" }}>{r.source}</td>
              <td style={{ padding: "8px 14px", border: "1px solid rgba(255,255,255,0.05)", background: i % 2 === 0 ? "#0e0e18" : "#0a0a12" }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                  color: r.updates === "Live" ? "#22c55e" : "#9ca3af",
                  background: r.updates === "Live" ? "rgba(34,197,94,0.12)" : "rgba(156,163,175,0.08)",
                }}>{r.updates}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AboutPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0d0d14" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px 60px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{
            display: "inline-block",
            background: "rgba(124,58,237,0.1)",
            border: "1px solid rgba(124,58,237,0.25)",
            borderRadius: 10, padding: "5px 16px",
            fontSize: 12, fontWeight: 700, color: "#7c3aed",
            textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 20,
          }}>
            Methodology
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 900, color: "white", marginBottom: 12, letterSpacing: -1, lineHeight: 1.15 }}>
            🧠 How TopBet Works
          </h1>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#7c3aed", marginBottom: 12 }}>
            We don&apos;t guess. We calculate.
          </div>
          <p style={{ fontSize: 16, color: "#9ca3af", maxWidth: 600, margin: "0 auto", lineHeight: 1.7 }}>
            TopBet uses a 4-layer quantitative model trusted by professional sports bettors. Here&apos;s exactly how it works.
          </p>
        </div>

        {/* Section 1 — Edge Score */}
        <div style={card}>
          <SectionTitle n="1" title="Edge Score (0–100)" />
          <p style={prose}>
            The <strong style={{ color: "white" }}>Edge Score</strong> is our headline number. It measures how much our model&apos;s probability diverges from the market&apos;s implied probability — after removing the bookmaker&apos;s margin. A higher edge means the market is mispricing the event in our favour.
          </p>
          <EdgeBar />
        </div>

        {/* Section 2 — Poisson */}
        <div style={card}>
          <SectionTitle n="2" title="Layer 1: Poisson Model + Dixon-Coles" />
          <p style={prose}>
            We calculate the probability of every scoreline (0-0, 1-0, 2-1, etc.) using each team&apos;s average goals scored and conceded. This is called a <strong style={{ color: "white" }}>Poisson distribution</strong> — the same statistical model used by professional quant funds.
          </p>
          <p style={{ ...prose, marginTop: 12 }}>
            Standard Poisson has a known flaw: it underestimates defensive games like 0-0 and 1-0. We fix this using the <strong style={{ color: "white" }}>Dixon-Coles correction</strong> (ρ = −0.13), which adjusts the probabilities for low-scoring scorelines. This improves accuracy by ~10% for defensive matches.
          </p>
          <p style={{ ...prose, marginTop: 12 }}>
            From the scoreline matrix, we derive:{" "}
            <span style={{ color: "#7c3aed", fontWeight: 600 }}>Match Result</span> &bull; <span style={{ color: "#7c3aed", fontWeight: 600 }}>Over/Under 2.5 Goals</span> &bull; <span style={{ color: "#7c3aed", fontWeight: 600 }}>BTTS</span> &bull; <span style={{ color: "#7c3aed", fontWeight: 600 }}>Corners</span> &bull; <span style={{ color: "#7c3aed", fontWeight: 600 }}>Cards</span>
          </p>
          <ScorelineGrid />
        </div>

        {/* Section 3 — Elo */}
        <div style={card}>
          <SectionTitle n="3" title="Layer 2: Elo Rating" />
          <p style={prose}>
            Every team has an <strong style={{ color: "white" }}>Elo rating</strong> — the same system used in chess and by FiveThirtyEight for sports predictions. A team rated 1700 is significantly stronger than one rated 1300.
          </p>
          <p style={{ ...prose, marginTop: 12 }}>
            We use Elo to calculate a win probability that accounts for <strong style={{ color: "white" }}>opponent quality</strong> — not just raw form. A team on a 5-game winning streak against weak opposition looks very different from a team beating top-6 sides.
          </p>
          <p style={{ ...prose, marginTop: 12 }}>
            Elo win probability is blended with our Poisson result to produce a more robust final probability.
          </p>
          <EloVisual />
        </div>

        {/* Section 4 — De-Vig */}
        <div style={card}>
          <SectionTitle n="4" title="Layer 3: De-Vig Market Comparison" />
          <p style={prose}>
            Pinnacle Sportsbook sets the sharpest lines in the world — every professional bettor uses Pinnacle&apos;s closing price as the benchmark for &ldquo;true probability.&rdquo;
          </p>
          <p style={{ ...prose, marginTop: 12 }}>
            We take Pinnacle&apos;s odds, strip out the bookmaker margin (<strong style={{ color: "white" }}>vig</strong>), and extract the true implied probability. We then compare this against our model&apos;s probability. Any gap above <strong style={{ color: "#22c55e" }}>5%</strong> is a value bet. Above <strong style={{ color: "#4ade80" }}>10%</strong> is a strong signal.
          </p>
          <DeVigVisual />
        </div>

        {/* Section 5 — Referee */}
        <div style={card}>
          <SectionTitle n="5" title="Layer 4: Referee Intelligence" />
          <p style={prose}>
            Every referee has measurable tendencies. <strong style={{ color: "white" }}>Michael Oliver</strong> averages 4.2 yellow cards per game. <strong style={{ color: "white" }}>Craig Pawson</strong> averages 3.2. For cards markets, this difference is significant.
          </p>
          <p style={{ ...prose, marginTop: 12 }}>
            We maintain a database of <strong style={{ color: "white" }}>21 EPL and UCL referees</strong> with per-game averages for:
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            {["Yellow cards", "Red cards", "Penalties", "VAR interventions", "Home bias score"].map((tag) => (
              <span key={tag} style={{
                fontSize: 12, fontWeight: 600,
                color: "#7c3aed", background: "rgba(124,58,237,0.12)",
                padding: "4px 12px", borderRadius: 6,
                border: "1px solid rgba(124,58,237,0.25)",
              }}>{tag}</span>
            ))}
          </div>
          <div style={{
            background: "#0a0a14", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)",
            padding: "14px 18px", marginTop: 16, display: "flex", flexDirection: "column", gap: 6,
          }}>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              <span style={{ color: "#ef4444", fontWeight: 700 }}>Strict referee</span> (cardStyle: <code style={{ color: "#a78bfa" }}>&apos;strict&apos;</code>) → cards market confidence <strong style={{ color: "#22c55e" }}>+7%</strong>
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              <span style={{ color: "#22c55e", fontWeight: 700 }}>Lenient referee</span> (cardStyle: <code style={{ color: "#a78bfa" }}>&apos;lenient&apos;</code>) → cards market confidence <strong style={{ color: "#ef4444" }}>−5%</strong>
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              VAR intervention rate affects our <strong style={{ color: "white" }}>penalty market</strong> predictions.
            </div>
          </div>
        </div>

        {/* Section 6 — Kelly */}
        <div style={card}>
          <SectionTitle n="6" title="Kelly Criterion" />
          <p style={prose}>
            Kelly Criterion is the mathematically proven optimal bet sizing formula for long-term bankroll growth:
          </p>
          <Formula>
            Kelly % = (Edge × Odds) / (Odds − 1)
          </Formula>
          <p style={prose}>
            We use <strong style={{ color: "white" }}>Quarter-Kelly</strong> (25% of full Kelly) for conservative bankroll management. If Kelly says 8%, we recommend 2% of bankroll.
          </p>
          <div style={{
            background: "rgba(124,58,237,0.06)", borderRadius: 10,
            border: "1px solid rgba(124,58,237,0.2)", padding: "14px 18px", marginTop: 14,
          }}>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              💰 <strong style={{ color: "white" }}>$200 bankroll</strong> × <strong style={{ color: "#7c3aed" }}>2% Kelly</strong> = <strong style={{ color: "#22c55e" }}>$4 bet</strong>
            </div>
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 6 }}>
              This prevents ruin while maximising compounding growth over a large sample size.
            </div>
          </div>
        </div>

        {/* Section 7 — Data Sources */}
        <div style={card}>
          <SectionTitle n="7" title="Data Sources" />
          <p style={prose}>All data is fetched from professional-grade APIs and cross-referenced for accuracy.</p>
          <DataTable />
        </div>

        {/* Section 8 — Disclaimer */}
        <div style={{
          ...card,
          background: "rgba(239,68,68,0.05)",
          border: "1px solid rgba(239,68,68,0.18)",
        }}>
          <SectionTitle n="8" title="What We Don't Claim" />
          <p style={prose}>
            <strong style={{ color: "#ef4444" }}>No model is perfect.</strong> An expected edge of 10% means roughly 55–60% win rate on those picks over a <em>large sample</em> — not every bet wins. Short-term variance is real.
          </p>
          <p style={{ ...prose, marginTop: 12 }}>
            This tool is designed for <strong style={{ color: "white" }}>disciplined, data-driven betting over a large sample size</strong>, not for one-off gambling. Bet responsibly, always within your means.
          </p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <Link href="/picks" style={{ textDecoration: "none" }}>
            <div style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "white", fontWeight: 700, fontSize: 16,
              padding: "14px 36px", borderRadius: 12,
              boxShadow: "0 0 30px rgba(124,58,237,0.35)",
              cursor: "pointer",
            }}>
              🎯 View Today&apos;s Picks →
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
