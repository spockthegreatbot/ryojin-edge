"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";

// ── Dynamic import — no SSR (Recharts uses browser APIs) ─────────────────────
const PnlLineChart   = dynamic(() => import("./StatsCharts").then((m) => m.PnlLineChart),   { ssr: false, loading: () => <ChartSkeleton h={240} /> });
const OutcomeDonut   = dynamic(() => import("./StatsCharts").then((m) => m.OutcomeDonut),   { ssr: false, loading: () => <ChartSkeleton h={240} /> });
const MonthlyBarChart = dynamic(() => import("./StatsCharts").then((m) => m.MonthlyBarChart), { ssr: false, loading: () => <ChartSkeleton h={220} /> });

// ── Types ─────────────────────────────────────────────────────────────────────
interface Overall {
  total: number; wins: number; losses: number; pending: number;
  win_rate: number | null; avg_edge_wins: number | null; avg_edge_all: number | null;
}
interface DayPnl  { date: string; label: string; dailyPnl: number; cumulativePnl: number }
interface MonthPnl { month: string; pnl: number }
interface RecentPick {
  date: string; match: string; market: string; pick: string;
  stake: number; odds: number | null; outcome: string | null;
  result: number | null; tier: string | null; edge: number;
}
interface StatsData {
  overall: Overall;
  bySport: { sport: string; total: number; wins: number; win_rate: number | null }[];
  byMarket: { market: string; total: number; wins: number; win_rate: number | null }[];
  byTier:   { tier: string;  total: number; wins: number; win_rate: number | null }[];
  recentPicks: RecentPick[];
  totalStaked: number; totalProfit: number; roi: number;
  dailyPnl: DayPnl[]; monthlyPnl: MonthPnl[];
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ChartSkeleton({ h }: { h: number }) {
  return (
    <div style={{ height: h, background: "rgba(255,255,255,0.03)", borderRadius: 10, animation: "pulse 1.5s infinite" }} />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
    .replace(",", "");
}

function WinRateBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span style={{ color: "#4b5563", fontSize: 13 }}>—</span>;
  const col = rate >= 55 ? "#22c55e" : rate >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <span style={{
      fontWeight: 700, fontSize: 13, color: col,
      background: col + "18", padding: "2px 8px", borderRadius: 6,
    }}>
      {rate}%
    </span>
  );
}

function OutcomePill({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span style={{ color: "#4b5563", fontSize: 11, fontStyle: "italic" }}>Pending</span>;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    win:  { label: "✅ Won",  color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
    loss: { label: "❌ Lost", color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
    push: { label: "— Push", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
    void: { label: "○ Void", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  };
  const s = map[outcome] ?? { label: outcome, color: "#9ca3af", bg: "rgba(156,163,175,0.1)" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, padding: "2px 8px", borderRadius: 6 }}>
      {s.label}
    </span>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#12121a",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      padding: "22px 24px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 18 }}>
      {children}
    </div>
  );
}

// ── Simple table for by-sport / by-market / by-tier ──────────────────────────
function BreakdownTable({
  rows,
  labelKey,
}: {
  rows: { [k: string]: number | null | string }[];
  labelKey: string;
}) {
  if (!rows.length) {
    return <p style={{ color: "#4b5563", fontSize: 13, margin: 0 }}>No data yet.</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {["", "Picks", "Wins", "Win rate"].map((h) => (
            <th key={h} style={{ padding: "6px 8px", textAlign: h === "" ? "left" : "right", color: "#4b5563", fontWeight: 600, fontSize: 11 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <td style={{ padding: "8px 8px", color: "white", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {String(row[labelKey] ?? "—")}
            </td>
            <td style={{ padding: "8px 8px", textAlign: "right", color: "#9ca3af" }}>{String(row.total)}</td>
            <td style={{ padding: "8px 8px", textAlign: "right", color: "#9ca3af" }}>{String(row.wins)}</td>
            <td style={{ padding: "8px 8px", textAlign: "right" }}>
              <WinRateBadge rate={row.win_rate as number | null} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const r = await fetch("/api/stats");
      const d = await r.json();
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ov = data?.overall;
  const hasData = (ov?.total ?? 0) > 0;
  const hasResolved = (ov?.wins ?? 0) + (ov?.losses ?? 0) > 0;

  const roiColor = (data?.roi ?? 0) >= 0 ? "#22c55e" : "#ef4444";
  const profitColor = (data?.totalProfit ?? 0) >= 0 ? "#22c55e" : "#ef4444";

  return (
    <main style={{ minHeight: "100vh", background: "#0d0d14", padding: "0 0 60px" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .stats-grid-top { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
        .stats-grid-mid  { display:grid; grid-template-columns:2fr 1fr; gap:16px; }
        .stats-grid-bot  { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
        @media(max-width:900px){
          .stats-grid-top,.stats-grid-mid,.stats-grid-bot{ grid-template-columns:1fr; }
        }
        .bets-table { width:100%; border-collapse:collapse; font-size:13px; }
        .bets-table th { padding:10px 12px; text-align:left; color:#4b5563; font-size:11px; font-weight:600; border-bottom:1px solid rgba(255,255,255,0.07); white-space:nowrap; }
        .bets-table td { padding:11px 12px; border-bottom:1px solid rgba(255,255,255,0.04); vertical-align:middle; }
        .bets-table tr:last-child td { border-bottom:none; }
        .bets-table tr:hover td { background:rgba(255,255,255,0.02); }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(180deg, rgba(124,58,237,0.1) 0%, rgba(13,13,20,0) 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        padding: "28px 24px 24px",
        marginBottom: 28,
      }}>
        <div style={{ maxWidth: 1300, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "white", margin: "0 0 4px", letterSpacing: -0.5 }}>
                📊 Pick Tracker
              </h1>
              <p style={{ color: "#6b7280", margin: 0, fontSize: 13 }}>
                Win rate tracking for all TopBet suggestions · $10 flat stake simulation
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              style={{
                background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)",
                color: "#9ca3af", borderRadius: 10, padding: "8px 16px",
                fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <span style={refreshing ? { display: "inline-block", animation: "spin 1s linear infinite" } : {}}>↻</span>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "0 24px" }}>

        {/* ── Hero stats (3 cards) ──────────────────────────────────────── */}
        <div className="stats-grid-top" style={{ marginBottom: 20 }}>
          {/* Total Bets */}
          <Card>
            <div style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              📋 Total Bets
            </div>
            {loading
              ? <div style={{ height: 36, background: "rgba(255,255,255,0.05)", borderRadius: 6, animation: "pulse 1.5s infinite" }} />
              : <div style={{ fontSize: 36, fontWeight: 800, color: "white" }}>{ov?.total ?? 0}</div>
            }
            {!loading && hasData && (
              <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 12, color: "#6b7280" }}>
                <span><span style={{ color: "#22c55e", fontWeight: 700 }}>{ov?.wins ?? 0}</span> won</span>
                <span><span style={{ color: "#ef4444", fontWeight: 700 }}>{ov?.losses ?? 0}</span> lost</span>
                <span><span style={{ color: "#6b7280", fontWeight: 700 }}>{ov?.pending ?? 0}</span> pending</span>
              </div>
            )}
          </Card>

          {/* ROI */}
          <Card>
            <div style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              % Total ROI
            </div>
            {loading
              ? <div style={{ height: 36, background: "rgba(255,255,255,0.05)", borderRadius: 6, animation: "pulse 1.5s infinite" }} />
              : <div style={{ fontSize: 36, fontWeight: 800, color: hasResolved ? roiColor : "#4b5563" }}>
                  {hasResolved ? `${(data?.roi ?? 0) >= 0 ? "+" : ""}${data?.roi ?? 0}%` : "—"}
                </div>
            }
            {!loading && hasResolved && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                Win rate: <span style={{ color: "white", fontWeight: 700 }}>{ov?.win_rate ?? "—"}%</span>
                {" · "}Avg edge: <span style={{ color: "#7c3aed", fontWeight: 700 }}>{ov?.avg_edge_all ?? "—"}%</span>
              </div>
            )}
            {!loading && !hasResolved && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>Tracking picks…</div>
            )}
          </Card>

          {/* P&L */}
          <Card>
            <div style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              $ Total Result
            </div>
            {loading
              ? <div style={{ height: 36, background: "rgba(255,255,255,0.05)", borderRadius: 6, animation: "pulse 1.5s infinite" }} />
              : <div style={{ fontSize: 36, fontWeight: 800, color: hasResolved ? profitColor : "#4b5563" }}>
                  {hasResolved
                    ? `${(data?.totalProfit ?? 0) >= 0 ? "+" : ""}$${Math.abs(data?.totalProfit ?? 0).toFixed(2)}`
                    : "—"}
                </div>
            }
            {!loading && hasResolved && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                Staked: <span style={{ color: "white", fontWeight: 700 }}>${data?.totalStaked ?? 0}</span>
                {" · "}$10 flat stake
              </div>
            )}
            {!loading && !hasResolved && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>Awaiting settled bets</div>
            )}
          </Card>
        </div>

        {/* ── Charts row 1: line + donut ────────────────────────────────── */}
        <div className="stats-grid-mid" style={{ marginBottom: 20 }}>
          <Card>
            <CardTitle>Profit / Loss — Last 30 Days</CardTitle>
            {loading
              ? <ChartSkeleton h={240} />
              : !hasResolved
              ? <EmptyChart h={240} label="No settled picks yet" />
              : <PnlLineChart data={data!.dailyPnl} />
            }
            {!loading && hasResolved && (
              <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 2, background: "#f59e0b", borderRadius: 2 }} />
                  <span style={{ color: "#6b7280" }}>Cumulative P&L</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 2, background: "#10b981", borderRadius: 2, borderTop: "2px dashed #10b981", borderBottom: "none" }} />
                  <span style={{ color: "#6b7280" }}>Daily P&L</span>
                </div>
              </div>
            )}
          </Card>

          <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <CardTitle>Outcome Summary</CardTitle>
            {loading
              ? <ChartSkeleton h={240} />
              : !hasData
              ? <EmptyChart h={240} label="No picks tracked yet" />
              : <OutcomeDonut overall={ov ?? null} />
            }
          </Card>
        </div>

        {/* ── Monthly bar chart ─────────────────────────────────────────── */}
        <Card style={{ marginBottom: 20 }}>
          <CardTitle>Monthly Results</CardTitle>
          {loading
            ? <ChartSkeleton h={220} />
            : !data?.monthlyPnl.length
            ? <EmptyChart h={220} label="No resolved picks yet — results will appear here" />
            : <MonthlyBarChart data={data.monthlyPnl} />
          }
        </Card>

        {/* ── Breakdowns row ────────────────────────────────────────────── */}
        <div className="stats-grid-bot" style={{ marginBottom: 20 }}>
          <Card>
            <CardTitle>⚽ By Sport</CardTitle>
            {loading ? <ChartSkeleton h={80} /> : <BreakdownTable rows={data?.bySport ?? []} labelKey="sport" />}
          </Card>
          <Card>
            <CardTitle>📊 By Market</CardTitle>
            {loading ? <ChartSkeleton h={80} /> : <BreakdownTable rows={data?.byMarket ?? []} labelKey="market" />}
          </Card>
          <Card>
            <CardTitle>🔥 By Tier</CardTitle>
            {loading ? <ChartSkeleton h={80} /> : <BreakdownTable rows={data?.byTier ?? []} labelKey="tier" />}
          </Card>
        </div>

        {/* ── Latest Bets table ─────────────────────────────────────────── */}
        <Card>
          <CardTitle>Latest Bets</CardTitle>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Array(5).fill(null).map((_, i) => (
                <div key={i} style={{ height: 36, background: "rgba(255,255,255,0.04)", borderRadius: 6, animation: "pulse 1.5s infinite" }} />
              ))}
            </div>
          ) : !data?.recentPicks.length ? (
            <p style={{ color: "#4b5563", fontSize: 14, margin: 0, textAlign: "center", padding: "30px 0" }}>
              No picks recorded yet.<br />
              <span style={{ fontSize: 12 }}>Picks will appear here once the database is connected.</span>
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="bets-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Match</th>
                    <th>Selection</th>
                    <th style={{ textAlign: "right" }}>Stake</th>
                    <th style={{ textAlign: "right" }}>Odds</th>
                    <th style={{ textAlign: "right" }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPicks.map((pick, i) => (
                    <tr key={i}>
                      <td style={{ color: "#6b7280", whiteSpace: "nowrap", fontSize: 12 }}>
                        {fmt(pick.date)}
                      </td>
                      <td style={{ color: "#d1d5db", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {pick.match}
                        <div style={{ fontSize: 10, color: "#4b5563", marginTop: 1 }}>{pick.market}</div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          background: "rgba(124,58,237,0.15)",
                          color: "#c4b5fd",
                          padding: "3px 9px", borderRadius: 6,
                          whiteSpace: "nowrap",
                        }}>
                          {pick.pick}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", color: "#9ca3af" }}>
                        ${pick.stake.toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right", color: "#9ca3af" }}>
                        {pick.odds ? pick.odds.toFixed(2) : <span style={{ color: "#4b5563" }}>—</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {pick.outcome === null ? (
                          <OutcomePill outcome={null} />
                        ) : pick.result !== null ? (
                          <span style={{
                            fontWeight: 700,
                            color: pick.result > 0 ? "#22c55e" : pick.result < 0 ? "#ef4444" : "#6b7280",
                          }}>
                            {pick.result >= 0 ? "+" : ""}${pick.result.toFixed(2)}
                          </span>
                        ) : (
                          <OutcomePill outcome={pick.outcome} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>
    </main>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyChart({ h, label }: { h: number; label: string }) {
  return (
    <div style={{
      height: h, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 8,
    }}>
      <div style={{ fontSize: 28 }}>📭</div>
      <div style={{ fontSize: 13, color: "#4b5563" }}>{label}</div>
    </div>
  );
}


