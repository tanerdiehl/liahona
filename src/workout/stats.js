// Workout analytics, all derived from raw sets (nothing stored pre-summarised).
// Warm-up sets are left out of volume, PRs and 1RM so they don't skew trends.
import { addDays, formatShort, fromISO, startOfWeek, weekRange } from '../lib/dates'
import { convertWeight, epley, workoutSeconds } from './lib'

export const GRANULARITIES = [
  ['month', 'Month'],
  ['week', 'Week'],
]

const LOADED = new Set(['weight_reps', 'weighted_bodyweight'])
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' })

export function bucketKey(iso, g) {
  if (g === 'week') return startOfWeek(iso)
  if (g === 'month') return iso.slice(0, 7)
  return iso.slice(0, 4)
}

// Every bucket from first to last, so empty weeks/months show as gaps.
export function bucketRange(firstIso, lastIso, g) {
  if (g === 'week') return weekRange(startOfWeek(firstIso), startOfWeek(lastIso))
  const out = []
  if (g === 'month') {
    let [y, m] = firstIso.slice(0, 7).split('-').map(Number)
    const end = lastIso.slice(0, 7)
    for (;;) {
      const k = `${y}-${String(m).padStart(2, '0')}`
      out.push(k)
      if (k >= end) break
      m === 12 ? ((y += 1), (m = 1)) : (m += 1)
    }
    return out
  }
  for (let y = +firstIso.slice(0, 4); y <= +lastIso.slice(0, 4); y++) out.push(String(y))
  return out
}

export function bucketLabel(key, g) {
  if (g === 'week') return formatShort(key)
  if (g === 'month') return `${monthFmt.format(new Date(+key.slice(0, 4), +key.slice(5) - 1, 1))} ’${key.slice(2, 4)}`
  return key
}

// Bucket boundaries as ISO dates, for filtering.
export function bucketBounds(key, g) {
  if (g === 'week') return [key, addDays(key, 6)]
  if (g === 'month') {
    const d = fromISO(`${key}-01`)
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return [`${key}-01`, `${key}-${String(last.getDate()).padStart(2, '0')}`]
  }
  return [`${key}-01-01`, `${key}-12-31`]
}

// Joins raw rows into sessions with per-set derived numbers in `unit`.
export function buildModel({ workouts, sets, exercises, unit }) {
  const exById = new Map(exercises.map((e) => [e.id, e]))
  const byWorkout = new Map()
  for (const s of sets) {
    const ex = exById.get(s.exercise_id)
    if (!ex) continue
    const w = s.weight == null ? null : convertWeight(Number(s.weight), s.weight_unit, unit)
    const working = s.set_type !== 'warmup'
    const loaded = LOADED.has(ex.exercise_type) && w != null && s.reps > 0
    const row = {
      ...s,
      ex,
      w,
      working,
      volume: working && loaded ? w * s.reps : 0,
      e1rm: working && loaded && ex.exercise_type === 'weight_reps' ? epley(w, s.reps) : 0,
    }
    if (!byWorkout.has(s.workout_id)) byWorkout.set(s.workout_id, [])
    byWorkout.get(s.workout_id).push(row)
  }
  const sessions = workouts
    .filter((w) => w.ended_at)
    .map((w) => {
      const rows = byWorkout.get(w.id) ?? []
      return {
        id: w.id,
        date: w.workout_date,
        name: w.name,
        seconds: workoutSeconds(w),
        sets: rows,
        workingSets: rows.filter((r) => r.working).length,
        volume: rows.reduce((n, r) => n + r.volume, 0),
      }
    })
    .filter((s) => s.sets.length)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return { sessions }
}

// Sessions, working sets and volume per bucket (including empty buckets).
export function timeline(sessions, g, today) {
  if (!sessions.length) return []
  const keys = bucketRange(sessions[0].date, today, g)
  const map = new Map(keys.map((k) => [k, { key: k, sessions: 0, sets: 0, volume: 0, seconds: 0 }]))
  for (const s of sessions) {
    const b = map.get(bucketKey(s.date, g))
    if (!b) continue
    b.sessions++
    b.sets += s.workingSets
    b.volume += s.volume
    b.seconds += s.seconds
  }
  return [...map.values()]
}

// Working sets and volume per muscle group within [from, to].
export function muscleBreakdown(sessions, from, to) {
  const out = new Map()
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue
    for (const r of s.sets) {
      if (!r.working) continue
      const m = r.ex.muscle_group
      const b = out.get(m) ?? { muscle: m, sets: 0, volume: 0 }
      b.sets++
      b.volume += r.volume
      out.set(m, b)
    }
  }
  return [...out.values()].sort((a, b) => b.sets - a.sets || b.volume - a.volume)
}

// One exercise across all sessions: best numbers per session.
export function exerciseHistory(sessions, exerciseId) {
  const out = []
  for (const s of sessions) {
    const rows = s.sets.filter((r) => r.exercise_id === exerciseId && r.working)
    if (!rows.length) continue
    const top = rows.reduce((best, r) => (r.e1rm > best.e1rm || (r.e1rm === best.e1rm && (r.w ?? 0) > (best.w ?? 0)) ? r : best))
    out.push({
      workoutId: s.id,
      date: s.date,
      sets: rows.length,
      maxWeight: Math.max(0, ...rows.map((r) => r.w ?? 0)),
      bestE1rm: Math.max(0, ...rows.map((r) => r.e1rm)),
      bestSetVolume: Math.max(0, ...rows.map((r) => r.volume)),
      volume: rows.reduce((n, r) => n + r.volume, 0),
      maxReps: Math.max(0, ...rows.map((r) => r.reps ?? 0)),
      maxSeconds: Math.max(0, ...rows.map((r) => r.duration_seconds ?? 0)),
      topSet: top,
    })
  }
  return out
}

// Each time a record was beaten (the first session of an exercise sets the
// baseline and isn't counted). Newest first.
export function prEvents(sessions) {
  const best = new Map()
  const events = []
  for (const s of sessions) {
    const perEx = new Map()
    for (const r of s.sets) {
      if (!r.working) continue
      const p = perEx.get(r.exercise_id) ?? { ex: r.ex, weight: 0, e1rm: 0, setVolume: 0, reps: 0 }
      p.weight = Math.max(p.weight, LOADED.has(r.ex.exercise_type) ? r.w ?? 0 : 0)
      p.e1rm = Math.max(p.e1rm, r.e1rm)
      p.setVolume = Math.max(p.setVolume, r.volume)
      p.reps = Math.max(p.reps, r.ex.exercise_type === 'bodyweight_reps' ? r.reps ?? 0 : 0)
      perEx.set(r.exercise_id, p)
    }
    for (const [exId, p] of perEx) {
      const prev = best.get(exId)
      if (prev) {
        const add = (kind, value) => events.push({ date: s.date, workoutId: s.id, ex: p.ex, kind, value })
        if (p.weight > prev.weight + 1e-9) add('Heaviest weight', p.weight)
        if (p.e1rm > prev.e1rm + 1e-9) add('Best est. 1RM', p.e1rm)
        if (p.setVolume > prev.setVolume + 1e-9) add('Best set volume', p.setVolume)
        if (p.reps > prev.reps) add('Most reps', p.reps)
      }
      best.set(exId, {
        weight: Math.max(prev?.weight ?? 0, p.weight),
        e1rm: Math.max(prev?.e1rm ?? 0, p.e1rm),
        setVolume: Math.max(prev?.setVolume ?? 0, p.setVolume),
        reps: Math.max(prev?.reps ?? 0, p.reps),
      })
    }
  }
  return events.reverse()
}

// Exercises you've actually done, most-logged first.
export function exercisesWithHistory(sessions) {
  const counts = new Map()
  for (const s of sessions)
    for (const r of s.sets) if (r.working) counts.set(r.exercise_id, { ex: r.ex, n: (counts.get(r.exercise_id)?.n ?? 0) + 1 })
  return [...counts.values()].sort((a, b) => b.n - a.n).map((c) => ({ ...c.ex, setCount: c.n }))
}
