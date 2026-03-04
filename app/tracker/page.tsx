import Link from "next/link";

export default function Tracker() {
  const stats = [
    { label: "Total Staked", value: "$0", color: "#9ca3af" },
    { label: "Returns", value: "$0", color: "#9ca3af" },
    { label: "P&L", value: "$0.00", color: "#22c55e" },
    { label: "Win Rate", value: "0%", color: "#eab308" },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "24px 16px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Link
          href="/"
          style={{ color: "#7c3aed", textDecoration: "none", fontSize: 14, display: "inline-block", marginBottom: 20 }}
        >
          ← Back
        </Link>
        <h1 style={{ color: "white", fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
          💰 Bet Tracker
        </h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {stats.map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: "#12121a",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.07)",
                padding: 20,
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "#12121a",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
            padding: 60,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>🦞</div>
          <div style={{ color: "#6b7280", fontSize: 15 }}>
            No active bets. Gordon is scanning markets.
          </div>
          <div style={{ color: "#374151", fontSize: 12, marginTop: 8 }}>
            Sports bet tracking coming soon
          </div>
        </div>
      </div>
    </main>
  );
}
