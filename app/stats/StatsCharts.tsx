"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
  PieChart, Pie,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────
interface DayPnl {
  date: string;
  label: string;
  dailyPnl: number;
  cumulativePnl: number;
}
interface MonthPnl { month: string; pnl: number }

interface ChartsProps {
  dailyPnl: DayPnl[];
  monthlyPnl: MonthPnl[];
  overall: {
    total: number; wins: number; losses: number;
    pending: number; win_rate: number | null;
  } | null;
}

// ── Shared tooltip style ─────────────────────────────────────────────────────
const tooltipStyle = {
  backgroundColor: "#1a1a2e",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "white",
  fontSize: 12,
};

// ── P&L Line Chart ───────────────────────────────────────────────────────────
export function PnlLineChart({ data }: { data: DayPnl[] }) {
  const hasDots = data.length <= 30;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#6b7280", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={Math.max(Math.floor(data.length / 8) - 1, 0)}
        />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v}`}
          width={52}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `$${Number(value).toFixed(2)}`,
            name === "cumulativePnl" ? "Cumulative P&L" : "Daily P&L",
          ]}
          labelStyle={{ color: "#9ca3af", marginBottom: 4 }}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
        <Line
          type="monotone"
          dataKey="cumulativePnl"
          stroke="#f59e0b"
          strokeWidth={2.5}
          dot={hasDots ? { r: 3, fill: "#f59e0b", strokeWidth: 0 } : false}
          activeDot={{ r: 5, fill: "#f59e0b" }}
        />
        <Line
          type="monotone"
          dataKey="dailyPnl"
          stroke="#10b981"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={hasDots ? { r: 2.5, fill: "#10b981", strokeWidth: 0 } : false}
          activeDot={{ r: 4, fill: "#10b981" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Donut Chart ──────────────────────────────────────────────────────────────
export function OutcomeDonut({ overall }: { overall: ChartsProps["overall"] }) {
  const wins = overall?.wins ?? 0;
  const losses = overall?.losses ?? 0;
  const pending = overall?.pending ?? 0;
  const total = overall?.total ?? 0;
  const push = total - wins - losses - pending;
  const settled = wins + losses;

  const data = [
    { name: "Won", value: wins, color: "#22c55e" },
    { name: "Lost", value: losses, color: "#ef4444" },
    { name: "Push", value: Math.max(push, 0), color: "#6b7280" },
    { name: "Not settled", value: pending, color: "#2d2d44" },
  ].filter((d) => d.value > 0);

  const winPct = settled > 0 ? ((wins / settled) * 100).toFixed(1) : "—";

  // Custom legend
  const allItems = [
    { name: "Won", color: "#22c55e", pct: settled > 0 ? ((wins / total) * 100).toFixed(0) : 0 },
    { name: "Lost", color: "#ef4444", pct: settled > 0 ? ((losses / total) * 100).toFixed(0) : 0 },
    { name: "Push", color: "#6b7280", pct: total > 0 ? ((Math.max(push, 0) / total) * 100).toFixed(0) : 0 },
    { name: "Not settled", color: "#2d2d44", pct: total > 0 ? ((pending / total) * 100).toFixed(0) : 0 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {/* Donut + centre text */}
      <div style={{ position: "relative", width: 220, height: 220 }}>
        <PieChart width={220} height={220}>
          <Pie
            data={data.length ? data : [{ name: "No data", value: 1, color: "#2d2d44" }]}
            cx={110}
            cy={110}
            innerRadius={70}
            outerRadius={100}
            dataKey="value"
            stroke="none"
            paddingAngle={2}
          >
            {(data.length ? data : [{ name: "No data", value: 1, color: "#2d2d44" }]).map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [value, name]}
          />
        </PieChart>
        {/* Centre text overlay */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          textAlign: "center",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "white", lineHeight: 1.1 }}>
            {winPct}{winPct !== "—" ? "%" : ""}
          </div>
          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2, fontWeight: 600 }}>Won</div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", justifyContent: "center" }}>
        {allItems.map((item) => (
          <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              {item.name} <span style={{ color: "white", fontWeight: 600 }}>{item.pct}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Monthly Bar Chart ────────────────────────────────────────────────────────
export function MonthlyBarChart({ data }: { data: MonthPnl[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v}`}
          width={52}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "P&L"]}
          labelStyle={{ color: "#9ca3af", marginBottom: 4 }}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
