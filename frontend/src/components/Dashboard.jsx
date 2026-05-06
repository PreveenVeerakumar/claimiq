import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import api from '../api/client'

function fmt(v, digits = 1) {
  if (v == null) return 'N/A'
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(digits)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(digits)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(digits)}K`
  return `$${v.toFixed(0)}`
}

function KPITile({ label, value, sub, subColor, trend }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 0 }}>
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div className="kpi-number">{value}</div>
        {trend != null && (
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: trend > 0 ? 'var(--danger)' : trend < 0 ? 'var(--emerald)' : 'var(--text-muted)'
          }}>
            {trend > 0 ? '▲' : trend < 0 ? '▼' : '–'}
          </span>
        )}
      </div>
      {sub && (
        <div style={{ marginTop: 6, fontSize: 12, color: subColor || 'var(--text-muted)', fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="card-title" style={{ marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function InsightItem({ color, icon, title, body }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '12px 0',
      borderBottom: '1px solid #f1f5f9'
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: color + '18', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 14
      }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  )
}

const INDIGO = '#6366f1'
const EMERALD = '#10b981'
const AMBER = '#f59e0b'
const DANGER = '#ef4444'
const GRAY = '#e2e8f0'
const BLUE = '#3b82f6'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [topDrugs, setTopDrugs] = useState([])
  const [variance, setVariance] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/summary'),
      api.get('/api/top-drugs'),
      api.get('/api/variance')
    ])
      .then(([s, t, v]) => {
        setSummary(s.data)
        setTopDrugs(t.data)
        setVariance(v.data)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const insights = useMemo(() => {
    if (!topDrugs.length || !summary) return []
    const sorted_pct = [...topDrugs].sort((a, b) => (b.spend_change_pct || 0) - (a.spend_change_pct || 0))
    const sorted_abs = [...topDrugs].sort((a, b) => ((b.spend_2025 - b.spend_2024) || 0) - ((a.spend_2025 - a.spend_2024) || 0))
    const sorted_cost = [...topDrugs].sort((a, b) => (b.avg_cost_per_claim_2024 || 0) - (a.avg_cost_per_claim_2024 || 0))
    const totalRebate = topDrugs.reduce((s, d) => s + (d.estimated_rebate_2024 || 0), 0)
    const highRisk = topDrugs.filter(d => d.variance_flag === 'high_increase').length
    const conc = summary.top_10_spend_concentration_pct ?? 0

    const result = []
    const top_pct = sorted_pct[0]
    if (top_pct && top_pct.spend_change_pct > 0) {
      result.push({
        color: DANGER, icon: '📈', title: 'Fastest Growing Spend',
        body: `${top_pct.brand_name} grew ${top_pct.spend_change_pct?.toFixed(1)}% YoY — from ${fmt(top_pct.spend_2024)} (2024) to ${fmt(top_pct.spend_2025)} (2025 YTD).`
      })
    }
    const top_abs = sorted_abs[0]
    if (top_abs) {
      const diff = (top_abs.spend_2025 || 0) - (top_abs.spend_2024 || 0)
      result.push({
        color: AMBER, icon: '💰', title: 'Highest Absolute Increase',
        body: `${top_abs.brand_name} added ${fmt(diff)} in spend YoY — the single largest dollar-amount increase in the portfolio.`
      })
    }
    const top_cost = sorted_cost[0]
    if (top_cost) {
      result.push({
        color: INDIGO, icon: '🏷', title: 'Highest Cost Per Claim',
        body: `${top_cost.brand_name} at ${fmt(top_cost.avg_cost_per_claim_2024)}/claim — classified as specialty biologic tier.`
      })
    }
    result.push({
      color: EMERALD, icon: '♻', title: 'Estimated WAC-to-ASP Market Discount',
      body: `${fmt(totalRebate)} estimated WAC-to-ASP discount across top 20 drugs. Rates: 25% specialty biologics, 20% brand, 3% generics — sourced from MedPAC 2023. Note: Part B ASP spending already reflects these discounts; this is not an additional rebate.`
    })
    if (highRisk > 0) {
      result.push({
        color: DANGER, icon: '⚠', title: 'Spend Variance Alert',
        body: `${highRisk} of the top 20 drugs show >20% spend increase vs 2024 — flagged for financial review.`
      })
    }
    result.push({
      color: AMBER, icon: '🎯', title: 'Concentration Risk',
      body: `Top 10 drugs represent ${conc.toFixed(1)}% of total Medicare Part B spend — high portfolio concentration risk.`
    })
    return result
  }, [topDrugs, summary])

  if (loading) return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: 110 }} />)}
      </div>
      <div className="skeleton" style={{ height: 320, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 280 }} />
    </div>
  )

  if (error) return <div className="error-banner">Failed to load dashboard: {error}</div>

  const spendChangePct = summary?.spend_change_pct ?? 0
  const varianceFlagCount = variance.filter(d => d.variance_flag !== 'stable').length
  const concentration = summary?.top_10_spend_concentration_pct ?? 0

  const top10BarData = topDrugs.slice(0, 10).map(d => ({
    name: d.brand_name.length > 18 ? d.brand_name.slice(0, 18) + '…' : d.brand_name,
    spend: d.spend_2024
  })).reverse()

  const top10Total = topDrugs.slice(0, 10).reduce((s, d) => s + (d.spend_2024 || 0), 0)
  const totalSpend = summary?.total_spend_2024 || 1
  const pieConcentrationData = [
    { name: 'Top 10 Drugs', value: top10Total },
    { name: 'All Others', value: totalSpend - top10Total }
  ]

  const yoyData = topDrugs.slice(0, 8).map(d => ({
    name: d.brand_name.length > 14 ? d.brand_name.slice(0, 14) + '…' : d.brand_name,
    '2024': d.spend_2024,
    '2025 YTD': d.spend_2025
  }))

  const flagCounts = variance.reduce((acc, d) => {
    acc[d.variance_flag] = (acc[d.variance_flag] || 0) + 1
    return acc
  }, {})
  const variancePieData = [
    { name: 'High Increase (>20%)', value: flagCounts['high_increase'] || 0 },
    { name: 'Stable (±20%)', value: flagCounts['stable'] || 0 },
    { name: 'High Decrease (>20%)', value: flagCounts['high_decrease'] || 0 }
  ].filter(d => d.value > 0)
  const varColors = [DANGER, '#94a3b8', BLUE]

  const rebateData = topDrugs.slice(0, 8).map(d => ({
    name: d.brand_name.length > 14 ? d.brand_name.slice(0, 14) + '…' : d.brand_name,
    'Net ASP Cost': (d.spend_2024 || 0) - (d.estimated_rebate_2024 || 0),
    'WAC-ASP Discount': d.estimated_rebate_2024 || 0
  })).reverse()

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <KPITile
          label="Total 2024 Spend"
          value={fmt(summary?.total_spend_2024)}
          sub="Full year Q1–Q4"
        />
        <KPITile
          label="2025 YTD Spend"
          value={fmt(summary?.total_spend_2025)}
          sub="Partial year Q1–Q3"
        />
        <KPITile
          label="Year-over-Year Change"
          value={`${spendChangePct >= 0 ? '+' : ''}${spendChangePct.toFixed(1)}%`}
          trend={spendChangePct}
          sub={spendChangePct >= 0 ? 'Spend trending up vs 2024' : 'Spend trending down vs 2024'}
          subColor={spendChangePct >= 0 ? 'var(--danger)' : 'var(--emerald)'}
        />
        <KPITile
          label="Drugs with Variance Flag"
          value={varianceFlagCount}
          sub={`of ${variance.length} tracked drugs`}
          subColor="var(--amber)"
        />
      </div>

      {/* Row 2: Top 10 bar + concentration donut */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ flex: 3 }}>
          <SectionHeader title="Top 10 Drugs by 2024 Spend" sub="Gross drug spend, full year 2024" />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={top10BarData} margin={{ left: 8, right: 32 }}>
              <XAxis
                type="number"
                tickFormatter={v => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false} tickLine={false}
              />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: '#1e293b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="spend" fill={INDIGO} radius={[0, 4, 4, 0]} name="2024 Spend" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ flex: 2 }}>
          <SectionHeader title="Spend Concentration" sub="Portfolio concentration risk" />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieConcentrationData} cx="50%" cy="50%" innerRadius="52%" outerRadius="72%" dataKey="value" stroke="none">
                  <Cell fill={INDIGO} />
                  <Cell fill={GRAY} />
                </Pie>
                <Tooltip formatter={v => [fmt(v, 2), '']} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', textAlign: 'center',
              top: '43%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none'
            }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{concentration.toFixed(0)}%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Top 10</div>
            </div>
          </div>
          <div style={{
            background: concentration > 60 ? '#fff7ed' : '#f0fdf4',
            border: `1px solid ${concentration > 60 ? '#fed7aa' : '#bbf7d0'}`,
            borderRadius: 8, padding: '10px 12px', fontSize: 12,
            color: concentration > 60 ? '#92400e' : '#065f46', marginTop: 8
          }}>
            {concentration > 60
              ? `⚠ High concentration — ${concentration.toFixed(1)}% of spend in 10 drugs indicates formulary risk.`
              : `✓ Moderate concentration — ${concentration.toFixed(1)}% in top 10 drugs.`}
          </div>
        </div>
      </div>

      {/* Row 3: YoY grouped bar + Variance flag pie */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ flex: 3 }}>
          <SectionHeader title="Year-over-Year Spend Comparison" sub="2024 full year vs 2025 Q1–Q3 (partial) — top 8 drugs" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={yoyData} margin={{ left: 8, right: 16 }} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={v => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`}
                tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={68}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="2024" fill={INDIGO} radius={[3, 3, 0, 0]} name="2024" />
              <Bar dataKey="2025 YTD" fill={EMERALD} radius={[3, 3, 0, 0]} name="2025 YTD" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ flex: 2 }}>
          <SectionHeader title="Variance Flag Distribution" sub={`Across all ${variance.length} tracked drugs`} />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={variancePieData} cx="50%" cy="50%" outerRadius="70%" dataKey="value" stroke="none" label={({ name, value }) => `${value}`} labelLine={false}>
                {variancePieData.map((_, i) => <Cell key={i} fill={varColors[i]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v + ' drugs', n]} />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {variancePieData.map((d, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center', padding: '8px 4px',
                background: varColors[i] + '12', borderRadius: 8,
                border: `1px solid ${varColors[i]}30`
              }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: varColors[i] }}>{d.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  {d.name.split(' ')[0] + ' ' + d.name.split(' ')[1]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Rebate stacked bar + Key Insights */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div className="card" style={{ flex: 3 }}>
          <SectionHeader title="WAC-to-ASP Market Discount Analysis" sub="Estimated discount embedded in ASP pricing — top 8 drugs (2024) · Source: MedPAC 2023" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart layout="vertical" data={rebateData} margin={{ left: 8, right: 32 }}>
              <XAxis
                type="number"
                tickFormatter={v => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`}
                tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
              />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: '#1e293b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Net ASP Cost" stackId="a" fill={INDIGO} name="Net ASP Cost" />
              <Bar dataKey="WAC-ASP Discount" stackId="a" fill={AMBER} radius={[0, 4, 4, 0]} name="WAC-ASP Discount" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ flex: 2 }}>
          <SectionHeader title="Key Insights" sub="Auto-derived from model outputs" />
          <div>
            {insights.map((ins, i) => (
              <InsightItem key={i} color={ins.color} icon={ins.icon} title={ins.title} body={ins.body} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
