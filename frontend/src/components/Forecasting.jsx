import { useEffect, useState, useMemo } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'
import api from '../api/client'

function fmt(v, digits = 1) {
  if (v == null) return 'N/A'
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(digits)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(digits)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(digits)}K`
  return `$${v.toFixed(0)}`
}

function SummaryTile({ label, value, sub }) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function Forecasting() {
  const [forecasts, setForecasts] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/forecast')
      .then(r => {
        setForecasts(r.data)
        if (r.data.length > 0) setSelected(r.data[0].drug_name)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const drug = useMemo(
    () => forecasts.find(f => f.drug_name === selected),
    [forecasts, selected]
  )

  const chartData = useMemo(() => {
    if (!drug) return []
    return [
      {
        date: '2024 Full Year',
        actual: drug.spend_2024,
        projected: null,
        upper: null,
        lower: null
      },
      {
        date: '2025 Q1–Q3',
        actual: drug.spend_2025_actual,
        projected: drug.spend_2025_actual,
        upper: null,
        lower: null
      },
      {
        date: '2025 Projected',
        actual: null,
        projected: drug.spend_2025_projected,
        upper: drug.upper_bound,
        lower: drug.lower_bound
      }
    ]
  }, [drug])

  if (loading) return <div className="skeleton" style={{ height: 500 }} />
  if (error) return <div className="error-banner">Failed to load forecasts: {error}</div>
  if (!forecasts.length) return <div>No forecast data available.</div>

  const growth = drug?.growth_rate_pct ?? 0
  const bandWidth = drug ? (drug.upper_bound - drug.lower_bound) : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <label style={{ fontWeight: 500, fontSize: 14 }}>Drug:</label>
        <select
          value={selected || ''}
          onChange={e => setSelected(e.target.value)}
          style={{ minWidth: 280 }}
        >
          {forecasts.map(f => (
            <option key={f.drug_name} value={f.drug_name}>{f.drug_name}</option>
          ))}
        </select>
        {drug && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {drug.generic_name}
          </span>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">2025 Full-Year Spend Projection</div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ left: 16, right: 24 }}>
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis
              tickFormatter={v => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`}
              tick={{ fontSize: 11, fill: '#64748b' }}
              width={72}
            />
            <Tooltip formatter={v => [v != null ? fmt(v, 2) : 'N/A', '']} />
            <Area
              type="monotone"
              dataKey="upper"
              fill="#e0e7ff"
              stroke="none"
              connectNulls
              activeDot={false}
              name="Upper bound"
            />
            <Area
              type="monotone"
              dataKey="lower"
              fill="white"
              stroke="none"
              connectNulls
              activeDot={false}
              name="Lower bound"
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 5, fill: '#6366f1' }}
              connectNulls
              name="Actual spend"
            />
            <Line
              type="monotone"
              dataKey="projected"
              stroke="#6366f1"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={{ r: 5, fill: '#6366f1', strokeDasharray: '' }}
              connectNulls
              name="Projected spend"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <SummaryTile
          label="2025 Projected Spend"
          value={fmt(drug?.spend_2025_projected)}
          sub="Full-year estimate"
        />
        <SummaryTile
          label="Growth Rate vs 2024"
          value={`${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`}
          sub={growth >= 0 ? 'Spend increasing' : 'Spend decreasing'}
        />
        <SummaryTile
          label="Confidence Range"
          value={fmt(drug?.lower_bound) + ' – ' + fmt(drug?.upper_bound)}
          sub={`Band width: ${fmt(bandWidth)}`}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>All 20 Drugs — Ranked by Projected Spend</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Drug</th>
              <th>2024 Actual</th>
              <th>2025 Projected</th>
              <th>Growth %</th>
              <th>Confidence Band</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((f, i) => (
              <tr
                key={f.drug_name}
                style={{ cursor: 'pointer', background: f.drug_name === selected ? '#f0f1fe' : undefined }}
                onClick={() => setSelected(f.drug_name)}
              >
                <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{i + 1}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{f.drug_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.generic_name}</div>
                </td>
                <td>{fmt(f.spend_2024)}</td>
                <td style={{ fontWeight: 600 }}>{fmt(f.spend_2025_projected)}</td>
                <td style={{ color: f.growth_rate_pct >= 0 ? 'var(--danger)' : 'var(--emerald)', fontWeight: 500 }}>
                  {f.growth_rate_pct >= 0 ? '+' : ''}{f.growth_rate_pct?.toFixed(1)}%
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {fmt(f.lower_bound)} – {fmt(f.upper_bound)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
