import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/habits'
import { track } from '../lib/saveStatus'
import { formatLong, todayISO } from '../lib/dates'

const DRAFT_KEY = 'liahona.journal.draft'

// Unsaved text is kept on this device so closing the app never loses it.
function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) ?? {}
  } catch {
    return {}
  }
}
function writeDraft(d) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* storage unavailable — draft just isn't kept */
  }
}

export default function Journal() {
  const today = todayISO()
  const [entries, setEntries] = useState(null)
  const [date, setDate] = useState(() => readDraft().date ?? today)
  const [body, setBody] = useState(() => readDraft().body ?? '')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setEntries(
        await fetchAll(() =>
          supabase
            .from('journal_entries')
            .select('*')
            .order('entry_date', { ascending: false })
            .order('created_at', { ascending: false }),
        ),
      )
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    writeDraft(body.trim() ? { date, body } : null)
  }, [date, body])

  async function save(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    const { error } = await track(supabase.from('journal_entries').insert({ entry_date: date, body }))
    setSaving(false)
    if (error) return setError(`Not saved — ${error.message}. Your text is still here.`)
    setError('')
    setBody('')
    setDate(today)
    load()
  }

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    return entries.filter(
      (e) =>
        (!q || e.body.toLowerCase().includes(q)) && (!from || e.entry_date >= from) && (!to || e.entry_date <= to),
    )
  }, [entries, query, from, to])

  const filtering = query || from || to

  return (
    <section className="narrow">
      <div className="page-head">
        <h1>Journal</h1>
      </div>

      <form className="card journal-new" onSubmit={save}>
        <input
          type="date"
          className="date-input"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
          aria-label="Entry date"
        />
        <textarea
          rows={6}
          placeholder="What's on your mind?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Journal entry"
        />
        <div className="form-actions">
          {body.trim() && <span className="muted small grow">Draft kept on this device until saved</span>}
          <button className="btn primary" disabled={saving || !body.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>

      <div className="journal-filters">
        <input
          type="search"
          placeholder="Search entries…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search journal"
        />
        <div className="date-filter">
          <label>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {filtering && (
            <button
              className="btn ghost small"
              onClick={() => {
                setQuery('')
                setFrom('')
                setTo('')
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {entries === null ? (
        <p className="muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="muted">{filtering ? 'No entries match.' : 'A blank page. Tell it about today.'}</p>
      ) : (
        <>
          {filtering && (
            <p className="muted small">
              {filtered.length} of {entries.length} entries
            </p>
          )}
          <ul className="journal-list">
            {filtered.map((e) => (
              <JournalEntry key={e.id} entry={e} onChanged={load} query={query.trim()} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function JournalEntry({ entry, onChanged, query }) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(entry.body)
  const [date, setDate] = useState(entry.entry_date)
  const [error, setError] = useState('')

  async function save() {
    if (!body.trim()) return
    const { error } = await track(
      supabase
        .from('journal_entries')
        .update({ body, entry_date: date, updated_at: new Date().toISOString() })
        .eq('id', entry.id),
    )
    if (error) return setError(`Not saved — ${error.message}`)
    setEditing(false)
    onChanged()
  }

  async function remove() {
    if (!window.confirm('Delete this journal entry permanently?')) return
    const { error } = await track(supabase.from('journal_entries').delete().eq('id', entry.id))
    if (error) return setError(error.message)
    onChanged()
  }

  if (editing)
    return (
      <li className="card journal-entry">
        <input type="date" className="date-input" value={date} onChange={(e) => setDate(e.target.value)} />
        <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="btn ghost small danger" onClick={remove}>
            Delete
          </button>
          <span className="grow" />
          <button
            className="btn ghost small"
            onClick={() => {
              setBody(entry.body)
              setDate(entry.entry_date)
              setEditing(false)
            }}
          >
            Cancel
          </button>
          <button className="btn primary small" onClick={save}>
            Save
          </button>
        </div>
      </li>
    )

  return (
    <li className="card journal-entry">
      <div className="journal-head">
        <h3>{formatLong(entry.entry_date)}</h3>
        <button className="link-btn" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
      <p className="journal-body">{highlight(entry.body, query)}</p>
    </li>
  )
}

function highlight(text, q) {
  if (!q) return text
  const out = []
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  let i = 0
  for (let j = lower.indexOf(needle); j !== -1; j = lower.indexOf(needle, i)) {
    out.push(text.slice(i, j), <mark key={j}>{text.slice(j, j + q.length)}</mark>)
    i = j + q.length
  }
  out.push(text.slice(i))
  return out
}
