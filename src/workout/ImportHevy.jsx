import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatLong } from '../lib/dates'
import { planHevyImport, runHevyImport } from './hevyImport'
import { toISO } from '../lib/dates'

export default function ImportHevy() {
  const [plan, setPlan] = useState(null)
  const [status, setStatus] = useState('idle') // idle | reading | ready | importing | done
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function choose(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setResult(null)
    setStatus('reading')
    try {
      setPlan(await planHevyImport(await file.text()))
      setStatus('ready')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  async function run() {
    setStatus('importing')
    setError('')
    try {
      setResult(await runHevyImport(plan))
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('ready')
    }
  }

  return (
    <section className="narrow">
      <div className="page-head">
        <Link to="/workout" className="btn ghost small">
          ‹ Workouts
        </Link>
      </div>
      <h1>Import from Hevy</h1>
      <p className="muted">
        In Hevy: Profile → Settings → Export &amp; Import Data → Export Workouts. Then choose that
        <code> workout_data.csv</code> file here. Workouts you've already imported are skipped automatically.
      </p>

      <label className="file-pick card">
        <input type="file" accept=".csv,text/csv" onChange={choose} disabled={status === 'importing'} />
        <span>{status === 'reading' ? 'Reading…' : 'Choose workout_data.csv'}</span>
      </label>

      {error && <p className="error">{error}</p>}

      {plan && status !== 'done' && (
        <div className="card import-preview">
          {plan.workouts.length === 0 ? (
            <p>Everything in this file is already in Liahona — nothing new to import.</p>
          ) : (
            <>
              <p>
                <strong>{plan.workouts.length} workouts</strong> · {plan.setCount} sets
                {plan.first && (
                  <>
                    {' '}
                    · {formatLong(toISO(plan.first))} – {formatLong(toISO(plan.last))}
                  </>
                )}
              </p>
              <ul className="muted small">
                <li>{plan.mergedCount} exercises match your library and will be merged with it</li>
                {plan.newExercises.length > 0 && (
                  <li>
                    {plan.newExercises.length} will be added as custom exercises:{' '}
                    {plan.newExercises.map((e) => e.name).join(', ')}
                  </li>
                )}
                {plan.skipped > 0 && <li>{plan.skipped} workouts already imported will be skipped</li>}
              </ul>
              <button className="btn primary" onClick={run} disabled={status === 'importing'}>
                {status === 'importing' ? 'Importing…' : `Import ${plan.workouts.length} workouts`}
              </button>
            </>
          )}
        </div>
      )}

      {result && (
        <div className="card import-preview">
          <p className="finish-banner">
            Imported {result.workouts} workouts and {result.sets} sets.
          </p>
          <Link to="/workout" className="btn ghost">
            See your workouts
          </Link>
        </div>
      )}
    </section>
  )
}
