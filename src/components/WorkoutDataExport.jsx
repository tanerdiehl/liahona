import { useState } from 'react'
import { addDays, todayISO } from '../lib/dates'
import { download, exportWorkoutsCSV, fetchWorkoutData, workoutDataText } from '../lib/exportData'

const PRESETS = [
  ['Last 4 weeks', 28],
  ['Last 6 weeks', 42],
  ['Last 3 months', 91],
  ['This year', 'year'],
  ['All time', 'all'],
]

// Raw workout data for the dates you pick — every completed set, nothing
// summarised. Show it to copy, or download it as CSV or text.
// (Showing and copying are separate taps so iPhone allows the copy.)
export default function WorkoutDataExport() {
  const today = todayISO()
  const [from, setFrom] = useState(addDays(today, -41))
  const [to, setTo] = useState(today)
  const [result, setResult] = useState(null) // { key, data, text }
  const [busy, setBusy] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const range = { from: from || undefined, to: to || undefined }
  const key = `${from}|${to}`

  function preset(p) {
    setTo(today)
    setFrom(p === 'all' ? '' : p === 'year' ? `${today.slice(0, 4)}-01-01` : addDays(today, -(p - 1)))
  }

  // Fetches once per date range; reused by every button.
  async function getData() {
    if (result?.key === key) return result
    const data = await fetchWorkoutData(range)
    const next = { key, data, text: workoutDataText(data, range) }
    setResult(next)
    return next
  }

  async function act(name, fn) {
    setBusy(name)
    setError('')
    try {
      await fn(await getData())
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('Copy was blocked — select the text below and copy it manually.')
    }
  }

  const shown = result?.key === key ? result : null
  const span = `${from || 'start'}-to-${to || today}`

  return (
    <div className="card report-export">
      <strong>🏋️ Workout data</strong>
      <span className="muted small">Every set you logged between two dates — raw numbers to analyze however you like.</span>
      <div className="preset-chips">
        {PRESETS.map(([label, p]) => (
          <button key={label} type="button" className="cat-chip" onClick={() => preset(p)}>
            {label}
          </button>
        ))}
      </div>
      <div className="date-range">
        <label>
          From
          <input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="report-actions">
        <button className="btn primary" onClick={() => act('show', () => {})} disabled={!!busy}>
          {busy === 'show' ? 'Loading…' : 'Show data'}
        </button>
        <button
          className="btn ghost"
          onClick={() => act('csv', (r) => exportWorkoutsCSV(range, r.data))}
          disabled={!!busy}
        >
          {busy === 'csv' ? 'Preparing…' : 'Download CSV'}
        </button>
        <button
          className="btn ghost"
          onClick={() => act('txt', (r) => download(`liahona-workouts-${span}.txt`, r.text, 'text/plain'))}
          disabled={!!busy}
        >
          {busy === 'txt' ? 'Preparing…' : 'Download text'}
        </button>
      </div>
      {shown && (
        <>
          <div className="report-actions">
            <span className="muted small grow">
              {shown.data.length} workout{shown.data.length === 1 ? '' : 's'} ·{' '}
              {shown.data.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0)} sets
            </span>
            <button className="btn primary small" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <textarea className="report-text" readOnly value={shown.text} rows={14} onFocus={(e) => e.target.select()} />
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
