import { useEffect, useState, useMemo } from 'react'
import api from '../api/client'

function fmt(v) {
  if (v == null) return 'N/A'
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function fmtPct(v) {
  if (v == null) return 'N/A'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function FlagBadge({ flag }) {
  if (flag === 'high_increase') return <span className="badge badge-red">High Increase</span>
  if (flag === 'high_decrease') return <span className="badge badge-blue">High Decrease</span>
  return <span className="badge badge-gray">Stable</span>
}

function ModelBadge({ flag }) {
  if (flag === 'Above expectation') return <span className="badge badge-red">{flag}</span>
  if (flag === 'Below expectation') return <span className="badge badge-blue">{flag}</span>
  return <span className="badge badge-gray">{flag}</span>
}

export default function VarianceAnalysis() {
  const [data, setData] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterFlag, setFilterFlag] = useState('all')
  const [sortKey, setSortKey] = useState('spend_change_pct')
  const [sortDir, setSortDir] = useState(-1)

  useEffect(() => {
    api.get('/api/variance')
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(-1) }
  }

  const filtered = useMemo(() => {
    let rows = data
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.brand_name?.toLowerCase().includes(q) ||
        r.generic_name?.toLowerCase().includes(q) ||
        r.hcpcs_code?.includes(q)
      )
    }
    if (filterFlag !== 'all') rows = rows.filter(r => r.variance_flag === filterFlag)
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      return (av - bv) * sortDir
    })
    return rows
  }, [data, search, filterFlag, sortKey, sortDir])

  function SortTh({ label, field }) {
    const active = sortKey === field
    return (
      <th onClick={() => toggleSort(field)}>
        {label} {active ? (sortDir === -1 ? '▼' : '▲') : ''}
      </th>
    )
  }

  if (loading) return <div className="skeleton" style={{ height: 400 }} />
  if (error) return <div className="error-banner">Failed to load variance data: {error}</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search by drug name or HCPCS code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 280 }}
        />
        <select value={filterFlag} onChange={e => setFilterFlag(e.target.value)}>
          <option value="all">All drugs</option>
          <option value="high_increase">High Increase</option>
          <option value="high_decrease">High Decrease</option>
          <option value="stable">Stable</option>
        </select>
        <select value={sortKey} onChange={e => setSortKey(e.target.value)}>
          <option value="spend_change_pct">Sort: Change %</option>
          <option value="spend_change_abs">Sort: Change $</option>
          <option value="spend_2024">Sort: 2024 Spend</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
          {filtered.length} drugs
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Drug</th>
                <th>HCPCS</th>
                <SortTh label="2024 Spend" field="spend_2024" />
                <SortTh label="2025 Spend" field="spend_2025" />
                <SortTh label="Change $" field="spend_change_abs" />
                <SortTh label="Change %" field="spend_change_pct" />
                <th>Flag</th>
                <th>Model Signal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((row, i) => {
                const pct = row.spend_change_pct ?? 0
                const abs = row.spend_change_abs ?? 0
                return (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{row.brand_name || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.generic_name}</div>
                    </td>
                    <td><span className="badge badge-gray">{row.hcpcs_code}</span></td>
                    <td>{fmt(row.spend_2024)}</td>
                    <td>{fmt(row.spend_2025)}</td>
                    <td style={{ color: abs >= 0 ? 'var(--danger)' : 'var(--emerald)', fontWeight: 500 }}>
                      {abs >= 0 ? '+' : ''}{fmt(abs)}
                    </td>
                    <td style={{ color: pct >= 0 ? 'var(--danger)' : 'var(--emerald)', fontWeight: 600 }}>
                      {fmtPct(pct)}
                    </td>
                    <td><FlagBadge flag={row.variance_flag} /></td>
                    <td><ModelBadge flag={row.model_flag} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
