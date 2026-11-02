import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDays, formatLong, formatShort, fromISO, startOfWeek, todayISO, weekdayShort } from '../lib/dates'
import { burst } from '../lib/celebrate'
import { useTasks } from '../lib/useTasks'
import {
  ALL_DAYS,
  CATEGORIES,
  DAY_LETTERS,
  describeRepeat,
  formatTime,
  fromMin,
  layoutEvents,
  nowMin,
  repeatKind,
  toMin,
  usePlan,
  WEEKDAYS,
} from './planLib'

const HOUR_PX = 56
const DAY_START = 6 * 60
const DAY_END = 23 * 60
const uuid = () => crypto.randomUUID()

// /plan — plan your day hour by hour, Preach My Gospel style.
export default function DayPlanner() {
  const navigate = useNavigate()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const weekStart = startOfWeek(date)
  const plan = usePlan(date, weekStart)
  const tasks = useTasks('todo')
  const [editing, setEditing] = useState(null) // event being added/edited
  const [now, setNow] = useState(nowMin())

  useEffect(() => {
    const t = setInterval(() => setNow(nowMin()), 60000)
    return () => clearInterval(t)
  }, [])

  const events = plan.events ?? []
  const first = Math.min(DAY_START, ...events.map((e) => Math.floor(toMin(e.start_time) / 60) * 60))
  const last = Math.max(DAY_END, ...events.map((e) => Math.ceil(toMin(e.end_time) / 60) * 60))
  const hours = []
  for (let m = first; m < last; m += 60) hours.push(m)
  const y = (min) => ((min - first) / 60) * HOUR_PX

  // Next open hour from now (or from the start of the day, for other days).
  function nextFree(len = 60) {
    let start = date === today ? Math.ceil(now / 30) * 30 : 8 * 60
    for (let guard = 0; guard < 48; guard++) {
      const clash = events.find((e) => toMin(e.start_time) < start + len && toMin(e.end_time) > start)
      if (!clash) break
      start = toMin(clash.end_time)
    }
    return start
  }

  function newEvent(startMin, extra = {}) {
    setEditing({
      id: uuid(),
      date,
      start_time: fromMin(startMin),
      end_time: fromMin(startMin + 60),
      title: '',
      category: 'other',
      location: '',
      notes: '',
      backup: '',
      status: 'planned',
      task_id: null,
      isNew: true,
      ...extra,
    })
  }

  function tapTimeline(e) {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const min = first + Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30
    newEvent(min)
  }

  function setStatus(ev, status, el) {
    plan.save({ ...ev, status })
    if (status === 'done') {
      burst(el, CATEGORIES[ev.category]?.color)
      const task = ev.task_id && tasks.open.find((t) => t.id === ev.task_id)
      if (task) tasks.complete(task)
    }
  }

  // ---------- drag ⠿ to move a block, or its bottom edge to change length ----------
  const [drag, setDrag] = useState(null) // { id, mode: 'move' | 'resize', y0, dy }
  const snap = (dy) => Math.round(((dy / HOUR_PX) * 60) / 15) * 15
  function moved(ev, mode, delta) {
    const s = toMin(ev.start_time)
    const en = toMin(ev.end_time)
    if (mode === 'resize') return { ...ev, end_time: fromMin(Math.max(s + 15, Math.min(24 * 60 - 1, en + delta))) }
    const ns = Math.max(0, Math.min(24 * 60 - 1 - (en - s), s + delta))
    return { ...ev, start_time: fromMin(ns), end_time: fromMin(ns + en - s) }
  }
  // The ref holds the live drag so a quick release never reads a stale position.
  const dragRef = useRef(null)
  const dragHandlers = (ev, mode) => ({
    onPointerDown: (p) => {
      p.stopPropagation()
      p.preventDefault()
      try {
        p.currentTarget.setPointerCapture(p.pointerId)
      } catch {
        /* not supported — moves still arrive while over the handle */
      }
      dragRef.current = { id: ev.id, mode, y0: p.clientY, dy: 0 }
      setDrag(dragRef.current)
    },
    onPointerMove: (p) => {
      const d = dragRef.current
      if (!d || d.id !== ev.id) return
      dragRef.current = { ...d, dy: p.clientY - d.y0 }
      setDrag(dragRef.current)
    },
    onPointerUp: (p) => {
      const d = dragRef.current
      if (!d || d.id !== ev.id) return
      dragRef.current = null
      setDrag(null)
      const delta = snap(p.clientY - d.y0)
      // A repeating plan moves just for this day.
      if (delta) plan.save(moved(ev, d.mode, delta))
    },
    onPointerCancel: () => {
      dragRef.current = null
      setDrag(null)
    },
    onClick: (c) => c.stopPropagation(),
  })

  const scheduled = new Set(events.map((e) => e.task_id).filter(Boolean))
  const unscheduled = tasks.open.filter((t) => t.title.trim() && !scheduled.has(t.id))
  const done = events.filter((e) => e.status === 'done').length
  const missed = events.filter((e) => e.status === 'missed').length
  const evening = date === today && now >= 18 * 60

  return (
    <section className="narrow planner">
      <div className="page-head">
        <h1>Plan</h1>
        <PlanTabs active="day" />
      </div>

      <div className="week-strip card">
        <div className="week-strip-head">
          <button className="icon-btn" onClick={() => setDate(addDays(date, -7))} aria-label="Previous week">
            ‹
          </button>
          <span className="muted small">
            {formatShort(weekStart)} – {formatShort(addDays(weekStart, 6))}
          </span>
          <button className="icon-btn" onClick={() => setDate(addDays(date, 7))} aria-label="Next week">
            ›
          </button>
          {date !== today && (
            <button className="link-btn" onClick={() => setDate(today)}>
              Today
            </button>
          )}
        </div>
        <div className="week-days">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => (
            <button
              key={d}
              className={`week-day ${d === date ? 'on' : ''} ${d === today ? 'is-today' : ''}`}
              onClick={() => setDate(d)}
            >
              <span className="small">{weekdayShort(d).slice(0, 2)}</span>
              <strong>{fromISO(d).getDate()}</strong>
              <span className={`dot ${plan.weekCounts[d] ? 'on' : ''}`} aria-hidden />
            </button>
          ))}
        </div>
      </div>

      <h2 className="planner-date">{date === today ? 'Today' : formatLong(date)}</h2>

      {evening && (
        <button className="card plan-tomorrow" onClick={() => setDate(addDays(today, 1))}>
          🌙 <strong>Plan tomorrow</strong>
          <span className="muted small">Set tomorrow's plan before bed — it makes the morning easy.</span>
        </button>
      )}

      <DayNotes
        key={`p-${date}`}
        label="Priorities"
        placeholder="The 1–3 things that matter most today"
        value={plan.day.priorities}
        onSave={(priorities) => plan.saveDay({ priorities })}
      />

      {plan.error && <p className="error">{plan.error}</p>}

      {!plan.events ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="timeline card">
          <div className="timeline-hours">
            {hours.map((m) => (
              <div key={m} className="timeline-hour" style={{ height: HOUR_PX }}>
                <span>{formatTime(fromMin(m))}</span>
              </div>
            ))}
          </div>
          <div className="timeline-grid" style={{ height: hours.length * HOUR_PX }} onClick={tapTimeline}>
            {hours.map((m) => (
              <div key={m} className="timeline-line" style={{ top: y(m) }} />
            ))}
            {date === today && now >= first && now <= last && <div className="now-line" style={{ top: y(now) }} />}
            {layoutEvents(events).map(({ e: orig, col, cols }) => {
              const dragging = drag?.id === orig.id
              const e = dragging ? moved(orig, drag.mode, snap(drag.dy)) : orig
              const cat = CATEGORIES[e.category] ?? CATEGORIES.other
              const top = y(toMin(e.start_time))
              const height = Math.max(26, y(toMin(e.end_time)) - top - 2)
              return (
                <div
                  key={e.id}
                  className={`plan-block s-${e.status} ${height < 44 ? 'short' : ''} ${dragging ? 'dragging' : ''}`}
                  style={{
                    top,
                    height,
                    left: `calc(${(col / cols) * 100}% + 2px)`,
                    width: `calc(${100 / cols}% - 4px)`,
                    '--cat': cat.color,
                  }}
                  onClick={() => setEditing(orig)}
                >
                  <button
                    className="plan-check"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      setStatus(orig, orig.status === 'done' ? 'planned' : 'done', ev.currentTarget)
                    }}
                    aria-label={e.status === 'done' ? 'Mark not done' : 'Mark done'}
                  >
                    {e.status === 'done' ? '✓' : e.status === 'missed' ? '✕' : ''}
                  </button>
                  <span className="plan-block-text">
                    <strong>
                      {e.series_id && <span className="repeat-icon" aria-label="Repeats">↻ </span>}
                      {e.title || 'Untitled'}
                    </strong>
                    <span className="small">
                      {formatTime(e.start_time)}–{formatTime(e.end_time)}
                      {e.location ? ` · ${e.location}` : ''}
                    </span>
                  </span>
                  <span className="plan-grip" aria-label="Drag to move" {...dragHandlers(orig, 'move')}>
                    ⠿
                  </span>
                  <span className="plan-resize" aria-label="Drag to change the end time" {...dragHandlers(orig, 'resize')} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button className="btn add-exercise" onClick={() => newEvent(nextFree())}>
        + Add to plan
      </button>

      {unscheduled.length > 0 && (
        <div className="card plan-todos">
          <h3>To-dos to fit in</h3>
          <ul>
            {unscheduled.slice(0, 12).map((t) => (
              <li key={t.id}>
                <span className="grow">{t.title}</span>
                <button
                  className="btn ghost small"
                  onClick={() => newEvent(nextFree(30), { title: t.title, task_id: t.id, end_time: fromMin(nextFree(30) + 30) })}
                >
                  + Schedule
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {events.length > 0 && (
        <div className="card plan-review">
          <h3>End of day</h3>
          <p className="muted small">
            {done} of {events.length} done{missed ? ` · ${missed} didn't happen` : ''}. Tap a block to mark it ✓ or ✕.
          </p>
          <DayNotes
            key={`r-${date}`}
            placeholder="How did today go? What will you do differently tomorrow?"
            value={plan.day.review}
            onSave={(review) => plan.saveDay({ review })}
          />
          {date === today && (
            <button className="link-btn" onClick={() => setDate(addDays(today, 1))}>
              Plan tomorrow ›
            </button>
          )}
        </div>
      )}

      {editing && (
        <EventSheet
          event={editing}
          series={editing.series_id ? plan.seriesById[editing.series_id] : null}
          tasks={tasks}
          onClose={() => setEditing(null)}
          onSave={({ event: ev, repeat, scope }) => {
            if (!ev.series_id) {
              if (repeat) plan.makeRepeating(ev, repeat)
              else plan.save(ev)
            } else if (scope === 'following') plan.saveFollowing(ev, repeat)
            else plan.save(ev)
            if (ev.date !== date) setDate(ev.date)
            setEditing(null)
          }}
          onStatus={(status, el) => {
            setStatus(editing, status, el)
            setEditing(null)
          }}
          onDelete={(scope) => {
            plan.remove(editing, scope)
            setEditing(null)
          }}
          onDuplicate={() => {
            plan.save({
              ...editing,
              id: uuid(),
              virtual: false,
              series_id: null,
              date: addDays(editing.date, 1),
              status: 'planned',
            })
            setEditing(null)
          }}
          onOpenTodo={() => navigate('/todo')}
        />
      )}
    </section>
  )
}

// Day / To-do / This week switcher shared with the To-do page.
export function PlanTabs({ active, onList }) {
  const navigate = useNavigate()
  const go = (list) => {
    if (onList) return onList(list)
    try {
      localStorage.setItem('liahona.todo.list', list)
    } catch {
      /* per-device preference */
    }
    navigate('/todo')
  }
  return (
    <div className="segmented">
      <button className={active === 'day' ? 'on' : ''} onClick={() => navigate('/plan')}>
        Day
      </button>
      <button className={active === 'todo' ? 'on' : ''} onClick={() => go('todo')}>
        To-do
      </button>
      <button className={active === 'week' ? 'on' : ''} onClick={() => go('week')}>
        This week
      </button>
    </div>
  )
}

// A text box that saves when you leave it.
function DayNotes({ label, placeholder, value, onSave }) {
  const [text, setText] = useState(value ?? '')
  const saved = useRef(value ?? '')
  useEffect(() => {
    if ((value ?? '') !== saved.current) {
      saved.current = value ?? ''
      setText(value ?? '')
    }
  }, [value])
  return (
    <label className="day-notes">
      {label && <span className="muted small">{label}</span>}
      <textarea
        rows={2}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== saved.current) {
            saved.current = text
            onSave(text)
          }
        }}
      />
    </label>
  )
}

function EventSheet({ event, series, tasks, onClose, onSave, onStatus, onDelete, onDuplicate }) {
  const [f, setF] = useState(event)
  const [more, setMore] = useState(Boolean(event.location || event.notes || event.backup))
  const repeating = Boolean(event.series_id)
  // Repeat pattern: kind 'none' | 'daily' | 'weekdays' | 'weekly'.
  const weekdayOf = (d) => fromISO(d).getDay()
  const [rep, setRep] = useState(() =>
    series
      ? { kind: repeatKind(series.days), days: series.days, until: series.end_date ?? '' }
      : { kind: 'none', days: [weekdayOf(event.date)], until: '' },
  )
  const [askDelete, setAskDelete] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const startMin = toMin(f.start_time)
  const endMin = toMin(f.end_time)
  const repeatDays = rep.kind === 'daily' ? ALL_DAYS : rep.kind === 'weekdays' ? WEEKDAYS : rep.days
  const valid = f.title.trim() && endMin > startMin && (rep.kind === 'none' || repeatDays.length > 0)
  const task = f.task_id && tasks.tasks?.find((t) => t.id === f.task_id)
  const repeat = rep.kind === 'none' ? null : { days: repeatDays, end_date: rep.until || null }

  function setStart(v) {
    // Keep the same length when the start moves.
    const len = endMin - startMin
    setF((x) => ({ ...x, start_time: v, end_time: fromMin(toMin(v) + (len > 0 ? len : 60)) }))
  }
  const toggleDay = (d) =>
    setRep((r) => ({ ...r, days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d].sort() }))
  const submit = (scope) => valid && onSave({ event: { ...f, title: f.title.trim() }, repeat, scope })

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet plan-sheet" role="dialog" aria-label="Plan" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{event.isNew ? 'Add to plan' : 'Edit plan'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form
          className="plan-form"
          onSubmit={(e) => {
            e.preventDefault()
            submit(repeating ? 'one' : undefined)
          }}
        >
          <input
            className="plan-title"
            placeholder="What are you doing?"
            value={f.title}
            onChange={set('title')}
            autoFocus={event.isNew && !event.title}
          />
          <div className="when-editor">
            <label>
              {rep.kind !== 'none' && !repeating ? 'Starting' : 'Date'}
              <input type="date" value={f.date} onChange={set('date')} disabled={repeating} />
            </label>
            <label>
              Start
              <input type="time" step={900} value={f.start_time.slice(0, 5)} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label>
              End
              <input type="time" step={900} value={f.end_time.slice(0, 5)} onChange={set('end_time')} />
            </label>
          </div>
          {endMin <= startMin && <p className="error small">End time needs to be after the start.</p>}

          <div className="repeat-row">
            <label>
              Repeat
              <select value={rep.kind} onChange={(e) => setRep((r) => ({ ...r, kind: e.target.value }))}>
                <option value="none">Doesn't repeat</option>
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays (Mon–Fri)</option>
                <option value="weekly">On certain days…</option>
              </select>
            </label>
            {rep.kind !== 'none' && (
              <label>
                Until
                <input
                  type="date"
                  value={rep.until}
                  min={f.date}
                  onChange={(e) => setRep((r) => ({ ...r, until: e.target.value }))}
                />
              </label>
            )}
          </div>
          {rep.kind === 'weekly' && (
            <div className="day-chips">
              {DAY_LETTERS.map((l, d) => (
                <button
                  type="button"
                  key={d}
                  className={`day-chip ${rep.days.includes(d) ? 'on' : ''}`}
                  onClick={() => toggleDay(d)}
                  aria-pressed={rep.days.includes(d)}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          {rep.kind !== 'none' && (
            <p className="muted small">
              {describeRepeat({ days: repeatDays, end_date: rep.until })}
              {!rep.until && ' — leave "Until" blank to keep it going, or set the last day (like the end of the semester).'}
            </p>
          )}

          <div className="cat-chips">
            {Object.entries(CATEGORIES).map(([k, c]) => (
              <button
                type="button"
                key={k}
                className={`cat-chip ${f.category === k ? 'on' : ''}`}
                style={{ '--cat': c.color }}
                onClick={() => setF((x) => ({ ...x, category: k }))}
              >
                {c.label}
              </button>
            ))}
          </div>
          {task && <p className="muted small">☐ Linked to-do: {task.title} — checking this off completes it.</p>}
          {more ? (
            <>
              <input placeholder="Where (optional)" value={f.location} onChange={set('location')} />
              <textarea rows={2} placeholder="Notes" value={f.notes} onChange={set('notes')} />
              <textarea
                rows={2}
                placeholder="Backup plan — what you'll do if this falls through"
                value={f.backup}
                onChange={set('backup')}
              />
            </>
          ) : (
            <button type="button" className="link-btn" onClick={() => setMore(true)}>
              + Place, notes, backup plan
            </button>
          )}

          {!event.isNew && (
            <div className="plan-status">
              <button
                type="button"
                className={`btn small ${event.status === 'done' ? 'primary' : 'ghost'}`}
                onClick={(e) => onStatus(event.status === 'done' ? 'planned' : 'done', e.currentTarget)}
              >
                ✓ Done
              </button>
              <button
                type="button"
                className={`btn small ${event.status === 'missed' ? 'danger' : 'ghost'}`}
                onClick={(e) => onStatus(event.status === 'missed' ? 'planned' : 'missed', e.currentTarget)}
              >
                ✕ Didn't happen
              </button>
            </div>
          )}
          {!event.isNew && event.backup && event.status === 'missed' && (
            <p className="muted small">Backup plan: {event.backup}</p>
          )}

          {askDelete ? (
            <div className="form-actions repeat-choice">
              <span className="muted small">Delete…</span>
              <button type="button" className="btn small ghost" onClick={() => onDelete('one')}>
                Just this day
              </button>
              <button type="button" className="btn small danger" onClick={() => onDelete('following')}>
                This & all after
              </button>
              <button type="button" className="link-btn" onClick={() => setAskDelete(false)}>
                Cancel
              </button>
            </div>
          ) : repeating ? (
            <>
              <div className="form-actions">
                <button type="button" className="link-btn danger-link" onClick={() => setAskDelete(true)}>
                  Delete
                </button>
                <span className="grow" />
                <button type="button" className="btn ghost" disabled={!valid} onClick={() => submit('one')}>
                  Save this day
                </button>
                <button type="button" className="btn primary" disabled={!valid} onClick={() => submit('following')}>
                  Save all from here
                </button>
              </div>
              <p className="muted small">
                “This day” changes only {formatShort(event.date)}. “All from here” changes every one from this day on —
                earlier days keep their history.
              </p>
            </>
          ) : (
            <div className="form-actions">
              {!event.isNew && (
                <>
                  <button type="button" className="link-btn danger-link" onClick={() => onDelete('one')}>
                    Delete
                  </button>
                  <button type="button" className="link-btn" onClick={onDuplicate}>
                    Copy to next day
                  </button>
                </>
              )}
              <span className="grow" />
              <button type="submit" className="btn primary" disabled={!valid}>
                Save
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

// Dashboard card: what's next today.
export function TodayPlanPanel() {
  const today = todayISO()
  const plan = usePlan(today, startOfWeek(today))
  const now = nowMin()
  if (plan.error) return null
  const events = plan.events ?? []
  const upcoming = events.filter((e) => toMin(e.end_time) > now && e.status === 'planned')
  const done = events.filter((e) => e.status === 'done').length
  return (
    <article className="card dash-card dash-plan">
      <header className="dash-card-head">
        <h2>Today's plan</h2>
        <Link to="/plan" className="dash-link">
          {events.length ? 'Open' : 'Plan your day'} ›
        </Link>
      </header>
      {!plan.events ? (
        <p className="muted">Loading…</p>
      ) : events.length === 0 ? (
        <p className="muted small">Nothing planned yet. A few minutes of planning makes the day go better.</p>
      ) : (
        <>
          <ul className="plan-mini">
            {(upcoming.length ? upcoming : events).slice(0, 4).map((e) => (
              <li key={e.id} className={`s-${e.status}`} style={{ '--cat': (CATEGORIES[e.category] ?? CATEGORIES.other).color }}>
                <span className="plan-mini-time">{formatTime(e.start_time)}</span>
                <span className="grow">{e.title}</span>
                {toMin(e.start_time) <= now && toMin(e.end_time) > now && <span className="now-pill">Now</span>}
              </li>
            ))}
          </ul>
          <p className="muted small">
            {done} of {events.length} done
          </p>
        </>
      )}
    </article>
  )
}
