"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Bet {
  id: string;
  date: string;           // ISO string
  match: string;          // "Arsenal vs Chelsea"
  market: string;         // "Match Winner"
  pick: string;           // "Arsenal"
  odds: number;           // decimal
  stake: number;          // AUD
  result: "pending" | "win" | "loss" | "void";
  payout?: number;        // actual payout received
  sport: string;
  notes?: string;
}

const STORAGE_KEY = "ryojin_bets_v2";

function loadBets(): Bet[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch { return []; }
}

function saveBets(bets: Bet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}

function fmtCurrency(n: number, forceSign = false): string {
  const s = Math.abs(n).toFixed(2);
  if (forceSign) return (n >= 0 ? "+" : "-") + "$" + s;
  return (n < 0 ? "-" : "") + "$" + s;
}

const SPORT_EMOJIS: Record<string, string> = {
  soccer: "⚽", nba: "🏀", nrl: "🏉", ufc: "🥊", other: "🎲",
};

export default function Tracker() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "settled">("all");

  // Form state
  const [form, setForm] = useState({
    match: "", market: "Match Winner", pick: "", odds: "",
    stake: "", sport: "soccer", notes: "", date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => { setBets(loadBets()); }, []);

  const settled = bets.filter(b => b.result !== "pending");
  const pending = bets.filter(b => b.result === "pending");

  const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
  const totalReturns = settled.reduce((s, b) => {
    if (b.result === "win") return s + (b.payout ?? b.stake * b.odds);
    if (b.result === "void") return s + b.stake;
    return s;
  }, 0);
  const pnl = totalReturns - totalStaked;
  const winRate = settled.length > 0
    ? Math.round((settled.filter(b => b.result === "win").length / settled.filter(b => b.result !== "void").length) * 100)
    : 0;
  const roi = totalStaked > 0 ? ((pnl / totalStaked) * 100).toFixed(1) : "0.0";
  const pendingExposure = pending.reduce((s, b) => s + b.stake, 0);
  const avgOdds = settled.filter(b => b.result === "win").length > 0
    ? (settled.filter(b => b.result === "win").reduce((s, b) => s + b.odds, 0) / settled.filter(b => b.result === "win").length).toFixed(2)
    : "—";

  const stats = [
    { label: "Total Staked", value: fmtCurrency(totalStaked), sub: `${settled.length} settled bets`, color: "#9ca3af" },
    { label: "P&L", value: fmtCurrency(pnl, true), sub: `ROI: ${roi}%`, color: pnl >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Win Rate", value: `${winRate}%`, sub: `${settled.filter(b=>b.result==="win").length}W / ${settled.filter(b=>b.result==="loss").length}L`, color: winRate >= 50 ? "#22c55e" : "#eab308" },
    { label: "Avg Win Odds", value: avgOdds, sub: "decimal", color: "#7c3aed" },
    { label: "Pending", value: fmtCurrency(pendingExposure), sub: `${pending.length} open bets`, color: "#eab308" },
  ];

  function submitBet() {
    if (!form.match || !form.pick || !form.odds || !form.stake) return;
    const odds = parseFloat(form.odds);
    const stake = parseFloat(form.stake);
    if (isNaN(odds) || isNaN(stake) || odds <= 1 || stake <= 0) return;

    if (editId) {
      const updated = bets.map(b => b.id === editId ? { ...b, ...form, odds, stake } : b);
      setBets(updated); saveBets(updated); setEditId(null);
    } else {
      const newBet: Bet = {
        id: Date.now().toString(),
        date: form.date,
        match: form.match, market: form.market, pick: form.pick,
        odds, stake, result: "pending",
        sport: form.sport, notes: form.notes,
      };
      const updated = [newBet, ...bets];
      setBets(updated); saveBets(updated);
    }
    setForm({ match: "", market: "Match Winner", pick: "", odds: "", stake: "", sport: "soccer", notes: "", date: new Date().toISOString().slice(0, 10) });
    setShowForm(false);
  }

  function settle(id: string, result: "win" | "loss" | "void", payout?: number) {
    const updated = bets.map(b => b.id === id ? { ...b, result, payout } : b);
    setBets(updated); saveBets(updated);
  }

  function deleteBet(id: string) {
    if (!confirm("Delete this bet?")) return;
    const updated = bets.filter(b => b.id !== id);
    setBets(updated); saveBets(updated);
  }

  function startEdit(b: Bet) {
    setForm({ match: b.match, market: b.market, pick: b.pick, odds: b.odds.toString(), stake: b.stake.toString(), sport: b.sport, notes: b.notes ?? "", date: b.date.slice(0,10) });
    setEditId(b.id); setShowForm(true);
  }

  const displayed = bets.filter(b =>
    filter === "all" ? true : filter === "pending" ? b.result === "pending" : b.result !== "pending"
  );

  const inputStyle = {
    width: "100%", background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13, outline: "none",
    boxSizing: "border-box" as const,
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "24px 16px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }`}</style>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <Link href="/" style={{ color: "#7c3aed", textDecoration: "none", fontSize: 13 }}>← Back</Link>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: 800, marginTop: 6, marginBottom: 0 }}>💰 Bet Tracker</h1>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditId(null); }}
            style={{ background: "#7c3aed", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, padding: "10px 20px", cursor: "pointer" }}
          >
            {showForm ? "✕ Cancel" : "+ Log Bet"}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
          {stats.map(({ label, value, sub, color }) => (
            <div key={label} style={{ background: "#12121a", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Add / Edit Bet Form */}
        {showForm && (
          <div style={{ background: "#12121a", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 16 }}>{editId ? "✏️ Edit Bet" : "➕ Log New Bet"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Match *</label>
                <input style={inputStyle} value={form.match} onChange={e => setForm(f=>({...f, match: e.target.value}))} placeholder="Arsenal vs Chelsea" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Pick *</label>
                <input style={inputStyle} value={form.pick} onChange={e => setForm(f=>({...f, pick: e.target.value}))} placeholder="Arsenal" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Market</label>
                <input style={inputStyle} value={form.market} onChange={e => setForm(f=>({...f, market: e.target.value}))} placeholder="Match Winner" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Decimal Odds *</label>
                <input style={inputStyle} type="number" step="0.01" value={form.odds} onChange={e => setForm(f=>({...f, odds: e.target.value}))} placeholder="2.10" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Stake ($AUD) *</label>
                <input style={inputStyle} type="number" step="1" value={form.stake} onChange={e => setForm(f=>({...f, stake: e.target.value}))} placeholder="50" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Sport</label>
                <select style={{...inputStyle, appearance: "none"}} value={form.sport} onChange={e => setForm(f=>({...f, sport: e.target.value}))}>
                  <option value="soccer">⚽ Soccer</option>
                  <option value="nba">🏀 NBA</option>
                  <option value="nrl">🏉 NRL</option>
                  <option value="ufc">🥊 UFC/MMA</option>
                  <option value="other">🎲 Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Date</label>
                <input style={inputStyle} type="date" value={form.date} onChange={e => setForm(f=>({...f, date: e.target.value}))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Notes</label>
                <input style={inputStyle} value={form.notes} onChange={e => setForm(f=>({...f, notes: e.target.value}))} placeholder="Edge signal, reasoning..." />
              </div>
            </div>
            {form.odds && form.stake && parseFloat(form.odds) > 1 && parseFloat(form.stake) > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#7c3aed", background: "rgba(124,58,237,0.08)", padding: "8px 12px", borderRadius: 8 }}>
                💡 To win: <strong>{fmtCurrency(parseFloat(form.stake) * (parseFloat(form.odds) - 1))}</strong> &nbsp;|&nbsp; Total return: <strong>{fmtCurrency(parseFloat(form.stake) * parseFloat(form.odds))}</strong>
              </div>
            )}
            <button
              onClick={submitBet}
              style={{ marginTop: 14, width: "100%", padding: "10px 0", background: "#7c3aed", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {editId ? "Save Changes" : "Log Bet"}
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {([["all", "All"], ["pending", "⏳ Pending"], ["settled", "✅ Settled"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: filter === k ? "#7c3aed" : "rgba(255,255,255,0.05)",
              color: filter === k ? "white" : "#6b7280",
            }}>{l} {k === "all" ? `(${bets.length})` : k === "pending" ? `(${pending.length})` : `(${settled.length})`}</button>
          ))}
        </div>

        {/* Bet list */}
        {displayed.length === 0 ? (
          <div style={{ background: "#12121a", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🥊</div>
            <div style={{ color: "#6b7280", fontSize: 14 }}>No bets logged yet. Hit &quot;+ Log Bet&quot; to start tracking.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {displayed.map(b => {
              const potentialReturn = b.stake * b.odds;
              const actualPnl = b.result === "win" ? (b.payout ?? potentialReturn) - b.stake
                : b.result === "loss" ? -b.stake
                : b.result === "void" ? 0 : null;
              return (
                <div key={b.id} style={{
                  background: "#12121a", borderRadius: 12,
                  border: `1px solid ${b.result === "win" ? "rgba(34,197,94,0.3)" : b.result === "loss" ? "rgba(239,68,68,0.2)" : b.result === "void" ? "rgba(107,114,128,0.2)" : "rgba(255,255,255,0.07)"}`,
                  padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 11 }}>{SPORT_EMOJIS[b.sport] ?? "🎲"}</span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>{b.date.slice(0,10)}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                          background: b.result === "win" ? "rgba(34,197,94,0.15)" : b.result === "loss" ? "rgba(239,68,68,0.15)" : b.result === "void" ? "rgba(107,114,128,0.15)" : "rgba(234,179,8,0.15)",
                          color: b.result === "win" ? "#22c55e" : b.result === "loss" ? "#ef4444" : b.result === "void" ? "#6b7280" : "#eab308",
                        }}>
                          {b.result === "pending" ? "⏳ OPEN" : b.result === "win" ? "✅ WIN" : b.result === "loss" ? "❌ LOSS" : "↩️ VOID"}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.match}</div>
                      <div style={{ fontSize: 12, color: "#a78bfa" }}>{b.market}: <strong>{b.pick}</strong> @ {b.odds.toFixed(2)}</div>
                      {b.notes && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3, fontStyle: "italic" }}>{b.notes}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, color: "#9ca3af" }}>Stake: <span style={{ color: "white", fontWeight: 700 }}>{fmtCurrency(b.stake)}</span></div>
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
                        <button onClick={() => settle(b.id, "win")} style={{ flex: 1, padding: "6px 0", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 7, color: "#22c55e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✅ Win</button>
                        <button onClick={() => settle(b.id, "loss")} style={{ flex: 1, padding: "6px 0", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>❌ Loss</button>
                        <button onClick={() => settle(b.id, "void")} style={{ flex: 1, padding: "6px 0", background: "rgba(107,114,128,0.1)", border: "1px solid rgba(107,114,128,0.2)", borderRadius: 7, color: "#6b7280", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>↩️ Void</button>
                      </>
                    )}
                    <button onClick={() => startEdit(b)} style={{ padding: "6px 12px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 7, color: "#7c3aed", fontSize: 11, cursor: "pointer" }}>✏️</button>
                    <button onClick={() => deleteBet(b.id)} style={{ padding: "6px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 7, color: "#ef4444", fontSize: 11, cursor: "pointer" }}>🗑️</button>
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
