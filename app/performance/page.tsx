'use client'

import { useEffect, useState } from 'react'

interface BreakdownRow {
  total: number
  wins: number
  losses: number
  pending: number
  pnl: number
  staked: number
  avg_closing_odds?: number | null
  avg_clv?: number | null
}

interface SportRow extends BreakdownRow { sport: string }
interface MarketRow extends BreakdownRow { market: string }
interface EdgeRow extends BreakdownRow { tier: string }

interface ClvSummary {
  with_clv: number
  avg_clv: number | null
  beat_closing: number
}

interface PerfData {
  bySport: SportRow[]
  byMarket: MarketRow[]
  byEdge: EdgeRow[]
  clvSummary: ClvSummary
}

function roi(pnl: number, staked: number): number | null {
  if (!staked) return null
  return parseFloat(((pnl / staked) * 100).toFixed(1))
}

function RoiCell({ pnl, staked }: { pnl: number; staked: number; wins: number }) {
  const r = roi(pnl, staked)
  if (r === null || staked === 0) {
    return <span style={{ color: '#4b5563' }}>—</span>
  }
  const color = r > 0 ? '#22c55e' : r < 0 ? '#ef4444' : '#6b7280'
  return (
    <span style={{ color, fontWeight: 600 }}>
      {r >= 0 ? '+' : ''}{r}%
    </span>
  )
}

function SectionTable<T extends BreakdownRow>({
  title,
  rows,
  labelKey,
}: {
  title: string
  rows: T[]
  labelKey: keyof T
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontFamily: 'monospace', fontSize: 11, color: '#666',
        letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12,
      }}>
        {title}
      </div>
      {!rows.length ? (
        <p style={{ color: '#4b5563', fontSize: 13, margin: 0 }}>No data yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Name', 'Total', 'W', 'L', 'Pending', 'P&L', 'ROI%', 'Closing', 'CLV'].map(h => (
                  <th key={h} style={{
                    padding: '8px 10px',
                    textAlign: h === 'Name' ? 'left' : 'right',
                    color: '#4b5563', fontWeight: 600, fontSize: 11,
                    fontFamily: 'monospace',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '9px 10px', color: 'white', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(row[labelKey] ?? '—')}
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: '#9ca3af' }}>{row.total}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: '#22c55e' }}>{row.wins}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: '#ef4444' }}>{row.losses}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: '#6b7280' }}>{row.pending}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', color: Number(row.pnl) >= 0 ? '#22c55e' : '#ef4444' }}>
                    {Number(row.pnl) >= 0 ? '+' : ''}${Number(row.pnl).toFixed(2)}
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                    <RoiCell pnl={Number(row.pnl)} staked={Number(row.staked)} wins={row.wins} />
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>
                    {row.avg_closing_odds != null ? Number(row.avg_closing_odds).toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {row.avg_clv != null
                      ? <span style={{ color: Number(row.avg_clv) >= 0 ? '#22c55e' : '#ef4444' }}>
                          {Number(row.avg_clv) >= 0 ? '+' : ''}{(Number(row.avg_clv) * 100).toFixed(1)}%
                        </span>
                      : <span style={{ color: '#4b5563' }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function PerformancePage() {
  const [data, setData] = useState<PerfData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats/performance')
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const clv = data?.clvSummary
  const hasClv = Number(clv?.with_clv ?? 0) > 0

  return (
    <main style={{ minHeight: '100vh', background: '#080808', padding: '0 0 60px' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '28px 24px 24px', marginBottom: 32 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 4px', letterSpacing: -0.5 }}>
            Performance Breakdown
          </h1>
          <p style={{ color: '#6b7280', margin: 0, fontSize: 13 }}>
            ROI by sport, market type, and edge tier
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>

        {/* CLV Summary */}
        {!loading && hasClv && clv && (
          <div style={{
            background: '#141419',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 2,
            padding: '18px 24px',
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                Avg CLV
              </div>
              <div style={{ fontSize: 28, fontWeight: 300, fontFamily: 'monospace', color: Number(clv.avg_clv ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                {Number(clv.avg_clv ?? 0) >= 0 ? '+' : ''}{Number(clv.avg_clv ?? 0).toFixed(2)}%
              </div>
            </div>
            <div style={{ color: '#6b7280', fontSize: 13 }}>
              Across <strong style={{ color: 'white' }}>{clv.with_clv}</strong> picks with closing data ·{' '}
              <strong style={{ color: '#22c55e' }}>{clv.beat_closing}</strong> beat closing line
              {' '}({Number(clv.with_clv) > 0 ? Math.round((Number(clv.beat_closing) / Number(clv.with_clv)) * 100) : 0}%)
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[120, 180, 140].map((h, i) => (
              <div key={i} style={{ height: h, background: 'rgba(255,255,255,0.04)', borderRadius: 2, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : (
          <div style={{ background: '#141419', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, padding: '24px' }}>
            <SectionTable title="By Sport" rows={data?.bySport ?? []} labelKey="sport" />
            <SectionTable title="By Market" rows={data?.byMarket ?? []} labelKey="market" />
            <SectionTable title="By Edge Tier" rows={data?.byEdge ?? []} labelKey="tier" />
          </div>
        )}
      </div>
    </main>
  )
}
