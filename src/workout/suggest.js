// Working-weight hint for an exercise, from last session's sets and (if the
// workout came from a routine) its target rep range. A hint, never forced.
import { convertWeight, epley } from './lib'

// "8–12" / "8-12" / "10" -> [lo, hi]
export function parseRange(text) {
  const nums = String(text ?? '')
    .match(/\d+/g)
    ?.map(Number)
  if (!nums?.length) return null
  return [Math.min(...nums), Math.max(...nums)]
}

export function suggestWeight({ previous, targetReps, unit, equipment }) {
  const sets = previous
    .filter((s) => s.set_type !== 'warmup' && s.weight != null && s.reps > 0)
    .map((s) => ({ w: convertWeight(Number(s.weight), s.weight_unit, unit), reps: s.reps }))
  if (!sets.length) return null

  const inc = unit === 'kg' ? (equipment === 'Dumbbell' ? 2 : 2.5) : 5
  const round = (x) => Math.round(x / inc) * inc
  const fmt = (x) => `${Math.round(x * 2) / 2} ${unit}`

  const topW = Math.max(...sets.map((s) => s.w))
  const atTop = sets.filter((s) => Math.abs(s.w - topW) < 0.01)
  const bestReps = Math.max(...atTop.map((s) => s.reps))
  const minReps = Math.min(...atTop.map((s) => s.reps))
  const range = parseRange(targetReps)
  const e1rm = Math.max(...sets.map((s) => epley(s.w, s.reps)))
  // Next loadable weight above last time (e.g. 135 -> 140, 132.3 -> 135).
  const next = Math.ceil((topW + inc / 2) / inc) * inc

  let main
  if (range ? atTop.every((s) => s.reps >= range[1]) : minReps >= 12) {
    main = `You hit ${range ? `${range[1]}+` : minReps} reps on every set at ${fmt(topW)} last time — try ${fmt(next)}.`
  } else if (range && minReps < range[0]) {
    main = `Last time: ${minReps} reps at ${fmt(topW)} (target ${range[0]}–${range[1]}). Stay there and build reps.`
  } else {
    main = `Stay at ${fmt(topW)} and aim for ${bestReps + 1} reps on your best set.`
  }

  const reps = range ? Math.round((range[0] + range[1]) / 2) : bestReps
  const est = round(e1rm / (1 + reps / 30))
  const detail = `Est. 1RM ${Math.round(e1rm)} ${unit} → about ${fmt(est)} for ${reps} reps.`
  return { main, detail }
}
