import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchHabits, fetchAll } from '../lib/habits'
import { attachMetrics, goalProgress, METRICS, PROGRESS_TYPES, TIERS } from '../lib/goals'
import { track } from '../lib/saveStatus'
import GoalProgress from '../components/GoalProgress'

export default function GoalDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [goal, setGoal] = useState(null)
  const [goalTitles, setGoalTitles] = useState({})
  const [habits, setHabits] = useState([])
  const [tasks, setTasks] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [{ data: g, error: e1 }, h, t, { data: all, error: e2 }] = await Promise.all([
        supabase.from('goals').select('*, goal_items(*)').eq('id', id).maybeSingle(),
        fetchHabits(),
        fetchAll(() => supabase.from('tasks').select('*').order('created_at')),
        supabase.from('goals').select('id,title'),
      ])
      if (e1 || e2) throw e1 || e2
      if (!g) return setError('Goal not found.')
      g.goal_items.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      await attachMetrics([g])
      setGoal(g)
      setHabits(h.filter((x) => !x.archived))
      setTasks(t)
      setGoalTitles(Object.fromEntries(all.map((x) => [x.id, x.title])))
    } catch (e) {
      setError(e.message)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function write(query) {
    const { error } = await track(query)
    setError(error ? `Not saved — ${error.message}` : '')
    await load()
    return !error
  }

  // Update goal fields locally right away, then save.
  function saveGoal(fields) {
    setGoal((g) => ({ ...g, ...fields }))
    return write(supabase.from('goals').update(fields).eq('id', id))
  }

  if (!goal) return <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>

  const linkedTasks = tasks.filter((t) => t.goal_id === id)
  const openLinked = linkedTasks.filter((t) => !t.completed_at)
  const doneLinked = linkedTasks.filter((t) => t.completed_at)
  const unlinkedOpen = tasks.filter((t) => !t.completed_at && !t.goal_id)

  return (
    <section className="narrow goal-detail">
      <div className="page-head">
        <Link to="/goals" className="btn ghost small">
          ‹ Goals
        </Link>
        {goal.completed_at && <span className="tag">Achieved</span>}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card form-card">
        <BlurInput
          className="title-input"
          value={goal.title}
          onSave={(title) => title.trim() && saveGoal({ title: title.trim() })}
          aria-label="Goal title"
        />
        <label>
          Why
          <BlurInput textarea rows={2} value={goal.why} onSave={(why) => saveGoal({ why })} />
        </label>
        <Segmented
          label="Horizon"
          options={TIERS.map((t) => [t.id, t.label])}
          value={goal.tier}
          onChange={(tier) => saveGoal({ tier })}
        />
      </div>

      <h2 className="section-title">Progress</h2>
      <div className="card form-card">
        <GoalProgress goal={goal} />
        {goalProgress(goal).reached && !goal.completed_at && (
          <button className="btn primary" onClick={() => saveGoal({ completed_at: new Date().toISOString() })}>
            🎉 Target reached — mark achieved
          </button>
        )}
        <Segmented
          label="Track progress as"
          options={PROGRESS_TYPES.map((t) => [t.id, t.label])}
          value={goal.progress_type}
          onChange={(progress_type) => saveGoal({ progress_type })}
        />
        {goal.progress_type === 'checklist' && <Checklist goal={goal} write={write} />}
        {goal.progress_type === 'percent' && (
          <PercentInput value={goal.percent} onSave={(percent) => saveGoal({ percent })} />
        )}
        {goal.progress_type === 'status' && (
          <label>
            Where things stand
            <BlurInput
              textarea
              rows={2}
              value={goal.status}
              placeholder="e.g. Applied — waiting to hear back"
              onSave={(status) => saveGoal({ status })}
            />
          </label>
        )}
        {goal.progress_type === 'metric' && <MetricEditor goal={goal} onSave={saveGoal} />}
      </div>

      <h2 className="section-title">Habits that build toward this</h2>
      <div className="card">
        {habits.length === 0 ? (
          <p className="muted">No habits yet.</p>
        ) : (
          <ul className="link-list">
            {habits.map((h) => {
              const linked = h.goal_id === id
              const elsewhere = h.goal_id && !linked ? goalTitles[h.goal_id] : null
              return (
                <li key={h.id}>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={linked}
                      onChange={() =>
                        write(supabase.from('habits').update({ goal_id: linked ? null : id }).eq('id', h.id))
                      }
                    />
                    <span className="dot" style={{ background: h.color }} />
                    {h.name}
                    {elsewhere && <span className="muted small">· linked to “{elsewhere}”</span>}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        <p className="muted small">A habit can build toward one goal at a time.</p>
      </div>

      <h2 className="section-title">Tasks</h2>
      <div className="card keep">
        <ul className="keep-list">
          {openLinked.map((t) => (
            <li key={t.id}>
              <button
                className="box"
                onClick={() =>
                  write(supabase.from('tasks').update({ completed_at: new Date().toISOString() }).eq('id', t.id))
                }
                aria-label={`Complete ${t.title}`}
              />
              <span className="keep-title">{t.title}</span>
              <button
                className="icon-btn keep-x"
                title="Unlink from goal"
                onClick={() => write(supabase.from('tasks').update({ goal_id: null }).eq('id', t.id))}
              >
                ×
              </button>
            </li>
          ))}
          <li className="keep-add">
            <QuickAdd
              placeholder="Add a task for this goal"
              onAdd={(title) => write(supabase.from('tasks').insert({ title, goal_id: id }))}
            />
          </li>
        </ul>
        {unlinkedOpen.length > 0 && (
          <select
            className="link-select"
            value=""
            onChange={(e) =>
              e.target.value && write(supabase.from('tasks').update({ goal_id: id }).eq('id', e.target.value))
            }
          >
            <option value="">Link an existing task…</option>
            {unlinkedOpen.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}
        {doneLinked.length > 0 && (
          <ul className="keep-list done">
            {doneLinked.map((t) => (
              <li key={t.id}>
                <span className="box on">✓</span>
                <span className="keep-title">{t.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="danger-zone">
        {goal.completed_at ? (
          <button className="btn ghost" onClick={() => saveGoal({ completed_at: null })}>
            Reopen goal
          </button>
        ) : (
          <button className="btn primary" onClick={() => saveGoal({ completed_at: new Date().toISOString() })}>
            ✓ Mark achieved
          </button>
        )}
        <button
          className="btn ghost danger"
          onClick={async () => {
            if (!window.confirm(`Delete "${goal.title}"? Linked habits and tasks are kept, just unlinked.`)) return
            if (await write(supabase.from('goals').delete().eq('id', id))) navigate('/goals')
          }}
        >
          Delete goal
        </button>
      </div>
    </section>
  )
}

function Checklist({ goal, write }) {
  return (
    <ul className="keep-list">
      {goal.goal_items.map((item) => (
        <li key={item.id}>
          <button
            className={`box ${item.done ? 'on' : ''}`}
            onClick={() => write(supabase.from('goal_items').update({ done: !item.done }).eq('id', item.id))}
            aria-label={item.done ? `Uncheck ${item.text}` : `Check ${item.text}`}
          >
            {item.done ? '✓' : ''}
          </button>
          <span className={`keep-title ${item.done ? 'struck' : ''}`}>{item.text}</span>
          <button
            className="icon-btn keep-x"
            aria-label="Delete step"
            onClick={() => write(supabase.from('goal_items').delete().eq('id', item.id))}
          >
            ×
          </button>
        </li>
      ))}
      <li className="keep-add">
        <QuickAdd
          placeholder="Add a step"
          onAdd={(text) => write(supabase.from('goal_items').insert({ goal_id: goal.id, text }))}
        />
      </li>
    </ul>
  )
}

function QuickAdd({ placeholder, onAdd }) {
  const [value, setValue] = useState('')
  const ref = useRef(null)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const v = value.trim()
        if (!v) return
        if (await onAdd(v)) setValue('')
        ref.current?.focus()
      }}
    >
      <span className="plus" aria-hidden>
        +
      </span>
      <input ref={ref} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
    </form>
  )
}

// Text field that saves when you leave it (or press Enter for single-line).
function BlurInput({ value, onSave, textarea, ...rest }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const props = {
    ...rest,
    value: v,
    onChange: (e) => setV(e.target.value),
    onBlur: () => v !== value && onSave(v),
  }
  return textarea ? (
    <textarea {...props} />
  ) : (
    <input {...props} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  )
}

function PercentInput({ value, onSave }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => v !== value && onSave(v)
  return (
    <div className="percent-input">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label="Percent complete"
      />
      <span className="percent-value">{v}%</span>
    </div>
  )
}

function Segmented({ label, options, value, onChange }) {
  return (
    <fieldset className="seg-field">
      <legend>{label}</legend>
      <div className="segmented">
        {options.map(([v, l]) => (
          <button type="button" key={v} className={value === v ? 'on' : ''} onClick={() => v !== value && onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// "Auto" goals: pick what to track; progress updates from your logged data.
function MetricEditor({ goal, onSave }) {
  const [exercises, setExercises] = useState([])
  useEffect(() => {
    fetchAll(() => supabase.from('exercises').select('id,name,exercise_type,archived').order('name'))
      .then((list) =>
        setExercises(list.filter((e) => !e.archived && ['weight_reps', 'weighted_bodyweight'].includes(e.exercise_type))),
      )
      .catch(() => {})
  }, [])
  const kind = METRICS.find((m) => m.id === goal.metric_kind)
  const unit = goal._unit ?? 'lbs'
  const num = (v) => {
    const n = Number(String(v).replace(',', '.'))
    return String(v).trim() === '' || isNaN(n) ? null : n
  }
  const round1 = (v) => Math.round(v * 10) / 10

  return (
    <div className="metric-editor">
      <label>
        Track
        <select
          className="ex-select"
          value={goal.metric_kind ?? ''}
          onChange={(e) => onSave({ metric_kind: e.target.value || null })}
        >
          <option value="">Choose what to track…</option>
          {METRICS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {kind?.needsExercise && (
        <label>
          Exercise
          <select
            className="ex-select"
            value={goal.metric_exercise_id ?? ''}
            onChange={(e) => onSave({ metric_exercise_id: e.target.value || null })}
          >
            <option value="">Choose an exercise…</option>
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind && (
        <div className="metric-row">
          <label>
            Starting point ({unit})
            <BlurInput
              inputMode="decimal"
              value={goal.metric_start == null ? '' : String(goal.metric_start)}
              onSave={(v) => onSave({ metric_start: num(v) })}
            />
          </label>
          <label>
            Target ({unit})
            <BlurInput
              inputMode="decimal"
              value={goal.metric_target == null ? '' : String(goal.metric_target)}
              onSave={(v) => onSave({ metric_target: num(v) })}
            />
          </label>
        </div>
      )}
      {goal._current != null && (
        <p className="muted small">
          Right now: <strong>{round1(goal._current)} {unit}</strong> — this updates by itself as you log.{' '}
          {goal.metric_start == null && (
            <button className="link-btn" onClick={() => onSave({ metric_start: round1(goal._current) })}>
              Use as starting point
            </button>
          )}
        </p>
      )}
      {kind && goal._current == null && (goal.metric_exercise_id || !kind.needsExercise) && (
        <p className="muted small">No data logged for this yet — progress will appear once you do.</p>
      )}
    </div>
  )
}
