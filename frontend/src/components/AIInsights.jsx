import { useState, useRef, useEffect } from 'react'
import api from '../api/client'

const SUGGESTED = [
  'Which drug had the biggest cost increase in 2025?',
  'What are the top anomalies by spend?',
  'Which drugs represent the highest financial risk?',
  'What does the 2025 forecast tell us?',
  'Which specialty biologics have the highest cost per claim?',
  'What is the total estimated rebate opportunity?'
]

function BriefContent({ text }) {
  const sections = text.split(/^##\s+/m).filter(Boolean)
  return (
    <div>
      {sections.map((section, i) => {
        const [heading, ...body] = section.split('\n')
        return (
          <div key={i} style={{ marginBottom: 18 }}>
            <div style={{
              fontWeight: 700, fontSize: 13, color: 'var(--indigo)',
              marginBottom: 6, paddingBottom: 4,
              borderBottom: '1px solid var(--indigo-light)'
            }}>
              {heading.trim()}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {body.join('\n').trim()}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const isBrief = msg.isBrief

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <div style={{
          maxWidth: '70%', padding: '10px 16px',
          borderRadius: '16px 16px 4px 16px',
          background: 'var(--indigo)', color: 'white',
          fontSize: 14, lineHeight: 1.6
        }}>
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 10, maxWidth: '85%' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: 'var(--indigo-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: 'var(--indigo)', fontWeight: 700, marginTop: 2
        }}>
          AI
        </div>
        <div style={{
          background: 'white', padding: isBrief ? '20px 24px' : '12px 16px',
          borderRadius: '4px 16px 16px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          border: isBrief ? '1px solid var(--indigo-light)' : '1px solid #f1f5f9',
          flex: 1
        }}>
          {isBrief ? (
            <>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f1f5f9'
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--indigo)' }}>
                  Executive Brief
                </span>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => window.print()}
                >
                  Download PDF
                </button>
              </div>
              <BriefContent text={msg.content} />
            </>
          ) : (
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingBubble() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: 'var(--indigo-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: 'var(--indigo)', fontWeight: 700
        }}>AI</div>
        <div style={{
          background: 'white', padding: '12px 16px',
          borderRadius: '4px 16px 16px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          border: '1px solid #f1f5f9'
        }}>
          <div className="dot-pulse"><span /><span /><span /></div>
        </div>
      </div>
    </div>
  )
}

export default function AIInsights() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [briefLoading, setBriefLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, briefLoading])

  async function sendQuestion(question) {
    const q = question.trim()
    if (!q || loading || briefLoading) return
    setMessages(m => [...m, { role: 'user', content: q }])
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const r = await api.post('/api/ask', { question: q })
      setMessages(m => [...m, { role: 'assistant', content: r.data.answer }])
    } catch (e) {
      setError('Failed to get answer. Check backend connection.')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function generateBrief() {
    if (briefLoading || loading) return
    setMessages(m => [...m, { role: 'user', content: 'Generate executive brief for the current dataset.' }])
    setBriefLoading(true)
    setError(null)
    try {
      const r = await api.post('/api/brief')
      setMessages(m => [...m, { role: 'assistant', content: r.data.brief, isBrief: true }])
    } catch (e) {
      setError('Failed to generate brief. Check backend connection.')
    } finally {
      setBriefLoading(false)
    }
  }

  const isIdle = !loading && !briefLoading

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 124px)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, flexShrink: 0
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>AI Drug Spend Analyst</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Powered by LLaMA 3.3 70B · Reads full dataset + model outputs
          </div>
        </div>
        <button
          className="btn-secondary"
          style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={generateBrief}
          disabled={!isIdle}
        >
          <span>📋</span>
          {briefLoading ? 'Generating…' : 'Generate Executive Brief'}
        </button>
      </div>

      {/* Chat window */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, background: 'var(--indigo-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 22, color: 'var(--indigo)'
              }}>AI</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                Ask anything about Medicare Part B drug spend
              </div>
              <div style={{ fontSize: 13, maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
                I have access to the full CMS dataset, anomaly detection results, Prophet forecasts,
                and variance analysis. Ask specific questions about costs, risks, or trends.
              </div>
            </div>
          )}

          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
          {(loading || briefLoading) && <LoadingBubble />}
          {error && <div className="error-banner" style={{ margin: '8px 0' }}>{error}</div>}
          <div ref={bottomRef} />
        </div>

        {/* Suggested questions */}
        <div style={{ padding: '12px 24px 0', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUGGESTED.map(q => (
              <button
                key={q}
                className="btn-secondary"
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}
                onClick={() => sendQuestion(q)}
                disabled={!isIdle}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div style={{ padding: '12px 24px 16px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask a question about drug spend, anomalies, forecasts, or costs…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendQuestion(input)}
              style={{ flex: 1 }}
              disabled={!isIdle}
            />
            <button
              className="btn-primary"
              onClick={() => sendQuestion(input)}
              disabled={!isIdle || !input.trim()}
              style={{ padding: '10px 20px' }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
