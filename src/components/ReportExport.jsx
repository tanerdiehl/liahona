import { useState } from 'react'
import { buildReport } from '../lib/report'
import { download } from '../lib/exportData'
import { todayISO } from '../lib/dates'

// Makes the AI-ready progress report, then copy or download it.
// (Creating and copying are separate taps so iPhone allows the copy.)
export default function ReportExport() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    setBusy(true)
    setError('')
    try {
      setText(await buildReport())
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('Copy was blocked — select the text below and copy it manually.')
    }
  }

  return (
    <div className="card report-export">
      <strong>📋 Progress report for AI</strong>
      <span className="muted small">
        A summary of your training, PRs, muscle balance, bodyweight, protein, habits and goals — written to paste into a
        Claude chat for analysis.
      </span>
      {!text ? (
        <button className="btn primary" onClick={create} disabled={busy}>
          {busy ? 'Building report…' : 'Create report'}
        </button>
      ) : (
        <>
          <div className="report-actions">
            <button className="btn primary" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
            <button className="btn ghost" onClick={() => download(`liahona-report-${todayISO()}.md`, text, 'text/markdown')}>
              Download
            </button>
            <button className="btn ghost" onClick={create} disabled={busy}>
              {busy ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <textarea className="report-text" readOnly value={text} rows={10} onFocus={(e) => e.target.select()} />
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
