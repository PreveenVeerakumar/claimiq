import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import VarianceAnalysis from './components/VarianceAnalysis'
import Forecasting from './components/Forecasting'
import AnomalyTracker from './components/AnomalyTracker'
import AIInsights from './components/AIInsights'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/variance" element={<VarianceAnalysis />} />
        <Route path="/forecast" element={<Forecasting />} />
        <Route path="/anomalies" element={<AnomalyTracker />} />
        <Route path="/ai" element={<AIInsights />} />
      </Routes>
    </Layout>
  )
}
