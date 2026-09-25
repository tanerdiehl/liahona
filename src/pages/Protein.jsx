import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { track } from '../lib/saveStatus'
import { addDays, formatLong, formatShort, todayISO } from '../lib/dates'

export const PROTEIN_MIN = 119
export const PROTEIN_MAX = 167
const HISTORY_DAYS = 30

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const round = (n) => Math.round(n * 10) / 10

export default function Protein() {
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [entries, setEntries] = useState(null)
  const [history, setHistory] = useState([])
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
    const { data, error } = await supabase
      .from('protein_entries')
      .select('date,grams')
      .gte('date', addDays(today, -(HISTORY_DAYS - 1)))
      .lte('date', today)
    if (error) return setError(error.message)
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
            g · target {PROTEIN_MIN}–{PROTEIN_MAX}g
          </span>
        </div>
        <ProteinBar total={total} />
        <p className="muted small">{statusText(total)}</p>

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

      <h2 className="section-title">Last {HISTORY_DAYS} days</h2>
      {history.length === 0 ? (
        <p className="muted">Nothing logged yet.</p>
      ) : (
        <ul className="history-list">
          {history.map((h) => {
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
    </section>
  )
}

function statusText(total) {
  if (total === 0) return 'Nothing logged yet.'
  if (total < PROTEIN_MIN) return `${round(PROTEIN_MIN - total)} g to reach your target.`
  if (total <= PROTEIN_MAX) return 'In your target range.'
  return `${round(total - PROTEIN_MAX)} g above the top of your range.`
}

// Bar scaled to 200g with the target band shaded.
function ProteinBar({ total }) {
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
