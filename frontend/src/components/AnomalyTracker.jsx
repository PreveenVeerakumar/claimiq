import { useEffect, useState, useMemo } from 'react'
import api from '../api/client'

function fmt(v) {
  if (v == null) return 'N/A'
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function fmtNum(v) {
  if (v == null) return 'N/A'
  return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)
}

function ScoreBar({ score }) {
  const color = score > 0.8 ? 'var(--danger)' : score >= 0.5 ? 'var(--amber)' : '#94a3b8'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1,
        height: 8,
        background: '#f1f5f9',
        borderRadius: 4,
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${score * 100}%`,
          height: '100%',
          background: color,
          borderRadius: 4,
          transition: 'width 0.3s'
        }} />
      </div>
      <span style={{ fontWeight: 600, fontSize: 13, color, width: 36, textAlign: 'right' }}>
        {score.toFixed(2)}
      </span>
    </div>
  )
}

function DrugCard({ drug }) {
  const [expanded, setExpanded] = useState(false)
  const score = drug.anomaly_score ?? 0
  const borderColor = score > 0.8 ? 'var(--danger)' : score >= 0.5 ? 'var(--amber)' : '#e2e8f0'

  return (
    <div className="card" style={{
      marginBottom: 12,
      borderLeft: `4px solid ${borderColor}`,
      padding: '20px 24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{drug.brand_name || '—'}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{drug.generic_name}</div>
          <span className="badge badge-gray" style={{ marginTop: 4 }}>{drug.hcpcs_code}</span>
        </div>
        <div style={{ minWidth: 200 }}>
          <div className="label" style={{ marginBottom: 4 }}>Anomaly Score</div>
          <ScoreBar score={score} />
        </div>
      </div>

      <div style={{
        background: '#fef9ef',
        border: '1px solid #fde68a',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 13,
        color: '#92400e',
        marginBottom: 12
      }}>
        ⚠ {drug.anomaly_reason}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Spend', value: fmt(drug.total_spend) },
          { label: 'Cost per Claim', value: fmt(drug.avg_cost_per_claim) },
          { label: 'Cost per Beneficiary', value: fmt(drug.avg_cost_per_bene) },
          { label: 'Total Claims', value: fmtNum(drug.total_claims) }
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
            <div className="label">{label}</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      <button
        className="btn-secondary"
        style={{ marginTop: 12, fontSize: 12, padding: '6px 12px' }}
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? 'Hide details ▲' : 'Why flagged ▼'}
      </button>

      {expanded && (
        <div style={{ marginTop: 12, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Anomaly details:</div>
          <ul style={{ paddingLeft: 20, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <li>Total spend: {fmt(drug.total_spend)} — ranked among top spenders in the dataset</li>
            <li>Avg cost per claim: {fmt(drug.avg_cost_per_claim)} — {drug.avg_cost_per_claim > 10000 ? 'specialty biologic pricing tier' : 'above typical range'}</li>
            <li>Total beneficiaries: {fmtNum(drug.total_benes)} — {drug.total_benes < 500 ? 'very concentrated patient population' : 'moderate population size'}</li>
            <li>Anomaly score {score.toFixed(3)} places this drug in the {score > 0.8 ? 'high-risk' : 'elevated-risk'} tier</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default function AnomalyTracker() {
  const [anomalies, setAnomalies] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [threshold, setThreshold] = useState(0.5)

  useEffect(() => {
    api.get('/api/anomalies')
      .then(r => setAnomalies(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(
    () => anomalies.filter(a => (a.anomaly_score ?? 0) >= threshold),
    [anomalies, threshold]
  )

  if (loading) return <div className="skeleton" style={{ height: 400 }} />
  if (error) return <div className="error-banner">Failed to load anomaly data: {error}</div>

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontWeight: 500 }}>Anomaly score threshold</label>
              <span style={{ fontWeight: 700, color: 'var(--indigo)' }}>{threshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--indigo)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>0.0 — All drugs</span>
              <span>0.5 — Anomalous</span>
              <span>1.0 — Extreme</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: 120 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--danger)' }}>{visible.length}</div>
            <div className="label">drugs flagged</div>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          No drugs above threshold {threshold.toFixed(2)}. Lower the slider to see more results.
        </div>
      ) : (
        visible.map((drug, i) => <DrugCard key={i} drug={drug} />)
      )}
    </div>
  )
}
