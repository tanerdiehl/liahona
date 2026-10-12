// Builds a plain-text (Markdown) progress report from all your data, made
// to paste into an AI chat (e.g. Claude) for analysis. Raw numbers, compact
// tables, no styling.
import { supabase } from './supabase'
import { fetchAll, fetchHabits } from './habits'
import { getSettings } from './settings'
import { addDays, startOfWeek, todayISO } from './dates'
import { habitStats } from './stats'
import { fetchGoals, goalProgress } from './goals'
import { buildModel, bucketKey, exerciseHistory, exercisesWithHistory, muscleBreakdown, prEvents } from '../workout/stats'
import { convertWeight, roundWeight } from '../workout/lib'

const r1 = (v) => Math.round(v * 10) / 10
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`)
const table = (head, rows) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')

export async function buildReport() {
  const today = todayISO()
  const [settings, habits, habitLogs, workouts, sets, exercises, body, protein, goals, routines] = await Promise.all([
    getSettings(),
    fetchHabits(),
    fetchAll(() => supabase.from('habit_logs').select('habit_id,date,status').order('date')),
    fetchAll(() => supabase.from('workouts').select('id,workout_date,name,started_at,ended_at').order('id')),
    fetchAll(() =>
      supabase
        .from('workout_sets')
        .select('id,workout_id,exercise_id,weight,weight_unit,reps,duration_seconds,set_type,completed')
        .eq('completed', true)
        .order('id'),
    ),
    fetchAll(() => supabase.from('exercises').select('*').order('id')),
    fetchAll(() => supabase.from('body_logs').select('*').order('log_date')),
    fetchAll(() => supabase.from('protein_entries').select('date,grams').order('date')),
    fetchGoals().catch(() => []),
    fetchAll(() => supabase.from('routines').select('name, routine_exercises(target_sets,target_reps,exercises(name))').order('id')).catch(() => []),
  ])
  const unit = settings.weight_unit
  const trackingStart = settings.tracking_start ?? null
  const out = []

  out.push(`# Personal progress report — generated ${today}`)
  out.push(
    `> Suggested prompt: "This is an export from my personal tracking app (habits, workouts, nutrition, bodyweight, goals). Please analyze my progress: what's improving, what's stalling, any muscle-group imbalances or training gaps, how consistent I've been, and give me 3–5 specific, practical recommendations for the next 4 weeks."`,
  )
  out.push(`Units: weights in ${unit}. Protein target: ${settings.protein_min ?? 119}–${settings.protein_max ?? 167} g/day. Weeks start on Sunday. Warm-up sets are excluded from volume, PRs and estimated 1RM (Epley: weight × (1 + reps/30)).`)

  // ---------- Training ----------
  const { sessions } = buildModel({ workouts, sets, exercises, unit })
  out.push(`\n## Training`)
  if (!sessions.length) out.push('No workouts logged.')
  else {
    const vol = sessions.reduce((n, s) => n + s.volume, 0)
    out.push(
      `- ${sessions.length} workouts from ${sessions[0].date} to ${sessions.at(-1).date}; ${sessions.reduce((n, s) => n + s.workingSets, 0)} working sets; total volume ${Math.round(vol).toLocaleString()} ${unit}; average session ${Math.round(sessions.reduce((n, s) => n + s.seconds, 0) / sessions.length / 60)} min.`,
    )
    const months = new Map()
    for (const s of sessions) {
      const k = s.date.slice(0, 7)
      const m = months.get(k) ?? { n: 0, sets: 0, vol: 0 }
      m.n++
      m.sets += s.workingSets
      m.vol += s.volume
      months.set(k, m)
    }
    out.push(`\n### By month\n` + table(['Month', 'Workouts', 'Working sets', `Volume (${unit})`], [...months].map(([k, m]) => [k, m.n, m.sets, Math.round(m.vol)])))

    const thisWeek = startOfWeek(today)
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i)))
    out.push(
      `\n### Last 8 weeks\n` +
        table(
          ['Week of', 'Workouts', 'Working sets'],
          weeks.map((w) => {
            const ws = sessions.filter((s) => bucketKey(s.date, 'week') === w)
            return [w, ws.length, ws.reduce((n, s) => n + s.workingSets, 0)]
          }),
        ),
    )

    const from28 = addDays(today, -27)
    const mb = muscleBreakdown(sessions, from28, today)
    out.push(
      `\n### Muscle groups, last 28 days (working sets; ÷4 for weekly average)\n` +
        (mb.length ? table(['Muscle', 'Sets', 'Sets/week', `Volume (${unit})`], mb.map((m) => [m.muscle, m.sets, r1(m.sets / 4), Math.round(m.volume)])) : 'None.'),
    )

    const exRows = exercisesWithHistory(sessions)
      .map((ex) => ({ ex, h: exerciseHistory(sessions, ex.id) }))
      .filter(({ h }) => h.length >= 2)
    const fmtTop = (h) => (h.topSet?.w != null ? `${roundWeight(h.topSet.w)}×${h.topSet.reps}` : `${h.maxReps} reps`)
    out.push(
      `\n### Exercises (2+ sessions)\n` +
        table(
          ['Exercise', 'Muscle', 'Sessions', 'First top set', 'Latest top set', `Best est. 1RM (${unit})`, `Heaviest (${unit})`, 'Last 3 sessions'],
          exRows.map(({ ex, h }) => [
            ex.name,
            ex.muscle_group,
            h.length,
            `${fmtTop(h[0])} (${h[0].date})`,
            `${fmtTop(h.at(-1))} (${h.at(-1).date})`,
            Math.max(...h.map((x) => x.bestE1rm)) ? roundWeight(Math.max(...h.map((x) => x.bestE1rm))) : '—',
            Math.max(...h.map((x) => x.maxWeight)) ? roundWeight(Math.max(...h.map((x) => x.maxWeight))) : '—',
            h.slice(-3).map((x) => `${x.date.slice(5)}: ${fmtTop(x)}`).join('; '),
          ]),
        ),
    )

    const prs = prEvents(sessions).filter((e) => e.date >= addDays(today, -60))
    out.push(
      `\n### PRs in the last 60 days\n` +
        (prs.length
          ? prs.map((e) => `- ${e.date} ${e.ex.name}: ${e.kind} ${e.kind === 'Most reps' ? `${e.value} reps` : `${roundWeight(e.value)} ${unit}`}`).join('\n')
          : 'None.'),
    )
  }
  if (routines.length)
    out.push(
      `\n### Saved routines\n` +
        routines
          .map((r) => `- ${r.name}: ${r.routine_exercises.map((x) => `${x.exercises?.name} ${x.target_sets}×${x.target_reps || '?'}`).join(', ')}`)
          .join('\n'),
    )

  // ---------- Body ----------
  const weights = body
    .filter((b) => b.bodyweight != null)
    .map((b) => ({ date: b.log_date, v: convertWeight(Number(b.bodyweight), b.weight_unit, unit) }))
  out.push(`\n## Bodyweight`)
  out.push(
    weights.length
      ? `- First ${r1(weights[0].v)} ${unit} (${weights[0].date}); latest ${r1(weights.at(-1).v)} ${unit} (${weights.at(-1).date}); change ${r1(weights.at(-1).v - weights[0].v)} ${unit} over ${weights.length} entries.`
      : 'No bodyweight logged.',
  )

  // ---------- Protein ----------
  const perDay = {}
  for (const p of protein) if (!trackingStart || p.date >= trackingStart) perDay[p.date] = (perDay[p.date] ?? 0) + Number(p.grams)
  const last30 = Object.entries(perDay).filter(([d]) => d > addDays(today, -30))
  const target = settings.protein_min ?? 119
  out.push(`\n## Protein (last 30 days)`)
  out.push(
    last30.length
      ? `- Logged ${last30.length} of 30 days; average ${Math.round(last30.reduce((n, [, g]) => n + g, 0) / last30.length)} g on logged days; hit ≥${target} g on ${last30.filter(([, g]) => g >= target).length} days.`
      : 'No protein logged in the last 30 days.',
  )

  // ---------- Habits ----------
  const logsBy = new Map()
  for (const l of habitLogs) {
    if (!logsBy.has(l.habit_id)) logsBy.set(l.habit_id, new Map())
    logsBy.get(l.habit_id).set(l.date, l.status)
  }
  const active = habits.filter((h) => !h.archived)
  out.push(`\n## Habits${trackingStart ? ` (tracked since ${trackingStart})` : ''}`)
  out.push(
    active.length
      ? table(
          ['Habit', 'Frequency', 'Window 1', 'Window 2', 'All time', 'Current streak', 'Longest streak'],
          active.map((h) => {
            const s = habitStats(h, logsBy.get(h.id) ?? new Map(), today, trackingStart)
            const [a, b, c] = s.windows
            return [h.name, h.frequency, `${a[0]}: ${pct(a[1]?.pct)}`, `${b[0]}: ${pct(b[1]?.pct)}`, pct(c[1]?.pct), s.currentStreak, s.longest]
          }),
        )
      : 'No habits.',
  )

  // ---------- Goals ----------
  out.push(`\n## Goals`)
  out.push(
    goals.length
      ? goals.map((g) => `- [${g.completed_at ? 'achieved' : g.tier}] ${g.title}: ${goalProgress(g).label}${g.why ? ` — why: ${g.why}` : ''}`).join('\n')
      : 'No goals.',
  )

  return out.join('\n')
}
