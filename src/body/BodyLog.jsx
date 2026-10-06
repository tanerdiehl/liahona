import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { track } from '../lib/saveStatus'
import { addDays, formatLong, formatShort, todayISO } from '../lib/dates'
import { loadSettings } from '../workout/lib'
import { LineChart } from '../workout/WorkoutCharts'
import { bucketed, fetchBodyLogs, MEASUREMENTS, round1, series, toMeasure } from './body'
import { convertWeight } from '../workout/lib'

const G = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
]
const COLOR = '#3B4A6B'
const MEASURE_UNIT_KEY = 'liahona.body.measureUnit'

function readMeasureUnit() {
  try {
    return localStorage.getItem(MEASURE_UNIT_KEY) === 'cm' ? 'cm' : 'in'
  } catch {
    return 'in'
  }
}

// /body — bodyweight and measurements over time.
export default function BodyLog() {
  const [logs, setLogs] = useState(null)
  const [unit, setUnit] = useState('lbs')
  const [mUnit, setMUnit] = useState(readMeasureUnit)
  const [g, setG] = useState('day')
  const [field, setField] = useState('waist')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      const [settings, rows] = await Promise.all([loadSettings(), fetchBodyLogs()])
      setUnit(settings.weight_unit)
      setLogs(rows)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function chooseMUnit(u) {
    setMUnit(u)
    try {
      localStorage.setItem(MEASURE_UNIT_KEY, u)
    } catch {
      /* per-device preference */
    }
  }

  const today = todayISO()
  const weights = useMemo(() => (logs ? series(logs, 'bodyweight', unit) : []), [logs, unit])
  const measured = useMemo(
    () => (logs ? MEASUREMENTS.filter(([k]) => logs.some((l) => l[k] != null)) : []),
    [logs],
  )
  const activeField = measured.some(([k]) => k === field) ? field : measured[0]?.[0]

  if (!logs) return <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>

  const latest = weights.at(-1)
  const nearest = (daysAgo) => {
    const target = addDays(today, -daysAgo)
    return [...weights].reverse().find((w) => w.date <= target)
  }
  const change = (from) => (latest && from ? round1(latest.value - from.value) : null)
  const signed = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v} ${unit}`)

  return (
    <section className="narrow body-log">
      <div className="page-head">
        <h1>Body</h1>
        <div className="segmented small-seg">
          {['in', 'cm'].map((u) => (
            <button key={u} className={mUnit === u ? 'on' : ''} onClick={() => chooseMUnit(u)}>
              {u}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <EntryForm
        key={editing?.id ?? 'new'}
        entry={editing}
        unit={unit}
        mUnit={mUnit}
        onSaved={() => {
          setEditing(null)
          load()
        }}
        onCancel={editing ? () => setEditing(null) : null}
        onError={setError}
      />

      {weights.length > 0 && (
        <>
          <div className="card stat-card">
            <div className="stat-row">
              <div className="stat">
                <span className="stat-value">
                  {round1(latest.value)} {unit}
                </span>
                <span className="stat-label">Latest · {formatShort(latest.date)}</span>
              </div>
              <div className="stat">
                <span className="stat-value">{signed(change(nearest(7)))}</span>
                <span className="stat-label">7 days</span>
              </div>
              <div className="stat">
                <span className="stat-value">{signed(change(nearest(30)))}</span>
                <span className="stat-label">30 days</span>
              </div>
              <div className="stat">
                <span className="stat-value">{signed(change(weights[0]))}</span>
                <span className="stat-label">Since {formatShort(weights[0].date)}</span>
              </div>
            </div>
          </div>

          <article className="card body-chart">
            <div className="wa-title-row">
              <h2 className="wa-title">Bodyweight ({unit})</h2>
              <div className="segmented small-seg">
                {G.map(([k, l]) => (
                  <button key={k} className={g === k ? 'on' : ''} onClick={() => setG(k)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <LineChart
              color={COLOR}
              format={(v) => `${Math.round(v)}`}
              data={bucketed(weights, g, undefined, today).map((b) => ({
                ...b,
                tip: `${b.label}: ${round1(b.value)} ${unit}${b.n > 1 ? ` (avg of ${b.n})` : ''}`,
              }))}
            />
          </article>
        </>
      )}

      {measured.length > 0 && (
        <article className="card body-chart">
          <div className="wa-title-row">
            <h2 className="wa-title">Measurements ({mUnit})</h2>
            <select className="target-select" value={activeField} onChange={(e) => setField(e.target.value)}>
              {measured.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <LineChart
            color="#BA7517"
            format={(v) => `${round1(v)}`}
            data={bucketed(series(logs, activeField, mUnit), g, undefined, today).map((b) => ({
              ...b,
              tip: `${b.label}: ${round1(b.value)} ${mUnit}`,
            }))}
          />
        </article>
      )}

      <h2 className="section-title">History</h2>
      {logs.length === 0 ? (
        <p className="empty-quip">Log your weight above to start your trend line.</p>
      ) : (
        <ul className="card body-history">
          {[...logs].reverse().map((l) => (
            <li key={l.id}>
              <button
                className="body-row"
                onClick={() => {
                  setEditing(l)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                <span className="muted small body-date">{formatShort(l.log_date)}</span>
                <span className="grow">
                  {l.bodyweight != null && (
                    <strong>
                      {round1(convertWeight(Number(l.bodyweight), l.weight_unit, unit))} {unit}
                    </strong>
                  )}
                  <span className="muted small">
                    {' '}
                    {MEASUREMENTS.filter(([k]) => l[k] != null)
                      .map(([k, label]) => `${label} ${round1(toMeasure(Number(l[k]), l.measure_unit, mUnit))}`)
                      .join(' · ')}
                  </span>
                  {l.notes && <span className="muted small body-note">{l.notes}</span>}
                </span>
                <span className="muted small">Edit</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// New entry, or editing an existing one. Values are saved in the units shown.
function EntryForm({ entry, unit, mUnit, onSaved, onCancel, onError }) {
  const today = todayISO()
  const init = (k) => {
    if (!entry || entry[k] == null) return ''
    const v = Number(entry[k])
    return String(round1(k === 'bodyweight' ? convertWeight(v, entry.weight_unit, unit) : toMeasure(v, entry.measure_unit, mUnit)))
  }
  const [date, setDate] = useState(entry?.log_date ?? today)
  const [values, setValues] = useState(() =>
    Object.fromEntries(['bodyweight', ...MEASUREMENTS.map(([k]) => k)].map((k) => [k, init(k)])),
  )
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [showMore, setShowMore] = useState(Boolean(entry && MEASUREMENTS.some(([k]) => entry[k] != null)))
  const [busy, setBusy] = useState(false)

  const num = (v) => {
    const n = Number(String(v).replace(',', '.'))
    return v === '' || !(n > 0) ? null : n
  }

  async function save(e) {
    e.preventDefault()
    const row = {
      log_date: date,
      bodyweight: num(values.bodyweight),
      weight_unit: unit,
      measure_unit: mUnit,
      notes: notes.trim(),
      ...Object.fromEntries(MEASUREMENTS.map(([k]) => [k, num(values[k])])),
    }
    if (row.bodyweight == null && !MEASUREMENTS.some(([k]) => row[k] != null))
      return onError('Enter your weight or at least one measurement.')
    setBusy(true)
    const { error } = await track(
      entry ? supabase.from('body_logs').update(row).eq('id', entry.id) : supabase.from('body_logs').insert(row),
    )
    setBusy(false)
    if (error) return onError(`Not saved — ${error.message}`)
    onError('')
    onSaved()
  }

  async function remove() {
    if (!window.confirm('Delete this entry permanently?')) return
    const { error } = await track(supabase.from('body_logs').delete().eq('id', entry.id))
    if (error) return onError(error.message)
    onSaved()
  }

  const set = (k) => (e) => setValues({ ...values, [k]: e.target.value })

  return (
    <form className="card body-form" onSubmit={save}>
      {entry && <p className="muted small">Editing {formatLong(entry.log_date)}</p>}
      <div className="body-main">
        <label>
          Date
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
        </label>
        <label>
          Weight ({unit})
          <input inputMode="decimal" placeholder="0.0" value={values.bodyweight} onChange={set('bodyweight')} />
        </label>
      </div>
      {showMore ? (
        <div className="body-measures">
          {MEASUREMENTS.map(([k, label]) => (
            <label key={k}>
              {label} ({mUnit})
              <input inputMode="decimal" value={values[k]} onChange={set(k)} />
            </label>
          ))}
        </div>
      ) : (
        <button type="button" className="link-btn" onClick={() => setShowMore(true)}>
          + Measurements
        </button>
      )}
      <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="form-actions">
        {entry && (
          <button type="button" className="btn ghost small danger" onClick={remove}>
            Delete
          </button>
        )}
        <span className="grow" />
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : entry ? 'Save changes' : 'Log'}
        </button>
      </div>
    </form>
  )
}
