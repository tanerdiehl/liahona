import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { track } from '../lib/saveStatus'
import { downloadBackup } from '../lib/backup'
import { BODY_COLUMNS, exportBodyCSV, exportHabitsCSV, exportSimpleCSV, exportWorkoutsCSV } from '../lib/exportData'
import { parseCSV } from '../workout/hevyImport'

// /data — your data, yours to take anywhere.
export default function DataPage() {
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function run(key, fn) {
    setBusy(key)
    setError('')
    setMsg('')
    try {
      const n = await fn()
      if (typeof n === 'number') setMsg(`Downloaded ${n.toLocaleString()} rows.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const item = (key, label, hint, fn) => (
    <li key={key}>
      <button onClick={() => run(key, fn)} disabled={!!busy}>
        <span className="grow">
          <strong>{label}</strong>
          <span className="muted small">{hint}</span>
        </span>
        <span className="muted small">{busy === key ? 'Preparing…' : 'Download'}</span>
      </button>
    </li>
  )

  return (
    <section className="narrow data-page">
      <h1>Your data</h1>
      <p className="muted">
        Everything you log is stored as raw records and never summarised away. Download it any time — CSV files open in
        Excel, Numbers or Google Sheets.
      </p>
      {msg && <p className="finish-banner">{msg}</p>}
      {error && <p className="error">{error}</p>}

      <h2 className="section-title">Export</h2>
      <ul className="card data-list">
        {item('workouts', 'Workouts (CSV)', 'Every set: date, exercise, weight, reps, time, distance. Hevy-compatible.', exportWorkoutsCSV)}
        {item('body', 'Body log (CSV)', 'Bodyweight and measurements.', exportBodyCSV)}
        {item('habits', 'Habits (CSV)', 'Every daily and weekly check-in.', exportHabitsCSV)}
        {item('protein', 'Protein (CSV)', 'Every protein entry.', () =>
          exportSimpleCSV('protein_entries', ['date', 'grams', 'created_at'], 'date'),
        )}
        {item('tasks', 'To-do (CSV)', 'Open and completed tasks.', () =>
          exportSimpleCSV('tasks', ['title', 'list', 'created_at', 'completed_at'], 'created_at'),
        )}
        {item('journal', 'Journal (CSV)', 'All entries.', () =>
          exportSimpleCSV('journal_entries', ['entry_date', 'body', 'created_at', 'updated_at'], 'entry_date'),
        )}
        {item('all', 'Everything (JSON)', 'One file with every table — a complete backup.', downloadBackup)}
      </ul>
      <p className="muted small">Progress photos stay in your private photo storage; download any photo from its page.</p>

      <h2 className="section-title">Import</h2>
      <ul className="card data-list">
        <li>
          <Link to="/workout/import">
            <span className="grow">
              <strong>Workouts (CSV)</strong>
              <span className="muted small">
                A Hevy export, or a workouts file downloaded from here. Workouts already in Liahona are skipped.
              </span>
            </span>
            <span aria-hidden>›</span>
          </Link>
        </li>
      </ul>
      <BodyImport onDone={(n) => setMsg(`Imported ${n} body log entries.`)} onError={setError} />
    </section>
  )
}

// Body log CSV with the same columns as the export. Rows identical to an
// existing entry are skipped, so re-importing a file is safe.
function BodyImport({ onDone, onError }) {
  const [busy, setBusy] = useState(false)

  async function choose(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const rows = parseCSV(await file.text())
      if (!rows.length || !('log_date' in rows[0])) throw new Error('This file needs a log_date column (use a body log export).')
      const existing = await fetchAll(() => supabase.from('body_logs').select('*').order('id'))
      const keyOf = (r) => BODY_COLUMNS.map((c) => (r[c] == null || r[c] === '' ? '' : String(Number(r[c]) || r[c]))).join('|')
      const seen = new Set(existing.map(keyOf))
      const fresh = rows
        .map((r) => {
          const out = {}
          for (const c of BODY_COLUMNS) {
            const v = r[c]
            if (v === undefined || v === '') continue
            out[c] = ['log_date', 'weight_unit', 'measure_unit', 'notes'].includes(c) ? v : Number(v)
          }
          out.weight_unit ??= 'lbs'
          out.measure_unit ??= 'in'
          return out
        })
        .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.log_date ?? '') && !seen.has(keyOf(r)))
      if (fresh.length) {
        const { error } = await track(supabase.from('body_logs').insert(fresh))
        if (error) throw new Error(error.message)
      }
      onDone(fresh.length)
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className="card file-pick">
      <input type="file" accept=".csv,text/csv" onChange={choose} disabled={busy} />
      <span>{busy ? 'Importing…' : 'Import body log (CSV)'}</span>
    </label>
  )
}
