import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { track } from '../lib/saveStatus'
import { addDays, formatLong, formatShort, todayISO } from '../lib/dates'
import { saveProteinTarget, useProteinTarget } from '../lib/proteinTarget'

const PAGE = 30 // days shown per "Show more"

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const round = (n) => Math.round(n * 10) / 10

export default function Protein() {
  const { min: PROTEIN_MIN, max: PROTEIN_MAX } = useProteinTarget()
  const [editingTarget, setEditingTarget] = useState(false)
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [entries, setEntries] = useState(null)
  const [history, setHistory] = useState([])
  const [shown, setShown] = useState(PAGE)
  const [grams, setGrams] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const loadDay = useCallback(async () => {
    const { data, error } = await supabase
      .from('protein_entries')
      .select('id,grams,created_at')
      .eq('date', date)
      .order('created_at')
    if (error) return setError(error.message)
    setEntries(data)
  }, [date])

  const loadHistory = useCallback(async () => {
    // Your whole history, every day you've logged.
    let data
    try {
      data = await fetchAll(() => supabase.from('protein_entries').select('date,grams').lte('date', today).order('id'))
    } catch (e) {
      return setError(e.message)
    }
    const totals = {}
    for (const r of data) totals[r.date] = (totals[r.date] ?? 0) + Number(r.grams)
    setHistory(
      Object.entries(totals)
        .map(([d, total]) => ({ date: d, total: round(total) }))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    )
  }, [today])

  useEffect(() => {
    loadDay()
  }, [loadDay])
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  async function add(e) {
    e.preventDefault()
    const n = Number(grams.replace(',', '.'))
    if (!(n > 0 && n < 1000)) return setError('Enter grams between 1 and 999.')
    setError('')
    const { error } = await track(supabase.from('protein_entries').insert({ date, grams: round(n) }))
    // Only clear the box once it's safely saved, so nothing is lost on failure.
    if (error) setError(`Not saved — ${error.message}`)
    else setGrams('')
    await Promise.all([loadDay(), loadHistory()])
    inputRef.current?.focus()
  }

  async function remove(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    const { error } = await track(supabase.from('protein_entries').delete().eq('id', id))
    if (error) setError(error.message)
    await Promise.all([loadDay(), loadHistory()])
  }

  const total = entries ? round(entries.reduce((s, e) => s + Number(e.grams), 0)) : 0
  const isToday = date === today

  return (
    <section className="narrow">
      <div className="page-head">
        <h1>Protein</h1>
      </div>

      <div className="range-nav">
        <button className="btn ghost small" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <span>{isToday ? 'Today' : formatLong(date)}</span>
        <button
          className="btn ghost small"
          onClick={() => setDate(addDays(date, 1))}
          disabled={isToday}
          aria-label="Next day"
        >
          ›
        </button>
        {!isToday && (
          <button className="btn ghost small" onClick={() => setDate(today)}>
            Today
          </button>
        )}
      </div>

      <div className="card protein-card">
        <div className="protein-total">
          <span className="big">{total}</span>
          <span className="muted">
            g · target {PROTEIN_MIN}–{PROTEIN_MAX}g{' '}
            <button className="link-btn" onClick={() => setEditingTarget(!editingTarget)}>
              {editingTarget ? 'Cancel' : 'Edit'}
            </button>
          </span>
        </div>
        {editingTarget && (
          <TargetEditor min={PROTEIN_MIN} max={PROTEIN_MAX} onDone={() => setEditingTarget(false)} onError={setError} />
        )}
        <ProteinBar total={total} min={PROTEIN_MIN} max={PROTEIN_MAX} />
        <p className="muted small">{statusText(total, PROTEIN_MIN, PROTEIN_MAX)}</p>

        <form className="quick-add" onSubmit={add}>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            placeholder="Grams"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            aria-label="Grams of protein"
          />
          <button className="btn primary">Add</button>
        </form>
        {error && <p className="error">{error}</p>}

        {entries && entries.length > 0 && (
          <ul className="entry-list">
            {entries.map((e) => (
              <li key={e.id}>
                <span>{round(Number(e.grams))} g</span>
                <span className="muted small">{timeFmt.format(new Date(e.created_at))}</span>
                <button className="icon-btn" onClick={() => remove(e.id)} aria-label="Delete entry">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="section-title">History</h2>
      {history.length === 0 ? (
        <p className="muted">Nothing logged yet.</p>
      ) : (
        <ul className="history-list">
          {history.slice(0, shown).map((h) => {
            const hit = h.total >= PROTEIN_MIN
            return (
              <li key={h.date}>
                <button className={h.date === date ? 'active' : ''} onClick={() => setDate(h.date)}>
                  <span className="h-date">{h.date === today ? 'Today' : formatShort(h.date)}</span>
                  <span className="h-bar">
                    <span
                      className={hit ? 'hit' : ''}
                      style={{ width: `${Math.min(100, (h.total / PROTEIN_MAX) * 100)}%` }}
                    />
                  </span>
                  <span className="h-total">
                    {h.total} g {hit && <span className="hit-mark">✓</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {history.length > shown && (
        <button className="btn ghost show-older" onClick={() => setShown(shown + PAGE)}>
          Show more
        </button>
      )}
    </section>
  )
}

function statusText(total, PROTEIN_MIN, PROTEIN_MAX) {
  if (total === 0) return 'Nothing logged yet.'
  if (total < PROTEIN_MIN) return `${round(PROTEIN_MIN - total)} g to reach your target.`
  if (total <= PROTEIN_MAX) return 'In your target range.'
  return `${round(total - PROTEIN_MAX)} g above the top of your range.`
}

// Bar scaled to 200g with the target band shaded.
function ProteinBar({ total, min: PROTEIN_MIN, max: PROTEIN_MAX }) {
  const scale = Math.max(200, total)
  const pct = (n) => `${(n / scale) * 100}%`
  const inRange = total >= PROTEIN_MIN
  return (
    <div className="protein-bar" role="img" aria-label={`${total} of ${PROTEIN_MIN} to ${PROTEIN_MAX} grams`}>
      <span className="band" style={{ left: pct(PROTEIN_MIN), width: pct(PROTEIN_MAX - PROTEIN_MIN) }} />
      <span className={`fill ${inRange ? 'hit' : ''}`} style={{ width: pct(total) }} />
    </div>
  )
}

// Change your daily target range. Applies everywhere (charts, dashboard,
// weekly review), including how past days are counted as "hit".
function TargetEditor({ min, max, onDone, onError }) {
  const [lo, setLo] = useState(String(min))
  const [hi, setHi] = useState(String(max))
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    const a = parseInt(lo, 10)
    const b = parseInt(hi, 10)
    if (!(a > 0 && b >= a && b < 1000)) return onError('Enter a low and high target, e.g. 140 and 180.')
    setBusy(true)
    try {
      await saveProteinTarget(a, b)
      onError('')
      onDone()
    } catch (err) {
      onError(`Not saved — ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="target-editor" onSubmit={save}>
      <label>
        At least
        <input inputMode="numeric" value={lo} onChange={(e) => setLo(e.target.value)} autoFocus />
      </label>
      <span className="times">–</span>
      <label>
        Up to
        <input inputMode="numeric" value={hi} onChange={(e) => setHi(e.target.value)} />
      </label>
      <span className="muted small">g / day</span>
      <button className="btn primary small" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
