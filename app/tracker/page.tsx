"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Bet {
  id: number;
  date: string;
  match: string;
  market: string;
  pick: string;
  odds: number;
  stake: number;
  result: "pending" | "win" | "loss" | "void";
  payout?: number;
  sport: string;
  notes?: string;
  created_at?: string;
}

function fmtCurrency(n: number, forceSign = false): string {
  const s = Math.abs(n).toFixed(2);
  if (forceSign) return (n >= 0 ? "+" : "-") + "$" + s;
  return (n < 0 ? "-" : "") + "$" + s;
}

const SPORT_EMOJIS: Record<string, string> = {
  soccer: "⚽", nba: "🏀", nrl: "🏉", ufc: "🥊", other: "🎲",
};

const SPORTS = ["all", "soccer", "nba", "nrl", "ufc", "other"] as const;
type SportFilter = typeof SPORTS[number];
type DateFilter = "all" | "week" | "month";
type StatusFilter = "all" | "pending" | "settled";

function getDateRange(filter: DateFilter): { start: Date | null } {
  if (filter === "all") return { start: null };
  const now = new Date();
  if (filter === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { start: d };
  }
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return { start: d };
}

export default function Tracker() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sportFilter, setSportFilter] = useState<SportFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const [form, setForm] = useState({
    match: "", market: "Match Winner", pick: "", odds: "",
    stake: "", sport: "soccer", notes: "", date: new Date().toISOString().slice(0, 10),
  });

  const loadBets = useCallback(async () => {
    try {
      const r = await fetch("/api/bets");
      const d = await r.json();
      setBets(d.bets ?? []);
    } catch (e) {
      console.error("[tracker] Failed to load bets:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBets(); }, [loadBets]);

  // Filtered bets
  const dateRange = getDateRange(dateFilter);
  const filtered = bets.filter(b => {
    if (statusFilter === "pending" && b.result !== "pending") return false;
    if (statusFilter === "settled" && b.result === "pending") return false;
    if (sportFilter !== "all" && b.sport !== sportFilter) return false;
    if (dateRange.start) {
      const betDate = new Date(b.date);
      if (betDate < dateRange.start) return false;
    }
    return true;
  });

  const settled = filtered.filter(b => b.result !== "pending" && b.result !== "void");
  const pending = filtered.filter(b => b.result === "pending");

  const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
  const totalReturns = settled.reduce((s, b) => {
    if (b.result === "win") return s + (b.payout ?? b.stake * b.odds);
    return s;
  }, 0);
  const pnl = totalReturns - totalStaked;
  const nonVoidSettled = settled.filter(b => b.result !== "void");
  const winRate = nonVoidSettled.length > 0
    ? Math.round((nonVoidSettled.filter(b => b.result === "win").length / nonVoidSettled.length) * 100)
    : 0;
  const roi = totalStaked > 0 ? ((pnl / totalStaked) * 100).toFixed(1) : "0.0";
  const pendingExposure = pending.reduce((s, b) => s + b.stake, 0);

  async function submitBet() {
    if (!form.match || !form.pick || !form.odds || !form.stake) return;
    const odds = parseFloat(form.odds);
    const stake = parseFloat(form.stake);
    if (isNaN(odds) || isNaN(stake) || odds <= 1 || stake <= 0) return;

    setSaving(true);
    try {
      if (editId) {
        const r = await fetch(`/api/bets/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, odds, stake }),
        });
        if (!r.ok) throw new Error("Failed to update");
        setEditId(null);
      } else {
        const r = await fetch("/api/bets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, odds, stake }),
        });
        if (!r.ok) throw new Error("Failed to create");
      }
      setForm({ match: "", market: "Match Winner", pick: "", odds: "", stake: "", sport: "soccer", notes: "", date: new Date().toISOString().slice(0, 10) });
      setShowForm(false);
      await loadBets();
    } catch (e) {
      console.error("[tracker] Save error:", e);
    } finally {
      setSaving(false);
    }
  }

  async function settle(id: number, result: "win" | "loss" | "void") {
    try {
      const r = await fetch(`/api/bets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (!r.ok) throw new Error("Failed to settle");
      await loadBets();
    } catch (e) {
      console.error("[tracker] Settle error:", e);
    }
  }

  async function deleteBet(id: number) {
    if (!confirm("Delete this bet?")) return;
    try {
      const r = await fetch(`/api/bets/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete");
      await loadBets();
    } catch (e) {
      console.error("[tracker] Delete error:", e);
    }
  }

  function startEdit(b: Bet) {
    setForm({
      match: b.match, market: b.market, pick: b.pick,
      odds: b.odds.toString(), stake: b.stake.toString(),
      sport: b.sport, notes: b.notes ?? "",
      date: b.date.slice(0, 10),
    });
    setEditId(b.id);
    setShowForm(true);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#080808", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 2, padding: "8px 12px", color: "white", fontSize: 13, outline: "none",
    boxSizing: "border-box",
  };

  const pnlColor = pnl >= 0 ? "#22c55e" : "#ef4444";
  const wrColor = winRate >= 50 ? "#22c55e" : "#eab308";

  return (
    <main style={{ minHeight: "100vh", background: "#080808", padding: "0 0 60px" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "24px 16px 20px",
        marginBottom: 24,
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Link href="/" style={{ color: "#44444f", textDecoration: "none", fontSize: 12 }}>← Back</Link>
              <h1 style={{ color: "white", fontSize: 22, fontWeight: 800, marginTop: 4, marginBottom: 0 }}>
                💰 Bet Tracker
              </h1>
            </div>
            <button
              onClick={() => { setShowForm(!showForm); setEditId(null); }}
              style={{
                background: "rgba(232,224,208,0.08)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 2,
                color: "#e8e0d0", fontSize: 12, fontWeight: 400,
                padding: "10px 20px", cursor: "pointer",
              }}
            >
              {showForm ? "✕ Cancel" : "+ Log Bet"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }}>

        {/* ── P&L Summary ── */}
        <div style={{
          background: "#141419", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 2, padding: "20px 24px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 }}>
                Net P&L
              </div>
              <div style={{ fontSize: 36, fontWeight: 300, color: pnlColor, marginTop: 4, fontFamily: "var(--font-dm-mono), monospace" }}>
                {fmtCurrency(pnl, true)}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                ROI: <span style={{ color: pnlColor, fontWeight: 700 }}>{roi}%</span>
                {" · "}Staked: <span style={{ color: "white", fontWeight: 600 }}>{fmtCurrency(totalStaked)}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 300, color: wrColor, fontFamily: "var(--font-dm-mono), monospace" }}>{winRate}%</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Win Rate</div>
                <div style={{ fontSize: 10, color: "#4b5563" }}>
                  {nonVoidSettled.filter(b => b.result === "win").length}W / {nonVoidSettled.filter(b => b.result === "loss").length}L
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 300, color: "#f59e0b", fontFamily: "var(--font-dm-mono), monospace" }}>{pending.length}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Pending</div>
                <div style={{ fontSize: 10, color: "#4b5563" }}>{fmtCurrency(pendingExposure)} exposure</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "white" }}>{filtered.length}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Total Bets</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Add / Edit Form ── */}
        {showForm && (
          <div style={{
            background: "#141419", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 2, padding: 20, marginBottom: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 16 }}>
              {editId ? "✏️ Edit Bet" : "➕ Log New Bet"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Match *</label>
                <input style={inputStyle} value={form.match} onChange={e => setForm(f => ({ ...f, match: e.target.value }))} placeholder="Arsenal vs Chelsea" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Pick *</label>
                <input style={inputStyle} value={form.pick} onChange={e => setForm(f => ({ ...f, pick: e.target.value }))} placeholder="Arsenal" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Market</label>
                <input style={inputStyle} value={form.market} onChange={e => setForm(f => ({ ...f, market: e.target.value }))} placeholder="Match Winner" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Decimal Odds *</label>
                <input style={inputStyle} type="number" step="0.01" value={form.odds} onChange={e => setForm(f => ({ ...f, odds: e.target.value }))} placeholder="2.10" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Stake ($AUD) *</label>
                <input style={inputStyle} type="number" step="1" value={form.stake} onChange={e => setForm(f => ({ ...f, stake: e.target.value }))} placeholder="50" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Sport</label>
                <select style={{ ...inputStyle, appearance: "none" }} value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value }))}>
                  <option value="soccer">⚽ Soccer</option>
                  <option value="nba">🏀 NBA</option>
                  <option value="nrl">🏉 NRL</option>
                  <option value="ufc">🥊 UFC/MMA</option>
                  <option value="other">🎲 Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Date</label>
                <input style={inputStyle} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Notes</label>
                <input style={inputStyle} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Edge signal, reasoning..." />
              </div>
            </div>
            {form.odds && form.stake && parseFloat(form.odds) > 1 && parseFloat(form.stake) > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#888899", background: "rgba(255,255,255,0.04)", padding: "8px 12px", borderRadius: 2 }}>
                💡 To win: <strong>{fmtCurrency(parseFloat(form.stake) * (parseFloat(form.odds) - 1))}</strong> · Total return: <strong>{fmtCurrency(parseFloat(form.stake) * parseFloat(form.odds))}</strong>
              </div>
            )}
            <button
              onClick={submitBet}
              disabled={saving}
              style={{
                marginTop: 14, width: "100%", padding: "10px 0",
                background: saving ? "rgba(255,255,255,0.04)" : "rgba(232,224,208,0.08)",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: 2, color: saving ? "#44444f" : "#e8e0d0",
                fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "Saving…" : editId ? "Save Changes" : "Log Bet"}
            </button>
          </div>
        )}

        {/* ── Filters ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
          {/* Status */}
          {([["all", "All"], ["pending", "⏳ Pending"], ["settled", "✅ Settled"]] as [StatusFilter, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setStatusFilter(k)} style={{
              padding: "6px 14px", borderRadius: 2, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: "transparent",
              color: statusFilter === k ? "#e8e0d0" : "#44444f",
            }}>{l}</button>
          ))}

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />

          {/* Sport */}
          {SPORTS.map(s => (
            <button key={s} onClick={() => setSportFilter(s)} style={{
              padding: "6px 10px", borderRadius: 2, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
              background: "transparent",
              color: sportFilter === s ? "#e8e0d0" : "#44444f",
            }}>
              {s === "all" ? "All Sports" : `${SPORT_EMOJIS[s] ?? "🎲"} ${s.toUpperCase()}`}
            </button>
          ))}

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />

          {/* Date range */}
          {([["all", "All Time"], ["week", "This Week"], ["month", "This Month"]] as [DateFilter, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setDateFilter(k)} style={{
              padding: "6px 12px", borderRadius: 2, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
              background: "transparent",
              color: dateFilter === k ? "#e8e0d0" : "#44444f",
            }}>{l}</button>
          ))}
        </div>

        {/* ── Bet list ── */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array(4).fill(null).map((_, i) => (
              <div key={i} style={{
                height: 80, background: "#141419", borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.05)",
                animation: "pulse 1.5s infinite",
              }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: "#141419", borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.07)",
            padding: 60, textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <div style={{ color: "#6b7280", fontSize: 14 }}>
              {bets.length === 0
                ? 'No bets logged yet. Hit "+ Log Bet" to start tracking.'
                : "No bets match your filters."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(b => {
              const potentialReturn = b.stake * b.odds;
              const actualPnl = b.result === "win" ? (b.payout ?? potentialReturn) - b.stake
                : b.result === "loss" ? -b.stake
                : b.result === "void" ? 0 : null;
              return (
                <div key={b.id} style={{
                  background: "#141419", borderRadius: 2,
                  border: `1px solid ${b.result === "win" ? "rgba(34,197,94,0.25)" : b.result === "loss" ? "rgba(239,68,68,0.2)" : b.result === "void" ? "rgba(107,114,128,0.2)" : "rgba(255,255,255,0.07)"}`,
                  padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 11 }}>{SPORT_EMOJIS[b.sport] ?? "🎲"}</span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>{b.date.slice(0, 10)}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                          background: b.result === "win" ? "rgba(34,197,94,0.12)" : b.result === "loss" ? "rgba(239,68,68,0.12)" : b.result === "void" ? "rgba(107,114,128,0.12)" : "rgba(234,179,8,0.12)",
                          color: b.result === "win" ? "#22c55e" : b.result === "loss" ? "#ef4444" : b.result === "void" ? "#6b7280" : "#eab308",
                        }}>
                          {b.result === "pending" ? "⏳ OPEN" : b.result === "win" ? "✅ WIN" : b.result === "loss" ? "❌ LOSS" : "↩️ VOID"}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {b.match}
                      </div>
                      <div style={{ fontSize: 12, color: "#888899" }}>
                        {b.market}: <strong>{b.pick}</strong> @ {b.odds.toFixed(2)}
                      </div>
                      {b.notes && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3, fontStyle: "italic" }}>{b.notes}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, color: "#9ca3af" }}>
                        Stake: <span style={{ color: "white", fontWeight: 700 }}>{fmtCurrency(b.stake)}</span>
                      </div>
                      {b.result === "pending" && (
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>To win: {fmtCurrency(potentialReturn - b.stake)}</div>
                      )}
                      {actualPnl !== null && (
                        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: actualPnl > 0 ? "#22c55e" : actualPnl < 0 ? "#ef4444" : "#6b7280" }}>
                          {fmtCurrency(actualPnl, true)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {b.result === "pending" && (
                      <>
                        <button onClick={() => settle(b.id, "win")} style={{ flex: 1, padding: "6px 0", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 7, color: "#22c55e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✅ Win</button>
                        <button onClick={() => settle(b.id, "loss")} style={{ flex: 1, padding: "6px 0", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>❌ Loss</button>
                        <button onClick={() => settle(b.id, "void")} style={{ flex: 1, padding: "6px 0", background: "rgba(107,114,128,0.08)", border: "1px solid rgba(107,114,128,0.2)", borderRadius: 7, color: "#6b7280", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>↩️ Void</button>
                      </>
                    )}
                    <button onClick={() => startEdit(b)} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 2, color: "#888899", fontSize: 11, cursor: "pointer" }}>✏️</button>
                    <button onClick={() => deleteBet(b.id)} style={{ padding: "6px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 7, color: "#ef4444", fontSize: 11, cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
