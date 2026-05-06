import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/variance', label: 'Variance Analysis', icon: '↕' },
  { to: '/forecast', label: 'Forecast', icon: '◈' },
  { to: '/anomalies', label: 'Anomaly Tracker', icon: '⚠' },
  { to: '/ai', label: 'AI Insights', icon: '✦' }
]

export default function Layout({ children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 240,
        minWidth: 240,
        background: 'var(--navy)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 10
      }}>
        <div style={{ padding: '28px 24px 24px' }}>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>
            Claim<span style={{ color: 'var(--indigo)' }}>IQ</span>
          </div>
          <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
            Medicare Intelligence Platform
          </div>
        </div>

        <nav style={{ flex: 1, padding: '0 12px' }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 2,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
                color: isActive ? 'white' : '#94a3b8',
                background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--indigo)' : '3px solid transparent',
                transition: 'all 0.15s'
              })}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          color: '#475569',
          fontSize: 11,
          lineHeight: 1.5
        }}>
          Data: CMS Medicare Part B<br />2024–2025
        </div>
      </aside>

      <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 32px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            Medicare Part B Drug Spend Intelligence
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            CMS Data · 2024 Q1–Q4 &amp; 2025 Q1–Q3
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: 32, background: 'var(--bg-main)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
